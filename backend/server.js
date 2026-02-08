const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// allow your React dev server (Vite default is 5173)
app.use(cors({ origin: "http://localhost:5173" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    console.log(`ROOM ${roomId} sockets:`, Array.from(io.sockets.adapter.rooms.get(roomId) || []));
    io.to(roomId).emit("system", `${name || "Someone"} joined ${roomId}`);
  });

  socket.on("ping-room", ({ roomId, text }) => {
    console.log(`📨 ping-room from ${socket.id} -> ${roomId}: ${text}`);
    io.to(roomId).emit("pong-room", { text, from: socket.id });
  });

  socket.on("doc-update", ({ roomId, text }) => {
    console.log("DOC UPDATE from", socket.id, "room", roomId, "len", text.length);
    io.to(roomId).emit("doc-update", text);
  });

  socket.on("disconnect", () => {
    console.log("❌ disconnected:", socket.id);
  });

});

server.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
});
