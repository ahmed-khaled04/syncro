const Y = require("yjs");

const roomDocs = new Map();          // roomId -> Y.Doc
const roomReady = new Map();         // roomId -> Promise<void>
const cleanupTimers = new Map();     // roomId -> Timeout
const saveTimers = new Map();        // roomId -> Timeout

// NEW: versioning timers + last saved content
const versionTimers = new Map();       // roomId -> Timeout
const lastVersionContent = new Map();  // roomId -> string

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

function startVersionTimer(roomId, doc) {
  if (!snapshotRepo) return;
  if (versionTimers.has(roomId)) return;

  const tick = async () => {
    try {
      const ytext = doc.getText("codemirror");
      const content = ytext.toString();
      const prev = lastVersionContent.get(roomId);

      // Only create a version if content changed
      if (prev !== content) {
        const update = Y.encodeStateAsUpdate(doc);

        await snapshotRepo.createVersion({
          roomId,
          kind: "auto",
          label: null,
          createdBy: null,
          snapshotBuffer: Buffer.from(update),
          content,
        });

        lastVersionContent.set(roomId, content);
        console.log(`🕒 Auto version snapshot saved: ${roomId}`);
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
  lastVersionContent.delete(roomId);
}

function ensureRoomCreated(roomId) {
  if (roomDocs.has(roomId)) return;

  const doc = new Y.Doc();
  doc.getText("codemirror");
  roomDocs.set(roomId, doc);

  // ---- READY PROMISE (load latest snapshot once) ----
  const readyPromise = (async () => {
    if (!snapshotRepo) return;

    try {
      const snapshot = await snapshotRepo.getSnapshot(roomId);
      if (snapshot) {
        Y.applyUpdate(doc, new Uint8Array(snapshot), "remote");
        console.log(`📥 Loaded snapshot for room: ${roomId}`);
      } else {
        console.log(`ℹ️ No snapshot found for room: ${roomId}`);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load snapshot for room ${roomId}:`, e);
    }
  })();

  roomReady.set(roomId, readyPromise);

  // Start periodic auto versioning
  startVersionTimer(roomId, doc);

  // ---- Debounced saver (latest snapshot only) ----
  doc.on("update", () => {
    if (!snapshotRepo) return;

    const existing = saveTimers.get(roomId);
    if (existing) clearTimeout(existing);

    const t = setTimeout(() => {
      (async () => {
        try {
          const update = Y.encodeStateAsUpdate(doc);
          await snapshotRepo.saveSnapshot(roomId, Buffer.from(update));
          console.log(`💾 Saved snapshot for room: ${roomId}`);
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

// ✅ wait until snapshot load finishes
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

module.exports = {
  getRoomDoc,
  waitRoomReady,
  deleteRoom,
  scheduleRoomCleanup,
  cancelRoomCleanup,
  setSnapshotRepo,
  getSnapshotRepo,
};
