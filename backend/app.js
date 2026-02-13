const express = require("express");
const cors = require("cors");
const { corsOptions } = require("./config/cors");
const createAuthRoutes = require("./routes/auth");
const createRoomRoutes = require("./routes/rooms");

function createApp(pool) {
  const app = express();
  app.use(cors(corsOptions()));
  app.use(express.json());

  // Auth routes
  if (pool) {
    app.use("/api/auth", createAuthRoutes(pool));
    app.use("/api/rooms", createRoomRoutes(pool));
  }

  return app;
}

module.exports = { createApp };
