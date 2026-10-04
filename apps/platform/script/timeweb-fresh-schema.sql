-- Fresh Timeweb installation only; no old employee/territory seeds.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id bigint UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_summary jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_summary_updated_at timestamptz;
CREATE TABLE IF NOT EXISTS responsibility_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind text NOT NULL,
  scope_key text NOT NULL,
  responsible_role text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  user_name text,
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responsibility_assignments_scope_role_uq UNIQUE(scope_kind,scope_key,responsible_role)
);
CREATE TABLE IF NOT EXISTS responsibility_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind text NOT NULL, scope_key text NOT NULL, responsible_role text NOT NULL,
  from_user_id uuid REFERENCES users(id), to_user_id uuid REFERENCES users(id),
  actor_user_id uuid REFERENCES users(id), reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wholesale_source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL, source_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(), raw jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS wholesale_client_metadata (
  guid_client uuid PRIMARY KEY REFERENCES dealers(id),
  source_sha256 text NOT NULL, holding_link_state text,
  pending_holding_guid uuid, manager_roster_state text, raw jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS wholesale_outlet_metadata (
  guid_store uuid PRIMARY KEY REFERENCES trade_points(id), guid_client uuid NOT NULL REFERENCES dealers(id),
  closed boolean NOT NULL, source_sha256 text NOT NULL, raw jsonb NOT NULL
);
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS employee_preview_guid uuid NULL,
  ADD COLUMN IF NOT EXISTS employee_preview_assignment text NULL,
  ADD COLUMN IF NOT EXISTS employee_preview_started_at timestamptz NULL;
CREATE TABLE IF NOT EXISTS employee_account_links (
  employee_guid uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES users(id),
  source text NOT NULL DEFAULT 'manual'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_account_links_user
  ON employee_account_links(user_id);
