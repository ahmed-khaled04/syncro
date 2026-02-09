require("dotenv").config();


const http = require("http");
const { Server } = require("socket.io");
const { createApp } = require("./app");
const { corsOptions } = require("./config/cors");
const { PORT } = require("./config/env");
const { registerSocketServer } = require("./sockets");

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, { cors: corsOptions() });
registerSocketServer(io);

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
