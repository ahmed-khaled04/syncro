// server/src/sockets/handlers/roomHandlers.js
const Y = require("yjs");

const {
  hydrateRoom,
  getRoomLang,
  setRoomLang,
  getRoomLocked,
  setRoomLocked,
  getRoomOwner,
  ensureRoomOwner,
  listRoomEditors,
  allowEditor,
  revokeEditor,
  isEditorAllowed,
} = require("../../rooms/roomStore");

const {
  getRoomDoc,
  waitRoomReady,
  cancelRoomCleanup,
  scheduleRoomCleanup,
  getSnapshotRepo,

  createFolder,
  createFile,
  renameNode,
  moveNode,
  deleteNodeRecursive,
  ensureFsDefaults,
} = require("../../rooms/ydocStore");

function isOwner(socket, roomId) {
  const ownerId = getRoomOwner(roomId);
  const userId = socket.data.userId;
  return ownerId && userId && ownerId === userId;
}

function canEdit(socket, roomId) {
  const locked = getRoomLocked(roomId);
  if (!locked) return true;

  const ownerId = getRoomOwner(roomId);
  const userId = socket.data.userId;

  const owner = ownerId && userId && ownerId === userId;
  const allowed = isEditorAllowed(roomId, userId);
  return !!(owner || allowed);
}

function registerRoomHandlers(io, socket) {
  socket.on("join-room", async ({ roomId, name, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("awareness-resync");
    cancelRoomCleanup(roomId);

    socket.data.userId = userId || null;
    socket.data.name = name || null;

    // ✅ NEW: load persisted room settings into memory cache
    await hydrateRoom(roomId);

    // ensure owner after hydrate (so DB owner is respected)
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
    ensureFsDefaults(doc);

    const full = Y.encodeStateAsUpdate(doc);
    socket.emit("y-sync", { update: Array.from(full) });

    io.to(roomId).emit("system", `${name || "Someone"} joined ${roomId}`);
  });

  socket.on("set-room-language", ({ roomId, lang }) => {
    // if not hydrated yet, no big deal; setRoomLang will cache + persist
    setRoomLang(roomId, lang);
    io.to(roomId).emit("room-language", { roomId, lang: getRoomLang(roomId) });
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

  // ✅ Helper: Broadcast Y.Doc update to all clients in room
  const broadcastUpdate = (roomId) => {
    const doc = getRoomDoc(roomId);
    const update = Y.encodeStateAsUpdate(doc);
    io.to(roomId).emit("y-update", { roomId, update: Array.from(update) });
  };

  // -------------------------------
  // ✅ FILE SYSTEM EVENTS
  // -------------------------------
  socket.on("fs:create-folder", ({ roomId, parentId, name }) => {
    if (!canEdit(socket, roomId)) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      createFolder(doc, { parentId: parentId || "root", name: name || "folder" });
    }, "fs");

    broadcastUpdate(roomId);
  });

  socket.on("fs:create-file", ({ roomId, parentId, name, initialContent }) => {
    if (!canEdit(socket, roomId)) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      createFile(doc, {
        parentId: parentId || "root",
        name: name || "file.js",
        initialContent: initialContent || "",
      });
    }, "fs");

    broadcastUpdate(roomId);
  });

  socket.on("fs:rename", ({ roomId, nodeId, name }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || !name) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      renameNode(doc, { nodeId, name });
    }, "fs");

    broadcastUpdate(roomId);
  });

  socket.on("fs:move", ({ roomId, nodeId, parentId }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || !parentId) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      moveNode(doc, { nodeId, parentId });
    }, "fs");

    broadcastUpdate(roomId);
  });

  socket.on("fs:delete", ({ roomId, nodeId }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || nodeId === "root") return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      deleteNodeRecursive(doc, nodeId);
    }, "fs");

    broadcastUpdate(roomId);
  });

  // -------------------------------
  // ✅ SNAPSHOTS PER FILE
  // -------------------------------
  socket.on("snapshots:list", async ({ roomId, fileId, limit = 50 }) => {
    const repo = getSnapshotRepo();
    if (!repo) return socket.emit("snapshots:list:result", { roomId, fileId, items: [] });
    if (!fileId) return socket.emit("snapshots:list:result", { roomId, fileId, items: [] });

    try {
      const items = await repo.listVersions(roomId, fileId, limit);
      socket.emit("snapshots:list:result", { roomId, fileId, items });
    } catch (e) {
      console.warn("snapshots:list failed:", e);
      socket.emit("snapshots:list:result", { roomId, fileId, items: [] });
    }
  });

  socket.on("snapshot:get", async ({ roomId, fileId, id }) => {
    const repo = getSnapshotRepo();
    if (!repo) return;
    if (!fileId) return;

    try {
      const item = await repo.getVersion(roomId, fileId, id);
      socket.emit("snapshot:get:result", { roomId, fileId, item: item || null });
    } catch (e) {
      console.warn("snapshot:get failed:", e);
      socket.emit("snapshot:get:result", { roomId, fileId, item: null });
    }
  });

  socket.on("snapshot:create", async ({ roomId, fileId, kind = "milestone", label = null }) => {
    const repo = getSnapshotRepo();
    if (!repo) return;
    if (!fileId) return;

    // only editors can create snapshots when locked
    if (!canEdit(socket, roomId)) return;

    try {
      const createdBy = socket.data.userId || null;
      const item = await repo.createMilestoneFromRoom(roomId, fileId, {
        label,
        createdBy,
      });
      socket.emit("snapshot:create:result", { roomId, fileId, ok: true, item });
    } catch (e) {
      console.warn("snapshot:create failed:", e);
      socket.emit("snapshot:create:result", { roomId, fileId, ok: false });
    }
  });

  socket.on("snapshot:restore", async ({ roomId, fileId, id }) => {
    const repo = getSnapshotRepo();
    if (!repo) return;
    if (!fileId) return;

    // only owner can restore when locked
    if (getRoomLocked(roomId) && !isOwner(socket, roomId)) return;

    try {
      const content = await repo.getContent(roomId, fileId, id);
      if (typeof content !== "string") return;

      const doc = getRoomDoc(roomId);

      // update the target file text in ydoc fs map
      doc.transact(() => {
        const fsTexts = doc.getMap("fs:texts");
        let ytext = fsTexts.get(fileId);
        if (!ytext) {
          ytext = new Y.Text();
          fsTexts.set(fileId, ytext);
        }
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      }, "snapshot-restore");

      broadcastUpdate(roomId);

      socket.emit("snapshot:restore:result", { roomId, fileId, ok: true });
    } catch (e) {
      console.warn("snapshot:restore failed:", e);
      socket.emit("snapshot:restore:result", { roomId, fileId, ok: false });
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      // schedule cleanup if room empties
      const room = io.sockets.adapter.rooms.get(roomId);
      const size = room ? room.size : 0;
      if (size <= 1) scheduleRoomCleanup(roomId);
    }
  });
}

module.exports = { registerRoomHandlers };
