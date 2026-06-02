/**
 * GET /api/catalog/filters?category_id=&group_id=
 * Контекстные фильтры по разделу (как tandoor.ru).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Pool } from "pg";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  buildCatalogProductWhere,
  CATALOG_EFFECTIVE_PRICE_SQL,
  parseCatalogListFilters,
  whereSqlFromClauses,
} from "./_catalog-query.js";
import {
  DEFAULT_FILTER_GROUPS,
  getFilterGroupsForRoot,
  propNamesForGroup,
  type FilterGroupDef,
} from "./_filter-config.js";
import { BOOLEAN_YES_SQL, PROP_VALUE_NUMERIC_SQL, collapsePropertyValues, isBrandGeoValue } from "./_filter-values.js";
import { resolveRootCategory } from "./_filter-resolve.js";

const JUNK_VALUE_SQL = `
  LENGTH(TRIM(pp.value)) <= 60
  AND TRIM(pp.value) !~* '^#?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  AND TRIM(pp.value) !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*[0-9a-f]{8}-'
`;

export type FilterGroupResponse = {
  key: string;
  label: string;
  kind: FilterGroupDef["kind"];
  order: number;
  values: Array<{ value: string; count: number }>;
};

async function loadCountryValueNorms(pool: Pool, whereSql: string, params: unknown[]): Promise<Set<string>> {
  const r = await pool.query<{ value: string }>(
    `SELECT DISTINCT pp.value
     FROM catalog_product_properties pp
     INNER JOIN catalog_products p ON p.id = pp.product_id
     ${whereSql}
       AND pp.name = 'Страна производитель'
       AND NULLIF(TRIM(pp.value), '') IS NOT NULL
       AND ${JUNK_VALUE_SQL}`,
    params,
  );
  return new Set(
    r.rows.map((row) =>
      row.value
        .trim()
        .replace(/ё/g, "е")
        .replace(/Ё/g, "Е")
        .toLowerCase(),
    ),
  );
}

async function loadCheckboxGroup(
  pool: Pool,
  def: FilterGroupDef,
  whereSql: string,
  params: unknown[],
  countryNorms: Set<string>,
): Promise<FilterGroupResponse | null> {
  const names = propNamesForGroup(def);
  const qParams = [...params, names];
  const r = await pool.query<{ value: string; count: string }>(
    `SELECT pp.value, COUNT(DISTINCT pp.product_id)::text AS count
     FROM catalog_product_properties pp
     INNER JOIN catalog_products p ON p.id = pp.product_id
     ${whereSql}
       AND pp.name = ANY($${qParams.length}::text[])
       AND NULLIF(TRIM(pp.value), '') IS NOT NULL
       AND ${JUNK_VALUE_SQL}
     GROUP BY pp.value
     ORDER BY count DESC, pp.value ASC
     LIMIT 300`,
    qParams,
  );

  let collapsed = collapsePropertyValues(
    r.rows.map((row) => ({ value: row.value, count: Number(row.count) })),
    def.propName,
  );

  if (def.key === "Бренд" || def.propName === "Бренд") {
    collapsed = collapsed.filter((c) => !isBrandGeoValue(c.display, countryNorms));
  }

  if (collapsed.length < 2) return null;

  return {
    key: def.key,
    label: def.label,
    kind: def.kind,
    order: def.order,
    values: collapsed.map((c) => ({ value: c.display, count: c.count })),
  };
}

async function loadBooleanGroup(
  pool: Pool,
  def: FilterGroupDef,
  whereSql: string,
  params: unknown[],
): Promise<FilterGroupResponse | null> {
  const qParams = [...params, def.propName];
  const r = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT p.id)::text AS count
     FROM catalog_products p
     INNER JOIN catalog_product_properties pp ON pp.product_id = p.id
     ${whereSql}
       AND pp.name = $${qParams.length}
       AND ${BOOLEAN_YES_SQL}`,
    qParams,
  );
  const count = Number(r.rows[0]?.count ?? 0);
  if (count < 1) return null;
  return {
    key: def.key,
    label: def.label,
    kind: "boolean",
    order: def.order,
    values: [{ value: "Да", count }],
  };
}

async function loadRangeBucketGroup(
  pool: Pool,
  def: FilterGroupDef,
  whereSql: string,
  params: unknown[],
): Promise<FilterGroupResponse | null> {
  if (!def.buckets?.length) return null;
  const values: Array<{ value: string; count: number }> = [];

  for (const bucket of def.buckets) {
    const qParams = [...params, def.propName];
    const parts: string[] = [
      `${PROP_VALUE_NUMERIC_SQL} IS NOT NULL`,
      `pp.name = $${qParams.length}`,
    ];
    if (bucket.min != null) {
      qParams.push(bucket.min);
      parts.push(`${PROP_VALUE_NUMERIC_SQL} >= $${qParams.length}`);
    }
    if (bucket.max != null) {
      qParams.push(bucket.max);
      parts.push(`${PROP_VALUE_NUMERIC_SQL} <= $${qParams.length}`);
    }

    const r = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id)::text AS count
       FROM catalog_products p
       INNER JOIN catalog_product_properties pp ON pp.product_id = p.id
       ${whereSql}
         AND ${parts.join(" AND ")}`,
      qParams,
    );
    const count = Number(r.rows[0]?.count ?? 0);
    if (count > 0) values.push({ value: bucket.label, count });
  }

  if (values.length < 2) return null;
  return {
    key: def.key,
    label: def.label,
    kind: "range_buckets",
    order: def.order,
    values,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    res.setHeader("Cache-Control", "private, max-age=60");

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.status !== "active") {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const parsed = parseCatalogListFilters(req);
    const root = await resolveRootCategory(pool, parsed.categoryId, parsed.groupId);
    const groupDefs = getFilterGroupsForRoot(root.id, root.name);

    const scope: typeof parsed = {
      categoryId: parsed.categoryId,
      groupId: parsed.groupId,
    };
    const { clauses, params } = buildCatalogProductWhere(scope, { includeListingFilters: false });
    const whereSql = whereSqlFromClauses(clauses);

    const priceR = await pool.query<{ min: string | null; max: string | null }>(
      `SELECT MIN(eff) AS min, MAX(eff) AS max
       FROM (
         SELECT (${CATALOG_EFFECTIVE_PRICE_SQL})::numeric AS eff
         FROM catalog_products p
         ${whereSql}
       ) sub
       WHERE eff IS NOT NULL AND eff > 0`,
      params,
    );
    const priceRow = priceR.rows[0];
    const price = {
      min: priceRow?.min != null ? Number(priceRow.min) : null,
      max: priceRow?.max != null ? Number(priceRow.max) : null,
    };

    const countryNorms = await loadCountryValueNorms(pool, whereSql, params);
    const groups: FilterGroupResponse[] = [];

    const sortedDefs = [...groupDefs].sort((a, b) => a.order - b.order);
    for (const def of sortedDefs) {
      let group: FilterGroupResponse | null = null;
      if (def.kind === "range_buckets") {
        group = await loadRangeBucketGroup(pool, def, whereSql, params);
      } else if (def.kind === "boolean") {
        group = await loadBooleanGroup(pool, def, whereSql, params);
      } else {
        group = await loadCheckboxGroup(pool, def, whereSql, params, countryNorms);
      }
      if (group) groups.push(group);
    }

    sendJson(res, 200, {
      success: true,
      categoryTitle: root.name,
      rootCategoryId: root.id,
      price,
      groups,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/filters]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
