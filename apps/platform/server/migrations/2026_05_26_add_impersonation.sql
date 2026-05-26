-- Расширяем sessions: помечаем сессии, созданные через impersonation
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS impersonator_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_impersonator ON sessions(impersonator_user_id) WHERE impersonator_user_id IS NOT NULL;
