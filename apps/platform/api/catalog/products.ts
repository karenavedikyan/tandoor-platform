/**
 * GET /api/catalog/products
 *   ?q=строка (по name/display_name)
 *   &category_id=uuid (фильтр по разделу catalog_categories)
 *   &group_id=uuid (фильтр по группе catalog_groups)
 *   &limit=50 (1..100)
 *   &offset=0
 *   &sort=name|stock
 * Возвращает товары из catalog_products (Neon).
 * Доступно любому авторизованному.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

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

    const q = String(req.query.q ?? "").trim();
    const categoryIdRaw = req.query.category_id;
    const categoryId = Array.isArray(categoryIdRaw) ? categoryIdRaw[0] : categoryIdRaw;
    const groupIdRaw = req.query.group_id;
    const groupId = Array.isArray(groupIdRaw) ? groupIdRaw[0] : groupIdRaw;
    const limitNum = Number(req.query.limit);
    const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(Math.floor(limitNum), 100) : 50;
    const offsetNum = Number(req.query.offset);
    const offset = Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.floor(offsetNum) : 0;
    const sort = String(req.query.sort ?? "name") === "stock" ? "stock" : "name";

    const where: string[] = ["p.active = TRUE"];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.display_name ILIKE $${params.length})`);
    }
    if (categoryId && typeof categoryId === "string" && /^[0-9a-f-]{36}$/i.test(categoryId)) {
      params.push(categoryId);
      where.push(`EXISTS (SELECT 1 FROM catalog_product_categories pc WHERE pc.product_id = p.id AND pc.category_id = $${params.length}::uuid)`);
    }
    if (groupId && typeof groupId === "string" && /^[0-9a-f-]{36}$/i.test(groupId)) {
      params.push(groupId);
      where.push(`p.group_id = $${params.length}::uuid`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const sortSql =
      sort === "stock"
        ? `ORDER BY total_stock DESC NULLS LAST, p.name ASC`
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
      total_stock: string | null;
      total_count: string;
    }>(
      `SELECT
         p.id,
         p.name,
         p.display_name,
         p.brand,
         p.is_on_site,
         (SELECT i.path FROM catalog_product_images i WHERE i.product_id = p.id ORDER BY i.sort_order ASC NULLS LAST LIMIT 1) AS image_path,
         (SELECT SUM(s.qty)::numeric FROM catalog_stocks s WHERE s.product_id = p.id) AS total_stock,
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
        total_stock: row.total_stock != null ? Number(row.total_stock) : null,
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/products]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
