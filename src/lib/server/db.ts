import { Pool, type QueryResultRow } from "pg";
const connectionString =
  process.env.DATABASE_URL ?? "postgres://fitcoach:root@localhost:5432/fitcoach";

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at);

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_chat_sessions_device
  ON chat_sessions(device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS injuries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('acute', 'chronic')),
  severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  status TEXT NOT NULL CHECK (status IN ('active', 'healing', 'cleared')),
  pain_score INTEGER,
  pain_trigger_movements TEXT,
  notes TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_injuries_device
  ON injuries(device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  soreness_score INTEGER NOT NULL,
  sleep_hours REAL,
  sleep_quality INTEGER,
  stress_level INTEGER,
  energy_level INTEGER,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'wearable_sync')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_device_date
  ON daily_checkins(device_id, date DESC);
`;

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(SCHEMA)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await pool.query<T>(text, params);
  return result.rows;
}
