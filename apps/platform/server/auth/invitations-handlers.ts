/**
 * `/api/invitations/*` для Express (`npm run dev`).
 * Логика совпадает с Vercel `api/invitations/[action].ts` (там self-contained дубль).
 */

import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { UserRole } from "@shared/auth";
import { BUSINESS_ROLES } from "@shared/auth";
import { canInviteRole, roleHasPermission } from "@shared/auth-rbac";
import { auditLog, authUsers, invitations, userTeamMemberships } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "./auth-user-snapshot";
import { buildAuthCookie } from "./cookie";
import { getAuthDb } from "./db";
import { hashPassword } from "./password-hash";
import { isStrongEnough } from "./password-hash";
import { getClientIp } from "./request-meta";
import { createSession } from "./session-service";

const JSON_CT = "application/json; charset=utf-8";
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function timingSafeEqualHex(storedHex: string, plainToken: string): boolean {
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHex, "hex");
  } catch {
    return false;
  }
  const computed = createHash("sha256").update(plainToken, "utf8").digest();
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

function publicUserFromRow(r: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
}): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    status: r.status,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
  };
}

async function tryAudit(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getAuthDb();
    if (!db) return;
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] audit", input.action, m.slice(0, 200));
  }
}

function readUserAgent(headers: Record<string, string | string[] | undefined>): string | null {
  const ua = headers["user-agent"];
  if (typeof ua === "string") return ua || null;
  if (Array.isArray(ua) && ua[0]) return ua[0]!;
  return null;
}

function applyJson(res: Response, status: number, body: Record<string, unknown>, extra?: { setCookie?: string }): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  if (extra?.setCookie) res.setHeader("Set-Cookie", extra.setCookie);
  res.status(status).json(body);
}

export async function createInvitation(req: Request, res: Response): Promise<void> {
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

  const body = req.body as {
    email?: unknown;
    role?: unknown;
    teamId?: unknown;
    fullName?: unknown;
  };

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "";
  const teamId =
    body.teamId === null || body.teamId === undefined || body.teamId === ""
      ? null
      : typeof body.teamId === "string"
        ? body.teamId.trim()
        : null;
  const fullNameOpt =
    typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim().slice(0, 120) : null;

  if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
    return;
  }
  if (!BUSINESS_ROLES.includes(roleRaw as UserRole)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимая роль." });
    return;
  }
  const targetRole = roleRaw as UserRole;
  if (!canInviteRole(auth.role, targetRole)) {
    applyJson(res, 403, {
      success: false,
      code: "FORBIDDEN_ROLE",
      message: "Эта роль недоступна для приглашения.",
    });
    return;
  }
  if (fullNameOpt != null && (fullNameOpt.length < 1 || fullNameOpt.length > 120)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "ФИО: от 1 до 120 символов." });
    return;
  }
  if (teamId != null && !UUID_RE.test(teamId)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный идентификатор команды." });
    return;
  }

  try {
    const existingUser = await db.select({ id: authUsers.id, status: authUsers.status }).from(authUsers).where(eq(authUsers.email, rawEmail)).limit(1);
    if (existingUser.length > 0) {
      applyJson(res, 409, {
        success: false,
        code: "EMAIL_TAKEN",
        message: "Пользователь с таким email уже существует.",
      });
      return;
    }

    const pending = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(eq(invitations.email, rawEmail), gt(invitations.expiresAt, sql`NOW()`), isNull(invitations.acceptedAt)),
      )
      .limit(1);
    if (pending.length > 0) {
      applyJson(res, 409, {
        success: false,
        code: "ALREADY_INVITED",
        message: "Приглашение уже отправлено.",
      });
      return;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(rawToken);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    await db.insert(invitations).values({
      id,
      email: rawEmail,
      role: targetRole,
      teamId: teamId ?? null,
      invitedBy: auth.userId,
      tokenHash,
      expiresAt,
      acceptedAt: null,
    });

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.invitation.create",
      entityType: "invitation",
      entityId: id,
      metadata: { email: rawEmail, role: targetRole, teamId: teamId ?? undefined, fullName: fullNameOpt ?? undefined },
    });

    const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || `https://${req.headers.host ?? "localhost"}`;
    const acceptUrl = `${baseUrl.replace(/\/$/, "")}/invite/${rawToken}`;

    applyJson(res, 200, {
      success: true,
      invitation: {
        id,
        email: rawEmail,
        role: targetRole,
        teamId: teamId,
        expiresAt,
        acceptUrl,
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] create", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.invitedBy, auth.userId))
      .orderBy(desc(invitations.expiresAt));

    const now = Date.now();
    const list = rows.map((r) => {
      const ex = new Date(r.expiresAt).getTime();
      const acc = r.acceptedAt != null;
      let status: "pending" | "accepted" | "expired";
      if (acc) status = "accepted";
      else if (!Number.isFinite(ex) || ex <= now) status = "expired";
      else status = "pending";
      const createdAt = new Date(ex - INVITE_TTL_MS).toISOString();
      return {
        id: r.id,
        email: r.email,
        role: r.role,
        teamId: r.teamId,
        createdAt,
        expiresAt: r.expiresAt,
        acceptedAt: r.acceptedAt,
        status,
      };
    });

    applyJson(res, 200, { success: true, invitations: list });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] list", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  const body = req.body as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите идентификатор приглашения." });
    return;
  }

  try {
    const rows = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    const row = rows[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Приглашение не найдено." });
      return;
    }
    const own = row.invitedBy === auth.userId;
    const allowed = own
      ? roleHasPermission(auth.role, "invitations.revoke_own")
      : roleHasPermission(auth.role, "invitations.revoke_any");
    if (!allowed) {
      applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    if (row.acceptedAt != null) {
      applyJson(res, 409, {
        success: false,
        code: "ALREADY_ACCEPTED",
        message: "Приглашение уже принято.",
      });
      return;
    }

    const nowIso = new Date().toISOString();
    await db.update(invitations).set({ expiresAt: nowIso }).where(eq(invitations.id, id));

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.invitation.revoke",
      entityType: "invitation",
      entityId: id,
      metadata: {},
    });

    applyJson(res, 200, { success: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] revoke", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function previewInvitation(req: Request, res: Response): Promise<void> {
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  const q = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!q || q.length < 30 || q.length > 200) {
    applyJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Некорректная ссылка приглашения." });
    return;
  }

  try {
    const hash = sha256Hex(q);
    const rows = await db.select().from(invitations).where(eq(invitations.tokenHash, hash)).limit(1);
    const row = rows[0];
    if (!row || !timingSafeEqualHex(row.tokenHash, q)) {
      applyJson(res, 404, { success: false, code: "INVALID_TOKEN", message: "Приглашение не найдено." });
      return;
    }
    const now = Date.now();
    const ex = new Date(row.expiresAt).getTime();
    if (row.acceptedAt != null) {
      applyJson(res, 410, { success: false, code: "ALREADY_ACCEPTED", message: "Приглашение уже использовано." });
      return;
    }
    if (!Number.isFinite(ex) || ex <= now) {
      applyJson(res, 410, { success: false, code: "EXPIRED", message: "Срок действия приглашения истёк." });
      return;
    }

    applyJson(res, 200, {
      success: true,
      email: row.email,
      role: row.role,
      teamId: row.teamId,
      fullName: null,
      expiresAt: row.expiresAt,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] preview", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const body = req.body as { token?: unknown; fullName?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullNameRaw = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (!token || token.length < 30 || token.length > 200) {
    applyJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Некорректная ссылка приглашения." });
    return;
  }
  if (password.length < 8) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Пароль не короче 8 символов." });
    return;
  }
  const strength = isStrongEnough(password);
  if (!strength.ok) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: strength.reason });
    return;
  }

  const effectiveFullName = fullNameRaw || null;
  if (!effectiveFullName) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО." });
    return;
  }

  const headers = req.headers as Record<string, string | string[] | undefined>;
  const ip = getClientIp(headers);
  const userAgent = readUserAgent(headers);

  try {
    const hash = sha256Hex(token);
    const invRows = await db.select().from(invitations).where(eq(invitations.tokenHash, hash)).limit(1);
    const inv = invRows[0];
    if (!inv || !timingSafeEqualHex(inv.tokenHash, token)) {
      applyJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Приглашение не найдено." });
      return;
    }
    const now = Date.now();
    const ex = new Date(inv.expiresAt).getTime();
    if (inv.acceptedAt != null) {
      applyJson(res, 410, { success: false, code: "ALREADY_ACCEPTED", message: "Приглашение уже использовано." });
      return;
    }
    if (!Number.isFinite(ex) || ex <= now) {
      applyJson(res, 410, { success: false, code: "EXPIRED", message: "Срок действия приглашения истёк." });
      return;
    }

    const emailLower = inv.email.toLowerCase();
    const pwHash = await hashPassword(password);

    const existing = await db.select().from(authUsers).where(eq(authUsers.email, emailLower)).limit(1);
    let userId: string;
    let snapshot: {
      id: string;
      email: string;
      full_name: string;
      role: string;
      status: string;
      must_change_password: boolean;
      last_login_at: string | null;
    };

    if (existing.length > 0) {
      const u = existing[0]!;
      if (u.status !== "invited") {
        applyJson(res, 409, {
          success: false,
          code: "EMAIL_TAKEN",
          message: "Пользователь с таким email уже существует.",
        });
        return;
      }
      userId = u.id;
      const up = await db
        .update(authUsers)
        .set({
          fullName: effectiveFullName,
          role: inv.role as typeof authUsers.$inferInsert.role,
          status: "active",
          passwordHash: pwHash,
          mustChangePassword: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(authUsers.id, userId))
        .returning({
          id: authUsers.id,
          email: authUsers.email,
          full_name: authUsers.fullName,
          role: authUsers.role,
          status: authUsers.status,
          must_change_password: authUsers.mustChangePassword,
          last_login_at: authUsers.lastLoginAt,
        });
      snapshot = up[0]!;
    } else {
      userId = randomUUID();
      const ins = await db
        .insert(authUsers)
        .values({
          id: userId,
          email: emailLower,
          fullName: effectiveFullName,
          role: inv.role,
          status: "active",
          passwordHash: pwHash,
          mustChangePassword: false,
          phone: null,
          createdBy: null,
        })
        .returning({
          id: authUsers.id,
          email: authUsers.email,
          full_name: authUsers.fullName,
          role: authUsers.role,
          status: authUsers.status,
          must_change_password: authUsers.mustChangePassword,
          last_login_at: authUsers.lastLoginAt,
        });
      snapshot = ins[0]!;
    }

    if (inv.teamId) {
      try {
        await db
          .insert(userTeamMemberships)
          .values({
            userId,
            teamId: inv.teamId,
            roleInTeam: inv.role,
          })
          .onConflictDoNothing();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[invitations] membership", m.slice(0, 200));
      }
    }

    await db.update(invitations).set({ acceptedAt: sql`NOW()` }).where(eq(invitations.id, inv.id));

    await tryAudit({
      actorUserId: userId,
      action: "auth.invitation.accept",
      entityType: "invitation",
      entityId: inv.id,
      metadata: { invitationId: inv.id },
    });

    let lastLoginAt: string | null = snapshot.last_login_at;
    try {
      const up2 = await db
        .update(authUsers)
        .set({ lastLoginAt: sql`NOW()` })
        .where(eq(authUsers.id, userId))
        .returning({ last_login_at: authUsers.lastLoginAt });
      const v = up2[0]?.last_login_at;
      if (v != null) lastLoginAt = v ?? null;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[invitations] accept lastLoginAt", m.slice(0, 200));
    }

    const sess = await createSession({ userId, userAgent, ip });
    await tryAudit({
      actorUserId: userId,
      action: "auth.login",
      entityType: "session",
      entityId: sess.sessionId,
      metadata: { ip, userAgent, via: "invitation_accept" },
    });

    const userJson = publicUserFromRow({
      ...snapshot,
      last_login_at: lastLoginAt,
    });

    applyJson(
      res,
      200,
      { success: true, user: userJson },
      { setCookie: buildAuthCookie(sess.refreshToken) },
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[invitations] accept", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
