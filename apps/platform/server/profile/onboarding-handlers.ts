/**
 * Онбординг первого входа: статус, завершение, токен привязки Telegram.
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { UserRole } from "../../shared/auth.js";
import { auditLog, authUsers } from "../../shared/auth-schema.js";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { getAuthDb } from "../auth/db";
import { roleHasPermission } from "../../shared/auth-rbac.js";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

export async function getOnboardingStatus(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(auth.role as UserRole, "profile.read_self")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const rows = await db
      .select({
        mustChangePassword: authUsers.mustChangePassword,
        email: authUsers.email,
        phone: authUsers.phone,
        fullName: authUsers.fullName,
        telegramUserId: authUsers.telegramUserId,
        onboardingCompletedAt: authUsers.onboardingCompletedAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, auth.userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    const emailLower = row.email.trim().toLowerCase();
    const profileNeedsUpdate =
      emailLower.endsWith("@tandoor.local") ||
      row.phone == null ||
      row.phone.trim() === "" ||
      row.fullName.trim() === "";
    const telegramLinked = row.telegramUserId != null && Number.isFinite(row.telegramUserId);
    applyJson(res, 200, {
      success: true,
      mustChangePassword: row.mustChangePassword,
      profileNeedsUpdate,
      telegramLinked,
      completedAt: row.onboardingCompletedAt ?? null,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] onboarding-status", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function postOnboardingComplete(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(auth.role as UserRole, "profile.update_self")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const updated = await db
      .update(authUsers)
      .set({
        onboardingCompletedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(authUsers.id, auth.userId), isNull(authUsers.onboardingCompletedAt)))
      .returning({ onboardingCompletedAt: authUsers.onboardingCompletedAt });
    const done = updated[0];
    if (done?.onboardingCompletedAt) {
      await tryAudit({
        actorUserId: auth.userId,
        action: "user.onboarding.completed",
        entityType: "user",
        entityId: auth.userId,
        metadata: {},
      });
    }
    applyJson(res, 200, { success: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] onboarding-complete", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function postProfileTelegramLinkToken(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(auth.role as UserRole, "profile.update_self")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const rawTok = randomBytes(24).toString("base64url");
    const tokenHash = sha256Hex(rawTok);
    const ins = await db.execute(
      sql`INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at)
          VALUES (${tokenHash}, ${auth.userId}::uuid, NOW() + interval '15 minutes')
          RETURNING expires_at`,
    );
    const rows = ins.rows as unknown as { expires_at: string }[];
    const row = rows[0];
    if (!row) {
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }
    applyJson(res, 200, {
      success: true,
      botUrl: `https://t.me/Tandoor_ibot?start=link_${rawTok}`,
      expiresAt: row.expires_at,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] profile-telegram-link-token", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
