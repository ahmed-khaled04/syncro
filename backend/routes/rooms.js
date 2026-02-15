const express = require("express");
const jwt = require("jsonwebtoken");

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
      const { roomName } = req.body;

      if (!roomName || roomName.trim() === "") {
        return res.status(400).json({ error: "Room name is required" });
      }

      // Generate unique room ID
      const roomId = Math.random().toString(36).slice(2, 8);
      console.log(`Creating room: ${roomId}, user_id: ${req.user.id}, owner_id: ${String(req.user.id)}`);

      // Create room_settings entry
      await pool.query(
        `INSERT INTO room_settings (room_id, lang, locked, owner_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (room_id) DO NOTHING`,
        [roomId, "js", false, String(req.user.id)]
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

      // Check if room exists
      const roomCheck = await pool.query("SELECT lang FROM room_settings WHERE room_id = $1", [
        roomId,
      ]);

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      const roomLang = roomCheck.rows[0].lang;

      // Check if user already has this room in their list
      const existingEntry = await pool.query(
        `SELECT is_owner FROM user_rooms WHERE user_id = $1 AND room_id = $2`,
        [req.user.id, roomId]
      );

      let isOwner = false;
      if (existingEntry.rows.length > 0) {
        // Preserve existing is_owner status
        isOwner = existingEntry.rows[0].is_owner;
      }

      // Insert or update user_rooms
      const result = await pool.query(
        `INSERT INTO user_rooms (user_id, room_id, is_owner, last_visited_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, room_id) DO UPDATE
        SET last_visited_at = NOW()
        RETURNING *`,
        [req.user.id, roomId, isOwner]
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

  return router;
}

module.exports = createRoomRoutes;
