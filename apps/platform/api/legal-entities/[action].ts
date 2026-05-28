/**
 * Legal entities API (Промт 64 + 67):
 *   GET  /api/legal-entities/list?clientId=
 *   POST /api/legal-entities/create  { clientId, ...fields }
 *   PATCH /api/legal-entities/patch?id=
 *   DELETE /api/legal-entities/delete?id=
 *   GET|POST /api/legal-entities/trade-point-link
 *   GET  /api/legal-entities/list-full?clientId=
 *   GET  /api/legal-entities/history?clientId=
 *   POST /api/legal-entities/create-full
 *   PATCH /api/legal-entities/patch-full?id=
 *   POST /api/legal-entities/archive
 *   POST /api/legal-entities/set-main
 *   POST /api/legal-entities/bulk-import
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
  handleLegalEntitiesCreate,
  handleLegalEntitiesDelete,
  handleLegalEntitiesList,
  handleLegalEntitiesPatch,
  handleTradePointLegalEntityLinkGet,
  handleTradePointLegalEntityLinkUpsert,
  parseLegalEntityBodyPaymentForm,
} from "../../shared/legal-entities-handlers.js";
import {
  handleLegalEntitiesArchive,
  handleLegalEntitiesBulkImport,
  handleLegalEntitiesCreateFull,
  handleLegalEntitiesHistory,
  handleLegalEntitiesListFull,
  handleLegalEntitiesPatchFull,
  handleLegalEntitiesSetMain,
} from "../../shared/legal-entities-full-handlers.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        message: "База данных недоступна. Юрлица сохраняются только при подключённом Postgres.",
      });
      return;
    }

    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (action === "list" && req.method === "GET") {
      await handleLegalEntitiesList(req, res, pool, me);
      return;
    }

    if (action === "create" && req.method === "POST") {
      const raw = (req.body ?? {}) as Record<string, unknown>;
      req.body = { ...raw, ...parseLegalEntityBodyPaymentForm(raw) };
      await handleLegalEntitiesCreate(req, res, pool, me);
      return;
    }

    if (action === "patch" && req.method === "PATCH") {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      if (!UUID_RE.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      const raw = (req.body ?? {}) as Record<string, unknown>;
      req.body = parseLegalEntityBodyPaymentForm(raw);
      await handleLegalEntitiesPatch(req, res, pool, me, id);
      return;
    }

    if (action === "delete" && req.method === "DELETE") {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      if (!UUID_RE.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      await handleLegalEntitiesDelete(res, pool, me, id);
      return;
    }

    if (action === "trade-point-link" && req.method === "GET") {
      await handleTradePointLegalEntityLinkGet(req, res, pool, me);
      return;
    }

    if (action === "trade-point-link" && req.method === "POST") {
      await handleTradePointLegalEntityLinkUpsert(req, res, pool, me);
      return;
    }

    if (action === "list-full" && req.method === "GET") {
      await handleLegalEntitiesListFull(req, res, pool, me);
      return;
    }

    if (action === "history" && req.method === "GET") {
      await handleLegalEntitiesHistory(req, res, pool, me);
      return;
    }

    if (action === "create-full" && req.method === "POST") {
      await handleLegalEntitiesCreateFull(req, res, pool, me);
      return;
    }

    if (action === "patch-full" && req.method === "PATCH") {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      if (!UUID_RE.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      await handleLegalEntitiesPatchFull(req, res, pool, me, id);
      return;
    }

    if (action === "archive" && req.method === "POST") {
      const body = (req.body ?? {}) as { id?: unknown };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!UUID_RE.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      await handleLegalEntitiesArchive(res, pool, me, id, body as { updatedByName?: unknown; updatedByUserId?: unknown });
      return;
    }

    if (action === "set-main" && req.method === "POST") {
      const body = (req.body ?? {}) as { id?: unknown };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!UUID_RE.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      await handleLegalEntitiesSetMain(res, pool, me, id);
      return;
    }

    if (action === "bulk-import" && req.method === "POST") {
      await handleLegalEntitiesBulkImport(req, res, pool, me);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут legal-entities." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[legal-entities-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
