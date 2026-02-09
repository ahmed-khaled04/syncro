const Y = require("yjs");

const roomDocs = new Map();       
const cleanupTimers = new Map();  

function getRoomDoc(roomId) {
  if (!roomDocs.has(roomId)) {
    const doc = new Y.Doc();
    doc.getText("codemirror"); 
    roomDocs.set(roomId, doc);
  }
  return roomDocs.get(roomId);
}

function hasRoomDoc(roomId) {
  return roomDocs.has(roomId);
}

function deleteRoom(roomId) {
  // clear timer if exists
  const t = cleanupTimers.get(roomId);
  if (t) clearTimeout(t);
  cleanupTimers.delete(roomId);

  // destroy doc
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
  // already scheduled?
  if (cleanupTimers.has(roomId)) return;

  const t = setTimeout(() => {
    deleteRoom(roomId);
    console.log(`🧹 Cleaned room: ${roomId}`);
  }, delayMs);

  cleanupTimers.set(roomId, t);
}

module.exports = {
  getRoomDoc,
  hasRoomDoc,
  deleteRoom,
  scheduleRoomCleanup,
  cancelRoomCleanup,
};
