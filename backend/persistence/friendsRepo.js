// persistence/friendsRepo.js
// Pure DB helpers for the friends system.

/**
 * Search for a user by email (case-insensitive).
 * Returns { id, name, email } or null.
 */
async function findUserByEmail(pool, email) {
  const q = (email || "").trim().toLowerCase();
  if (q.length < 4) return null; 

  const { rows } = await pool.query(
    `
    SELECT id, name, email
    FROM users
    WHERE LOWER(email) LIKE $1
    ORDER BY email ASC
    LIMIT 1
    `,
    [`${q}%`]
  );

  return rows[0] || null;
}
/**
 * Send a friend request from requesterId → addresseeId.
 * Silently ignores duplicate (already sent) by doing nothing.
 */
async function sendRequest(pool, requesterId, addresseeId) {
    await pool.query(
        `INSERT INTO friends (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
        [requesterId, addresseeId]
    );
}

/**
 * Incoming pending requests directed at userId.
 * Returns [{ id, requester_id, name, email, created_at }]
 */
async function getIncoming(pool, userId) {
    const { rows } = await pool.query(
        `SELECT f.requester_id AS id, u.name, u.email, f.created_at
     FROM friends f
     JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * Outgoing pending requests sent by userId.
 * Returns [{ id (addressee), name, email, created_at }]
 */
async function getOutgoing(pool, userId) {
    const { rows } = await pool.query(
        `SELECT f.addressee_id AS id, u.name, u.email, f.created_at
     FROM friends f
     JOIN users u ON u.id = f.addressee_id
     WHERE f.requester_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * Accept or decline a request.
 * status: 'accepted' | 'declined'
 */
async function respondToRequest(pool, requesterId, addresseeId, status) {
    await pool.query(
        `UPDATE friends SET status = $3, updated_at = NOW()
     WHERE requester_id = $1 AND addressee_id = $2`,
        [requesterId, addresseeId, status]
    );
}

/**
 * List accepted friends of userId.
 * Returns [{ id, name, email }]
 */
async function listFriends(pool, userId) {
    const { rows } = await pool.query(
        `SELECT
       CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS id,
       u.name,
       u.email
     FROM friends f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.name ASC`,
        [userId]
    );
    return rows;
}

/**
 * Check if two users are friends.
 */
async function areFriends(pool, a, b) {
    const { rows } = await pool.query(
        `SELECT 1 FROM friends
     WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
       AND status = 'accepted'
     LIMIT 1`,
        [a, b]
    );
    return rows.length > 0;
}

/**
 * Remove a friend relationship (both directions).
 */
async function removeFriend(pool, userId, otherId) {
    await pool.query(
        `DELETE FROM friends
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
        [userId, otherId]
    );
}

/**
 * Create or update a join-request for a private room.
 */
async function upsertJoinRequest(pool, roomId, requesterId) {
    await pool.query(
        `INSERT INTO room_join_requests (room_id, requester_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (room_id, requester_id)
     DO UPDATE SET status = 'pending', created_at = NOW()`,
        [roomId, requesterId]
    );
}

module.exports = {
    findUserByEmail,
    sendRequest,
    getIncoming,
    getOutgoing,
    respondToRequest,
    listFriends,
    areFriends,
    removeFriend,
    upsertJoinRequest,
};
