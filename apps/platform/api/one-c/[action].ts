/**
 * GET /api/one-c/overview | team | manager | stores | store | legals | legal
 * Read-only showroom from shadow tables.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  canAccessOneCShowroom,
  handleOneCLegal,
  handleOneCLegals,
  handleOneCManager,
  handleOneCOverview,
  handleOneCStore,
  handleOneCStores,
  handleOneCTeam,
} from "../../shared/one-c-showroom-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

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

    if (action === "overview") {
      await handleOneCOverview(req, res, pool);
      return;
    }
    if (action === "team") {
      await handleOneCTeam(req, res, pool);
      return;
    }
    if (action === "manager") {
      await handleOneCManager(req, res, pool);
      return;
    }
    if (action === "stores") {
      await handleOneCStores(req, res, pool);
      return;
    }
    if (action === "store") {
      await handleOneCStore(req, res, pool);
      return;
    }
    if (action === "legals") {
      await handleOneCLegals(req, res, pool);
      return;
    }
    if (action === "legal") {
      await handleOneCLegal(req, res, pool);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестное действие." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/one-c]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
