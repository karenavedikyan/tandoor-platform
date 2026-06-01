-- Prompt 114.4: permanent flag for non-retryable override write errors

ALTER TABLE overrides_write_errors
  ADD COLUMN IF NOT EXISTS permanent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_overrides_write_errors_permanent_created
  ON overrides_write_errors(permanent, created_at DESC);
