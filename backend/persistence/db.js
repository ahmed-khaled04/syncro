// server/src/persistence/db.js
const { Pool } = require("pg");

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function initDb(pool) {
  // Users table for authentication
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
  `);

  // User-Room associations (for tracking ownership and visits)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_rooms (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL,
      is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, room_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_rooms_user_id ON public.user_rooms(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_rooms_room_id ON public.user_rooms(room_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.room_settings (
      room_id TEXT PRIMARY KEY,
      lang TEXT NOT NULL DEFAULT 'js',
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      owner_id TEXT NULL,
      editors JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_room_settings_updated_at
    ON public.room_settings(updated_at);
  `);


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

  // -----------------------------
  // Version history (multiple rows)
  // -----------------------------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.room_snapshot_versions (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      file_id TEXT NOT NULL DEFAULT 'main',
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_room_versions_room_file_created
    ON public.room_snapshot_versions (room_id, file_id, created_at DESC);
  `);
}

module.exports = { createPool, initDb };
