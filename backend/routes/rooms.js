const express = require("express");
const jwt = require("jsonwebtoken");
const {
  isUserConnectedToRoom,
  getConnectedUsers,
} = require("../rooms/roomConnections");

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

  // Join existing room
  router.post("/:roomId/join", verifyToken, async (req, res) => {
    try {
      const { roomId } = req.params;

      const inviteToken = req.body?.inviteToken || req.query?.invite || null;

      // Check if room exists
      const roomCheck = await pool.query(
        "SELECT lang, owner_id FROM room_settings WHERE room_id = $1",
        [roomId]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const roomLang = roomCheck.rows[0].lang;
      const ownerId = roomCheck.rows[0].owner_id;
      const isOwner = String(ownerId) === String(req.user.id);

      // NEW: Check if owner is online (for non-owners WITHOUT valid invite)
      if (!isOwner && ownerId) {
        const ownerOnline = isUserConnectedToRoom(roomId, ownerId);
        if (!ownerOnline) {
          return res.status(403).json({
            error: "Room owner is not online. You can only join when the owner is inside the room.",
          });
        }
      }
      // Validate invite token first (allows joining even if owner offline)
      let inviteValid = false;

      if (!isOwner && inviteToken) {
        const redeem = await pool.query(
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
          [String(req.user.id), roomId, String(inviteToken)]
        );

        inviteValid = redeem.rowCount > 0;
      }


      // Check if user already has this room in their list
      const existingEntry = await pool.query(
        `SELECT is_owner FROM user_rooms WHERE user_id = $1 AND room_id = $2`,
        [req.user.id, roomId]
      );

      // This ensures consistency between database and API response
      let userIsOwner = isOwner;
      if (existingEntry.rows.length > 0) {
        // If user already in room, preserve their existing ownership status
        userIsOwner = existingEntry.rows[0].is_owner;
      }

      // Insert or update user_rooms
      const result = await pool.query(
        `INSERT INTO user_rooms (user_id, room_id, is_owner, last_visited_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, room_id) DO UPDATE
        SET last_visited_at = NOW()
        RETURNING *`,
        [req.user.id, roomId, userIsOwner]
      );

      res.json({
        room: {
          room_id: roomId,
          is_owner: result.rows[0].is_owner,
          joined_at: result.rows[0].created_at,
          lang: roomLang,
        },
      });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ error: error.message || "Failed to join room" });
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
      const { name, description, lang } = req.body;

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

      // Update room settings
      const updateResult = await pool.query(
        `UPDATE room_settings 
        SET name = COALESCE($1, name), 
            description = $2, 
            lang = COALESCE($3, lang)
        WHERE room_id = $4
        RETURNING room_id, name, description, lang, owner_id`,
        [name?.trim() || null, description?.trim() || null, lang, roomId]
      );

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
      const inviteUrl = `/room/${roomId}?invite=${token}`;

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

      res.json({
        valid: true,
        invite: {
          roomId: invite.room_id,
          expiresAt: invite.expires_at,
          revoked: invite.revoked,
          redeemedAt: invite.redeemed_at,
        },
      });
    } catch (error) {
      console.error("Error validating invite:", error);
      res.status(500).json({ valid: false, error: "Failed to validate invite" });
    }
  });





  return router;
}

module.exports = createRoomRoutes;
