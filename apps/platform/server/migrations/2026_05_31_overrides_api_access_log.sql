-- Промт 113.2: серверный access-log для overrides API (диагностика записи в БД).

CREATE TABLE IF NOT EXISTS overrides_api_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  actor_user_id UUID,
  body_summary JSONB,
  response_status INT,
  response_code TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overrides_api_access_log_created_at
  ON overrides_api_access_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_overrides_api_access_log_actor
  ON overrides_api_access_log (actor_user_id, created_at DESC);
