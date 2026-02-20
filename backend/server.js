// server/src/server.js
require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const { createApp } = require("./app");
const { corsOptions } = require("./config/cors");
const { PORT } = require("./config/env");
const { registerSocketServer } = require("./sockets");

const { createPool, initDb } = require("./persistence/db");
const { createSnapshotRepo } = require("./persistence/snapshotRepo");
const { setSnapshotRepo } = require("./rooms/ydocStore");
const { initRoomStore } = require("./rooms/roomStore");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function extractTokenFromSocket(socket) {
  // Prefer handshake auth (recommended)
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return authToken;

  // Fallback: Authorization header
  const h = socket.handshake?.headers?.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7);
  }

  return null;
}

async function main() {
  // init postgres
  const pool = createPool();
  await initDb(pool);

  const app = createApp(pool);
  const server = http.createServer(app);

  const io = new Server(server, { cors: corsOptions() });

  io.use((socket, next) => {
    try {
      const token = extractTokenFromSocket(socket);
      if (!token) {
        return next(new Error("unauthorized"));
      }

      const payload = jwt.verify(token, JWT_SECRET);

      // IMPORTANT: adapt to your JWT payload fields
      const userId = payload.id ?? payload.userId ?? payload.sub;
      if (!userId) return next(new Error("unauthorized"));

      socket.data.userId = String(userId);
      socket.data.name = payload.name;
      socket.data.email = payload.email;

      return next();
    } catch (e) {
      return next(new Error("unauthorized"));
    }
  });

  registerSocketServer(io, pool);

  // allow roomStore to persist room settings
  initRoomStore(pool);

  setSnapshotRepo(createSnapshotRepo(pool));

  server.listen(PORT, () =>
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  );
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
