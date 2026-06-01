/**
 * GET /api/catalog/product?id=<uuid>
 * Полная карточка товара: основные поля, свойства, изображения, остатки по складам.
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

    const [imagesR, propsR, stocksR, catsR, pricesR] = await Promise.all([
      pool.query<{ path: string; sort_order: number | null }>(
        `SELECT path, sort_order FROM catalog_product_images
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
    ]);

    // Бейджи из свойств 1С
    const propsLc = propsR.rows.map((r) => ({ name: r.name.trim().toLowerCase(), value: (r.value ?? "").trim().toLowerCase() }));
    const truthy = (v: string) => v === "да" || v === "y" || v === "yes" || v === "true" || v === "1";
    const badges = {
      is_new: propsLc.some((p) => p.name === "новинка" && truthy(p.value)),
      is_hit: propsLc.some((p) => p.name === "хит продаж" && truthy(p.value)),
      is_sale: propsLc.some((p) => p.name === "акция" && truthy(p.value)),
    };

    // Розничная цена = "РРЦ Тандор", акционная = "АкционнаяЦена_Тандор_Розница"
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
        images: imagesR.rows.map((r) => ({ path: r.path, sort_order: r.sort_order })),
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
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[catalog/product]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
