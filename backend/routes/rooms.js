const express = require("express");
const jwt = require("jsonwebtoken");
const {authMiddleware} = require("../middleware/auth.js");

const {
  isUserConnectedToRoom,
  getConnectedUsers,
  debugDump,
} = require("../rooms/roomConnections");

const {
  listJoinRequests,
  setJoinRequestStatus,
  addEditorToRoom,
  getRoomOwnerId,
} = require("../persistence/friendsRepo");

const crypto = require("crypto");


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}


function makeInviteToken() {
  // 16 bytes => 32 hex chars (good enough, hard to guess)
  return crypto.randomBytes(16).toString("hex");
}

async function assertOwner(pool, roomId, userId) {
  const ownerCheck = await pool.query(
    "SELECT owner_id FROM room_settings WHERE room_id = $1",
    [roomId]
  );

  if (ownerCheck.rows.length === 0) {
    return { ok: false, status: 404, error: "Room not found" };
  }

  const ownerId = ownerCheck.rows[0].owner_id;
  if (String(ownerId) !== String(userId)) {
    return { ok: false, status: 403, error: "Only room owner can do this" };
  }

  return { ok: true };
}

async function validateInvite(pool, roomId, token) {
  if (!token) return null;

  const res = await pool.query(
    `
    SELECT *
    FROM room_invites
    WHERE room_id = $1
      AND token = $2
      AND revoked = FALSE
      AND redeemed_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
    `,
    [roomId, token]
  );

  return res.rowCount ? res.rows[0] : null;
}



//Endpoints
function createRoomRoutes(pool) {

  // Get user's rooms (owned and visited)
  router.get("/my-rooms", verifyToken, async (req, res) => {
    try {
      console.log(`Fetching rooms for user_id: ${req.user.id}`);
      
      const result = await pool.query(
        `SELECT 
          ur.room_id, 
          ur.is_owner, 
          ur.created_at as joined_at,
          ur.last_visited_at,
          rs.name,
          rs.description,
          rs.lang,
          rs.owner_id,
          rs.is_public,
          u.name as owner_name
        FROM user_rooms ur
        LEFT JOIN room_settings rs ON ur.room_id = rs.room_id
        LEFT JOIN users u ON rs.owner_id::INTEGER = u.id
        WHERE ur.user_id = $1
        ORDER BY ur.last_visited_at DESC`,
        [req.user.id]
      );

      console.log(`Found ${result.rows.length} rooms:`, result.rows);
      res.json({ rooms: result.rows });
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ error: error.message || "Failed to fetch rooms" });
    }
  });

  // Create new room (user becomes owner)
  router.post("/", verifyToken, async (req, res) => {
    try {
      const { roomName, description } = req.body;

      if (!roomName || roomName.trim() === "") {
        return res.status(400).json({ error: "Room name is required" });
      }

      // Generate unique room ID
      const roomId = Math.random().toString(36).slice(2, 8);
      console.log(`Creating room: ${roomId}, user_id: ${req.user.id}, owner_id: ${String(req.user.id)}`);

      // Create room_settings entry
      await pool.query(
        `INSERT INTO room_settings (room_id, name, description, lang, locked, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (room_id) DO NOTHING`,
        [roomId, roomName.trim(), description?.trim() || null, "js", false, String(req.user.id)]
      );

      // Create user_rooms entry (owner)
      const insertResult = await pool.query(
        `INSERT INTO user_rooms (user_id, room_id, is_owner)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, room_id) DO NOTHING
        RETURNING *`,
        [req.user.id, roomId, true]
      );

      console.log(`Room ${roomId} created. user_rooms result:`, insertResult.rows);

      res.status(201).json({
        room: {
          room_id: roomId,
          is_owner: true,
          joined_at: new Date().toISOString(),
          lang: "js",
        },
      });
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ error: error.message || "Failed to create room" });
    }
  });


  router.post("/:roomId/join", verifyToken, async (req, res) => {
    console.log("========== JOIN ROOM ==========");
    console.log("time:", new Date().toISOString());
    console.log("roomId param:", req.params.roomId);
    console.log("user:", req.user);
    console.log("headers.content-type:", req.headers["content-type"]);
    console.log("raw query:", req.query);
    console.log("raw body:", req.body);
    console.log("body.inviteToken:", req.body?.inviteToken);
    console.log("query.invite:", req.query?.invite);
    console.log("================================");
    const client = await pool.connect();
    try {
      const { roomId } = req.params;

      const inviteTokenRaw = req.body?.inviteToken || req.query?.invite || null;
      const inviteToken = inviteTokenRaw ? String(inviteTokenRaw) : null;

      // 1) room exists?
      const roomCheck = await client.query(
        "SELECT lang, owner_id, is_public, editors FROM room_settings WHERE room_id = $1",
        [roomId]
      );
      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const roomLang = roomCheck.rows[0].lang;
      const ownerId = roomCheck.rows[0].owner_id;
      const isPublic = roomCheck.rows[0].is_public;
      const editors = roomCheck.rows[0].editors || [];
      const isOwner = String(ownerId) === String(req.user.id);
      
      // Check if user is in the editors whitelist (accepted users)
      const isEditorAllowed = Array.isArray(editors) && 
        editors.some((e) => String(e.id) === String(req.user.id));

      // 2) membership check
      const existingEntry = await client.query(
        `SELECT is_owner FROM user_rooms WHERE user_id = $1 AND room_id = $2`,
        [req.user.id, roomId]
      );
      const alreadyMember = existingEntry.rows.length > 0;

      // 3) OWNER: always allow
      if (!isOwner) {
        const norm = (v) => (v === null || v === undefined ? "" : String(v));

        // 4) Check if owner is online (required for all non-owners)
        const ownerOnline = ownerId
          ? isUserConnectedToRoom(norm(roomId), norm(ownerId))
          : false;
        
        console.log("JOIN owner check:", {
          roomId: norm(roomId),
          ownerId: norm(ownerId),
          ownerOnline,
          isPublic,
          isEditorAllowed,
          inviteProvided: !!inviteToken,
          connectedUsers: getConnectedUsers(norm(roomId)),
        });

        if (!ownerOnline) {
          return res.status(403).json({
            error:
              "Room owner is not online. You can only join when the owner is inside the room.",
          });
        }

        // 5) If room is PRIVATE: require invite OR be in editors whitelist
        // If room is PUBLIC: invite is optional (already online check passed)
        if (!alreadyMember && !isEditorAllowed) {
          // User is not a member and not in editors - need an invite
          if (!isPublic || !inviteToken) {
            // If private, ALWAYS require token. If public, token is optional.
            if (!isPublic && !inviteToken) {
              return res
                .status(401)
                .json({ error: "Invite token is required to join this private room." });
            }
          }

          // If we have an invite token, validate and redeem it
          if (inviteToken) {
            await client.query("BEGIN");

            // Redeem invite atomically: also enforces expiry, revoked, and single-use
            const redeem = await client.query(
              `
              UPDATE room_invites
              SET redeemed_by = $1,
                  redeemed_at = NOW()
              WHERE room_id = $2
                AND token = $3
                AND revoked = FALSE
                AND redeemed_at IS NULL
                AND (expires_at IS NULL OR expires_at > NOW())
              RETURNING token
              `,
              [String(req.user.id), roomId, inviteToken]
            );

            if (redeem.rowCount === 0) {
              await client.query("ROLLBACK");
              return res.status(410).json({
                error: "Invite expired / invalid / already used or revoked",
              });
            }

            await client.query("COMMIT");
          }
        }
        // 6) If alreadyMember or isEditorAllowed: can join without invite
      }

      // 7) Upsert membership / last_visited
      const userIsOwner = alreadyMember ? existingEntry.rows[0].is_owner : isOwner;

      const result = await client.query(
        `
        INSERT INTO user_rooms (user_id, room_id, is_owner, last_visited_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, room_id) DO UPDATE
        SET last_visited_at = NOW()
        RETURNING *
        `,
        [req.user.id, roomId, userIsOwner]
      );

      return res.json({
        room: {
          room_id: roomId,
          is_owner: result.rows[0].is_owner,
          joined_at: result.rows[0].created_at,
          lang: roomLang,
        },
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      console.error("Error joining room:", error);
      return res.status(500).json({ error: error.message || "Failed to join room" });
    } finally {
      client.release();
    }
  });

  // Check if room owner is online
  router.get("/:roomId/availability", async (req, res) => {
    try {
      const { roomId } = req.params;

      // Check if room exists
      const roomCheck = await pool.query(
        "SELECT owner_id, name FROM room_settings WHERE room_id = $1",
        [roomId]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const ownerId = roomCheck.rows[0].owner_id;
      const roomName = roomCheck.rows[0].name;
      const ownerOnline = ownerId ? isUserConnectedToRoom(roomId, ownerId) : false;
      const connectedUsers = getConnectedUsers(roomId);

      res.json({
        roomId,
        roomName,
        ownerOnline,
        connectedUsers: connectedUsers.length,
      });
    } catch (error) {
      console.error("Error checking room availability:", error);
      res.status(500).json({ error: "Failed to check room availability" });
    }
  });

  // Update room settings (owner only)
  router.put("/:roomId", verifyToken, async (req, res) => {
    try {
      const { roomId } = req.params;
      const { name, description, lang, is_public } = req.body;

      // Check if user is owner
      const ownerCheck = await pool.query(
        "SELECT owner_id FROM room_settings WHERE room_id = $1",
        [roomId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (String(ownerCheck.rows[0].owner_id) !== String(req.user.id)) {
        return res.status(403).json({ error: "Only room owner can update settings" });
      }

      // Build dynamic update query
      let updates = [];
      let values = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount}`);
        values.push(name?.trim() || null);
        paramCount++;
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount}`);
        values.push(description?.trim() || null);
        paramCount++;
      }

      if (lang !== undefined) {
        updates.push(`lang = $${paramCount}`);
        values.push(lang);
        paramCount++;
      }

      if (is_public !== undefined) {
        updates.push(`is_public = $${paramCount}`);
        values.push(Boolean(is_public));
        paramCount++;
      }

      if (updates.length === 0) {
        return res.json({
          message: "No changes",
          room: ownerCheck.rows[0],
        });
      }

      values.push(roomId);
      const updateSQL = `UPDATE room_settings SET ${updates.join(", ")} WHERE room_id = $${paramCount} RETURNING room_id, name, description, lang, owner_id, is_public`;

      const updateResult = await pool.query(updateSQL, values);

      res.json({
        message: "Room settings updated",
        room: updateResult.rows[0],
      });
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ error: error.message || "Failed to update room" });
    }
  });

  // Delete room (owner only)
  router.delete("/:roomId", verifyToken, async (req, res) => {
    try {
      const { roomId } = req.params;

      // Check if user is owner
      const ownerCheck = await pool.query(
        "SELECT owner_id FROM room_settings WHERE room_id = $1",
        [roomId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (String(ownerCheck.rows[0].owner_id) !== String(req.user.id)) {
        return res.status(403).json({ error: "Only room owner can delete" });
      }

      // Delete room and all related data
      await pool.query("DELETE FROM user_rooms WHERE room_id = $1", [roomId]);
      await pool.query("DELETE FROM room_settings WHERE room_id = $1", [roomId]);

      res.json({ message: "Room deleted" });
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  router.post("/:roomId/invites", verifyToken, async (req, res) => {
    try {
      const { roomId } = req.params;
      const { expiresInMinutes, singleUse = true } = req.body || {};

      const owner = await assertOwner(pool, roomId, req.user.id);
      if (!owner.ok) return res.status(owner.status).json({ error: owner.error });

      const token = makeInviteToken();

      const expiresAt =
        typeof expiresInMinutes === "number" && expiresInMinutes > 0
          ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
          : null;

      await pool.query(
        `
        INSERT INTO room_invites (room_id, token, created_by, expires_at, revoked)
        VALUES ($1, $2, $3, $4, FALSE)
        `,
        [roomId, token, String(req.user.id), expiresAt]
      );

      // You can build a full URL on frontend; here we return the path.
      const inviteUrl = `/invite/${roomId}/${token}`;

      res.status(201).json({
        invite: {
          roomId,
          token,
          inviteUrl,
          expiresAt,
          // singleUse is enforced in join route below (see comment)
          singleUse: !!singleUse,
        },
      });
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: error.message || "Failed to create invite" });
    }
  });

  router.get("/:roomId/invites", verifyToken, async (req, res) => {
    try {
      const { roomId } = req.params;

      const owner = await assertOwner(pool, roomId, req.user.id);
      if (!owner.ok) return res.status(owner.status).json({ error: owner.error });

      const result = await pool.query(
        `
        SELECT id, room_id, token, created_by, expires_at, revoked, created_at, redeemed_by, redeemed_at
        FROM room_invites
        WHERE room_id = $1
        ORDER BY created_at DESC
        `,
        [roomId]
      );

      res.json({ invites: result.rows });
    } catch (error) {
      console.error("Error listing invites:", error);
      res.status(500).json({ error: error.message || "Failed to list invites" });
    }
  });

  router.post("/invites/:token/revoke", verifyToken, async (req, res) => {
    try {
      const { token } = req.params;

      // Need roomId to check owner, so fetch invite first
      const inv = await pool.query(
        "SELECT room_id FROM room_invites WHERE token = $1",
        [token]
      );

      if (inv.rows.length === 0) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const roomId = inv.rows[0].room_id;

      const owner = await assertOwner(pool, roomId, req.user.id);
      if (!owner.ok) return res.status(owner.status).json({ error: owner.error });

      await pool.query(
        "UPDATE room_invites SET revoked = TRUE WHERE token = $1",
        [token]
      );

      res.json({ message: "Invite revoked" });
    } catch (error) {
      console.error("Error revoking invite:", error);
      res.status(500).json({ error: error.message || "Failed to revoke invite" });
    }
  });

  router.get("/invites/validate", async (req, res) => {
    try {
      const { roomId, token } = req.query;

      if (!roomId || !token) {
        return res.status(400).json({ valid: false, error: "roomId and token are required" });
      }

      const invite = await validateInvite(pool, String(roomId), String(token));
      if (!invite) return res.json({ valid: false });

      // Also fetch room details for the invite preview
      const roomResult = await pool.query(
        "SELECT name, description, lang FROM room_settings WHERE room_id = $1",
        [roomId]
      );
      const roomSettings = roomResult.rows[0] || {};

      res.json({
        valid: true,
        invite: {
          roomId: invite.room_id,
          expiresAt: invite.expires_at,
          revoked: invite.revoked,
          redeemedAt: invite.redeemed_at,
          roomName: roomSettings.name,
          description: roomSettings.description,
          lang: roomSettings.lang,
        },
      });
    } catch (error) {
      console.error("Error validating invite:", error);
      res.status(500).json({ valid: false, error: "Failed to validate invite" });
    }
  });

  // Check join request status for current user
  router.get("/:roomId/join-request-status", verifyToken, async (req, res) => {
    const { roomId } = req.params;

    try {
      // Check if user is in editors (accepted)
      const roomCheck = await pool.query(
        "SELECT editors FROM room_settings WHERE room_id = $1",
        [roomId]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const editors = roomCheck.rows[0].editors || [];
      const isEditorAllowed = Array.isArray(editors) && 
        editors.some((e) => String(e.id) === String(req.user.id));

      if (isEditorAllowed) {
        return res.json({ status: "accepted" });
      }

      // Check if there's a pending/declined request
      const requestCheck = await pool.query(
        `SELECT status FROM public.room_join_requests 
        WHERE room_id = $1 AND requester_id = $2
        LIMIT 1`,
        [roomId, req.user.id]
      );

      if (requestCheck.rows.length > 0) {
        const status = requestCheck.rows[0].status;
        return res.json({ status });
      }

      // No request or editor access
      res.json({ status: null });
    } catch (e) {
      console.error("check join-request-status error:", e);
      res.status(500).json({ error: "Failed to check join request status" });
    }
  });

  // Owner-only: list pending join requests
  router.get("/:roomId/join-requests", verifyToken, async (req, res) => {
    const { roomId } = req.params;

    try {
      const ownerId = await getRoomOwnerId(pool, roomId);
      if (!ownerId || String(ownerId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Only the owner can view join requests" });
      }

      const requests = await listJoinRequests(pool, roomId);
      res.json({ requests });
    } catch (e) {
      console.error("list join-requests error:", e);
      res.status(500).json({ error: "Failed to load join requests" });
    }
  });

  // Owner-only: accept request => mark accepted + add to editors allowlist
  router.post("/:roomId/join-requests/:requesterId/accept", verifyToken, async (req, res) => {
    const { roomId, requesterId } = req.params;
    const rid = parseInt(requesterId, 10);
    if (Number.isNaN(rid)) return res.status(400).json({ error: "Invalid requesterId" });

    try {
      const ownerId = await getRoomOwnerId(pool, roomId);
      if (!ownerId || String(ownerId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Only the owner can accept" });
      }

      // get requester details
      const { rows } = await pool.query(
        `SELECT id, name, email FROM public.users WHERE id = $1 LIMIT 1`,
        [rid]
      );
      const u = rows[0];
      if (!u) return res.status(404).json({ error: "Requester not found" });

      // Get room name for notification
      const roomRes = await pool.query(
        `SELECT name FROM room_settings WHERE room_id = $1 LIMIT 1`,
        [roomId]
      );
      const roomName = roomRes.rows[0]?.name || roomId;

      console.log(`✅ Accepting join request: user ${u.id} (${u.name}) → room ${roomId}`);

      await setJoinRequestStatus(pool, roomId, rid, "accepted");
      await addEditorToRoom(pool, roomId, u);

      console.log(`✅ User ${u.id} is now added to editors and user_rooms for room ${roomId}`);

      // Emit socket event to notify the requester
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${rid}`).emit("join-request:accepted", {
          roomId,
          roomName,
          userId: rid,
        });
      }

      res.json({ ok: true, user: u });
    } catch (e) {
      console.error("accept join-request error:", e);
      res.status(500).json({ error: "Failed to accept request" });
    }
  });


  // Owner-only: decline request
  router.post("/:roomId/join-requests/:requesterId/decline", verifyToken, async (req, res) => {
    const { roomId, requesterId } = req.params;
    const rid = parseInt(requesterId, 10);
    if (Number.isNaN(rid)) return res.status(400).json({ error: "Invalid requesterId" });

    try {
      const ownerId = await getRoomOwnerId(pool, roomId);
      if (!ownerId || String(ownerId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Only the owner can decline" });
      }

      // Get room name for notification
      const roomRes = await pool.query(
        `SELECT name FROM room_settings WHERE room_id = $1 LIMIT 1`,
        [roomId]
      );
      const roomName = roomRes.rows[0]?.name || roomId;

      console.log(`❌ Declining join request: user ${rid} → room ${roomId}`);
      await setJoinRequestStatus(pool, roomId, rid, "declined");
      console.log(`❌ Join request declined for user ${rid} in room ${roomId}`);

      // Emit socket event to notify the requester
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${rid}`).emit("join-request:declined", {
          roomId,
          roomName,
          userId: rid,
        });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("decline join-request error:", e);
      res.status(500).json({ error: "Failed to decline request" });
    }
  });

  // DEBUG: Check current state of room connections
  router.get("/debug/connections", (req, res) => {
    const state = debugDump();
    console.log("🔍 DEBUG: Current room connections state:", state);
    res.json(state);
  });


  return router;
}

module.exports = createRoomRoutes;

