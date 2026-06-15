-- Промт 338: телеметрия demo-fallback для real-юзеров (DIAG_AUDIT_ENABLED=1).
-- Применяется отдельно от PR.

CREATE TABLE IF NOT EXISTS real_scope_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  call_site text NOT NULL,
  profile_role text NOT NULL,
  persona_user_id text NOT NULL,
  real_user_id uuid NULL,
  reason text NOT NULL,
  event_count integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_real_scope_audit_log_occurred_at
  ON real_scope_audit_log (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_scope_audit_log_call_site_role
  ON real_scope_audit_log (call_site, profile_role);
