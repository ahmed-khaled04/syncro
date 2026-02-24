const express = require("express");
const cors = require("cors");
const { corsOptions } = require("./config/cors");
const createAuthRoutes = require("./routes/auth");
const createRoomRoutes = require("./routes/rooms");
const createFriendsRoutes = require("./routes/friends");

function createApp(pool) {
  const app = express();
  app.use(cors(corsOptions()));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Auth routes
  if (pool) {
    app.use("/api/auth", createAuthRoutes(pool));
    app.use("/api/rooms", createRoomRoutes(pool));
    app.use("/api/friends", createFriendsRoutes(pool));
    app.get("/health", (req, res) => res.json({ ok: true }));
  }

  return app;
}

module.exports = { createApp };
