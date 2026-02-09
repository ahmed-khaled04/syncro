const { Pool } = require("pg");

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function initDb(pool) {
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
}

module.exports = { createPool, initDb };
