// Track which users are connected to each room
const roomConnections = new Map(); // Map<roomId, Set<userId>>

function addUserToRoom(roomId, userId) {
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  roomConnections.get(roomId).add(userId);
  console.log(`✅ User ${userId} connected to room ${roomId}. Users: ${Array.from(roomConnections.get(roomId)).join(", ")}`);
}

function removeUserFromRoom(roomId, userId) {
  if (roomConnections.has(roomId)) {
    roomConnections.get(roomId).delete(userId);
    console.log(`❌ User ${userId} disconnected from room ${roomId}. Users: ${Array.from(roomConnections.get(roomId)).join(", ") || "None"}`);
    
    // Clean up empty rooms
    if (roomConnections.get(roomId).size === 0) {
      roomConnections.delete(roomId);
    }
  }
}

function isUserConnectedToRoom(roomId, userId) {
  return roomConnections.has(roomId) && roomConnections.get(roomId).has(userId);
}

function getConnectedUsers(roomId) {
  return roomConnections.has(roomId) ? Array.from(roomConnections.get(roomId)) : [];
}

module.exports = {
  addUserToRoom,
  removeUserFromRoom,
  isUserConnectedToRoom,
  getConnectedUsers,
};
