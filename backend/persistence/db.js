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
      file_id TEXT NOT NULL DEFAULT 'main',   -- ✅ NEW
      kind TEXT NOT NULL DEFAULT 'auto',
      label TEXT NULL,
      created_by TEXT NULL,
      snapshot BYTEA NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure file_id column exists (for existing DBs)
  await pool.query(`
    ALTER TABLE public.room_snapshot_versions
    ADD COLUMN IF NOT EXISTS file_id TEXT NOT NULL DEFAULT 'main';
  `);

  // Composite index for per-file history
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_room_versions_room_file_created
    ON public.room_snapshot_versions (room_id, file_id, created_at DESC);
  `);
}

module.exports = { createPool, initDb };
