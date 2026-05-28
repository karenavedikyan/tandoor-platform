/**
 * API комментариев клиента и ТТ (Postgres) — Промт 69.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { assertClientReadAccess, assertClientWriteAccess } from "./legal-entities-handlers.js";
import {
  mapClientCommentRow,
  parseCommentType,
  type ClientCommentScope,
} from "./client-comments-types.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;
const SCOPES = new Set<ClientCommentScope>(["dealer", "trade_point"]);

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sanitizeClientId(raw: string): string | null {
  const t = raw.trim();
  if (!t || !CLIENT_ID_RE.test(t)) return null;
  return t;
}

function parseScope(raw: unknown): ClientCommentScope | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as ClientCommentScope;
  return SCOPES.has(s) ? s : null;
}

function actorUserId(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

async function countActiveComments(pool: PoolLike, clientId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM client_comments WHERE client_id = $1 AND is_deleted = false`,
    [clientId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function getCommentRow(pool: PoolLike, id: string): Promise<ReturnType<typeof mapClientCommentRow> | null> {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query<Record<string, unknown>>(`SELECT * FROM client_comments WHERE id = $1::uuid LIMIT 1`, [id]);
  return r.rows[0] ? mapClientCommentRow(r.rows[0]) : null;
}

export async function handleClientCommentsList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const clientId = sanitizeClientId(typeof req.query.clientId === "string" ? req.query.clientId : "");
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientReadAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const includeDeleted =
    req.query.includeDeleted === "1" || req.query.includeDeleted === "true";
  const r = await pool.query<Record<string, unknown>>(
    includeDeleted
      ? `SELECT * FROM client_comments WHERE client_id = $1 ORDER BY created_at DESC`
      : `SELECT * FROM client_comments WHERE client_id = $1 AND is_deleted = false ORDER BY created_at DESC`,
    [clientId],
  );
  sendJson(res, 200, {
    success: true,
    clientId,
    items: r.rows.map(mapClientCommentRow),
  });
}

export async function handleClientCommentsCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const clientId = sanitizeClientId(String(body.clientId ?? ""));
  const scope = parseScope(body.scope) ?? "dealer";
  const scopeRef = typeof body.scopeRef === "string" && body.scopeRef.trim() ? body.scopeRef.trim() : null;
  const commentBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!clientId || !commentBody) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "clientId и body обязательны." });
    return;
  }
  if (scope === "trade_point" && !scopeRef) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите scopeRef для trade_point." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const type = parseCommentType(body.type, scope);
  const actorName = typeof body.createdByName === "string" ? body.createdByName.trim() : me.id;
  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO client_comments (
       client_id, scope, scope_ref, type, body, is_deleted,
       created_by_user_id, created_by_name, updated_at
     ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, NOW())
     RETURNING *`,
    [
      clientId,
      scope,
      scope === "dealer" ? null : scopeRef,
      type,
      commentBody,
      actorUserId(typeof body.createdByUserId === "string" ? body.createdByUserId : me.id),
      actorName || null,
    ],
  );
  sendJson(res, 201, { success: true, item: mapClientCommentRow(r.rows[0]!) });
}

export async function handleClientCommentsRequestDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as { id?: unknown; reason?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const cur = await getCommentRow(pool, id);
  if (!cur) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Комментарий не найден." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, cur.clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  void body.reason;
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE client_comments SET is_deleted = true, updated_at = NOW() WHERE id = $1::uuid RETURNING *`,
    [id],
  );
  sendJson(res, 200, { success: true, item: mapClientCommentRow(r.rows[0]!) });
}

type LsDealerComment = {
  id?: string;
  type?: string;
  body: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
};

type LsTpComment = {
  id?: string;
  body: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
};

export async function handleClientCommentsBulkImport(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as {
    clientId?: unknown;
    dealerComments?: unknown;
    tradePointComments?: unknown;
  };
  const clientId = sanitizeClientId(String(body.clientId ?? ""));
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const existing = await countActiveComments(pool, clientId);
  if (existing > 0) {
    sendJson(res, 409, { success: false, code: "ALREADY_EXISTS", message: "Комментарии уже есть в БД." });
    return;
  }

  const insertComment = async (
    scope: ClientCommentScope,
    scopeRef: string | null,
    c: LsDealerComment | LsTpComment,
    type: string,
  ) => {
    if (!c.body?.trim()) return;
    await pool.query(
      `INSERT INTO client_comments (
         client_id, scope, scope_ref, type, body, is_deleted,
         created_by_user_id, created_by_name, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, COALESCE($8::timestamptz, NOW()), COALESCE($9::timestamptz, NOW()))`,
      [
        clientId,
        scope,
        scopeRef,
        type,
        c.body.trim(),
        actorUserId(c.createdBy),
        c.createdByName?.trim() || null,
        c.createdAt ?? null,
        c.createdAt ?? null,
      ],
    );
  };

  const dealerComments = Array.isArray(body.dealerComments) ? (body.dealerComments as LsDealerComment[]) : [];
  for (const c of dealerComments) {
    await insertComment("dealer", null, c, parseCommentType(c.type, "dealer"));
  }

  const tpMap = body.tradePointComments;
  if (tpMap && typeof tpMap === "object") {
    for (const [tpId, arr] of Object.entries(tpMap as Record<string, LsTpComment[]>)) {
      if (!Array.isArray(arr)) continue;
      for (const c of arr) {
        await insertComment("trade_point", tpId, c, "general");
      }
    }
  }

  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM client_comments WHERE client_id = $1 AND is_deleted = false ORDER BY created_at DESC`,
    [clientId],
  );
  sendJson(res, 201, { success: true, clientId, items: r.rows.map(mapClientCommentRow) });
}
