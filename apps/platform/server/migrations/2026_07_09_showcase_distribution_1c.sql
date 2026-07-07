-- Shadow: дистрибуция витрины 1С (матрица категорий + overrides размещений + история).

CREATE TABLE IF NOT EXISTS showcase_matrix_1c (
  store_id_1c UUID NOT NULL,
  category_id TEXT NOT NULL CHECK (category_id IN ('entrance_doors','interior_doors','hardware','molding')),
  actual_count INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  comment TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  updated_by_name TEXT,
  PRIMARY KEY (store_id_1c, category_id)
);
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_1c_updated ON showcase_matrix_1c(updated_at DESC);

CREATE TABLE IF NOT EXISTS showcase_distribution_overrides_1c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id_1c UUID NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('category','model','competitor','placement')),
  target_id UUID,
  status TEXT,
  comment TEXT,
  client_op_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  updated_by_name TEXT,
  placement_type TEXT,
  placement_segment TEXT,
  placement_capacity INTEGER,
  placement_actual INTEGER,
  placement_ref TEXT,
  placement_our_models JSONB,
  placement_competitors JSONB,
  placement_legacy_ours JSONB
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_1c_store ON showcase_distribution_overrides_1c(store_id_1c);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_1c_updated ON showcase_distribution_overrides_1c(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_showcase_dist_1c_op ON showcase_distribution_overrides_1c(client_op_id) WHERE client_op_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS showcase_distribution_history_1c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id_1c UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','matrix_upsert')),
  payload JSONB NOT NULL,
  actor_user_id UUID,
  actor_full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_hist_1c_store ON showcase_distribution_history_1c(store_id_1c, created_at DESC);
