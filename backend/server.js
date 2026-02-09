const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const Y = require("yjs");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

// room metadata
const roomLang = new Map();

// ✅ server-authoritative Yjs docs (one per room)
const roomDocs = new Map(); // roomId -> Y.Doc

function getRoomDoc(roomId) {
  if (!roomDocs.has(roomId)) {
    const doc = new Y.Doc();
    doc.getText("codemirror"); // ensure text type exists
    roomDocs.set(roomId, doc);
  }
  return roomDocs.get(roomId);
}

io.on("connection", (socket) => {
  console.log("✅ connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);

    if (!roomLang.has(roomId)) roomLang.set(roomId, "js");
    socket.emit("room-language", { roomId, lang: roomLang.get(roomId) });

    // ✅ send full doc state to the joining client
    const doc = getRoomDoc(roomId);
    const full = Y.encodeStateAsUpdate(doc);     
    socket.emit("y-sync", { update: Array.from(full) });

    io.to(roomId).emit("system", `${name || "Someone"} joined ${roomId}`);
  });

  socket.on("set-room-language", ({ roomId, lang }) => {
    roomLang.set(roomId, lang);
    io.to(roomId).emit("room-language", { roomId, lang });
  });

  
  socket.on("y-update", ({ roomId, update }) => {
    const doc = getRoomDoc(roomId);
    const u8 = new Uint8Array(update);

    
    Y.applyUpdate(doc, u8);

    // broadcast to others
    socket.to(roomId).emit("y-update", { update });
  });

  socket.on("disconnect", () => {
    console.log("❌ disconnected:", socket.id);
  });
});

server.listen(4000, () => console.log("🚀 Server running on http://localhost:4000"));
