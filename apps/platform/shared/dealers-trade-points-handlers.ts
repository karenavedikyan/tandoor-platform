/**
 * API чтения дилеров и торговых точек (Промт 348).
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { TRADE_POINT_OVERRIDE_JOIN } from "./db-scope-formula.js";
import {
  mapDbRowsToDealerRow,
  type DbDealerRow,
  type DbTradePointRow,
} from "./dealers-trade-points-mapper.js";

export type DealersTradePointsSearchFilters = {
  query?: string;
  teamId?: string;
  managerId?: string;
  city?: string;
  cities?: string[];
  clientType?: string;
  clientCategory?: string;
  clientCategories?: string[];
  priorityOnly?: boolean;
  activeOnly?: boolean;
  includeClosed?: boolean;
};

export type DealersTradePointsSummary = {
  total: number;
  active: number;
  priority: number;
  closed: number;
  unknownType: number;
};

const DEALER_SELECT = `
  d.external_key,
  d.name,
  d.release_code,
  d.city,
  d.region,
  d.client_type,
  d.client_category,
  d.status,
  d.format,
  d.is_active,
  d.is_priority,
  d.is_closed,
  d.legal_entity,
  d.holding,
  d.comment,
  d.manager_name,
  d.release_address,
  d.client_type_label,
  d.release_team_id,
  d.release_manager_id
`;

function buildDealerFilterSql(
  filters: DealersTradePointsSearchFilters,
): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];

  const q = filters.query?.trim().toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    clauses.push(`(
      lower(d.name) LIKE ${p}
      OR lower(coalesce(d.city, '')) LIKE ${p}
      OR lower(coalesce(d.release_code, '')) LIKE ${p}
      OR lower(d.external_key) LIKE ${p}
      OR lower(coalesce(d.manager_name, '')) LIKE ${p}
      OR lower(coalesce(d.region, '')) LIKE ${p}
    )`);
  }

  const teamId = filters.teamId?.trim();
  if (teamId && teamId !== "all") {
    params.push(teamId);
    clauses.push(`d.release_team_id = $${params.length}`);
  }

  const managerId = filters.managerId?.trim();
  if (managerId && managerId !== "all") {
    params.push(managerId);
    clauses.push(`d.release_manager_id = $${params.length}`);
  }

  const cities = filters.cities?.filter(Boolean);
  if (cities && cities.length > 0) {
    params.push(cities);
    clauses.push(`d.city = ANY($${params.length}::text[])`);
  } else {
    const city = filters.city?.trim();
    if (city && city !== "all") {
      params.push(city);
      clauses.push(`d.city = $${params.length}`);
    }
  }

  const categories = filters.clientCategories?.filter(Boolean);
  if (categories && categories.length > 0) {
    params.push(categories);
    clauses.push(`d.client_category = ANY($${params.length}::text[])`);
  } else {
    const cat = filters.clientCategory?.trim();
    if (cat && cat !== "all") {
      params.push(cat);
      clauses.push(`d.client_category = $${params.length}`);
    }
  }

  const clientType = filters.clientType?.trim();
  if (clientType && clientType !== "all") {
    params.push(clientType);
    clauses.push(`d.client_type = $${params.length}`);
  }

  if (filters.priorityOnly) {
    clauses.push(`d.is_priority = TRUE`);
  }
  if (filters.activeOnly) {
    clauses.push(`d.is_active = TRUE`);
  }
  if (!filters.includeClosed) {
    clauses.push(`d.is_closed = FALSE`);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

async function fetchTradePointsForDealers(
  pool: PoolLike,
  dealerKeys: string[],
): Promise<Map<string, DbTradePointRow[]>> {
  const map = new Map<string, DbTradePointRow[]>();
  if (dealerKeys.length === 0) return map;

  const r = await pool.query<DbTradePointRow & { dealer_external_key: string }>(
    `SELECT tp.external_key,
            d.external_key AS dealer_external_key,
            tp.name,
            tp.city,
            tp.address,
            tp.format,
            tp.is_active,
            COALESCE(tpo.is_primary, FALSE) AS is_primary,
            tp.importance_tier
       FROM trade_points tp
       JOIN dealers d ON d.id = tp.dealer_id
       ${TRADE_POINT_OVERRIDE_JOIN}
       WHERE d.external_key = ANY($1::text[])
       ORDER BY tp.external_key`,
    [dealerKeys],
  );

  for (const row of r.rows) {
    const key = row.dealer_external_key;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export async function handleDealersTradePointsList(
  pool: PoolLike,
  filters: DealersTradePointsSearchFilters,
): Promise<{ success: true; dealers: ReturnType<typeof mapDbRowsToDealerRow>[] }> {
  const { where, params } = buildDealerFilterSql(filters);
  const r = await pool.query<DbDealerRow>(
    `SELECT ${DEALER_SELECT}
       FROM dealers d
       ${where}
       ORDER BY d.name`,
    params,
  );

  const dealerKeys = r.rows.map((row) => row.external_key);
  const tpMap = await fetchTradePointsForDealers(pool, dealerKeys);

  const dealers = r.rows.map((row) =>
    mapDbRowsToDealerRow(row, tpMap.get(row.external_key) ?? []),
  );

  return { success: true, dealers };
}

export async function handleDealersTradePointsGet(
  pool: PoolLike,
  externalKey: string,
): Promise<
  | { success: true; dealer: ReturnType<typeof mapDbRowsToDealerRow> }
  | { success: false; code: "NOT_FOUND"; message: string }
> {
  const key = externalKey.trim();
  if (!key) {
    return { success: false, code: "NOT_FOUND", message: "Дилер не найден." };
  }

  const r = await pool.query<DbDealerRow>(
    `SELECT ${DEALER_SELECT}
       FROM dealers d
      WHERE d.external_key = $1
      LIMIT 1`,
    [key],
  );

  const dealer = r.rows[0];
  if (!dealer) {
    return { success: false, code: "NOT_FOUND", message: "Дилер не найден." };
  }

  const tpMap = await fetchTradePointsForDealers(pool, [key]);
  return { success: true, dealer: mapDbRowsToDealerRow(dealer, tpMap.get(key) ?? []) };
}

export async function handleDealersTradePointsSummary(
  pool: PoolLike,
  filters: DealersTradePointsSearchFilters = {},
): Promise<{ success: true; summary: DealersTradePointsSummary }> {
  const { where, params } = buildDealerFilterSql(filters);
  const r = await pool.query<{
    total: string;
    active: string;
    priority: string;
    closed: string;
    unknown_type: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE d.is_active)::text AS active,
       COUNT(*) FILTER (WHERE d.is_priority)::text AS priority,
       COUNT(*) FILTER (WHERE d.is_closed)::text AS closed,
       COUNT(*) FILTER (WHERE d.client_type = 'unknown')::text AS unknown_type
     FROM dealers d
     ${where}`,
    params,
  );

  const row = r.rows[0];
  return {
    success: true,
    summary: {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      priority: Number(row?.priority ?? 0),
      closed: Number(row?.closed ?? 0),
      unknownType: Number(row?.unknown_type ?? 0),
    },
  };
}

export async function countDealersAndTradePoints(pool: PoolLike): Promise<{
  dealers: number;
  tradePoints: number;
}> {
  const d = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM dealers");
  const t = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM trade_points");
  return {
    dealers: Number(d.rows[0]?.c ?? 0),
    tradePoints: Number(t.rows[0]?.c ?? 0),
  };
}
