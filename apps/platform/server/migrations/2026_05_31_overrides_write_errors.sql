-- Prompt 113.1: log failed override writes for diagnostics

CREATE TABLE IF NOT EXISTS overrides_write_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_overrides_write_errors_created_at ON overrides_write_errors(created_at DESC);
