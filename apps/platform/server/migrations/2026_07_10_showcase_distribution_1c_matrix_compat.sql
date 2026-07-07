-- Совместимость shadow overrides с ShowcaseMatrixEntryDto (model/variant/placement).

ALTER TABLE showcase_distribution_overrides_1c
  ALTER COLUMN target_id TYPE TEXT USING target_id::text;

ALTER TABLE showcase_distribution_overrides_1c
  DROP CONSTRAINT IF EXISTS showcase_distribution_overrides_1c_target_kind_check;

ALTER TABLE showcase_distribution_overrides_1c
  ADD CONSTRAINT showcase_distribution_overrides_1c_target_kind_check
  CHECK (target_kind IN ('category','model','variant','competitor','placement'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_showcase_dist_1c_target
  ON showcase_distribution_overrides_1c (store_id_1c, target_kind, target_id)
  WHERE target_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS showcase_matrix_events_1c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  dealer_id UUID NOT NULL,
  store_id_1c UUID NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  comment TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  placement_type TEXT,
  placement_segment TEXT,
  placement_capacity INTEGER,
  placement_actual INTEGER,
  placement_ref TEXT,
  placement_our_models JSONB,
  placement_competitors JSONB,
  placement_legacy_ours JSONB
);

CREATE INDEX IF NOT EXISTS idx_showcase_matrix_events_1c_store
  ON showcase_matrix_events_1c (store_id_1c, changed_at DESC);
