/**
 * GET/POST /api/one-c/overview | hierarchy | ... | store-matrix | store-override | store-history
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  handleOneCStoreHistory,
  handleOneCStoreMatrixPost,
  handleOneCStoreOverrideDelete,
  handleOneCStoreOverridePost,
  OneCDistributionValidationError,
} from "../../shared/one-c-distribution-handlers.js";
import {
  canAccessOneCShowroom,
  handleOneCHierarchy,
  handleOneCLegal,
  handleOneCLegals,
  handleOneCManager,
  handleOneCOverview,
  handleOneCRm,
  handleOneCRop,
  handleOneCStore,
  handleOneCStores,
} from "../../shared/one-c-showroom-handlers.js";
import {
  handleBitrixOrder,
  handleBitrixOrders,
  handleBitrixOrdersForLegal,
  handleBitrixOrdersForStore,
  handleBitrixOrdersSummaryForLegal,
  handleBitrixOrdersSummaryForManager,
  handleBitrixOrdersSummaryForStore,
} from "../../shared/bitrix-orders/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (!canAccessOneCShowroom(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Доступ только для admin/manager." });
      return;
    }

    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    if (action === "overview" && req.method === "GET") {
      await handleOneCOverview(req, res, pool);
      return;
    }
    if (action === "hierarchy" && req.method === "GET") {
      await handleOneCHierarchy(req, res, pool);
      return;
    }
    if (action === "rop" && req.method === "GET") {
      await handleOneCRop(req, res, pool);
      return;
    }
    if (action === "rm" && req.method === "GET") {
      await handleOneCRm(req, res, pool);
      return;
    }
    if (action === "manager" && req.method === "GET") {
      await handleOneCManager(req, res, pool);
      return;
    }
    if (action === "stores" && req.method === "GET") {
      await handleOneCStores(req, res, pool);
      return;
    }
    if (action === "store" && req.method === "GET") {
      await handleOneCStore(req, res, pool, me.id);
      return;
    }
    if (action === "store-history" && req.method === "GET") {
      await handleOneCStoreHistory(req, res, pool);
      return;
    }
    if (action === "store-matrix" && req.method === "POST") {
      await handleOneCStoreMatrixPost(req, res, pool, me);
      return;
    }
    if (action === "store-override" && req.method === "POST") {
      await handleOneCStoreOverridePost(req, res, pool, me);
      return;
    }
    if (action === "store-override-delete" && (req.method === "POST" || req.method === "DELETE")) {
      await handleOneCStoreOverrideDelete(req, res, pool, me);
      return;
    }
    if (action === "legals" && req.method === "GET") {
      await handleOneCLegals(req, res, pool);
      return;
    }
    if (action === "legal" && req.method === "GET") {
      await handleOneCLegal(req, res, pool);
      return;
    }
    if (action === "orders" && req.method === "GET") {
      await handleBitrixOrders(req, res, pool, me.id);
      return;
    }
    if (action === "orders-for-store" && req.method === "GET") {
      await handleBitrixOrdersForStore(req, res, pool, me.id);
      return;
    }
    if (action === "orders-for-legal" && req.method === "GET") {
      await handleBitrixOrdersForLegal(req, res, pool, me.id);
      return;
    }
    if (action === "order" && req.method === "GET") {
      await handleBitrixOrder(req, res, pool, me.id);
      return;
    }
    if (action === "orders-summary-for-store" && req.method === "GET") {
      await handleBitrixOrdersSummaryForStore(req, res, pool, me.id);
      return;
    }
    if (action === "orders-summary-for-legal" && req.method === "GET") {
      await handleBitrixOrdersSummaryForLegal(req, res, pool, me.id);
      return;
    }
    if (action === "orders-summary-for-manager" && req.method === "GET") {
      await handleBitrixOrdersSummaryForManager(req, res, pool, me.id);
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестное действие." });
      return;
    }
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
  } catch (e) {
    if (e instanceof OneCDistributionValidationError) {
      sendJson(res, 400, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/one-c]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
