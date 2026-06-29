/**
 * Dealers & trade points API (Промт 348):
 *   GET /api/dealers-trade-points/list
 *   GET /api/dealers-trade-points/get?externalKey=
 *   GET /api/dealers-trade-points/summary
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  resolveDealersTradePointsGet,
  resolveDealersTradePointsList,
  resolveDealersTradePointsSummary,
  type DealersTradePointsSearchFilters,
} from "../../server/dealers/dealers-trade-points-source.js";
import {
  handleTradePointsListScoped,
  type ListScopedTradePointsResult,
} from "../../shared/trade-points-list-scoped-handlers.js";
import { listActiveTradePointsForDealerUnifiedDetailed } from "../../shared/trade-point-primary.js";

const READ_ROLES = new Set([
  "admin",
  "director",
  "category_manager",
  "rop",
  "manager",
  "regional_manager",
  "sales_manager",
  "marketer",
  "analyst",
]);

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const vals = raw.map((v) => String(v).trim()).filter(Boolean);
    return vals.length > 0 ? vals : undefined;
  }
  const s = parseQueryString(raw);
  if (!s) return undefined;
  const vals = s.split(",").map((v) => v.trim()).filter(Boolean);
  return vals.length > 0 ? vals : undefined;
}

function filtersFromQuery(req: VercelRequest): DealersTradePointsSearchFilters {
  return {
    query: parseQueryString(req.query.query),
    teamId: parseQueryString(req.query.teamId),
    managerId: parseQueryString(req.query.managerId),
    city: parseQueryString(req.query.city),
    cities: parseStringArray(req.query.cities),
    clientType: parseQueryString(req.query.clientType),
    clientCategory: parseQueryString(req.query.clientCategory),
    clientCategories: parseStringArray(req.query.clientCategories),
    priorityOnly: parseBool(req.query.priorityOnly),
    activeOnly: parseBool(req.query.activeOnly),
    includeClosed: parseBool(req.query.includeClosed),
  };
}

function parseForUserId(req: VercelRequest): string | undefined {
  const raw = req.query.for_user_id;
  const s = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  const t = s.trim();
  return t || undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (me.status !== "active" || !READ_ROLES.has(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    if (action === "list") {
      const payload = await resolveDealersTradePointsList(pool, filtersFromQuery(req));
      sendJson(res, 200, payload);
      return;
    }

    if (action === "get") {
      const externalKey = parseQueryString(req.query.externalKey);
      if (!externalKey) {
        sendJson(res, 400, {
          success: false,
          code: "VALIDATION",
          message: "Параметр externalKey обязателен.",
        });
        return;
      }
      const payload = await resolveDealersTradePointsGet(pool, externalKey);
      if (!payload.success) {
        sendJson(res, 404, payload);
        return;
      }
      sendJson(res, 200, payload);
      return;
    }

    if (action === "list-scoped") {
      const payload: ListScopedTradePointsResult = await handleTradePointsListScoped(
        pool,
        { id: me.id, role: me.role },
        parseForUserId(req),
      );
      if ("forbidden" in payload) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      if ("notFound" in payload) {
        sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
        return;
      }
      sendJson(res, 200, payload);
      return;
    }

    if (action === "active-unified") {
      const dealerId =
        parseQueryString(req.query.dealerId) ?? parseQueryString(req.query.dealer_id);
      if (!dealerId) {
        sendJson(res, 400, {
          success: false,
          code: "VALIDATION",
          message: "Параметр dealerId обязателен.",
        });
        return;
      }
      const tradePoints = await listActiveTradePointsForDealerUnifiedDetailed(pool, dealerId);
      sendJson(res, 200, { success: true, data: { tradePoints } });
      return;
    }

    if (action === "summary") {
      const payload = await resolveDealersTradePointsSummary(pool, filtersFromQuery(req));
      sendJson(res, 200, payload);
      return;
    }

    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут dealers-trade-points.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[dealers-trade-points-api]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
