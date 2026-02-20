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
} = require("../../rooms/ydocStore.js");

const {
  addUserToRoom,
  removeUserFromRoom,
} = require("../../rooms/roomConnections.js");


const {
  setUserCurrentRoom,
  notifyFriendsAboutRoom,
} = require("./friendsHandlers.js");


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

function registerRoomHandlers(io, socket , pool) {
  console.log(`🔌 Registering handlers for socket: ${socket.id}`);

  socket.on("join-room", async ({ roomId, name }) => {
    socket.join(roomId);
    socket.to(roomId).emit("awareness-resync");
    cancelRoomCleanup(roomId);

    const userId = socket.data.userId;
    if (!userId) {
      console.warn("❌ join-room blocked: unauthenticated socket");
      return;
    }
    socket.data.name = name || null;
    socket.data.roomId = roomId; // Track which room user is in

    console.log(`✅ User joined room: userId=${userId}, roomId=${roomId}, name=${name}`);

    if (userId) {
      addUserToRoom(roomId, userId);
    }

    // load persisted room settings into memory cache
    await hydrateRoom(roomId);

    // ensure owner after hydrate (so DB owner is respected)
    const ownerId = String(ensureRoomOwner(roomId, userId));
    let roomName = roomId;
    let isPublic = true;
    try {
      const { rows } = await pool.query(
        `
        SELECT name,
              COALESCE(is_public, true) AS is_public,
              owner_id
        FROM public.room_settings
        WHERE room_id = $1
        LIMIT 1
        `,
        [roomId]
      );
      if (rows[0]) {
        roomName = rows[0].name || roomName;
        isPublic = Boolean(rows[0].is_public);
        ownerId = String(rows[0].owner_id || ownerId);
      }
    } catch (e){
      console.warn("room_settings lookup failed:", e.message);
    }

    const roomInfo = {
      roomId,
      roomName,
      isPublic,
      ownerId,
    };

    setUserCurrentRoom(userId , roomInfo);
    notifyFriendsAboutRoom(io , pool , userId , roomInfo);

    // owner private room (for edit requests)
    if (ownerId && userId && ownerId === userId) {
      socket.join(`owner:${roomId}`);
      console.log(`👑 User ${userId} is owner of room ${roomId}`);
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

  socket.on("leave-room", ({ roomId }) => {
    const userId = socket.data.userId;
    console.log(`\n🚪 LEAVE-ROOM event: roomId=${roomId}, userId=${userId}`);
    
    if (userId) {
      removeUserFromRoom(roomId, userId);
      setUserCurrentRoom(userId, null);
      notifyFriendsAboutRoom(io, pool, userId, null);
    }

    socket.leave(roomId);
    io.to(roomId).emit("system", `${userId || "Someone"} left ${roomId}`);
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
    
    console.log(`🔐 set-room-lock requested:`);
    console.log(`   roomId=${roomId}`);
    console.log(`   userId=${userId} (type: ${typeof userId})`);
    console.log(`   ownerId=${ownerId} (type: ${typeof ownerId})`);
    console.log(`   comparison: ${ownerId} === ${userId} ? ${ownerId === userId}`);
    
    if (!ownerId || ownerId !== userId) {
      console.warn(`❌ Unauthorized lock attempt: userId="${userId}" is not owner="${ownerId}"`);
      return;
    }

    const next = setRoomLocked(roomId, locked);
    console.log(`✅ Room locked: ${next}`);

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
      const doc = getRoomDoc(roomId);
      
      // Get snapshot buffer
      const snapshotBuffer = Y.encodeStateAsUpdate(doc);
      
      // Get file content from files map
      const files = doc.getMap("files");
      const ytext = files.get(fileId);
      const content = ytext ? ytext.toString() : "";
      
      // Create version with proper parameters
      await repo.createVersion({
        roomId,
        fileId,
        kind,
        label,
        createdBy,
        snapshotBuffer,
        content,
      });
      
      socket.emit("snapshot:create:result", { roomId, fileId, ok: true });
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
      const version = await repo.getVersion(roomId, fileId, id);
      if (!version || typeof version.content !== "string") return;

      const doc = getRoomDoc(roomId);

      // update the target file text in ydoc files map
      doc.transact(() => {
        const files = doc.getMap("files");
        let ytext = files.get(fileId);
        if (!ytext) {
          ytext = new Y.Text();
          files.set(fileId, ytext);
        }
        ytext.delete(0, ytext.length);
        ytext.insert(0, version.content);
      }, "snapshot-restore");

      broadcastUpdate(roomId);

      socket.emit("snapshot:restore:result", { roomId, fileId, ok: true });
    } catch (e) {
      console.warn("snapshot:restore failed:", e);
      socket.emit("snapshot:restore:result", { roomId, fileId, ok: false });
    }
  });

  // Handle disconnect - use both "disconnecting" and "disconnect" for reliability
  const handleDisconnect = () => {
    const userId = socket.data.userId;
    const roomId = socket.data.roomId;

    console.log(`\n🔌🔌🔌 DISCONNECT EVENT FIRED 🔌🔌🔌`);
    console.log(`   userId=${userId}, roomId=${roomId}`);
    console.log(`   socket.rooms: ${Array.from(socket.rooms).join(", ")}`);

    if (userId && roomId) {
      // Explicitly remove from the main room
      console.log(`   ❌ Removing user ${userId} from room ${roomId}`);
      removeUserFromRoom(roomId, userId);
    }

    if (userId) {
      setUserCurrentRoom(userId, null);
      notifyFriendsAboutRoom(io, pool, userId, null);
    }

    // Also clean up any other rooms this socket was in
    if (userId) {
      for (const rid of socket.rooms) {
        if (rid === socket.id || rid === roomId) continue;
        console.log(`   ❌ Also removing user ${userId} from room ${rid}`);
        removeUserFromRoom(rid, userId);
      }
    }

    // Schedule cleanup for empty rooms
    for (const rid of socket.rooms) {
      if (rid === socket.id) continue;

      const room = io.sockets.adapter.rooms.get(rid);
      const size = room ? room.size : 0;

      if (size <= 1) {
        console.log(`   ⏰ Scheduling cleanup for room ${rid} (${size} sockets left)`);
        scheduleRoomCleanup(rid);
      }
    }
  };

  socket.on("disconnecting", handleDisconnect);
  socket.on("disconnect", handleDisconnect);

}

module.exports = { registerRoomHandlers };
