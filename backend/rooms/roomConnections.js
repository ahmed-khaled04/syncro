// Track which users are connected to each room
console.log("🧠 roomConnections loaded from:", __filename, "pid:", process.pid);

const roomConnections = new Map(); // Map<string, Set<string>>

const norm = (v) => (v === null || v === undefined ? "" : String(v));

function addUserToRoom(roomId, userId) {
  roomId = norm(roomId);
  userId = norm(userId);

  console.log(`\n➕ addUserToRoom: roomId="${roomId}", userId="${userId}"`);

  if (!roomConnections.has(roomId)) {
    console.log(`   Creating new room in map`);
    roomConnections.set(roomId, new Set());
  }
  
  const hadUser = roomConnections.get(roomId).has(userId);
  roomConnections.get(roomId).add(userId);

  console.log(
    `✅ User ${userId} added to room ${roomId} (was already there? ${hadUser}). Users: ${Array.from(
      roomConnections.get(roomId)
    ).join(", ")}`
  );

  console.log(`   Full state:`, debugDump());
}

function removeUserFromRoom(roomId, userId) {
  roomId = norm(roomId);
  userId = norm(userId);

  console.log(`\n🗑️ removeUserFromRoom called: roomId="${roomId}", userId="${userId}"`);
  console.log(`   Current connections map:`, debugDump());

  const set = roomConnections.get(roomId);
  if (!set) {
    console.log(`   ⚠️ Room "${roomId}" not in map!`);
    return;
  }

  const hadUser = set.has(userId);
  console.log(`   Room has user before delete? ${hadUser}`);

  set.delete(userId);

  console.log(
    `❌ User ${userId} deleted from room ${roomId}. Remaining users: ${
      Array.from(set).join(", ") || "None"
    }`
  );

  if (set.size === 0) {
    console.log(`   🗑️ Room "${roomId}" is now empty, deleting room from map`);
    roomConnections.delete(roomId);
  }

  console.log(`   After cleanup:`, debugDump());
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