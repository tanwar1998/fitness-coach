-- Reference mirror of the schema auto-created by src/lib/server/db.ts.
-- The running app uses db.ts for migrations (CREATE / ALTER ... IF NOT EXISTS).

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