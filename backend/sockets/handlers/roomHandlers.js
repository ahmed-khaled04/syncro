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
  getSnapshotRepo,
} = require("../../rooms/ydocStore");

function isOwner(socket, roomId) {
  const ownerId = getRoomOwner(roomId);
  const userId = socket.data.userId;
  return ownerId && userId && ownerId === userId;
}

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
      io.to(roomId).emit("room-editors", {
        roomId,
        editors: listRoomEditors(roomId),
      });
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

    allowEditor(roomId, targetUserId);

    io.to(roomId).emit("room-editors", {
      roomId,
      editors: listRoomEditors(roomId),
    });

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

  // -------------------------------
  // ✅ SNAPSHOTS / VERSION HISTORY
  // -------------------------------

  // list versions
  socket.on("snapshots:list", async ({ roomId, limit = 50 }) => {
    const repo = getSnapshotRepo();
    if (!repo) {
      return socket.emit("snapshots:list:result", { roomId, items: [] });
    }

    try {
      const items = await repo.listVersions(roomId, limit);
      socket.emit("snapshots:list:result", { roomId, items });
    } catch (e) {
      console.warn("snapshots:list failed:", e);
      socket.emit("snapshots:list:result", { roomId, items: [] });
    }
  });

  // get one snapshot (for diff preview)
  socket.on("snapshot:get", async ({ roomId, id }) => {
    const repo = getSnapshotRepo();
    if (!repo) return;

    try {
      const row = await repo.getVersion(roomId, Number(id));
      if (!row) return;

      socket.emit("snapshot:get:result", {
        roomId,
        snapshot: {
          id: row.id,
          kind: row.kind,
          label: row.label,
          created_by: row.created_by,
          created_at: row.created_at,
          content: row.content, // BEFORE content
        },
      });
    } catch (e) {
      console.warn("snapshot:get failed:", e);
    }
  });

  // create milestone snapshot (owner-only)
  socket.on("snapshot:create", async ({ roomId, label }) => {
    if (!isOwner(socket, roomId)) return;

    const repo = getSnapshotRepo();
    if (!repo) return;

    try {
      const doc = getRoomDoc(roomId);
      const ytext = doc.getText("codemirror");
      const content = ytext.toString();
      const update = Y.encodeStateAsUpdate(doc);

      await repo.createVersion({
        roomId,
        kind: "milestone",
        label: label || "Milestone",
        createdBy: socket.data.userId || null,
        snapshotBuffer: Buffer.from(update),
        content,
      });

      io.to(roomId).emit("system", `📌 Milestone snapshot created.`);
    } catch (e) {
      console.warn("snapshot:create failed:", e);
    }
  });

  // restore snapshot (owner-only)
  socket.on("snapshot:restore", async ({ roomId, id }) => {
    if (!isOwner(socket, roomId)) return;

    const repo = getSnapshotRepo();
    if (!repo) return;

    try {
      const row = await repo.getVersion(roomId, Number(id));
      if (!row) return;

      const doc = getRoomDoc(roomId);
      const ytext = doc.getText("codemirror");

      // Replace whole text (best for "restore")
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, row.content);
      }, "restore");

      // Broadcast full sync so everyone converges quickly
      const full = Y.encodeStateAsUpdate(doc);
      io.to(roomId).emit("y-sync", { update: Array.from(full) });

      io.to(roomId).emit("system", `⏪ Snapshot restored by owner.`);
    } catch (e) {
      console.warn("snapshot:restore failed:", e);
    }
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
