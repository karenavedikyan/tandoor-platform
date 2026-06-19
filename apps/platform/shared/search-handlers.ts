/**
 * Глобальный поиск по платформе (Промт 250).
 */
import type { PoolLike } from "./admin/admin-auth.js";
import { fetchMyClientCodes } from "./my-client-codes-handlers.js";
import { buildCatalogProductWhere } from "../api/catalog/_catalog-query.js";
import { dealerJoinStatusActive, tpJoinStatusActive } from "./record-status.js";

export type GlobalSearchResultItem = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
};

export type GlobalSearchTradePointItem = GlobalSearchResultItem & {
  dealerId: string;
};

export type GlobalSearchResult = {
  clients: GlobalSearchResultItem[];
  tradePoints: GlobalSearchTradePointItem[];
  products: GlobalSearchResultItem[];
  assignments: GlobalSearchResultItem[];
};

export type GlobalSearchSessionUser = {
  id: string;
  role: string;
  status: string;
};

export type GlobalSearchOptions = {
  query: string;
  limitPerType?: number;
};

const SEARCH_ROLES = new Set([
  "admin",
  "director",
  "rop",
  "regional_manager",
  "manager",
  "analyst",
  "marketer",
  "category_manager",
]);

const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 120;
const DEFAULT_LIMIT = 8;

function sanitizeQuery(raw: string): string | null {
  const t = raw.trim();
  if (t.length < MIN_QUERY_LEN) return null;
  return t.slice(0, MAX_QUERY_LEN);
}

function queryTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 0);
}

/** AND по подстрокам для ILIKE. */
function pushHaystackTokenClauses(
  haystackSql: string,
  tokens: string[],
  params: unknown[],
  conds: string[],
): void {
  for (const token of tokens) {
    params.push(`%${token}%`);
    const n = params.length;
    conds.push(`lower(${haystackSql}) LIKE $${n}`);
  }
}

type ClientScope =
  | { kind: "all" }
  | { kind: "codes"; codes: string[] };

async function resolveClientScope(pool: PoolLike, user: GlobalSearchSessionUser): Promise<ClientScope> {
  const codesPayload = await fetchMyClientCodes(pool, { id: user.id, role: user.role });
  if (
    user.role === "admin" ||
    user.role === "director" ||
    user.role === "analyst" ||
    user.role === "marketer" ||
    user.role === "category_manager"
  ) {
    return { kind: "all" };
  }
  const codes = new Set<string>([...codesPayload.ownCodes, ...codesPayload.teamCodes]);
  return { kind: "codes", codes: Array.from(codes).filter(Boolean) };
}

function pushClientScopeClause(
  dealerIdSql: string,
  scope: ClientScope,
  params: unknown[],
  conds: string[],
): void {
  if (scope.kind === "all") return;
  if (scope.codes.length === 0) {
    conds.push("FALSE");
    return;
  }
  params.push(scope.codes);
  const n = params.length;
  conds.push(`upper(regexp_replace(${dealerIdSql}, '^client-', '')) = ANY($${n}::text[])`);
}

function dealerHref(dealerId: string): string {
  return `/dealers/${encodeURIComponent(dealerId)}`;
}

function tradePointHref(dealerId: string, tpId: string): string {
  return `/dealers/${encodeURIComponent(dealerId)}/trade-points/${encodeURIComponent(tpId)}`;
}

async function searchClients(
  pool: PoolLike,
  scope: ClientScope,
  tokens: string[],
  limit: number,
): Promise<GlobalSearchResultItem[]> {
  const params: unknown[] = [];
  const conds: string[] = [dealerJoinStatusActive("dov")];
  pushClientScopeClause("dov.dealer_id", scope, params, conds);
  pushHaystackTokenClauses(
    `COALESCE(dov.name, '') || ' ' || COALESCE(dov.city, '') || ' ' || upper(regexp_replace(dov.dealer_id, '^client-', ''))`,
    tokens,
    params,
    conds,
  );

  params.push(limit);
  const limitParam = params.length;

  const dovQ = await pool.query<{ id: string; label: string; sublabel: string | null }>(
    `SELECT dov.dealer_id AS id,
            COALESCE(NULLIF(TRIM(dov.name), ''), upper(regexp_replace(dov.dealer_id, '^client-', ''))) AS label,
            NULLIF(TRIM(dov.city), '') AS sublabel
     FROM dealer_overrides dov
     WHERE ${conds.join(" AND ")}
     ORDER BY dov.name NULLS LAST, dov.dealer_id
     LIMIT $${limitParam}`,
    params,
  );

  const results: GlobalSearchResultItem[] = dovQ.rows.map((r) => ({
    id: r.id,
    label: r.label,
    sublabel: r.sublabel ?? undefined,
    href: dealerHref(r.id),
  }));

  if (results.length >= limit) return results.slice(0, limit);

  const mdParams: unknown[] = [];
  const mdConds: string[] = [];
  pushClientScopeClause("md.dealer_id", scope, mdParams, mdConds);
  pushHaystackTokenClauses(
    `COALESCE(md.payload->>'name', '') || ' ' || COALESCE(md.payload->>'city', '') || ' ' || COALESCE(md.payload->>'inn', '') || ' ' || md.dealer_id`,
    tokens,
    mdParams,
    mdConds,
  );
  mdParams.push(limit);
  const mdLimit = mdParams.length;

  const mdQ = await pool.query<{ id: string; label: string; sublabel: string | null }>(
    `SELECT md.dealer_id AS id,
            COALESCE(NULLIF(TRIM(md.payload->>'name'), ''), md.dealer_id) AS label,
            NULLIF(TRIM(COALESCE(md.payload->>'city', '')), '') AS sublabel
     FROM manual_dealers md
     WHERE ${mdConds.length ? mdConds.join(" AND ") : "TRUE"}
     ORDER BY label
     LIMIT $${mdLimit}`,
    mdParams,
  );

  const seen = new Set(results.map((r) => r.id));
  for (const r of mdQ.rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    results.push({
      id: r.id,
      label: r.label,
      sublabel: r.sublabel ?? undefined,
      href: dealerHref(r.id),
    });
    if (results.length >= limit) break;
  }

  if (results.length >= limit) return results.slice(0, limit);

  const leParams: unknown[] = [];
  const leConds: string[] = ["le.status <> 'archived'"];
  pushClientScopeClause("le.client_id", scope, leParams, leConds);
  pushHaystackTokenClauses(
    `COALESCE(le.name, '') || ' ' || COALESCE(le.inn, '') || ' ' || le.client_id`,
    tokens,
    leParams,
    leConds,
  );
  leParams.push(limit);
  const leLimit = leParams.length;

  const leQ = await pool.query<{ id: string; label: string; sublabel: string | null }>(
    `SELECT le.client_id AS id,
            COALESCE(NULLIF(TRIM(le.name), ''), le.client_id) AS label,
            NULLIF(TRIM(le.inn), '') AS sublabel
     FROM legal_entities le
     WHERE ${leConds.join(" AND ")}
     ORDER BY le.name NULLS LAST
     LIMIT $${leLimit}`,
    leParams,
  );

  for (const r of leQ.rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    results.push({
      id: r.id,
      label: r.label,
      sublabel: r.sublabel ? `ИНН ${r.sublabel}` : undefined,
      href: dealerHref(r.id),
    });
    if (results.length >= limit) break;
  }

  return results;
}

async function searchTradePoints(
  pool: PoolLike,
  scope: ClientScope,
  tokens: string[],
  limit: number,
): Promise<GlobalSearchTradePointItem[]> {
  const params: unknown[] = [];
  const conds: string[] = [tpJoinStatusActive("tpo"), "tpo.dealer_id IS NOT NULL"];
  pushClientScopeClause("tpo.dealer_id", scope, params, conds);
  pushHaystackTokenClauses(
    `COALESCE(tpo.name, '') || ' ' || COALESCE(tpo.city, '') || ' ' || COALESCE(tpo.address, '') || ' ' || COALESCE(dov.name, '')`,
    tokens,
    params,
    conds,
  );
  params.push(limit);
  const limitParam = params.length;

  const r = await pool.query<{
    id: string;
    dealer_id: string;
    label: string;
    sublabel: string | null;
  }>(
    `SELECT tpo.tp_id AS id,
            tpo.dealer_id,
            COALESCE(NULLIF(TRIM(tpo.name), ''), tpo.tp_id) AS label,
            NULLIF(TRIM(COALESCE(tpo.city, '') || CASE WHEN tpo.address IS NOT NULL AND TRIM(tpo.address) <> '' THEN ' · ' || tpo.address ELSE '' END), '') AS sublabel
     FROM trade_point_overrides tpo
     LEFT JOIN dealer_overrides dov ON dov.dealer_id = tpo.dealer_id
     WHERE ${conds.join(" AND ")}
     ORDER BY tpo.name NULLS LAST
     LIMIT $${limitParam}`,
    params,
  );

  return r.rows.map((row) => ({
    id: row.id,
    dealerId: row.dealer_id,
    label: row.label,
    sublabel: row.sublabel ?? undefined,
    href: tradePointHref(row.dealer_id, row.id),
  }));
}

async function searchProducts(pool: PoolLike, query: string, limit: number): Promise<GlobalSearchResultItem[]> {
  const { clauses, params } = buildCatalogProductWhere({ q: query });
  params.push(limit);
  const limitParam = params.length;

  const r = await pool.query<{ id: string; label: string; sublabel: string | null }>(
    `SELECT p.id::text AS id,
            COALESCE(NULLIF(TRIM(p.display_name), ''), p.name) AS label,
            NULLIF(TRIM(COALESCE(
              (SELECT pp.value FROM catalog_product_properties pp
               WHERE pp.product_id = p.id AND pp.name = 'Артикул' LIMIT 1),
              ''
            )), '') AS sublabel
     FROM catalog_products p
     WHERE ${clauses.join(" AND ")}
     ORDER BY p.name
     LIMIT $${limitParam}`,
    params,
  );

  return r.rows.map((row) => ({
    id: row.id,
    label: row.label,
    sublabel: row.sublabel ?? undefined,
    href: `/catalog/${encodeURIComponent(row.id)}`,
  }));
}

async function searchAssignments(
  pool: PoolLike,
  user: GlobalSearchSessionUser,
  tokens: string[],
  limit: number,
): Promise<GlobalSearchResultItem[]> {
  const params: unknown[] = [];
  const conds: string[] = ["a.is_archived = false"];

  if (user.role === "manager") {
    params.push(user.id);
    const n = params.length;
    conds.push(`(a.assignee_user_id = $${n}::uuid OR a.created_by = $${n}::uuid)`);
  }

  pushHaystackTokenClauses(
    `COALESCE(a.title, '') || ' ' || COALESCE(a.assignee_name, '') || ' ' || COALESCE(a.trade_point_id, '') || ' ' || COALESCE(a.dealer_id, '')`,
    tokens,
    params,
    conds,
  );

  params.push(limit);
  const limitParam = params.length;

  const r = await pool.query<{ id: string; label: string; sublabel: string | null }>(
    `SELECT a.id::text AS id,
            COALESCE(NULLIF(TRIM(a.title), ''), 'Задание') AS label,
            NULLIF(TRIM(COALESCE(a.assignee_name, '')), '') AS sublabel
     FROM showcase_install_assignments a
     WHERE ${conds.join(" AND ")}
     ORDER BY a.created_at DESC
     LIMIT $${limitParam}`,
    params,
  );

  return r.rows.map((row) => ({
    id: row.id,
    label: row.label,
    sublabel: row.sublabel ?? undefined,
    href: `/assignment/${encodeURIComponent(row.id)}`,
  }));
}

export async function handleGlobalSearch(
  pool: PoolLike,
  user: GlobalSearchSessionUser,
  options: GlobalSearchOptions,
): Promise<{ success: true; result: GlobalSearchResult }> {
  if (user.status !== "active" || !SEARCH_ROLES.has(user.role)) {
    return {
      success: true,
      result: { clients: [], tradePoints: [], products: [], assignments: [] },
    };
  }

  const query = sanitizeQuery(options.query);
  const limit = Math.min(Math.max(options.limitPerType ?? DEFAULT_LIMIT, 1), 20);

  if (!query) {
    return {
      success: true,
      result: { clients: [], tradePoints: [], products: [], assignments: [] },
    };
  }

  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return {
      success: true,
      result: { clients: [], tradePoints: [], products: [], assignments: [] },
    };
  }

  const scope = await resolveClientScope(pool, user);

  const [clients, tradePoints, products, assignments] = await Promise.all([
    searchClients(pool, scope, tokens, limit),
    searchTradePoints(pool, scope, tokens, limit),
    searchProducts(pool, query, limit),
    SEARCH_ROLES.has(user.role) &&
      user.role !== "analyst" &&
      user.role !== "marketer" &&
      user.role !== "category_manager"
      ? searchAssignments(pool, user, tokens, limit)
      : Promise.resolve([]),
  ]);

  return {
    success: true,
    result: { clients, tradePoints, products, assignments },
  };
}
