/**
 * Showcase matrix catalog API (Промт 159/160):
 *   GET  /api/showcase-matrix-catalog/list
 *   GET  /api/showcase-matrix-catalog/get?id=
 *   GET  /api/showcase-matrix-catalog/resolve
 *   POST /api/showcase-matrix-catalog/upsert
 *   POST /api/showcase-matrix-catalog/set-status
 *   POST /api/showcase-matrix-catalog/delete
 *   POST /api/showcase-matrix-catalog/replace-models
 *   POST /api/showcase-matrix-catalog/batch-sync
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { canManageShowcaseMatrixCatalogServer } from "../../shared/showcase-matrix-catalog-access.js";
import {
  batchSyncMatrixCatalog,
  deleteMatrixDef,
  getMatrixDef,
  listMatrixDefs,
  parseMatrixDefModelInput,
  parseMatrixDefUpsertInput,
  replaceMatrixDefModels,
  resolveActiveMatrixDef,
  setMatrixDefStatus,
  upsertMatrixDef,
  ShowcaseMatrixCatalogValidationError,
  type ShowcaseMatrixCatalogActor,
  type ShowcaseMatrixCatalogClientCategory,
  type ShowcaseMatrixCatalogScopeKind,
  type ShowcaseMatrixCatalogStatus,
  type ShowcaseMatrixDefModelInput,
} from "../../shared/showcase-matrix-catalog-handlers.js";

const CATALOG_READ_ROLES = new Set([
  "admin",
  "director",
  "rop",
  "regional_manager",
  "manager",
  "marketer",
  "analyst",
]);

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function assertCatalogReadRole(me: { role: string; status: string }): boolean {
  return me.status === "active" && CATALOG_READ_ROLES.has(me.role);
}

function toActor(me: {
  id: string;
  role: string;
  status: string;
  full_name: string;
}): ShowcaseMatrixCatalogActor {
  return {
    id: me.id,
    role: me.role,
    status: me.status,
    fullName: me.full_name,
  };
}

function parseClientCategoryQuery(raw: unknown): ShowcaseMatrixCatalogClientCategory | undefined {
  const s = parseQueryString(raw);
  if (!s) return undefined;
  const allowed = new Set([
    "new_client",
    "top150",
    "top350",
    "top500",
    "top500plus",
  ]);
  return allowed.has(s) ? (s as ShowcaseMatrixCatalogClientCategory) : undefined;
}

function parseScopeKindQuery(raw: unknown): ShowcaseMatrixCatalogScopeKind | undefined {
  const s = parseQueryString(raw);
  if (s === "global" || s === "region" || s === "city") return s;
  return undefined;
}

function parseStatusQuery(raw: unknown): ShowcaseMatrixCatalogStatus | undefined {
  const s = parseQueryString(raw);
  if (s === "draft" || s === "published" || s === "archived") return s;
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
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

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (!assertCatalogReadRole(me)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const actor = toActor(me);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (action === "list" && req.method === "GET") {
      const defs = await listMatrixDefs(pool, {
        clientCategory: parseClientCategoryQuery(req.query.clientCategory),
        scopeKind: parseScopeKindQuery(req.query.scopeKind),
        status: parseStatusQuery(req.query.status),
        region: parseQueryString(req.query.region),
        city: parseQueryString(req.query.city),
      });
      sendJson(res, 200, { success: true, defs });
      return;
    }

    if (action === "get" && req.method === "GET") {
      const id = parseQueryString(req.query.id);
      if (!id) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      const def = await getMatrixDef(pool, id);
      if (!def) {
        sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Матрица не найдена." });
        return;
      }
      sendJson(res, 200, { success: true, def });
      return;
    }

    if (action === "resolve" && req.method === "GET") {
      const clientCategory = parseClientCategoryQuery(req.query.clientCategory);
      if (!clientCategory) {
        sendJson(res, 400, {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Укажите clientCategory.",
        });
        return;
      }
      const onDate = parseQueryString(req.query.onDate) ?? new Date().toISOString().slice(0, 10);
      const def = await resolveActiveMatrixDef(pool, {
        clientCategory,
        region: parseQueryString(req.query.region) ?? null,
        city: parseQueryString(req.query.city) ?? null,
        onDate,
      });
      sendJson(res, 200, { success: true, def });
      return;
    }

    const mutating =
      (action === "upsert" && req.method === "POST") ||
      (action === "set-status" && req.method === "POST") ||
      (action === "delete" && req.method === "POST") ||
      (action === "replace-models" && req.method === "POST") ||
      (action === "batch-sync" && req.method === "POST");

    if (mutating && !canManageShowcaseMatrixCatalogServer(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    if (action === "upsert" && req.method === "POST") {
      const input = parseMatrixDefUpsertInput(body);
      const result = await upsertMatrixDef(pool, actor, input);
      sendJson(res, 200, { success: true, def: result.def, idempotent: result.idempotent });
      return;
    }

    if (action === "set-status" && req.method === "POST") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const status = parseStatusQuery(body.status);
      if (!id || !status) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id и status." });
        return;
      }
      const def = await setMatrixDefStatus(pool, id, status, actor);
      sendJson(res, 200, { success: true, def });
      return;
    }

    if (action === "delete" && req.method === "POST") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
        return;
      }
      await deleteMatrixDef(pool, id, actor);
      sendJson(res, 200, { success: true });
      return;
    }

    if (action === "replace-models" && req.method === "POST") {
      const defId = typeof body.defId === "string" ? body.defId.trim() : "";
      if (!defId) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите defId." });
        return;
      }
      const rawModels = body.models;
      if (!Array.isArray(rawModels)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите models." });
        return;
      }
      const models: ShowcaseMatrixDefModelInput[] = rawModels.map((m) =>
        parseMatrixDefModelInput((m ?? {}) as Record<string, unknown>),
      );
      const replaced = await replaceMatrixDefModels(pool, defId, models, actor);
      sendJson(res, 200, { success: true, models: replaced });
      return;
    }

    if (action === "batch-sync" && req.method === "POST") {
      const rawOps = body.ops;
      if (!Array.isArray(rawOps)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ops." });
        return;
      }
      const ops = rawOps as Parameters<typeof batchSyncMatrixCatalog>[2];
      const payload = await batchSyncMatrixCatalog(pool, actor, ops);
      sendJson(res, 200, { success: true, ...payload });
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
      return;
    }

    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут showcase-matrix-catalog.",
    });
  } catch (e) {
    if (e instanceof ShowcaseMatrixCatalogValidationError) {
      sendJson(res, 400, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[showcase-matrix-catalog-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
