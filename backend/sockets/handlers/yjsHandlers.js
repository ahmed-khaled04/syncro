const Y = require("yjs");
const { getRoomDoc } = require("../../rooms/ydocStore");
const { getRoomLocked, getRoomOwner, isEditorAllowed } = require("../../rooms/roomStore");

function registerYjsHandlers(io, socket) {
  socket.on("y-update", ({ roomId, update }) => {
    const locked = getRoomLocked(roomId);

    if (locked) {
      const ownerId = getRoomOwner(roomId);
      const userId = socket.data.userId;

      const isOwner = ownerId && userId && ownerId === userId;
      const allowed = isEditorAllowed(roomId, userId);

      if (!isOwner && !allowed) return; // ✅ server-enforced
    }

    const doc = getRoomDoc(roomId);
    const u8 = new Uint8Array(update);

    Y.applyUpdate(doc, u8);

    socket.to(roomId).emit("y-update", { update });
  });

  socket.on("awareness-update", ({ roomId, update }) => {
    socket.to(roomId).emit("awareness-update", { update });
  });
}

module.exports = { registerYjsHandlers };
