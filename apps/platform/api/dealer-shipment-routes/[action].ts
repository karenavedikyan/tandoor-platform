/**
 * Dealer shipment routes API (Промт 114):
 *   GET  /api/dealer-shipment-routes/list?userId=
 *   POST /api/dealer-shipment-routes/upsert
 *   POST /api/dealer-shipment-routes/delete
 *   POST /api/dealer-shipment-routes/bulk-import
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  handleDealerShipmentRoutesBulkImport,
  handleDealerShipmentRoutesDelete,
  handleDealerShipmentRoutesList,
  handleDealerShipmentRoutesUpsert,
  resolveSessionContext,
} from "../../shared/dealer-shipment-routes-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, {
        success: false,
        code: "DB_UNAVAILABLE",
        message: "База данных недоступна.",
      });
      return;
    }

    const ctx = await resolveSessionContext(pool, vercelHeaders(req));
    if (!ctx) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (action === "list" && req.method === "GET") {
      await handleDealerShipmentRoutesList(req, res, pool, ctx);
      return;
    }
    if (action === "upsert" && req.method === "POST") {
      await handleDealerShipmentRoutesUpsert(req, res, pool, ctx);
      return;
    }
    if (action === "delete" && req.method === "POST") {
      await handleDealerShipmentRoutesDelete(req, res, pool, ctx);
      return;
    }
    if (action === "bulk-import" && req.method === "POST") {
      await handleDealerShipmentRoutesBulkImport(req, res, pool, ctx);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут dealer-shipment-routes." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[dealer-shipment-routes-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
