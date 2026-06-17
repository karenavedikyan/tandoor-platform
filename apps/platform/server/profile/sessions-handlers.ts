/**
 * `/api/admin/sessions-*-self` для Express (`npm run dev`).
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { auditLog, sessions } from "../../shared/auth-schema.js";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { parseAuthRefreshToken } from "../auth/cookie";
import { getAuthDb } from "../auth/db";

const JSON_CT = "application/json; charset=utf-8";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function timingSafeEqualHex(storedHex: string, plainToken: string): boolean {
  try {
    const a = Buffer.from(storedHex, "hex");
    const b = createHash("sha256").update(plainToken, "utf8").digest();
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function tryAudit(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getAuthDb();
    if (!db) return;
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] audit", input.action, m.slice(0, 200));
  }
}

export async function listSelfSessions(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const raw = parseAuthRefreshToken(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);

  try {
    const rows = await db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ip: sessions.ip,
        expiresAt: sessions.expiresAt,
        refreshTokenHash: sessions.refreshTokenHash,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, auth.userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, sql`NOW()`)))
      .orderBy(desc(sessions.expiresAt));

    const list = rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ip: r.ip,
      expiresAt: r.expiresAt,
      current: !!(raw && timingSafeEqualHex(r.refreshTokenHash, raw)),
    }));

    applyJson(res, 200, { success: true, sessions: list });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] sessions-list-self", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function revokeSelfSession(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = (req.body ?? {}) as { id?: unknown };
  const sid = typeof body.id === "string" ? body.id.trim() : "";
  if (!sid || !UUID_RE.test(sid)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор сессии." });
    return;
  }

  const raw = parseAuthRefreshToken(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
  if (!raw) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  try {
    const row = await db
      .select({ id: sessions.id, refreshTokenHash: sessions.refreshTokenHash })
      .from(sessions)
      .where(and(eq(sessions.id, sid), eq(sessions.userId, auth.userId), isNull(sessions.revokedAt)))
      .limit(1);
    const r0 = row[0];
    if (!r0) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Сессия не найдена." });
      return;
    }
    if (timingSafeEqualHex(r0.refreshTokenHash, raw)) {
      applyJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Текущую сессию нельзя отозвать здесь, используйте выход.",
      });
      return;
    }

    await db.update(sessions).set({ revokedAt: sql`NOW()` }).where(eq(sessions.id, sid));

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.session.revoke_self",
      entityType: "session",
      entityId: sid,
      metadata: {},
    });

    applyJson(res, 200, { success: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] sessions-revoke-self", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function revokeOtherSelfSessions(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const raw = parseAuthRefreshToken(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
  if (!raw) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  const curHash = sha256Hex(raw);

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  try {
    const rev = await db
      .update(sessions)
      .set({ revokedAt: sql`NOW()` })
      .where(and(eq(sessions.userId, auth.userId), isNull(sessions.revokedAt), ne(sessions.refreshTokenHash, curHash)))
      .returning({ id: sessions.id });

    const revoked = rev.length;

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.session.revoke_others_self",
      entityType: "user",
      entityId: auth.userId,
      metadata: { revoked },
    });

    applyJson(res, 200, { success: true, revoked });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] sessions-revoke-others-self", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
