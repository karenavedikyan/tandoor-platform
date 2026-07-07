/**
 * Showcase matrix API for 1C shadow tables — mirrors /api/showcase-matrix/*
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import { canAccessOneCShowroom } from "../../../shared/one-c-showroom-handlers.js";
import {
  handleOneCShowcaseMatrixBatchSync,
  handleOneCShowcaseMatrixHistory,
  handleOneCShowcaseMatrixList,
  handleOneCShowcaseMatrixScope,
  handleOneCShowcaseMatrixScopeAll,
  handleOneCShowcaseMatrixSnapshotRange,
  handleOneCShowcaseMatrixSnapshotUpsert,
  handleOneCShowcaseMatrixUpsert,
  sendOneCShowcaseMatrixError,
} from "../../../shared/one-c-showcase-matrix-handlers.js";
import type { ShowcaseMatrixSessionUser } from "../../../shared/showcase-matrix-handlers.js";

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function parseQueryInt(raw: unknown): number | undefined {
  const s = parseQueryString(raw);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function toSessionUser(me: {
  id: string;
  role: string;
  status: string;
  full_name: string;
}): ShowcaseMatrixSessionUser {
  return {
    id: me.id,
    role: me.role,
    status: me.status,
    fullName: me.full_name,
  };
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

    if (action === "list" && req.method === "GET") {
      const data = await handleOneCShowcaseMatrixList(pool, {
        tradePointId: parseQueryString(req.query.tradePointId),
        dealerId: parseQueryString(req.query.dealerId),
      });
      sendJson(res, 200, data);
      return;
    }

    if (action === "history" && req.method === "GET") {
      const data = await handleOneCShowcaseMatrixHistory(pool, {
        tradePointId: parseQueryString(req.query.tradePointId),
        dealerId: parseQueryString(req.query.dealerId),
        limit: parseQueryInt(req.query.limit),
      });
      sendJson(res, 200, data);
      return;
    }

    if (action === "upsert" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixUpsert(
        pool,
        toSessionUser(me),
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendJson(res, 200, data);
      return;
    }

    if (action === "batch-sync" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixBatchSync(
        pool,
        toSessionUser(me),
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendJson(res, 200, data);
      return;
    }

    if (action === "scope" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixScope(pool, (req.body ?? {}) as Record<string, unknown>);
      sendJson(res, 200, data);
      return;
    }

    if (action === "scope-all" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixScopeAll(pool, (req.body ?? {}) as Record<string, unknown>);
      sendJson(res, 200, data);
      return;
    }

    if (action === "snapshot-upsert" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixSnapshotUpsert(
        pool,
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendJson(res, 200, data);
      return;
    }

    if (action === "snapshot-range" && req.method === "POST") {
      const data = await handleOneCShowcaseMatrixSnapshotRange(
        pool,
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестное действие." });
  } catch (e) {
    sendOneCShowcaseMatrixError(res, e);
  }
}
