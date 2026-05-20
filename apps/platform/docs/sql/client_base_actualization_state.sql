-- Таблица персистентного состояния актуализации клиентской базы (Neon / Postgres).
-- Выполните один раз в консоли Neon SQL Editor или через psql:
--   psql "$DATABASE_URL" -f apps/platform/docs/sql/client_base_actualization_state.sql

CREATE TABLE IF NOT EXISTS client_base_actualization_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  role TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cb_actualization_user_id ON client_base_actualization_state (user_id);
CREATE INDEX IF NOT EXISTS idx_cb_actualization_updated_at ON client_base_actualization_state (updated_at);
