const Y = require("yjs");
const { getRoomLang, setRoomLang } = require("../../rooms/roomStore");
const {
  getRoomDoc,
  cancelRoomCleanup,
  scheduleRoomCleanup,
} = require("../../rooms/ydocStore");

function registerRoomHandlers(io, socket) {
  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);

    // if room was empty and scheduled for cleanup, cancel it
    cancelRoomCleanup(roomId);

    // language sync
    socket.emit("room-language", { roomId, lang: getRoomLang(roomId) });

    // full yjs sync
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
      if (roomId === socket.id) continue; // ignore private room

      // wait for socket to actually leave, then check room size
      setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const size = room ? room.size : 0;

        if (size === 0) {
          scheduleRoomCleanup(roomId); // default 10 minutes
          console.log(`⏳ Scheduled cleanup for empty room: ${roomId}`);
        }
      }, 0);
    }
  });
}

module.exports = { registerRoomHandlers };
