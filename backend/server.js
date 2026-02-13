// server/src/server.js
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const { createApp } = require("./app");
const { corsOptions } = require("./config/cors");
const { PORT } = require("./config/env");
const { registerSocketServer } = require("./sockets");

const { createPool, initDb } = require("./persistence/db");
const { createSnapshotRepo } = require("./persistence/snapshotRepo");
const { setSnapshotRepo } = require("./rooms/ydocStore");

const { initRoomStore } = require("./rooms/roomStore");

async function main() {
  // init postgres
  const pool = createPool();
  await initDb(pool);

  const app = createApp(pool);
  const server = http.createServer(app);

  const io = new Server(server, { cors: corsOptions() });
  registerSocketServer(io);

  //allow roomStore to persist room settings
  initRoomStore(pool);

  setSnapshotRepo(createSnapshotRepo(pool));

  server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
