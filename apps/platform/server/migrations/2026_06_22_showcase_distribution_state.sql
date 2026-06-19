-- Промт 426: showcase distribution state в БД (вместо sessionStorage)

CREATE TABLE IF NOT EXISTS showcase_distribution_overrides (
  dealer_id       TEXT NOT NULL,
  category_id     TEXT NOT NULL CHECK (category_id IN ('entrance_doors','interior_doors','hardware','molding')),
  actual_count    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('ok','attention','critical')),
  comment         TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT,
  updated_by_name TEXT,
  PRIMARY KEY (dealer_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_overrides_dealer
  ON showcase_distribution_overrides (dealer_id);

CREATE TABLE IF NOT EXISTS showcase_distribution_task_updates (
  task_id               TEXT PRIMARY KEY,
  dealer_id             TEXT NOT NULL,
  category_id           TEXT NOT NULL CHECK (category_id IN ('entrance_doors','interior_doors','hardware','molding')),
  status                TEXT NOT NULL CHECK (status IN ('new','in_progress','done','postponed','needs_rop')),
  result_comment        TEXT,
  next_action_date      TEXT,
  next_action_text      TEXT,
  completed_at          TEXT,
  result_kind           TEXT CHECK (result_kind IN ('added_models','agreed_installation','updated_samples','photo_report','client_refused')),
  resolved_actual_count INTEGER,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by            TEXT,
  updated_by_name       TEXT
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_task_updates_dealer
  ON showcase_distribution_task_updates (dealer_id);

CREATE TABLE IF NOT EXISTS showcase_distribution_history (
  id         TEXT PRIMARY KEY,
  dealer_id  TEXT NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta       TEXT NOT NULL,
  body       TEXT NOT NULL,
  actor_id   TEXT,
  actor_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_history_dealer_at
  ON showcase_distribution_history (dealer_id, at DESC);

CREATE TABLE IF NOT EXISTS showcase_distribution_recommendations (
  dealer_id       TEXT NOT NULL,
  model_id        TEXT NOT NULL,
  model_label     TEXT NOT NULL,
  category_id     TEXT NOT NULL CHECK (category_id IN ('entrance_doors','interior_doors','hardware','molding')),
  bucket          TEXT NOT NULL CHECK (bucket IN ('top20','novelty')),
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  created_by_name TEXT,
  PRIMARY KEY (dealer_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_showcase_dist_recs_dealer
  ON showcase_distribution_recommendations (dealer_id);
