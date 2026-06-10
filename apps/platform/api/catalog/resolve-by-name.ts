/**
 * GET /api/catalog/resolve-by-name?name=<название>
 * Сопоставление legacy-названия (из seed) с товаром каталога 1С.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

export type CatalogResolveByNameResult = "matched" | "ambiguous" | "not_found";

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

    const nameRaw = req.query.name;
    const name = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
    const normalized = typeof name === "string" ? normalizeName(name) : "";
    if (!normalized) {
      sendJson(res, 400, { success: false, code: "BAD_NAME", message: "Укажите название товара." });
      return;
    }

    const rows = await pool.query<{ id: string }>(
      `SELECT id::text
       FROM catalog_products
       WHERE active = TRUE
         AND (
           LOWER(TRIM(REGEXP_REPLACE(name, '\\s+', ' ', 'g'))) = $1
           OR (
             display_name IS NOT NULL
             AND LOWER(TRIM(REGEXP_REPLACE(display_name, '\\s+', ' ', 'g'))) = $1
           )
         )
       ORDER BY name ASC
       LIMIT 3`,
      [normalized],
    );

    const matchCount = rows.rowCount ?? rows.rows.length;
    if (matchCount === 0) {
      sendJson(res, 200, { success: true, result: "not_found" satisfies CatalogResolveByNameResult });
      return;
    }
    if (matchCount > 1) {
      sendJson(res, 200, { success: true, result: "ambiguous" satisfies CatalogResolveByNameResult });
      return;
    }

    sendJson(res, 200, {
      success: true,
      result: "matched" satisfies CatalogResolveByNameResult,
      productId: rows.rows[0].id,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/resolve-by-name]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
