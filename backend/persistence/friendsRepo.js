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

async function listJoinRequests(pool, roomId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.requester_id AS id,
      u.name,
      u.email,
      r.created_at
    FROM public.room_join_requests r
    JOIN public.users u ON u.id = r.requester_id
    WHERE r.room_id = $1 AND r.status = 'pending'
    ORDER BY r.created_at DESC
    `,
    [roomId]
  );
  return rows;
}

async function setJoinRequestStatus(pool, roomId, requesterId, status) {
  await pool.query(
    `
    UPDATE public.room_join_requests
    SET status = $3
    WHERE room_id = $1 AND requester_id = $2
    `,
    [roomId, requesterId, status]
  );
}

async function addEditorToRoom(pool, roomId, editor) {
  // Load current editors
  const { rows } = await pool.query(
    `SELECT editors FROM public.room_settings WHERE room_id = $1 LIMIT 1`,
    [roomId]
  );

  const current = rows[0]?.editors || [];
  const arr = Array.isArray(current) ? current : [];

  const exists = arr.some((e) => String(e.id) === String(editor.id));
  if (!exists) arr.push({ id: editor.id, name: editor.name, email: editor.email });

  await pool.query(
    `UPDATE public.room_settings SET editors = $2::jsonb, updated_at = NOW() WHERE room_id = $1`,
    [roomId, JSON.stringify(arr)]
  );

  // Also register them in user_rooms as a participant (if not already)
  await pool.query(
    `INSERT INTO user_rooms (user_id, room_id, is_owner, created_at, last_visited_at)
    VALUES ($1, $2, false, NOW(), NOW())
    ON CONFLICT (user_id, room_id) DO NOTHING`,
    [editor.id, roomId]
  );
}

async function getRoomOwnerId(pool, roomId) {
  const { rows } = await pool.query(
    `SELECT owner_id FROM public.room_settings WHERE room_id = $1 LIMIT 1`,
    [roomId]
  );
  return rows[0]?.owner_id ?? null; // TEXT
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
    listJoinRequests,
    setJoinRequestStatus,
    addEditorToRoom,
    getRoomOwnerId,
};
