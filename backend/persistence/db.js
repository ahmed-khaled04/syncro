const { Pool } = require("pg");

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function initDb(pool) {
  // Latest snapshot (fast resume)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.room_snapshots (
      room_id TEXT PRIMARY KEY,
      snapshot BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS room_snapshots_updated_at_idx
    ON public.room_snapshots(updated_at);
  `);

  // Version history (multiple rows)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.room_snapshot_versions (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'auto',          -- 'auto' | 'milestone'
      label TEXT NULL,                           -- optional label for milestone
      created_by TEXT NULL,                      -- owner userId or null
      snapshot BYTEA NOT NULL,                   -- Yjs state update (optional use)
      content TEXT NOT NULL,                     -- plain text for restore + diff
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS room_snapshot_versions_room_id_created_at_idx
    ON public.room_snapshot_versions(room_id, created_at DESC);
  `);
}

module.exports = { createPool, initDb };
