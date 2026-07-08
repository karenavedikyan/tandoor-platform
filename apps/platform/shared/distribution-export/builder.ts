import type { PoolLike } from "../../server/db/neon-client.js";

export type DistributionPlacementDto = {
  type: string;
  segment: string;
  capacity: number;
  actual_ours: number;
  our_models: Array<{ article: string; count: number }>;
  competitors: Array<{ brand: string; count: number }>;
  ref: string | null;
  updated_at: string;
};

export type DistributionStoreDto = {
  store_id_1c: string;
  legal_entity_1c: string;
  ma_number: string | null;
  updated_at: string;
  models: [];
  placements: DistributionPlacementDto[];
};

export type DistributionExportDto = {
  generated_at: string;
  source: "lk.tandoor.ru";
  version: 2;
  level: 2;
  stores: DistributionStoreDto[];
  unmatched_dealers: string[];
};

type PlacementRow = {
  store_id_1c: string;
  legal_entity_1c: string;
  ma_number: string | null;
  placement_type: string;
  placement_segment: string;
  placement_capacity: number | null;
  placement_actual: number | null;
  placement_our_models: unknown;
  placement_competitors: unknown;
  placement_ref: string | null;
  updated_at: string;
};

const PLACEMENTS_SQL = `
WITH lk_placement_rows AS (
  SELECT
    sme.dealer_id,
    sme.placement_type,
    sme.placement_segment,
    sme.placement_capacity,
    sme.placement_actual,
    sme.placement_our_models,
    sme.placement_competitors,
    sme.placement_ref,
    sme.updated_at
  FROM showcase_matrix_entries sme
  WHERE sme.target_kind = 'placement'
    AND sme.placement_type IS NOT NULL
),
override_placement_rows AS (
  SELECT
    o.store_id_1c::text AS store_id_1c,
    s.legal_entity_1c::text AS legal_entity_1c,
    l.ma_number,
    o.placement_type,
    o.placement_segment,
    o.placement_capacity,
    o.placement_actual,
    o.placement_our_models,
    o.placement_competitors,
    o.placement_ref,
    o.updated_at
  FROM showcase_distribution_overrides_1c o
  INNER JOIN exchange_stores_raw s ON s.id_1c = o.store_id_1c
  LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
  WHERE o.placement_type IS NOT NULL
),
mapped_dealers AS (
  SELECT
    d.external_key AS dealer_id,
    l.id_1c::text AS legal_entity_1c,
    l.ma_number
  FROM dealers d
  LEFT JOIN exchange_legals_raw l
    ON UPPER(TRIM(l.ma_number)) = UPPER(REPLACE(d.external_key, 'client-ma-', 'MA-'))
),
dealer_store_rows AS (
  SELECT
    m.dealer_id,
    m.legal_entity_1c,
    m.ma_number,
    s.id_1c::text AS store_id_1c
  FROM mapped_dealers m
  INNER JOIN exchange_stores_raw s ON s.legal_entity_1c::text = m.legal_entity_1c
  WHERE m.legal_entity_1c IS NOT NULL
),
lk_store_placements AS (
  SELECT
    ds.store_id_1c,
    ds.legal_entity_1c,
    ds.ma_number,
    lp.placement_type,
    lp.placement_segment,
    lp.placement_capacity,
    lp.placement_actual,
    lp.placement_our_models,
    lp.placement_competitors,
    lp.placement_ref,
    lp.updated_at
  FROM lk_placement_rows lp
  INNER JOIN mapped_dealers md ON md.dealer_id = lp.dealer_id AND md.legal_entity_1c IS NOT NULL
  INNER JOIN dealer_store_rows ds ON ds.dealer_id = lp.dealer_id
),
all_placements AS (
  SELECT
    store_id_1c,
    legal_entity_1c,
    ma_number,
    placement_type,
    placement_segment,
    placement_capacity,
    placement_actual,
    placement_our_models,
    placement_competitors,
    placement_ref,
    updated_at
  FROM lk_store_placements
  UNION ALL
  SELECT
    store_id_1c,
    legal_entity_1c,
    ma_number,
    placement_type,
    placement_segment,
    placement_capacity,
    placement_actual,
    placement_our_models,
    placement_competitors,
    placement_ref,
    updated_at
  FROM override_placement_rows
)
SELECT
  store_id_1c,
  legal_entity_1c,
  ma_number,
  placement_type,
  placement_segment,
  placement_capacity,
  placement_actual,
  placement_our_models,
  placement_competitors,
  placement_ref,
  updated_at
FROM all_placements
ORDER BY store_id_1c ASC, updated_at ASC`;

const UNMATCHED_SQL = `
SELECT DISTINCT sme.dealer_id
FROM showcase_matrix_entries sme
LEFT JOIN exchange_legals_raw l
  ON UPPER(TRIM(l.ma_number)) = UPPER(REPLACE(sme.dealer_id, 'client-ma-', 'MA-'))
WHERE sme.target_kind = 'placement'
  AND l.id_1c IS NULL
ORDER BY sme.dealer_id ASC`;

function toUtcIso(value: string | Date | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString();
  return d.toISOString();
}

function normalizeOurModels(raw: unknown): Array<{ article: string; count: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ article: string; count: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const article = String(row.article ?? row.modelId ?? row.model_id ?? "").trim();
    if (!article) continue;
    const countRaw = Number(row.count ?? 1);
    out.push({ article, count: Number.isFinite(countRaw) && countRaw > 0 ? Math.floor(countRaw) : 1 });
  }
  return out;
}

function normalizeCompetitors(raw: unknown): Array<{ brand: string; count: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ brand: string; count: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const brand = String(row.brand ?? "").trim();
    if (!brand) continue;
    const countRaw = Number(row.count ?? 1);
    out.push({ brand, count: Number.isFinite(countRaw) && countRaw > 0 ? Math.floor(countRaw) : 1 });
  }
  return out;
}

function mapPlacementRow(row: PlacementRow): DistributionPlacementDto {
  return {
    type: row.placement_type,
    segment: row.placement_segment,
    capacity: row.placement_capacity ?? 0,
    actual_ours: row.placement_actual ?? 0,
    our_models: normalizeOurModels(row.placement_our_models),
    competitors: normalizeCompetitors(row.placement_competitors),
    ref: row.placement_ref?.trim() ? row.placement_ref.trim() : null,
    updated_at: toUtcIso(row.updated_at),
  };
}

function aggregateStores(rows: PlacementRow[]): DistributionStoreDto[] {
  const byStore = new Map<string, { meta: PlacementRow; placements: DistributionPlacementDto[] }>();

  for (const row of rows) {
    const key = row.store_id_1c;
    let bucket = byStore.get(key);
    if (!bucket) {
      bucket = { meta: row, placements: [] };
      byStore.set(key, bucket);
    }
    bucket.placements.push(mapPlacementRow(row));
    if (new Date(row.updated_at).getTime() > new Date(bucket.meta.updated_at).getTime()) {
      bucket.meta = { ...bucket.meta, updated_at: row.updated_at };
    }
  }

  return Array.from(byStore.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => ({
      store_id_1c: bucket.meta.store_id_1c,
      legal_entity_1c: bucket.meta.legal_entity_1c,
      ma_number: bucket.meta.ma_number?.trim() ? bucket.meta.ma_number.trim() : null,
      updated_at: toUtcIso(bucket.meta.updated_at),
      models: [] as [],
      placements: bucket.placements,
    }));
}

export async function buildDistributionExport(
  pool: PoolLike,
  now: Date = new Date(),
): Promise<DistributionExportDto> {
  const [placementRes, unmatchedRes] = await Promise.all([
    pool.query<PlacementRow>(PLACEMENTS_SQL),
    pool.query<{ dealer_id: string }>(UNMATCHED_SQL),
  ]);

  const stores = aggregateStores(placementRes.rows);
  const unmatched_dealers = unmatchedRes.rows.map((r) => r.dealer_id).sort((a, b) => a.localeCompare(b));

  for (const dealerId of unmatched_dealers) {
    console.warn(`[distribution-export] WARN unmatched dealer: ${dealerId}`);
  }

  return {
    generated_at: now.toISOString(),
    source: "lk.tandoor.ru",
    version: 2,
    level: 2,
    stores,
    unmatched_dealers,
  };
}
