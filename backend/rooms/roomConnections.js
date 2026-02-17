// Track which users are connected to each room
console.log("🧠 roomConnections loaded from:", __filename, "pid:", process.pid);

const roomConnections = new Map(); // Map<string, Set<string>>

const norm = (v) => (v === null || v === undefined ? "" : String(v));

function addUserToRoom(roomId, userId) {
  roomId = norm(roomId);
  userId = norm(userId);

  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  roomConnections.get(roomId).add(userId);

  console.log(
    `✅ User ${userId} connected to room ${roomId}. Users: ${Array.from(
      roomConnections.get(roomId)
    ).join(", ")}`
  );
}

function removeUserFromRoom(roomId, userId) {
  roomId = norm(roomId);
  userId = norm(userId);

  const set = roomConnections.get(roomId);
  if (!set) return;

  set.delete(userId);

  console.log(
    `❌ User ${userId} disconnected from room ${roomId}. Users: ${
      Array.from(set).join(", ") || "None"
    }`
  );

  if (set.size === 0) roomConnections.delete(roomId);
}

function isUserConnectedToRoom(roomId, userId) {
  roomId = norm(roomId);
  userId = norm(userId);
  return roomConnections.get(roomId)?.has(userId) || false;
}

function getConnectedUsers(roomId) {
  roomId = norm(roomId);
  return roomConnections.has(roomId) ? Array.from(roomConnections.get(roomId)) : [];
}

function debugDump() {
  const out = {};
  for (const [rid, set] of roomConnections.entries()) {
    out[rid] = Array.from(set);
  }
  return out;
}

module.exports = {
  addUserToRoom,
  removeUserFromRoom,
  isUserConnectedToRoom,
  getConnectedUsers,
  debugDump,
};