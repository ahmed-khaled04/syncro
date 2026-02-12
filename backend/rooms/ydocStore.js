const Y = require("yjs");
const crypto = require("crypto");

const roomDocs = new Map();      // roomId -> Y.Doc
const roomReady = new Map();     // roomId -> Promise<void>
const cleanupTimers = new Map(); // roomId -> Timeout
const saveTimers = new Map();    // roomId -> Timeout

// auto versioning
const versionTimers = new Map();      // roomId -> Timeout
const lastVersionContent = new Map(); // `${roomId}:${fileId}` -> string

let snapshotRepo = null;
function setSnapshotRepo(repo) {
  snapshotRepo = repo;
}
function getSnapshotRepo() {
  return snapshotRepo;
}

function getDebounceMs() {
  const v = Number(process.env.SNAPSHOT_DEBOUNCE_MS);
  return Number.isFinite(v) ? v : 1000;
}

function getIntervalMs() {
  const v = Number(process.env.SNAPSHOT_INTERVAL_MS);
  return Number.isFinite(v) ? v : 5 * 60 * 1000; // 5 min
}

/* ---------------------------
   FILE SYSTEM (Yjs structure)
   ---------------------------
   doc.getMap("fs:nodes") : nodeId -> Y.Map({ id,type,name,parentId,fileId,createdAt })
   doc.getMap("files")    : fileId -> Y.Text
*/
function ensureFsDefaults(doc) {
  const nodes = doc.getMap("fs:nodes");
  const files = doc.getMap("files");

  // root folder
  if (!nodes.has("root")) {
    const root = new Y.Map();
    root.set("id", "root");
    root.set("type", "folder");
    root.set("name", "root");
    root.set("parentId", null);
    root.set("createdAt", Date.now());
    nodes.set("root", root);
  }

  // default file: main.js
  if (!nodes.has("node:main")) {
    const fileId = "main";
    if (!files.has(fileId)) {
      const t = new Y.Text();
      t.insert(0, "// Welcome to Syncro 👋\n\nconsole.log('main.js');\n");
      files.set(fileId, t);
    }

    const n = new Y.Map();
    n.set("id", "node:main");
    n.set("type", "file");
    n.set("name", "main.js");
    n.set("parentId", "root");
    n.set("fileId", fileId);
    n.set("createdAt", Date.now());
    nodes.set("node:main", n);
  }
}

function getAllFileIds(doc) {
  const files = doc.getMap("files");
  return Array.from(files.keys());
}

function startVersionTimer(roomId, doc) {
  if (!snapshotRepo) return;
  if (versionTimers.has(roomId)) return;

  const tick = async () => {
    try {
      // iterate all files, only version if content changed
      const files = doc.getMap("files");
      for (const fileId of files.keys()) {
        const ytext = files.get(fileId);
        if (!ytext || typeof ytext.toString !== "function") continue;

        const content = ytext.toString();
        const key = `${roomId}:${fileId}`;
        const prev = lastVersionContent.get(key);

        if (prev !== content) {
          const update = Y.encodeStateAsUpdate(doc);

          await snapshotRepo.createVersion({
            roomId,
            fileId,
            kind: "auto",
            label: null,
            createdBy: null,
            snapshotBuffer: Buffer.from(update),
            content,
          });

          lastVersionContent.set(key, content);
        }
      }
    } catch (e) {
      console.warn(`⚠️ Auto version snapshot failed for ${roomId}:`, e);
    } finally {
      versionTimers.set(roomId, setTimeout(tick, getIntervalMs()));
    }
  };

  versionTimers.set(roomId, setTimeout(tick, getIntervalMs()));
}

function stopVersionTimer(roomId) {
  const t = versionTimers.get(roomId);
  if (t) clearTimeout(t);
  versionTimers.delete(roomId);

  // cleanup lastVersionContent keys for that room
  for (const k of lastVersionContent.keys()) {
    if (k.startsWith(`${roomId}:`)) lastVersionContent.delete(k);
  }
}

function ensureRoomCreated(roomId) {
  if (roomDocs.has(roomId)) return;

  const doc = new Y.Doc();
  ensureFsDefaults(doc);
  roomDocs.set(roomId, doc);

  // ---- READY PROMISE (load latest full-doc snapshot once) ----
  const readyPromise = (async () => {
    if (!snapshotRepo) return;

    try {
      const snapshot = await snapshotRepo.getSnapshot(roomId);
      if (snapshot) {
        Y.applyUpdate(doc, new Uint8Array(snapshot), "remote");
      }
      // ensure FS still valid after loading old snapshot
      ensureFsDefaults(doc);
    } catch (e) {
      console.warn(`⚠️ Failed to load snapshot for room ${roomId}:`, e);
      ensureFsDefaults(doc);
    }
  })();

  roomReady.set(roomId, readyPromise);

  // Start periodic per-file auto versions
  startVersionTimer(roomId, doc);

  // ---- Debounced saver (latest full snapshot only) ----
  doc.on("update", () => {
    if (!snapshotRepo) return;

    const existing = saveTimers.get(roomId);
    if (existing) clearTimeout(existing);

    const t = setTimeout(() => {
      (async () => {
        try {
          const update = Y.encodeStateAsUpdate(doc);
          await snapshotRepo.saveSnapshot(roomId, Buffer.from(update));
        } catch (e) {
          console.warn(`⚠️ Failed to save snapshot for room ${roomId}:`, e);
        } finally {
          saveTimers.delete(roomId);
        }
      })();
    }, getDebounceMs());

    saveTimers.set(roomId, t);
  });
}

function getRoomDoc(roomId) {
  ensureRoomCreated(roomId);
  return roomDocs.get(roomId);
}

async function waitRoomReady(roomId) {
  ensureRoomCreated(roomId);
  const p = roomReady.get(roomId);
  if (p) await p;
}

function deleteRoom(roomId) {
  const cleanup = cleanupTimers.get(roomId);
  if (cleanup) clearTimeout(cleanup);
  cleanupTimers.delete(roomId);

  const save = saveTimers.get(roomId);
  if (save) clearTimeout(save);
  saveTimers.delete(roomId);

  stopVersionTimer(roomId);
  roomReady.delete(roomId);

  const doc = roomDocs.get(roomId);
  if (doc) doc.destroy?.();
  roomDocs.delete(roomId);
}

function cancelRoomCleanup(roomId) {
  const t = cleanupTimers.get(roomId);
  if (t) clearTimeout(t);
  cleanupTimers.delete(roomId);
}

function scheduleRoomCleanup(roomId, delayMs = 10 * 60 * 1000) {
  if (cleanupTimers.has(roomId)) return;

  const t = setTimeout(() => {
    deleteRoom(roomId);
    console.log(`🧹 Cleaned room: ${roomId}`);
  }, delayMs);

  cleanupTimers.set(roomId, t);
}

/* ---------------------------
   FS helpers for handlers
   --------------------------- */
function createFolder(doc, { parentId = "root", name = "folder" }) {
  const nodes = doc.getMap("fs:nodes");

  const id = `node:${crypto.randomUUID()}`;
  const n = new Y.Map();
  n.set("id", id);
  n.set("type", "folder");
  n.set("name", name);
  n.set("parentId", parentId);
  n.set("createdAt", Date.now());
  nodes.set(id, n);

  return id;
}

function createFile(doc, { parentId = "root", name = "file.js", initialContent = "" }) {
  const nodes = doc.getMap("fs:nodes");
  const files = doc.getMap("files");

  const fileId = crypto.randomUUID();
  const text = new Y.Text();
  if (initialContent) text.insert(0, initialContent);
  files.set(fileId, text);

  const nodeId = `node:${crypto.randomUUID()}`;
  const n = new Y.Map();
  n.set("id", nodeId);
  n.set("type", "file");
  n.set("name", name);
  n.set("parentId", parentId);
  n.set("fileId", fileId);
  n.set("createdAt", Date.now());
  nodes.set(nodeId, n);

  return { nodeId, fileId };
}

function renameNode(doc, { nodeId, name }) {
  const nodes = doc.getMap("fs:nodes");
  const n = nodes.get(nodeId);
  if (!n) return false;
  n.set("name", name);
  return true;
}

function moveNode(doc, { nodeId, parentId }) {
  const nodes = doc.getMap("fs:nodes");
  const n = nodes.get(nodeId);
  if (!n) return false;
  n.set("parentId", parentId);
  return true;
}

function deleteNodeRecursive(doc, nodeId) {
  const nodes = doc.getMap("fs:nodes");
  const files = doc.getMap("files");

  const target = nodes.get(nodeId);
  if (!target) return;

  const type = target.get("type");

  // delete children first if folder
  if (type === "folder") {
    for (const [id, node] of nodes.entries()) {
      if (node?.get("parentId") === nodeId) {
        deleteNodeRecursive(doc, id);
      }
    }
  }

  // delete file content
  if (type === "file") {
    const fileId = target.get("fileId");
    if (fileId && files.has(fileId)) files.delete(fileId);
  }

  nodes.delete(nodeId);
}

module.exports = {
  getRoomDoc,
  waitRoomReady,
  deleteRoom,
  scheduleRoomCleanup,
  cancelRoomCleanup,

  setSnapshotRepo,
  getSnapshotRepo,

  // FS helpers
  ensureFsDefaults,
  getAllFileIds,
  createFolder,
  createFile,
  renameNode,
  moveNode,
  deleteNodeRecursive,
};
