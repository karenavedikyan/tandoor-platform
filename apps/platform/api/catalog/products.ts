/**
 * GET /api/catalog/products
 *   ?q=строка
 *   &category_id=uuid
 *   &group_id=uuid
 *   &brand=…&brand=…
 *   &props=Key:Val,…
 *   &price_min=&price_max=
 *   &limit=50 (1..100)
 *   &offset=0
 *   &sort=name|stock|price_asc|price_desc
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
    const limitNum = Number(req.query.limit);
    const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(Math.floor(limitNum), 100) : 50;
    const offsetNum = Number(req.query.offset);
    const offset = Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.floor(offsetNum) : 0;
    const sortRaw = String(req.query.sort ?? "name");
    const sort =
      sortRaw === "stock"
        ? "stock"
        : sortRaw === "price_asc"
          ? "price_asc"
          : sortRaw === "price_desc"
            ? "price_desc"
            : "name";

    const { clauses, params } = buildCatalogProductWhere(filters);
    const whereSql = whereSqlFromClauses(clauses);

    const sortSql =
      sort === "stock"
        ? `ORDER BY total_stock DESC NULLS LAST, p.name ASC`
        : sort === "price_asc"
          ? `ORDER BY price_retail ASC NULLS LAST, p.name ASC`
          : sort === "price_desc"
            ? `ORDER BY price_retail DESC NULLS LAST, p.name ASC`
            : `ORDER BY p.name ASC`;

    params.push(limit);
    params.push(offset);

    const r = await pool.query<{
      id: string;
      name: string;
      display_name: string | null;
      brand: string | null;
      is_on_site: boolean;
      image_path: string | null;
      image_url: string | null;
      total_stock: string | null;
      price_retail: string | null;
      price_retail_sale: string | null;
      is_new: boolean;
      is_hit: boolean;
      is_sale: boolean;
      total_count: string;
    }>(
      `SELECT
         p.id,
         p.name,
         p.display_name,
         p.brand,
         p.is_on_site,
         (SELECT i.path FROM catalog_product_images i WHERE i.product_id = p.id ORDER BY i.sort_order ASC NULLS LAST LIMIT 1) AS image_path,
         (SELECT i.blob_url FROM catalog_product_images i WHERE i.product_id = p.id AND i.blob_url IS NOT NULL ORDER BY i.sort_order ASC NULLS LAST LIMIT 1) AS image_url,
         (SELECT SUM(s.qty)::numeric FROM catalog_stocks s WHERE s.product_id = p.id) AS total_stock,
         (SELECT pr.value FROM catalog_prices pr JOIN catalog_price_types pt ON pt.id = pr.price_type_id WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%ррц тандор%' LIMIT 1) AS price_retail,
         (SELECT pr.value FROM catalog_prices pr JOIN catalog_price_types pt ON pt.id = pr.price_type_id WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%акционнаяцена_тандор_розница%' LIMIT 1) AS price_retail_sale,
         EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'новинка' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_new,
         EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'хит продаж' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_hit,
         EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'акция' AND NULLIF(TRIM(pp.value), '') IS NOT NULL) AS is_sale,
         COUNT(*) OVER () AS total_count
       FROM catalog_products p
       ${whereSql}
       ${sortSql}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = r.rows.length > 0 ? Number(r.rows[0].total_count) : 0;

    sendJson(res, 200, {
      success: true,
      total,
      limit,
      offset,
      items: r.rows.map((row) => ({
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        brand: row.brand,
        is_on_site: row.is_on_site,
        image_path: row.image_path,
        image_url: row.image_url,
        total_stock: row.total_stock != null ? Number(row.total_stock) : null,
        price_retail: row.price_retail != null ? Number(row.price_retail) : null,
        price_retail_sale: row.price_retail_sale != null ? Number(row.price_retail_sale) : null,
        is_new: row.is_new,
        is_hit: row.is_hit,
        is_sale: row.is_sale,
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/products]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
