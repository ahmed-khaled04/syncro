function createSnapshotRepo(pool) {
  async function getSnapshot(roomId) {
    const res = await pool.query(
      `SELECT snapshot FROM room_snapshots WHERE room_id = $1`,
      [roomId]
    );
    return res.rowCount ? res.rows[0].snapshot : null; // Buffer or null
  }

  async function saveSnapshot(roomId, snapshotBuffer) {
    await pool.query(
      `
      INSERT INTO room_snapshots (room_id, snapshot, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (room_id)
      DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()
      `,
      [roomId, snapshotBuffer]
    );
  }

  return { getSnapshot, saveSnapshot };
}

module.exports = { createSnapshotRepo };
