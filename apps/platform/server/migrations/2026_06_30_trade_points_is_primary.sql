-- Промт A: канонический is_primary в trade_points (не копируем из overrides).

ALTER TABLE trade_points
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

UPDATE trade_points SET is_primary = false WHERE is_primary = true;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY dealer_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM trade_points
  WHERE is_active = true
)
UPDATE trade_points tp
SET is_primary = true
FROM ranked r
WHERE tp.id = r.id AND r.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_points_dealer_one_primary
  ON trade_points (dealer_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_trade_points_dealer_primary
  ON trade_points (dealer_id, is_primary)
  WHERE is_active = true;
