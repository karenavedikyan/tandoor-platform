-- Foundation for /clients-1c: unified distribution view + materialized store/client aggregates.
-- Does not modify dealers, trade_points, showcase_matrix_entries, or /dealers UI tables.

DROP FUNCTION IF EXISTS refresh_clients_1c_mv();
DROP MATERIALIZED VIEW IF EXISTS mv_clients_1c;
DROP MATERIALIZED VIEW IF EXISTS mv_stores_1c;
DROP VIEW IF EXISTS v_store_distribution;

CREATE OR REPLACE VIEW v_store_distribution AS
WITH override_rows AS (
  SELECT
    o.store_id_1c,
    o.target_kind,
    COALESCE(o.target_id::text, '') AS target_id,
    o.status,
    o.placement_type,
    o.placement_segment,
    o.placement_capacity,
    o.placement_actual,
    o.placement_ref,
    o.placement_our_models,
    o.placement_competitors,
    'override_1c'::text AS source,
    o.updated_at,
    o.updated_by_name
  FROM showcase_distribution_overrides_1c o
),
matrix_rows AS (
  SELECT
    esr.id_1c AS store_id_1c,
    sme.target_kind,
    sme.target_id,
    sme.status,
    sme.placement_type,
    sme.placement_segment,
    sme.placement_capacity,
    sme.placement_actual,
    sme.placement_ref,
    sme.placement_our_models,
    sme.placement_competitors,
    'matrix_lk'::text AS source,
    sme.updated_at,
    sme.updated_by_name
  FROM showcase_matrix_entries sme
  INNER JOIN trade_points tp ON tp.external_key = sme.trade_point_id
  INNER JOIN exchange_stores_raw esr ON esr.linked_trade_point_id = tp.id
),
combined AS (
  SELECT * FROM override_rows
  UNION ALL
  SELECT * FROM matrix_rows
)
SELECT DISTINCT ON (store_id_1c, target_kind, target_id)
  store_id_1c,
  target_kind,
  target_id,
  status,
  placement_type,
  placement_segment,
  placement_capacity,
  placement_actual,
  placement_ref,
  placement_our_models,
  placement_competitors,
  source,
  updated_at,
  updated_by_name
FROM combined
ORDER BY
  store_id_1c,
  target_kind,
  target_id,
  CASE source WHEN 'override_1c' THEN 0 ELSE 1 END,
  updated_at DESC NULLS LAST;

CREATE MATERIALIZED VIEW mv_stores_1c AS
WITH store_orders AS (
  SELECT
    bo.store_uuid AS store_id_1c,
    COUNT(*) FILTER (
      WHERE bo.created_at_bitrix >= NOW() - INTERVAL '90 days'
    )::int AS orders_last_90d_count,
    COALESCE(
      SUM(bo.total_with_discount) FILTER (
        WHERE bo.created_at_bitrix >= NOW() - INTERVAL '90 days'
      ),
      0
    )::numeric AS orders_last_90d_amount,
    MAX(bo.created_at_bitrix) AS last_order_at
  FROM bitrix_orders_snapshot bo
  WHERE bo.store_uuid IS NOT NULL
  GROUP BY bo.store_uuid
),
store_distribution AS (
  SELECT
    vd.store_id_1c,
    COUNT(*)::int AS distribution_total_targets,
    COUNT(*) FILTER (
      WHERE COALESCE(vd.placement_actual, 0) > 0
        OR vd.status IN ('installed', 'present', 'planned', 'confirmed')
    )::int AS distribution_filled_count,
    MAX(vd.updated_at) AS last_distribution_updated_at
  FROM v_store_distribution vd
  GROUP BY vd.store_id_1c
)
SELECT
  s.id_1c AS store_id_1c,
  s.name AS store_name,
  s.address AS store_address,
  s.status AS store_status,
  s.legal_entity_1c AS legal_id_1c,
  COALESCE(NULLIF(BTRIM(l.legal_name), ''), l.name) AS legal_name,
  l.inn AS legal_inn,
  l.city AS legal_city,
  l.region AS legal_region,
  COALESCE(l.parent_1c, l.id_1c) AS holding_id_1c,
  COALESCE(NULLIF(BTRIM(h.legal_name), ''), h.name) AS holding_name,
  l.responsible_manager_1c,
  l.responsible_manager_name,
  l.regional_manager_1c,
  l.regional_manager_name,
  l.furniture_manager_1c,
  l.furniture_manager_name,
  s.manager_1c AS store_manager_1c,
  s.manager_name AS store_manager_name,
  s.linked_trade_point_id,
  COALESCE(sd.distribution_filled_count, 0) AS distribution_filled_count,
  COALESCE(sd.distribution_total_targets, 0) AS distribution_total_targets,
  CASE
    WHEN COALESCE(sd.distribution_total_targets, 0) = 0 THEN 0::numeric(5, 2)
    ELSE ROUND(
      100.0 * COALESCE(sd.distribution_filled_count, 0)::numeric
        / sd.distribution_total_targets::numeric,
      2
    )
  END AS distribution_percent,
  COALESCE(so.orders_last_90d_count, 0) AS orders_last_90d_count,
  COALESCE(so.orders_last_90d_amount, 0)::numeric AS orders_last_90d_amount,
  so.last_order_at,
  sd.last_distribution_updated_at,
  NOW() AS refreshed_at
FROM exchange_stores_raw s
LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
LEFT JOIN exchange_legals_raw h ON h.id_1c = COALESCE(l.parent_1c, l.id_1c)
LEFT JOIN store_distribution sd ON sd.store_id_1c = s.id_1c
LEFT JOIN store_orders so ON so.store_id_1c = s.id_1c;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_stores_1c_store_id ON mv_stores_1c (store_id_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_holding ON mv_stores_1c (holding_id_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_legal ON mv_stores_1c (legal_id_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_resp_mgr ON mv_stores_1c (responsible_manager_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_reg_mgr ON mv_stores_1c (regional_manager_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_furn_mgr ON mv_stores_1c (furniture_manager_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_store_mgr ON mv_stores_1c (store_manager_1c);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_legal_city ON mv_stores_1c (legal_city);
CREATE INDEX IF NOT EXISTS idx_mv_stores_1c_legal_region ON mv_stores_1c (legal_region);

CREATE MATERIALIZED VIEW mv_clients_1c AS
SELECT
  ms.holding_id_1c,
  MAX(ms.holding_name) AS holding_name,
  MAX(h.inn) AS holding_inn,
  MAX(h.city) AS holding_city,
  MAX(h.region) AS holding_region,
  COUNT(*)::int AS stores_count,
  COUNT(DISTINCT ms.legal_id_1c)::int AS legals_count,
  COALESCE(
    ARRAY_AGG(DISTINCT ms.responsible_manager_name) FILTER (
      WHERE ms.responsible_manager_name IS NOT NULL AND BTRIM(ms.responsible_manager_name) <> ''
    ),
    ARRAY[]::text[]
  ) AS responsible_managers,
  COALESCE(
    ARRAY_AGG(DISTINCT ms.regional_manager_name) FILTER (
      WHERE ms.regional_manager_name IS NOT NULL AND BTRIM(ms.regional_manager_name) <> ''
    ),
    ARRAY[]::text[]
  ) AS regional_managers,
  COALESCE(SUM(ms.distribution_filled_count), 0)::int AS distribution_filled_count,
  COALESCE(SUM(ms.distribution_total_targets), 0)::int AS distribution_total_targets,
  CASE
    WHEN COALESCE(SUM(ms.distribution_total_targets), 0) = 0 THEN 0::numeric(5, 2)
    ELSE ROUND(
      100.0 * COALESCE(SUM(ms.distribution_filled_count), 0)::numeric
        / SUM(ms.distribution_total_targets)::numeric,
      2
    )
  END AS distribution_percent,
  COALESCE(SUM(ms.orders_last_90d_count), 0)::int AS orders_last_90d_count,
  COALESCE(SUM(ms.orders_last_90d_amount), 0)::numeric AS orders_last_90d_amount,
  MAX(ms.last_order_at) AS last_order_at,
  MAX(ms.last_distribution_updated_at) AS last_distribution_updated_at,
  NOW() AS refreshed_at
FROM mv_stores_1c ms
LEFT JOIN exchange_legals_raw h ON h.id_1c = ms.holding_id_1c
WHERE ms.holding_id_1c IS NOT NULL
GROUP BY ms.holding_id_1c;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_clients_1c_holding_id ON mv_clients_1c (holding_id_1c);
CREATE INDEX IF NOT EXISTS idx_mv_clients_1c_city ON mv_clients_1c (holding_city);
CREATE INDEX IF NOT EXISTS idx_mv_clients_1c_region ON mv_clients_1c (holding_region);

CREATE OR REPLACE FUNCTION refresh_clients_1c_mv() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stores_1c;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clients_1c;
END;
$$ LANGUAGE plpgsql;

REFRESH MATERIALIZED VIEW mv_stores_1c;
REFRESH MATERIALIZED VIEW mv_clients_1c;
