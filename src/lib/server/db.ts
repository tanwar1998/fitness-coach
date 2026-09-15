import { Pool, type QueryResultRow } from "pg";
const connectionString =
  process.env.DATABASE_URL ?? "postgres://fitcoach:root@localhost:5432/fitcoach";

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
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

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS referenced_exercise_ids JSONB NOT NULL DEFAULT '[]';

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

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  unit TEXT NOT NULL DEFAULT 'kg',
  current_value NUMERIC NOT NULL,
  target_value NUMERIC NOT NULL,
  weekly_days TEXT NOT NULL DEFAULT '3',
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_device
  ON goals(device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS goal_checkins (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_checkins_goal
  ON goal_checkins(goal_id, created_at);

ALTER TABLE goal_checkins ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE goal_checkins ADD COLUMN IF NOT EXISTS workout_log_id TEXT;

CREATE INDEX IF NOT EXISTS idx_goal_checkins_workout_log
  ON goal_checkins(workout_log_id);

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  workout_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  level TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  preset TEXT NOT NULL,
  exercise_count INTEGER NOT NULL,
  completed_on DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_device
  ON workout_logs(device_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS weekly_checkins (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  week_start DATE NOT NULL,
  summary TEXT NOT NULL,
  adjustments JSONB NOT NULL DEFAULT '[]',
  stats JSONB NOT NULL DEFAULT '{}',
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_device
  ON weekly_checkins(device_id, week_start DESC);

CREATE TABLE IF NOT EXISTS wearable_metrics (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('apple_health', 'google_fit')),
  steps INTEGER,
  resting_heart_rate REAL,
  hrv_ms REAL,
  sleep_duration_minutes INTEGER,
  sleep_score REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, date, provider)
);

CREATE INDEX IF NOT EXISTS idx_wearable_device_date
  ON wearable_metrics(device_id, date DESC);

CREATE TABLE IF NOT EXISTS meal_log_entry (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL DEFAULT '',
  ingredient_id INTEGER,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  date DATE NOT NULL,
  kcal NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meal_log_entry ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meal_log_entry ALTER COLUMN ingredient_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_log_device_date
  ON meal_log_entry(device_id, date DESC);

CREATE TABLE IF NOT EXISTS nutrition_targets (
  device_id TEXT PRIMARY KEY,
  kcal INTEGER NOT NULL DEFAULT 2000,
  protein_g INTEGER NOT NULL DEFAULT 120,
  carbs_g INTEGER NOT NULL DEFAULT 250,
  fat_g INTEGER NOT NULL DEFAULT 70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
