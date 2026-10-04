-- Admin employee preview (read-only view of 1C assignments without LK account).
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS employee_preview_guid uuid NULL,
  ADD COLUMN IF NOT EXISTS employee_preview_assignment text NULL,
  ADD COLUMN IF NOT EXISTS employee_preview_started_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_employee_preview
  ON sessions(employee_preview_guid)
  WHERE employee_preview_guid IS NOT NULL;
