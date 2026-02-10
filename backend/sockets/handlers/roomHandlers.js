const Y = require("yjs");
const { getRoomLang, setRoomLang } = require("../../rooms/roomStore");
const {
  getRoomDoc,
  waitRoomReady,
  cancelRoomCleanup,
  scheduleRoomCleanup,
} = require("../../rooms/ydocStore");

function registerRoomHandlers(io, socket) {
  socket.on("join-room", async ({ roomId, name }) => {
    socket.join(roomId);
    socket.to(roomId).emit("awareness-resync");
    cancelRoomCleanup(roomId);

    // ✅ IMPORTANT: ensure snapshot loaded before sending full sync
    await waitRoomReady(roomId);

    socket.emit("room-language", { roomId, lang: getRoomLang(roomId) });

    const doc = getRoomDoc(roomId);
    const full = Y.encodeStateAsUpdate(doc);
    socket.emit("y-sync", { update: Array.from(full) });

    io.to(roomId).emit("system", `${name || "Someone"} joined ${roomId}`);
  });

  socket.on("set-room-language", ({ roomId, lang }) => {
    setRoomLang(roomId, lang);
    io.to(roomId).emit("room-language", { roomId, lang });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;

      setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const size = room ? room.size : 0;
        if (size === 0) scheduleRoomCleanup(roomId);
      }, 0);
    }
  });
}

module.exports = { registerRoomHandlers };
