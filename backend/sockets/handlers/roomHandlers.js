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
    
    // ✅ Broadcast the change to all clients
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
    
    // ✅ Broadcast the change to all clients
    broadcastUpdate(roomId);
  });

  socket.on("fs:rename", ({ roomId, nodeId, name }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || !name) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      renameNode(doc, { nodeId, name });
    }, "fs");
    
    // ✅ Broadcast the change to all clients
    broadcastUpdate(roomId);
  });

  socket.on("fs:move", ({ roomId, nodeId, parentId }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || !parentId) return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      moveNode(doc, { nodeId, parentId });
    }, "fs");
    
    // ✅ Broadcast the change to all clients
    broadcastUpdate(roomId);
  });

  socket.on("fs:delete", ({ roomId, nodeId }) => {
    if (!canEdit(socket, roomId)) return;
    if (!nodeId || nodeId === "root") return;

    const doc = getRoomDoc(roomId);
    doc.transact(() => {
      deleteNodeRecursive(doc, nodeId);
    }, "fs");
    
    // ✅ Broadcast the change to all clients
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
      const row = await repo.getVersion(roomId, fileId, Number(id));
      if (!row) return;

      socket.emit("snapshot:get:result", {
        roomId,
        fileId,
        snapshot: {
          id: row.id,
          kind: row.kind,
          label: row.label,
          created_by: row.created_by,
          created_at: row.created_at,
          content: row.content,
        },
      });
    } catch (e) {
      console.warn("snapshot:get failed:", e);
    }
  });

  // milestone snapshot (owner only)
  socket.on("snapshot:create", async ({ roomId, fileId, label }) => {
    if (!isOwner(socket, roomId)) return;
    if (!fileId) return;

    const repo = getSnapshotRepo();
    if (!repo) return;

    try {
      const doc = getRoomDoc(roomId);
      const files = doc.getMap("files");
      const ytext = files.get(fileId);
      if (!ytext) return;

      const content = ytext.toString();
      const update = Y.encodeStateAsUpdate(doc);

      await repo.createVersion({
        roomId,
        fileId,
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

  // restore snapshot (owner only)
  socket.on("snapshot:restore", async ({ roomId, fileId, id }) => {
    if (!isOwner(socket, roomId)) return;
    if (!fileId) return;

    const repo = getSnapshotRepo();
    if (!repo) return;

    try {
      const row = await repo.getVersion(roomId, fileId, Number(id));
      if (!row) return;

      const doc = getRoomDoc(roomId);
      const files = doc.getMap("files");
      const ytext = files.get(fileId);
      if (!ytext) return;

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
