// server/src/rooms/roomStore.js

// In-memory cache (fast)
// Persisted to DB via initRoomStore(pool) + hydrateRoom(roomId)
const roomLang = new Map();    // roomId -> lang
const roomLock = new Map();    // roomId -> boolean
const roomOwner = new Map();   // roomId -> userId
const roomEditors = new Map(); // roomId -> Set(userId)

let _pool = null;

// Prevent re-hydrating the same room repeatedly
const hydrated = new Set();

// Simple per-room debounce for DB writes
const saveTimers = new Map(); // roomId -> timeout

function initRoomStore(pool) {
  _pool = pool;
}

function _ensureEditorsSet(roomId) {
  if (!roomEditors.has(roomId)) roomEditors.set(roomId, new Set());
  return roomEditors.get(roomId);
}

function _getEditorsArray(roomId) {
  return Array.from(_ensureEditorsSet(roomId));
}

async function hydrateRoom(roomId) {
  if (!roomId) return;
  if (hydrated.has(roomId)) return;

  // If no DB configured, just mark hydrated (memory-only mode)
  if (!_pool) {
    hydrated.add(roomId);
    return;
  }

  try {
    const res = await _pool.query(
      `SELECT room_id, lang, locked, owner_id, editors
       FROM public.room_settings
       WHERE room_id = $1`,
      [roomId]
    );

    if (res.rowCount === 0) {
      // Create default row (only once)
      await _pool.query(
        `INSERT INTO public.room_settings(room_id, lang, locked, owner_id, editors)
         VALUES ($1, 'js', FALSE, NULL, '[]'::jsonb)
         ON CONFLICT (room_id) DO NOTHING`,
        [roomId]
      );

      // Defaults in cache
      roomLang.set(roomId, "js");
      roomLock.set(roomId, false);
      if (!roomOwner.has(roomId)) roomOwner.set(roomId, null);
      _ensureEditorsSet(roomId).clear();

      hydrated.add(roomId);
      return;
    }

    const row = res.rows[0];

    roomLang.set(roomId, row.lang || "js");
    roomLock.set(roomId, !!row.locked);
    roomOwner.set(roomId, row.owner_id || null);

    const set = _ensureEditorsSet(roomId);
    set.clear();

    const editors = Array.isArray(row.editors) ? row.editors : [];
    for (const id of editors) {
      if (id) set.add(String(id));
    }

    hydrated.add(roomId);
  } catch (e) {
    console.warn("[roomStore] hydrateRoom failed:", e);
    // fallback: memory defaults
    if (!roomLang.has(roomId)) roomLang.set(roomId, "js");
    if (!roomLock.has(roomId)) roomLock.set(roomId, false);
    if (!roomOwner.has(roomId)) roomOwner.set(roomId, null);
    _ensureEditorsSet(roomId);
    hydrated.add(roomId);
  }
}

async function _persistRoomNow(roomId) {
  if (!_pool) return;

  const lang = roomLang.get(roomId) ?? "js";
  const locked = !!(roomLock.get(roomId) ?? false);
  const ownerId = roomOwner.get(roomId) || null;
  const editors = _getEditorsArray(roomId);

  await _pool.query(
    `INSERT INTO public.room_settings (room_id, lang, locked, owner_id, editors, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (room_id) DO UPDATE SET
       lang = EXCLUDED.lang,
       locked = EXCLUDED.locked,
       owner_id = EXCLUDED.owner_id,
       editors = EXCLUDED.editors,
       updated_at = NOW()`,
    [roomId, lang, locked, ownerId, JSON.stringify(editors)]
  );
}

function _schedulePersist(roomId) {
  if (!_pool) return;
  if (!roomId) return;

  // debounce per room
  if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));

  const t = setTimeout(async () => {
    saveTimers.delete(roomId);
    try {
      await _persistRoomNow(roomId);
    } catch (e) {
      console.warn("[roomStore] persist failed:", e);
    }
  }, 300);

  saveTimers.set(roomId, t);
}

// -----------------------------
// Public API (same shape you use now)
// -----------------------------
function getRoomLang(roomId) {
  if (!roomLang.has(roomId)) roomLang.set(roomId, "js");
  return roomLang.get(roomId);
}

function setRoomLang(roomId, lang) {
  roomLang.set(roomId, lang || "js");
  _schedulePersist(roomId);
  return roomLang.get(roomId);
}

function getRoomLocked(roomId) {
  if (!roomLock.has(roomId)) roomLock.set(roomId, false);
  return roomLock.get(roomId);
}

function setRoomLocked(roomId, locked) {
  roomLock.set(roomId, !!locked);

  // optional: if unlocking, clear allowlist
  if (!locked) clearRoomEditors(roomId);

  _schedulePersist(roomId);
  return !!locked;
}

function getRoomOwner(roomId) {
  return roomOwner.get(roomId) || null;
}

function ensureRoomOwner(roomId, userId) {
  const current = roomOwner.get(roomId) || null;

  if (!current && userId) {
    roomOwner.set(roomId, userId);
    _schedulePersist(roomId);
  }

  return roomOwner.get(roomId) || null;
}

function getRoomEditors(roomId) {
  return _ensureEditorsSet(roomId);
}

function listRoomEditors(roomId) {
  return _getEditorsArray(roomId);
}

function allowEditor(roomId, userId) {
  if (!userId) return listRoomEditors(roomId);
  _ensureEditorsSet(roomId).add(String(userId));
  _schedulePersist(roomId);
  return listRoomEditors(roomId);
}

function revokeEditor(roomId, userId) {
  if (!userId) return listRoomEditors(roomId);
  _ensureEditorsSet(roomId).delete(String(userId));
  _schedulePersist(roomId);
  return listRoomEditors(roomId);
}

function clearRoomEditors(roomId) {
  _ensureEditorsSet(roomId).clear();
  _schedulePersist(roomId);
  return [];
}

function isEditorAllowed(roomId, userId) {
  if (!userId) return false;
  return _ensureEditorsSet(roomId).has(String(userId));
}

module.exports = {
  initRoomStore,
  hydrateRoom,

  getRoomLang,
  setRoomLang,
  getRoomLocked,
  setRoomLocked,
  getRoomOwner,
  ensureRoomOwner,

  getRoomEditors,
  listRoomEditors,
  allowEditor,
  revokeEditor,
  clearRoomEditors,
  isEditorAllowed,
};
