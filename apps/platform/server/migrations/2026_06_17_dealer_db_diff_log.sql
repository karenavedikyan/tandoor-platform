-- Промт 374: лог расхождений seed ↔ БД при shadow-сверке.

CREATE TABLE IF NOT EXISTS dealer_db_diff_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key TEXT NOT NULL,
  field        TEXT NOT NULL,
  seed_value   TEXT,
  db_value     TEXT,
  diff_kind    TEXT NOT NULL,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope        TEXT NOT NULL DEFAULT 'shadow'
);

CREATE INDEX IF NOT EXISTS idx_dealer_db_diff_log_key ON dealer_db_diff_log (external_key);
CREATE INDEX IF NOT EXISTS idx_dealer_db_diff_log_detected ON dealer_db_diff_log (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_db_diff_log_kind ON dealer_db_diff_log (diff_kind);
