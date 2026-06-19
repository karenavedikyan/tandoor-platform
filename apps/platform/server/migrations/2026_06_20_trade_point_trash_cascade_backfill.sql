-- Промт 418: бэкфилл — ТТ активных клиентов в корзине наследуют status/trashed_* от dealer.
UPDATE trade_point_overrides tpo
SET status = 'in_trash',
    trashed_at = d_ov.trashed_at,
    trashed_by = d_ov.trashed_by,
    updated_at = NOW()
FROM dealer_overrides d_ov
WHERE tpo.dealer_id = d_ov.dealer_id
  AND d_ov.status = 'in_trash'
  AND tpo.status = 'active';

INSERT INTO trade_point_overrides (tp_id, dealer_id, status, trashed_at, trashed_by, updated_by)
SELECT tp.id, tp.dealer_id, 'in_trash'::record_status, d_ov.trashed_at, d_ov.trashed_by, d_ov.trashed_by
FROM trade_points tp
INNER JOIN dealer_overrides d_ov ON d_ov.dealer_id = tp.dealer_id
LEFT JOIN trade_point_overrides tpo ON tpo.tp_id = tp.id
WHERE d_ov.status = 'in_trash'
  AND tp.is_active = TRUE
  AND tpo.tp_id IS NULL
ON CONFLICT (tp_id) DO NOTHING;
