-- Промт 422: основная торговая точка (is_primary) в trade_point_overrides.

ALTER TABLE trade_point_overrides
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tpo_dealer_primary
  ON trade_point_overrides (dealer_id)
  WHERE is_primary = true AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tpo_dealer_one_primary
  ON trade_point_overrides (dealer_id)
  WHERE is_primary = true AND status = 'active';

-- Backfill: для каждого dealer'а — выбрать одну ТТ:
--   если только одна active ТТ — она is_primary=true
--   если несколько — самая старая по created_at
WITH ranked AS (
  SELECT tp_id,
         ROW_NUMBER() OVER (PARTITION BY dealer_id ORDER BY created_at ASC, tp_id ASC) AS rn
  FROM trade_point_overrides
  WHERE status = 'active' AND dealer_id IS NOT NULL
)
UPDATE trade_point_overrides tpo
SET is_primary = true,
    updated_at = NOW()
FROM ranked
WHERE tpo.tp_id = ranked.tp_id
  AND ranked.rn = 1;
