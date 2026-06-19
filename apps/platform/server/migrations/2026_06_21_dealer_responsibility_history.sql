-- Prompt 424: история смены ответственных на уровне dealer + хотфикс UUID в regional_manager_name

CREATE TABLE IF NOT EXISTS dealer_responsibility_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         text NOT NULL,
  responsible_role  text NOT NULL,
  from_user_id      uuid NULL,
  to_user_id        uuid NULL,
  actor_user_id     uuid NOT NULL,
  reason            text NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drh_dealer ON dealer_responsibility_history (dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drh_to_user ON dealer_responsibility_history (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drh_role ON dealer_responsibility_history (responsible_role);

-- Хотфикс битой записи (regional_manager_name = UUID)
UPDATE dealer_overrides
SET regional_manager_name = COALESCE(
  NULLIF((SELECT full_name FROM users WHERE id = dealer_overrides.regional_manager_id), ''),
  (SELECT email FROM users WHERE id = dealer_overrides.regional_manager_id)
)
WHERE regional_manager_id IS NOT NULL
  AND regional_manager_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
