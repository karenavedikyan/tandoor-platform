-- Промт 159: справочник управляемых матриц моделей на витрину (тип клиента + период + регион/город).

CREATE TABLE IF NOT EXISTS showcase_matrix_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_category TEXT NOT NULL,
  scope_kind TEXT NOT NULL,
  scope_region TEXT,
  scope_city TEXT,
  effective_from DATE,
  effective_to DATE,
  season_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  comment TEXT,
  client_op_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  updated_by_name TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_defs_client_category_check'
  ) THEN
    ALTER TABLE showcase_matrix_defs
      ADD CONSTRAINT showcase_matrix_defs_client_category_check
      CHECK (client_category IN ('new_client','top150','top350','top500','top500plus'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_defs_scope_kind_check'
  ) THEN
    ALTER TABLE showcase_matrix_defs
      ADD CONSTRAINT showcase_matrix_defs_scope_kind_check
      CHECK (scope_kind IN ('global','region','city'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_defs_status_check'
  ) THEN
    ALTER TABLE showcase_matrix_defs
      ADD CONSTRAINT showcase_matrix_defs_status_check
      CHECK (status IN ('draft','published','archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_defs_scope_fields_check'
  ) THEN
    ALTER TABLE showcase_matrix_defs
      ADD CONSTRAINT showcase_matrix_defs_scope_fields_check
      CHECK (
        (scope_kind = 'global' AND scope_region IS NULL AND scope_city IS NULL) OR
        (scope_kind = 'region' AND scope_region IS NOT NULL AND scope_city IS NULL) OR
        (scope_kind = 'city' AND scope_region IS NOT NULL AND scope_city IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_defs_effective_dates_check'
  ) THEN
    ALTER TABLE showcase_matrix_defs
      ADD CONSTRAINT showcase_matrix_defs_effective_dates_check
      CHECK (
        effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_showcase_matrix_defs_client_op
  ON showcase_matrix_defs (client_op_id) WHERE client_op_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_showcase_matrix_defs_resolve
  ON showcase_matrix_defs (client_category, scope_kind, scope_region, scope_city, status);

CREATE INDEX IF NOT EXISTS idx_showcase_matrix_defs_period
  ON showcase_matrix_defs (effective_from, effective_to);

CREATE TABLE IF NOT EXISTS showcase_matrix_def_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  def_id UUID NOT NULL REFERENCES showcase_matrix_defs(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  segment TEXT NOT NULL,
  value_weight INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_def_models_target_kind_check'
  ) THEN
    ALTER TABLE showcase_matrix_def_models
      ADD CONSTRAINT showcase_matrix_def_models_target_kind_check
      CHECK (target_kind IN ('model','variant'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_def_models_priority_check'
  ) THEN
    ALTER TABLE showcase_matrix_def_models
      ADD CONSTRAINT showcase_matrix_def_models_priority_check
      CHECK (priority IN ('high','medium','low'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'showcase_matrix_def_models_segment_check'
  ) THEN
    ALTER TABLE showcase_matrix_def_models
      ADD CONSTRAINT showcase_matrix_def_models_segment_check
      CHECK (segment IN ('vh','mk','hardware'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_smdm_def ON showcase_matrix_def_models (def_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_smdm_def_target
  ON showcase_matrix_def_models (def_id, target_kind, target_id);
