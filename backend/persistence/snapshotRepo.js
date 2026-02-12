function createSnapshotRepo(pool) {
  // ------------------------------
  // Latest room snapshot (full Y.Doc update)
  // ------------------------------
  async function getSnapshot(roomId) {
    const res = await pool.query(
      `SELECT snapshot FROM room_snapshots WHERE room_id = $1`,
      [roomId]
    );
    return res.rowCount ? res.rows[0].snapshot : null; // Buffer | null
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

  // ------------------------------
  // Per-file version history
  // ------------------------------
  async function createVersion({
    roomId,
    fileId,
    kind = "auto",
    label = null,
    createdBy = null,
    snapshotBuffer,
    content,
  }) {
    if (!fileId) throw new Error("createVersion requires fileId");

    await pool.query(
      `
      INSERT INTO room_snapshot_versions
        (room_id, file_id, kind, label, created_by, snapshot, content)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [roomId, fileId, kind, label, createdBy, snapshotBuffer, content]
    );
  }

  async function listVersions(roomId, fileId, limit = 50) {
    const res = await pool.query(
      `
      SELECT id, room_id, file_id, kind, label, created_by, created_at
      FROM room_snapshot_versions
      WHERE room_id = $1 AND file_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [roomId, fileId, limit]
    );
    return res.rows;
  }

  async function getVersion(roomId, fileId, id) {
    const res = await pool.query(
      `
      SELECT id, room_id, file_id, kind, label, created_by, created_at, snapshot, content
      FROM room_snapshot_versions
      WHERE room_id = $1 AND file_id = $2 AND id = $3
      `,
      [roomId, fileId, id]
    );
    return res.rowCount ? res.rows[0] : null;
  }

  return {
    getSnapshot,
    saveSnapshot,
    createVersion,
    listVersions,
    getVersion,
  };
}

module.exports = { createSnapshotRepo };
