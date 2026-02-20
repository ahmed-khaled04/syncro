// sockets/handlers/friendsHandlers.js
// Handles real-time online status for the friends system.

const { listFriends } = require("../../persistence/friendsRepo");

// In-memory map to track which room each user is currently in
// Key: userId (string), Value: { roomId, roomName, isPublic, ownerId }
const userCurrentRoom = new Map();

/**
 * Get all socket IDs currently in the personal room for a user.
 * Returns true if the user has at least one connected socket.
 */
function isUserOnline(io, userId) {
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    return !!(room && room.size > 0);
}

/**
 * Get the current room info for a user
 */
function getUserCurrentRoom(userId) {
    return userCurrentRoom.get(String(userId)) || null;
}

/**
 * Set the current room for a user
 */
function setUserCurrentRoom(userId, roomInfo) {
    if (roomInfo) {
        userCurrentRoom.set(String(userId), roomInfo);
    } else {
        userCurrentRoom.delete(String(userId));
    }
}

/**
 * Notify friends about a user's room change
 */
async function notifyFriendsAboutRoom(io, pool, userId, roomInfo) {
    try {
        const friends = await listFriends(pool, userId);
        for (const friend of friends) {
            if (isUserOnline(io, friend.id)) {
                io.to(`user:${friend.id}`).emit("friend:room-update", {
                    userId,
                    room: roomInfo,
                });
            }
        }
    } catch (e) {
        console.warn("notifyFriendsAboutRoom error:", e.message);
    }
}

function registerFriendsHandlers(io, socket, pool) {
    console.log("friendsHandlers userId:", socket.data.userId);
    const userId = socket.data.userId;
    if (!userId) return; // unauthenticated socket — skip

    // Join the personal room so friends can ping us
    socket.join(`user:${userId}`);

    // On connect: notify each online friend that we're now online
    (async () => {
        try {
            const friends = await listFriends(pool, userId);
            for (const friend of friends) {
                if (isUserOnline(io, friend.id)) {
                    // Tell friend we're online
                    io.to(`user:${friend.id}`).emit("friend:online", { userId });
                    // Tell us that friend is online
                    socket.emit("friend:online", { userId: friend.id });
                    
                    // Tell us about friend's current room if they're in one
                    const friendRoom = getUserCurrentRoom(friend.id);
                    if (friendRoom) {
                        socket.emit("friend:room-update", {
                            userId: friend.id,
                            room: friendRoom,
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("friendsHandlers connect error:", e.message);
        }
    })();

    // Client asks for fresh online status of their friends (including room info)
    socket.on("friends:get-online", async () => {
        if (!userId) return;
        try {
            const friends = await listFriends(pool, userId);
            const onlineIds = [];
            const roomUpdates = [];
            
            for (const friend of friends) {
                if (isUserOnline(io, friend.id)) {
                    onlineIds.push(friend.id);
                    
                    // Include room info if they're in a room
                    const roomInfo = getUserCurrentRoom(friend.id);
                    if (roomInfo) {
                        roomUpdates.push({
                            userId: friend.id,
                            room: roomInfo,
                        });
                    }
                }
            }
            
            socket.emit("friends:online-list", { onlineIds });
            
            // Send room updates for all online friends
            for (const update of roomUpdates) {
                socket.emit("friend:room-update", update);
            }
        } catch (e) {
            console.warn("friends:get-online error:", e.message);
        }
    });

    // Client tells the server which room they're currently in
    // Payload: { roomId, roomName, isPublic, ownerId }
    socket.on("friend:room-joined", ({ roomId, roomName, isPublic, ownerId }) => {
        if (!userId || !roomId) return;
        
        const roomInfo = {
            roomId,
            roomName: roomName || "Unnamed Room",
            isPublic: Boolean(isPublic),
            ownerId: ownerId ? String(ownerId) : null,
        };
        
        setUserCurrentRoom(userId, roomInfo);
        
        // Notify all friends about the room change
        notifyFriendsAboutRoom(io, pool, userId, roomInfo);
    });

    // Client tells the server they've left their current room
    socket.on("friend:room-left", () => {
        if (!userId) return;
        
        const oldRoom = getUserCurrentRoom(userId);
        setUserCurrentRoom(userId, null);
        
        // Notify friends that we're no longer in a room
        if (oldRoom) {
            notifyFriendsAboutRoom(io, pool, userId, null);
        }
    });

    // Client requests to join a friend's room
    // Payload: { roomId, ownerId, requesterName }
    socket.on("friend:join-room-request", ({ roomId, ownerId, requesterName }) => {
        if (!userId || !roomId || !ownerId) return;

        io.to(`user:${ownerId}`).emit("friend:join-room-request", {
            roomId,
            requester: { id: userId, name: requesterName || socket.data.name || "Someone" },
            at: Date.now(),
        });
    });

    // On disconnect: notify friends we've gone offline and clear room info
    socket.on("disconnecting", async () => {
        try {
            // Clear room info
            const currentRoom = getUserCurrentRoom(userId);
            if (currentRoom) {
                setUserCurrentRoom(userId, null);
            }
            
            const friends = await listFriends(pool, userId);
            for (const friend of friends) {
                io.to(`user:${friend.id}`).emit("friend:offline", { userId });
                
                // Also notify that we left our room
                if (currentRoom) {
                    io.to(`user:${friend.id}`).emit("friend:room-update", {
                        userId,
                        room: null,
                    });
                }
            }
        } catch (e) {
            // Non-critical — ignore
        }
    });
}

module.exports = { registerFriendsHandlers, getUserCurrentRoom, setUserCurrentRoom , notifyFriendsAboutRoom, };
