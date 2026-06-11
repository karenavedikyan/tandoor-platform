/**
 * GET /api/catalog/products — листинг по моделям (группы вариантов 1С).
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
  parseCatalogListFilters,
  whereSqlFromClauses,
} from "./_catalog-query.js";
import { getFilterGroupsForRoot } from "./_filter-config.js";
import {
  buildGroupedProductsQuery,
  isInteriorDoorGrouping,
  parseCatalogListSort,
  resolveDefaultSortMode,
  type CatalogVariantRow,
  type VariantOption,
} from "./_catalog-grouping.js";
import { resolveRootCategory } from "./_filter-resolve.js";

type VariantOptionRow = VariantOption;

function parseVariantJson(raw: unknown): VariantOptionRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as VariantOptionRow[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as VariantOptionRow[];
    } catch {
      return [];
    }
  }
  return [];
}

const CATALOG_IMAGE_URL_SQL = `(SELECT i.blob_url FROM catalog_product_images i
 WHERE i.product_id = p.id AND i.blob_url IS NOT NULL
 ORDER BY i.sort_order ASC NULLS LAST, i.path ASC LIMIT 1)`;

const CATALOG_IMAGE_PATH_SQL = `(SELECT i.path FROM catalog_product_images i
 WHERE i.product_id = p.id AND i.path IS NOT NULL
 ORDER BY i.sort_order ASC NULLS LAST, i.path ASC LIMIT 1)`;

type CatalogBatchRow = {
  id: string;
  name: string;
  image_path: string | null;
  image_url: string | null;
};

function mapCatalogBatchItems(rows: CatalogBatchRow[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    image_path: row.image_path,
    image_url: row.image_url,
  }));
}

function parseVariantsJson(raw: unknown): CatalogVariantRow[] {
  return parseVariantJson(raw).map((item) => {
    const row = item as unknown as CatalogVariantRow;
    return {
      product_id: String(row.product_id),
      size: row.size != null ? String(row.size) : null,
      color: row.color != null ? String(row.color) : null,
      door_type: row.door_type != null ? String(row.door_type) : null,
      side: row.side != null ? String(row.side) : null,
      price_retail: row.price_retail != null ? Number(row.price_retail) : null,
      price_retail_sale: row.price_retail_sale != null ? Number(row.price_retail_sale) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      total_stock: row.total_stock != null ? Number(row.total_stock) : null,
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

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

    const filters = parseCatalogListFilters(req);

    if (filters.ids?.length) {
      const r = await pool.query<CatalogBatchRow>(
        `SELECT
           p.id,
           COALESCE(p.display_name, p.name) AS name,
           ${CATALOG_IMAGE_PATH_SQL} AS image_path,
           ${CATALOG_IMAGE_URL_SQL} AS image_url
         FROM catalog_products p
         WHERE p.active = TRUE AND p.id = ANY($1::uuid[])`,
        [filters.ids],
      );
      sendJson(res, 200, {
        success: true,
        total: r.rows.length,
        limit: r.rows.length,
        offset: 0,
        items: mapCatalogBatchItems(r.rows),
      });
      return;
    }

    if (filters.names?.length) {
      const r = await pool.query<CatalogBatchRow>(
        `SELECT DISTINCT ON (lower(p.name))
           p.id,
           COALESCE(p.display_name, p.name) AS name,
           ${CATALOG_IMAGE_PATH_SQL} AS image_path,
           ${CATALOG_IMAGE_URL_SQL} AS image_url
         FROM catalog_products p
         WHERE p.active = TRUE AND (
           lower(p.name) = ANY($1::text[])
           OR lower(COALESCE(p.display_name, p.name)) = ANY($1::text[])
         )
         ORDER BY lower(p.name), p.id`,
        [filters.names],
      );
      sendJson(res, 200, {
        success: true,
        total: r.rows.length,
        limit: r.rows.length,
        offset: 0,
        items: mapCatalogBatchItems(r.rows),
      });
      return;
    }

    const root = await resolveRootCategory(pool, filters.categoryId, filters.groupId);
    const filterGroupDefs = getFilterGroupsForRoot(root.id, root.name);
    const interiorGrouping = isInteriorDoorGrouping(root);

    const limitNum = Number(req.query.limit);
    const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(Math.floor(limitNum), 100) : 50;
    const offsetNum = Number(req.query.offset);
    const offset = Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.floor(offsetNum) : 0;
    const sort = parseCatalogListSort(req.query.sort);
    const defaultSortMode = resolveDefaultSortMode(root.id, root.name);

    const { clauses: filterClauses, params } = buildCatalogProductWhere(filters, { filterGroupDefs });
    const scopeClauses = [filterClauses[0]!];
    const lastClause = filterClauses[filterClauses.length - 1];
    if (lastClause?.includes("hidden_tree")) {
      scopeClauses.push(lastClause);
    }
    const scopeWhereSql = whereSqlFromClauses(scopeClauses);
    const filterWhereSql = whereSqlFromClauses(filterClauses);

    params.push(interiorGrouping);
    const interiorParamIndex = params.length;

    const { sql: groupedSql } = buildGroupedProductsQuery(
      scopeWhereSql,
      filterWhereSql,
      interiorParamIndex,
      sort,
      defaultSortMode,
    );

    params.push(limit);
    params.push(offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const r = await pool.query<{
      rep_id: string;
      rep_name: string;
      rep_display_name: string | null;
      rep_brand: string | null;
      rep_is_on_site: boolean;
      rep_image_path: string | null;
      rep_image_url: string | null;
      rep_price_retail: string | null;
      rep_price_retail_sale: string | null;
      rep_is_new: boolean;
      rep_is_hit: boolean;
      rep_is_sale: boolean;
      variant_count: number;
      group_total_stock: string | null;
      total_count: string;
      sizes: unknown;
      colors: unknown;
      door_types: unknown;
      sides: unknown;
      variants: unknown;
    }>(`${groupedSql} LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params);

    const total = r.rows.length > 0 ? Number(r.rows[0].total_count) : 0;

    sendJson(res, 200, {
      success: true,
      total,
      limit,
      offset,
      items: r.rows.map((row) => ({
        id: row.rep_id,
        name: row.rep_name,
        display_name: row.rep_display_name,
        brand: row.rep_brand,
        is_on_site: row.rep_is_on_site,
        image_path: row.rep_image_path,
        image_url: row.rep_image_url,
        total_stock: row.group_total_stock != null ? Number(row.group_total_stock) : null,
        price_retail: row.rep_price_retail != null ? Number(row.rep_price_retail) : null,
        price_retail_sale: row.rep_price_retail_sale != null ? Number(row.rep_price_retail_sale) : null,
        is_new: row.rep_is_new,
        is_hit: row.rep_is_hit,
        is_sale: row.rep_is_sale,
        variant_count: row.variant_count,
        sizes: parseVariantJson(row.sizes),
        colors: parseVariantJson(row.colors),
        door_types: parseVariantJson(row.door_types).map(({ value, product_id }) => ({ value, product_id })),
        sides: parseVariantJson(row.sides).map(({ value, product_id }) => ({ value, product_id })),
        variants: parseVariantsJson(row.variants),
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/products]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
