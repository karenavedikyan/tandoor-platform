/**
 * GET /api/catalog/categories
 * Возвращает плоский список разделов с counts товаров для дропдауна-фильтра.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { hiddenCategoriesExcludeSql } from "./_hidden.js";

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

    const hidden = hiddenCategoriesExcludeSql("c", 1);
    const catParams = [...hidden.params];

    const r = await pool.query<{
      id: string;
      name: string;
      parent_id: string | null;
      sort_order: number | null;
      product_count: string;
    }>(
      `SELECT c.id, c.name, c.parent_id, c.sort_order,
              (
                SELECT COUNT(DISTINCT pc.product_id)
                FROM catalog_product_categories pc
                WHERE pc.category_id IN (
                  WITH RECURSIVE subtree AS (
                    SELECT id FROM catalog_categories WHERE id = c.id
                    UNION ALL
                    SELECT ch.id FROM catalog_categories ch
                    INNER JOIN subtree st ON ch.parent_id = st.id
                  )
                  SELECT id FROM subtree
                )
              ) AS product_count
       FROM catalog_categories c
       WHERE 1=1 ${hidden.sql}
       ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`,
      catParams,
    );

    sendJson(res, 200, {
      success: true,
      items: r.rows.map((row) => ({
          id: row.id,
          name: row.name,
          parent_id: row.parent_id,
          sort_order: row.sort_order,
          product_count: Number(row.product_count),
        })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/categories]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
