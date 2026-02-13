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
      const result = await pool.query(
        `SELECT 
          ur.room_id, 
          ur.is_owner, 
          ur.created_at as joined_at,
          ur.last_visited_at,
          rs.lang,
          u.name as owner_name
        FROM user_rooms ur
        LEFT JOIN room_settings rs ON ur.room_id = rs.room_id
        LEFT JOIN users u ON rs.owner_id = u.id::TEXT
        WHERE ur.user_id = $1
        ORDER BY ur.last_visited_at DESC`,
        [req.user.id]
      );

      res.json({ rooms: result.rows });
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ error: "Failed to fetch rooms" });
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

      // Create room_settings entry
      await pool.query(
        `INSERT INTO room_settings (room_id, lang, locked, owner_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING`,
        [roomId, "js", false, req.user.id]
      );

      // Create user_rooms entry (owner)
      await pool.query(
        `INSERT INTO user_rooms (user_id, room_id, is_owner)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING`,
        [req.user.id, roomId, true]
      );

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
      res.status(500).json({ error: "Failed to create room" });
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

      // Insert or update user_rooms
      const result = await pool.query(
        `INSERT INTO user_rooms (user_id, room_id, is_owner, last_visited_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, room_id) DO UPDATE
        SET last_visited_at = NOW()
        RETURNING *`,
        [req.user.id, roomId, false]
      );

      res.json({
        room: {
          room_id: roomId,
          is_owner: false,
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

      if (ownerCheck.rows[0].owner_id !== req.user.id) {
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
