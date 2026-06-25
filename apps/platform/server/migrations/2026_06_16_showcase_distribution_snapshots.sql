-- Ежедневные снимки агрегата дистрибуции по ТТ (last-write-wins за день)

CREATE TABLE IF NOT EXISTS showcase_distribution_snapshots (
  trade_point_id        TEXT NOT NULL,
  dealer_id             TEXT,
  snapshot_date         DATE NOT NULL,
  entrance_capacity     INTEGER NOT NULL DEFAULT 0,
  entrance_on_shelf     INTEGER NOT NULL DEFAULT 0,
  interior_capacity     INTEGER NOT NULL DEFAULT 0,
  interior_on_shelf     INTEGER NOT NULL DEFAULT 0,
  hardware_capacity     INTEGER NOT NULL DEFAULT 0,
  hardware_on_shelf     INTEGER NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID,
  updated_by_name       TEXT,
  PRIMARY KEY (trade_point_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_distribution_snapshots_tp_date
  ON showcase_distribution_snapshots (trade_point_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_distribution_snapshots_date
  ON showcase_distribution_snapshots (snapshot_date);
