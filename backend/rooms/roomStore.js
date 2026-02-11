// room metadata
const roomLang = new Map();    // roomId -> lang
const roomLock = new Map();    // roomId -> boolean
const roomOwner = new Map();   // roomId -> userId
const roomEditors = new Map(); // roomId -> Set(userId)

function getRoomLang(roomId) {
  if (!roomLang.has(roomId)) roomLang.set(roomId, "js");
  return roomLang.get(roomId);
}

function setRoomLang(roomId, lang) {
  roomLang.set(roomId, lang);
  return lang;
}

function getRoomLocked(roomId) {
  if (!roomLock.has(roomId)) roomLock.set(roomId, false);
  return roomLock.get(roomId);
}

function setRoomLocked(roomId, locked) {
  roomLock.set(roomId, !!locked);
  // optional: if unlocking, clear allowlist to keep things clean
  if (!locked) clearRoomEditors(roomId);
  return !!locked;
}

function getRoomOwner(roomId) {
  return roomOwner.get(roomId) || null;
}

function ensureRoomOwner(roomId, userId) {
  if (!roomOwner.has(roomId) && userId) {
    roomOwner.set(roomId, userId);
  }
  return roomOwner.get(roomId) || null;
}

function getRoomEditors(roomId) {
  if (!roomEditors.has(roomId)) roomEditors.set(roomId, new Set());
  return roomEditors.get(roomId);
}

function listRoomEditors(roomId) {
  return Array.from(getRoomEditors(roomId));
}

function allowEditor(roomId, userId) {
  if (!userId) return listRoomEditors(roomId);
  getRoomEditors(roomId).add(userId);
  return listRoomEditors(roomId);
}

function revokeEditor(roomId, userId) {
  if (!userId) return listRoomEditors(roomId);
  getRoomEditors(roomId).delete(userId);
  return listRoomEditors(roomId);
}

function clearRoomEditors(roomId) {
  getRoomEditors(roomId).clear();
  return [];
}

function isEditorAllowed(roomId, userId) {
  if (!userId) return false;
  return getRoomEditors(roomId).has(userId);
}

module.exports = {
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
