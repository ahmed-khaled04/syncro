function createSnapshotRepo(pool) {
  // latest snapshot
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

  // version history
  async function createVersion({
    roomId,
    kind = "auto",
    label = null,
    createdBy = null,
    snapshotBuffer,
    content,
  }) {
    const res = await pool.query(
      `
      INSERT INTO room_snapshot_versions (room_id, kind, label, created_by, snapshot, content)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
      `,
      [roomId, kind, label, createdBy, snapshotBuffer, content]
    );
    return res.rowCount ? res.rows[0] : null; // { id, created_at }
  }

  // ✅ milestones always show first
  async function listVersions(roomId, limit = 50) {
    const res = await pool.query(
      `
      SELECT id, kind, label, created_by, created_at
      FROM room_snapshot_versions
      WHERE room_id = $1
      ORDER BY (kind = 'milestone') DESC, created_at DESC
      LIMIT $2
      `,
      [roomId, limit]
    );
    return res.rows;
  }

  async function getVersion(roomId, id) {
    const res = await pool.query(
      `
      SELECT id, kind, label, created_by, created_at, snapshot, content
      FROM room_snapshot_versions
      WHERE room_id = $1 AND id = $2
      `,
      [roomId, id]
    );
    return res.rowCount ? res.rows[0] : null;
  }

  /**
   * ✅ Retention: keep last N auto versions for a room, delete older autos.
   * Milestones are NOT touched.
   */
  async function pruneAutoVersions(roomId, keep = 200) {
    const k = Number(keep);
    if (!Number.isFinite(k) || k <= 0) return;

    await pool.query(
      `
      DELETE FROM room_snapshot_versions
      WHERE room_id = $1
        AND kind = 'auto'
        AND id NOT IN (
          SELECT id
          FROM room_snapshot_versions
          WHERE room_id = $1 AND kind = 'auto'
          ORDER BY created_at DESC
          LIMIT $2
        )
      `,
      [roomId, k]
    );
  }

  return {
    getSnapshot,
    saveSnapshot,
    createVersion,
    listVersions,
    getVersion,
    pruneAutoVersions,
  };
}

module.exports = { createSnapshotRepo };
