const Y = require("yjs");
const { getRoomDoc } = require("../../rooms/ydocStore");

function registerYjsHandlers(io, socket) {
  socket.on("y-update", ({ roomId, update }) => {
    const doc = getRoomDoc(roomId);
    const u8 = new Uint8Array(update);

    Y.applyUpdate(doc, u8);

    // broadcast to others
    socket.to(roomId).emit("y-update", { update });
  });
}

module.exports = { registerYjsHandlers };
