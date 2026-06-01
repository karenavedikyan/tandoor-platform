/**
 * GET /api/catalog/product?id=<uuid>
 * Полная карточка товара: основные поля, свойства, изображения, остатки, breadcrumbs, related.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Pool } from "pg";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

type BreadcrumbRow = { id: string; name: string; kind: "group" | "category" };

async function fetchGroupBreadcrumbs(pool: Pool, groupId: string): Promise<BreadcrumbRow[]> {
  const r = await pool.query<{ id: string; name: string | null; kind: string }>(
    `WITH RECURSIVE chain AS (
       SELECT id, name, parent_id, 1 AS depth
       FROM catalog_groups
       WHERE id = $1::uuid
       UNION ALL
       SELECT g.id, g.name, g.parent_id, c.depth + 1
       FROM catalog_groups g
       INNER JOIN chain c ON g.id = c.parent_id
       WHERE c.depth < 10 AND c.parent_id IS NOT NULL
     )
     SELECT id::text, COALESCE(NULLIF(TRIM(name), ''), id::text) AS name, 'group'::text AS kind, depth
     FROM chain
     ORDER BY depth DESC`,
    [groupId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    kind: "group",
  }));
}

async function fetchCategoryBreadcrumbs(pool: Pool, productId: string): Promise<BreadcrumbRow[]> {
  const r = await pool.query<{ id: string; name: string | null; kind: string }>(
    `WITH first_cat AS (
       SELECT category_id
       FROM catalog_product_categories
       WHERE product_id = $1::uuid
       ORDER BY category_id
       LIMIT 1
     ),
     RECURSIVE chain AS (
       SELECT c.id, c.name, c.parent_id, 1 AS depth
       FROM catalog_categories c
       INNER JOIN first_cat fc ON fc.category_id = c.id
       UNION ALL
       SELECT c.id, c.name, c.parent_id, ch.depth + 1
       FROM catalog_categories c
       INNER JOIN chain ch ON c.id = ch.parent_id
       WHERE ch.depth < 10 AND ch.parent_id IS NOT NULL
     )
     SELECT id::text, COALESCE(NULLIF(TRIM(name), ''), id::text) AS name, 'category'::text AS kind, depth
     FROM chain
     ORDER BY depth DESC`,
    [productId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    kind: "category",
  }));
}

async function fetchBreadcrumbs(
  pool: Pool,
  productId: string,
  groupId: string | null,
): Promise<BreadcrumbRow[]> {
  if (groupId) {
    const crumbs = await fetchGroupBreadcrumbs(pool, groupId);
    if (crumbs.length > 0) return crumbs;
  }
  return fetchCategoryBreadcrumbs(pool, productId);
}

async function fetchRelated(
  pool: Pool,
  groupId: string | null,
  productId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    display_name: string | null;
    brand: string | null;
    image_url: string | null;
    price_retail: number | null;
    price_retail_sale: number | null;
    badges: { is_new: boolean; is_hit: boolean; is_sale: boolean };
  }>
> {
  if (!groupId) return [];

  const r = await pool.query<{
    id: string;
    name: string;
    display_name: string | null;
    brand: string | null;
    image_url: string | null;
    price_retail: string | null;
    price_retail_sale: string | null;
    is_new: boolean;
    is_hit: boolean;
    is_sale: boolean;
  }>(
    `SELECT
       p.id,
       p.name,
       p.display_name,
       p.brand,
       (SELECT i.blob_url FROM catalog_product_images i
        WHERE i.product_id = p.id AND i.blob_url IS NOT NULL
        ORDER BY i.sort_order ASC NULLS LAST, i.path ASC LIMIT 1) AS image_url,
       (SELECT pr.value FROM catalog_prices pr
        JOIN catalog_price_types pt ON pt.id = pr.price_type_id
        WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%ррц тандор%' LIMIT 1) AS price_retail,
       (SELECT pr.value FROM catalog_prices pr
        JOIN catalog_price_types pt ON pt.id = pr.price_type_id
        WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%акционнаяцена_тандор_розница%' LIMIT 1) AS price_retail_sale,
       EXISTS (SELECT 1 FROM catalog_product_properties pp
        WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'новинка'
        AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_new,
       EXISTS (SELECT 1 FROM catalog_product_properties pp
        WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'хит продаж'
        AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')) AS is_hit,
       EXISTS (SELECT 1 FROM catalog_product_properties pp
        WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'акция'
        AND NULLIF(TRIM(pp.value), '') IS NOT NULL) AS is_sale
     FROM catalog_products p
     WHERE p.group_id = $1::uuid AND p.id <> $2::uuid AND p.active = TRUE
     ORDER BY p.name ASC
     LIMIT 12`,
    [groupId, productId],
  );

  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    brand: row.brand,
    image_url: row.image_url,
    price_retail: row.price_retail != null ? Number(row.price_retail) : null,
    price_retail_sale: row.price_retail_sale != null ? Number(row.price_retail_sale) : null,
    badges: {
      is_new: row.is_new,
      is_hit: row.is_hit,
      is_sale: row.is_sale,
    },
  }));
}

function extractDescription(props: { name: string; value: string }[]): string | null {
  for (const r of props) {
    const n = r.name.trim().toLowerCase();
    if (n === "описание" || n === "описание для сайта") {
      const v = (r.value ?? "").trim();
      if (v) return v;
    }
  }
  return null;
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

    const idRaw = req.query.id;
    const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    if (!id || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
      sendJson(res, 400, { success: false, code: "BAD_ID", message: "Неверный id товара." });
      return;
    }

    const productR = await pool.query<{
      id: string;
      group_id: string | null;
      name: string;
      display_name: string | null;
      brand: string | null;
      is_on_site: boolean;
      active: boolean;
      synced_at: string;
      group_name: string | null;
    }>(
      `SELECT p.id, p.group_id, p.name, p.display_name, p.brand, p.is_on_site, p.active, p.synced_at,
              g.name AS group_name
       FROM catalog_products p
       LEFT JOIN catalog_groups g ON g.id = p.group_id
       WHERE p.id = $1::uuid`,
      [id],
    );
    if (productR.rowCount === 0) {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Товар не найден." });
      return;
    }
    const p = productR.rows[0];

    const [imagesR, propsR, stocksR, catsR, pricesR, breadcrumbs, related] = await Promise.all([
      pool.query<{ path: string; sort_order: number | null; blob_url: string | null }>(
        `SELECT path, sort_order, blob_url FROM catalog_product_images
         WHERE product_id = $1::uuid
         ORDER BY sort_order ASC NULLS LAST, path ASC`,
        [id],
      ),
      pool.query<{ name: string; value: string }>(
        `SELECT name, value FROM catalog_product_properties
         WHERE product_id = $1::uuid AND value <> ''
         ORDER BY name ASC`,
        [id],
      ),
      pool.query<{ warehouse_id: string; warehouse_name: string; qty: string; expected_qty: string | null }>(
        `SELECT s.warehouse_id, w.name AS warehouse_name, s.qty, s.expected_qty
         FROM catalog_stocks s
         LEFT JOIN catalog_warehouses w ON w.id = s.warehouse_id
         WHERE s.product_id = $1::uuid
         ORDER BY w.name ASC NULLS LAST`,
        [id],
      ),
      pool.query<{ category_id: string; category_name: string }>(
        `SELECT pc.category_id, c.name AS category_name
         FROM catalog_product_categories pc
         LEFT JOIN catalog_categories c ON c.id = pc.category_id
         WHERE pc.product_id = $1::uuid
         ORDER BY c.name ASC NULLS LAST`,
        [id],
      ),
      pool.query<{ price_type_id: string; type_name: string; value: string; currency: string }>(
        `SELECT pr.price_type_id, pt.name AS type_name, pr.value, pr.currency
         FROM catalog_prices pr
         LEFT JOIN catalog_price_types pt ON pt.id = pr.price_type_id
         WHERE pr.product_id = $1::uuid
         ORDER BY pt.name ASC NULLS LAST`,
        [id],
      ),
      fetchBreadcrumbs(pool, id, p.group_id),
      fetchRelated(pool, p.group_id, id),
    ]);

    const propsLc = propsR.rows.map((r) => ({
      name: r.name.trim().toLowerCase(),
      value: (r.value ?? "").trim().toLowerCase(),
    }));
    const truthy = (v: string) => v === "да" || v === "y" || v === "yes" || v === "true" || v === "1";
    const badges = {
      is_new: propsLc.some((x) => x.name === "новинка" && truthy(x.value)),
      is_hit: propsLc.some((x) => x.name === "хит продаж" && truthy(x.value)),
      is_sale: propsLc.some((x) => x.name === "акция" && x.value !== ""),
    };

    const prices = pricesR.rows.map((r) => ({
      price_type_id: r.price_type_id,
      type_name: r.type_name,
      value: Number(r.value),
      currency: r.currency,
    }));
    const findPrice = (sub: string) =>
      prices.find((x) => (x.type_name ?? "").toLowerCase().includes(sub.toLowerCase()))?.value ?? null;
    const priceRetail = findPrice("ррц тандор");
    const priceRetailSale = findPrice("акционнаяцена_тандор_розница");
    const description = extractDescription(propsR.rows);

    sendJson(res, 200, {
      success: true,
      product: {
        id: p.id,
        name: p.name,
        display_name: p.display_name,
        brand: p.brand,
        is_on_site: p.is_on_site,
        active: p.active,
        synced_at: p.synced_at,
        group: p.group_id ? { id: p.group_id, name: p.group_name } : null,
        images: imagesR.rows.map((r) => ({
          path: r.path,
          sort_order: r.sort_order,
          blob_url: r.blob_url,
        })),
        properties: propsR.rows.map((r) => ({ name: r.name, value: r.value })),
        stocks: stocksR.rows.map((r) => ({
          warehouse_id: r.warehouse_id,
          warehouse_name: r.warehouse_name,
          qty: Number(r.qty),
          expected_qty: r.expected_qty != null ? Number(r.expected_qty) : null,
        })),
        categories: catsR.rows.map((r) => ({ id: r.category_id, name: r.category_name })),
        prices,
        price_retail: priceRetail,
        price_retail_sale: priceRetailSale,
        badges,
        breadcrumbs,
        related,
        description,
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/product]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
