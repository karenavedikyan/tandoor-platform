/**
 * GET /api/catalog/filters?category_id=&group_id=
 * Доступные фильтры для текущего раздела (цена, бренды, свойства).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  buildCatalogProductWhere,
  CATALOG_EFFECTIVE_PRICE_SQL,
  FILTER_PROPERTIES_WITHOUT_BRAND,
  parseCatalogListFilters,
  propertyFilterMeta,
  whereSqlFromClauses,
} from "./_catalog-query.js";

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

    const brandsR = await pool.query<{ value: string; count: string }>(
      `SELECT effective_brand AS value, COUNT(DISTINCT id)::text AS count
       FROM (
         SELECT p.id,
           COALESCE(
             NULLIF(TRIM((
               SELECT pp.value FROM catalog_product_properties pp
               WHERE pp.product_id = p.id AND pp.name = 'Бренд' AND NULLIF(TRIM(pp.value), '') IS NOT NULL
               LIMIT 1
             )), ''),
             NULLIF(TRIM((
               SELECT pp.value FROM catalog_product_properties pp
               WHERE pp.product_id = p.id AND pp.name = 'Производитель' AND NULLIF(TRIM(pp.value), '') IS NOT NULL
               LIMIT 1
             )), ''),
             NULLIF(TRIM(p.brand), '')
           ) AS effective_brand
         FROM catalog_products p
         ${whereSql}
       ) x
       WHERE effective_brand IS NOT NULL AND effective_brand <> ''
       GROUP BY effective_brand
       ORDER BY COUNT(DISTINCT id) DESC, effective_brand ASC
       LIMIT 100`,
      params,
    );

    const brands = brandsR.rows.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }));

    const properties: Array<{
      key: string;
      label: string;
      unit: string | null;
      values: Array<{ value: string; count: number }>;
    }> = [];

    for (const propName of FILTER_PROPERTIES_WITHOUT_BRAND) {
      const propParams = [...params, propName];
      const propR = await pool.query<{ value: string; count: string }>(
        `SELECT pp.value, COUNT(DISTINCT pp.product_id)::text AS count
         FROM catalog_product_properties pp
         INNER JOIN catalog_products p ON p.id = pp.product_id
         ${whereSql}
           AND pp.name = $${propParams.length}
           AND NULLIF(TRIM(pp.value), '') IS NOT NULL
         GROUP BY pp.value
         ORDER BY count DESC, pp.value ASC
         LIMIT 200`,
        propParams,
      );

      if (propR.rows.length < 2) continue;

      const meta = propertyFilterMeta(propName);
      properties.push({
        key: propName,
        label: meta.label,
        unit: meta.unit,
        values: propR.rows.map((row) => ({
          value: row.value,
          count: Number(row.count),
        })),
      });
    }

    sendJson(res, 200, {
      success: true,
      price,
      brands,
      properties,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/filters]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
