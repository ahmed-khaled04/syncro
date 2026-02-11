const Y = require("yjs");

const {
  getRoomLang,
  setRoomLang,
  getRoomLocked,
  setRoomLocked,
  getRoomOwner,
  ensureRoomOwner,
  listRoomEditors,
  allowEditor,
  revokeEditor,
} = require("../../rooms/roomStore");

const {
  getRoomDoc,
  waitRoomReady,
  cancelRoomCleanup,
  scheduleRoomCleanup,
} = require("../../rooms/ydocStore");

function registerRoomHandlers(io, socket) {
  socket.on("join-room", async ({ roomId, name, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("awareness-resync");
    cancelRoomCleanup(roomId);

    socket.data.userId = userId || null;
    socket.data.name = name || null;

    const ownerId = ensureRoomOwner(roomId, userId);

    // owner private room (for edit requests)
    if (ownerId && userId && ownerId === userId) {
      socket.join(`owner:${roomId}`);
    }

    await waitRoomReady(roomId);

    socket.emit("room-language", { roomId, lang: getRoomLang(roomId) });

    socket.emit("room-lock", {
      roomId,
      locked: getRoomLocked(roomId),
      ownerId,
    });

    socket.emit("room-editors", {
      roomId,
      editors: listRoomEditors(roomId),
    });

    const doc = getRoomDoc(roomId);
    const full = Y.encodeStateAsUpdate(doc);
    socket.emit("y-sync", { update: Array.from(full) });

    io.to(roomId).emit("system", `${name || "Someone"} joined ${roomId}`);
  });

  socket.on("set-room-language", ({ roomId, lang }) => {
    setRoomLang(roomId, lang);
    io.to(roomId).emit("room-language", { roomId, lang });
  });

  // lock/unlock (owner only)
  socket.on("set-room-lock", ({ roomId, locked }) => {
    const ownerId = getRoomOwner(roomId);
    const userId = socket.data.userId;
    if (!ownerId || ownerId !== userId) return;

    const next = setRoomLocked(roomId, locked);

    io.to(roomId).emit("room-lock", { roomId, locked: next, ownerId });

    // when unlocking we cleared editors in store; broadcast the cleared list
    if (!next) {
      io.to(roomId).emit("room-editors", { roomId, editors: listRoomEditors(roomId) });
    }
  });

  // viewer -> owner: request edit
  socket.on("request-edit", ({ roomId }) => {
    const ownerId = getRoomOwner(roomId);
    const locked = getRoomLocked(roomId);
    if (!ownerId || !locked) return;

    const requesterId = socket.data.userId;
    const requesterName = socket.data.name || "Someone";

    if (requesterId && requesterId === ownerId) return;

    io.to(`owner:${roomId}`).emit("edit-request", {
      roomId,
      requester: { id: requesterId, name: requesterName },
      at: Date.now(),
    });
  });

  // owner -> allow editor
  socket.on("grant-edit", ({ roomId, userId: targetUserId }) => {
    const ownerId = getRoomOwner(roomId);
    const userId = socket.data.userId;
    if (!ownerId || ownerId !== userId) return;

    // only meaningful if locked; but we allow anyway
    allowEditor(roomId, targetUserId);

    io.to(roomId).emit("room-editors", {
      roomId,
      editors: listRoomEditors(roomId),
    });

    // optional: notify the room (or just the target client UI will update)
    io.to(roomId).emit("system", `Edit access granted.`);
  });

  // owner -> revoke editor
  socket.on("revoke-edit", ({ roomId, userId: targetUserId }) => {
    const ownerId = getRoomOwner(roomId);
    const userId = socket.data.userId;
    if (!ownerId || ownerId !== userId) return;

    revokeEditor(roomId, targetUserId);

    io.to(roomId).emit("room-editors", {
      roomId,
      editors: listRoomEditors(roomId),
    });

    io.to(roomId).emit("system", `Edit access revoked.`);
  });

  socket.on("disconnecting", () => {
    for (const rid of socket.rooms) {
      if (rid === socket.id) continue;

      setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(rid);
        const size = room ? room.size : 0;
        if (size === 0) scheduleRoomCleanup(rid);
      }, 0);
    }
  });
}

module.exports = { registerRoomHandlers };
