-- Explicit 1C employee ↔ LK user links (not inferred from GUID/name similarity).
CREATE TABLE IF NOT EXISTS employee_account_links (
  employee_guid uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES users(id),
  source text NOT NULL DEFAULT 'manual'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_account_links_user
  ON employee_account_links(user_id);
