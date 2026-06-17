/**
 * `/api/admin/audit-list` для Express (`npm run dev`).
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { roleHasPermission } from "../../shared/auth-rbac.js";
import { auditLog, authUsers } from "../../shared/auth-schema.js";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { getAuthDb } from "../auth/db";

const JSON_CT = "application/json; charset=utf-8";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

function qs(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
  return undefined;
}

export async function listAudit(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "audit.read")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const actor = qs(req.query.actor);
  const actionLike = qs(req.query.action);
  const entityType = qs(req.query.entityType);
  const entityId = qs(req.query.entityId);
  const fromIso = qs(req.query.from);
  const toIso = qs(req.query.to);
  const limitRaw = qs(req.query.limit);
  const offsetRaw = qs(req.query.offset);

  if (actor != null && actor !== "" && !UUID_RE.test(actor)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный фильтр по актору." });
    return;
  }

  let fromMs: number | null = null;
  let toMs: number | null = null;
  if (fromIso != null && fromIso !== "") {
    const t = Date.parse(fromIso);
    if (!Number.isFinite(t)) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректная дата «с»." });
      return;
    }
    fromMs = t;
  }
  if (toIso != null && toIso !== "") {
    const t = Date.parse(toIso);
    if (!Number.isFinite(t)) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректная дата «по»." });
      return;
    }
    toMs = t;
  }

  let limit = 100;
  if (limitRaw != null && limitRaw !== "") {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Параметр limit должен быть от 1 до 200." });
      return;
    }
    limit = n;
  }

  let offset = 0;
  if (offsetRaw != null && offsetRaw !== "") {
    const n = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Параметр offset должен быть неотрицательным." });
      return;
    }
    offset = n;
  }

  const conds = [];
  if (actor != null && actor !== "") {
    conds.push(eq(auditLog.actorUserId, actor));
  }
  if (actionLike != null && actionLike !== "") {
    conds.push(ilike(auditLog.action, `%${sanitizeLikeFragment(actionLike)}%`));
  }
  if (entityType != null && entityType !== "") {
    conds.push(eq(auditLog.entityType, entityType));
  }
  if (entityId != null && entityId !== "") {
    conds.push(eq(auditLog.entityId, entityId));
  }
  if (fromMs != null) {
    conds.push(gte(auditLog.createdAt, new Date(fromMs).toISOString()));
  }
  if (toMs != null) {
    conds.push(lte(auditLog.createdAt, new Date(toMs).toISOString()));
  }

  const where = conds.length ? and(...conds) : undefined;

  try {
    const [{ n: totalRaw }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where);
    const total = Number(totalRaw ?? 0);

    const rows = await db
      .select({
        id: auditLog.id,
        actorUserId: auditLog.actorUserId,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
        actorEmail: authUsers.email,
        actorFullName: authUsers.fullName,
      })
      .from(auditLog)
      .leftJoin(authUsers, eq(auditLog.actorUserId, authUsers.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => {
      const meta = r.metadata;
      let metadata: Record<string, unknown> | null = null;
      if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
        metadata = meta as Record<string, unknown>;
      }
      const actorOut =
        r.actorUserId != null && r.actorEmail
          ? { id: r.actorUserId, email: r.actorEmail, fullName: r.actorFullName ?? null }
          : null;
      return {
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: actorOut,
        metadata,
        createdAt: r.createdAt,
      };
    });

    applyJson(res, 200, { success: true, total, items });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] audit-list", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
