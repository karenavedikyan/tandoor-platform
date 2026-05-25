/**
 * POST /api/admin/admin-recovery — webhook Telegram для аварийного сброса пароля admin.
 * Логика совпадает с Vercel `api/admin/[action].ts` (action admin-recovery).
 */

import type { Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { auditLog } from "@shared/auth-schema";
import { getAuthDb } from "../auth/db";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function resolveDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

type NeonSql = ReturnType<typeof neon>;
let cachedSql: NeonSql | null | undefined;

function getNeonSql(): NeonSql | null {
  if (cachedSql !== undefined) return cachedSql;
  const url = resolveDatabaseUrl();
  if (!url) {
    cachedSql = null;
    return null;
  }
  cachedSql = neon(url);
  return cachedSql;
}

const tgRecoveryLastIssued = new Map<number, number>();

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function readRecoverySecretHeader(headers: Record<string, string | string[] | undefined>): string | null {
  const a = headers["x-recovery-secret"];
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && a[0]?.trim()) return a[0]!.trim();
  const b = headers["x-telegram-bot-api-secret-token"];
  if (typeof b === "string" && b.trim()) return b.trim();
  if (Array.isArray(b) && b[0]?.trim()) return b[0]!.trim();
  return null;
}

function parseTelegramWhitelist(): Set<number> {
  const raw = process.env.TG_RECOVERY_WHITELIST?.trim();
  if (!raw) return new Set();
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const x = part.trim();
    if (!x) continue;
    const n = Number(x);
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

function pickPublicHost(headers: Record<string, string | string[] | undefined>): string {
  const xf = headers["x-forwarded-host"];
  if (typeof xf === "string" && xf.trim()) return xf.trim().split(",")[0]!.trim();
  if (Array.isArray(xf) && xf[0]?.trim()) return xf[0]!.trim().split(",")[0]!.trim();
  const h = headers.host;
  if (typeof h === "string" && h.trim()) return h.trim();
  if (Array.isArray(h) && h[0]?.trim()) return h[0]!.trim();
  return "localhost";
}

function pickPublicAppOrigin(headers: Record<string, string | string[] | undefined>): string {
  const envUrl = process.env.PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      const normalized = envUrl.includes("://") ? envUrl : `https://${envUrl}`;
      const u = new URL(normalized);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return `https://${pickPublicHost(headers)}`;
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
    console.error("[api/admin] admin-recovery audit", input.action, m.slice(0, 200));
  }
}

async function tgSendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN?.trim();
  if (!token) {
    console.warn("[api/admin] admin-recovery: TG_BOT_TOKEN не задан, сообщение не отправлено");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[api/admin] admin-recovery sendMessage", res.status, t.slice(0, 200));
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[api/admin] admin-recovery sendMessage network", m.slice(0, 200));
  }
}

export async function postAdminTelegramRecovery(req: Request, res: Response): Promise<void> {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const expected = process.env.TG_RECOVERY_SECRET?.trim();
  const got = readRecoverySecretHeader(headers);
  if (!expected || !got || !timingSafeEqualUtf8(expected, got)) {
    res.status(401).json({ ok: false });
    return;
  }

  const sql = getNeonSql();
  if (!sql) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const rawBody = req.body;
  const body = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
  const msg = body.message as Record<string, unknown> | undefined;
  const textRaw = msg && typeof msg.text === "string" ? msg.text.trim() : "";
  const from = msg && typeof msg.from === "object" && msg.from !== null ? (msg.from as Record<string, unknown>) : undefined;
  const chat = msg && typeof msg.chat === "object" && msg.chat !== null ? (msg.chat as Record<string, unknown>) : undefined;
  const fromId = from && typeof from.id === "number" && Number.isFinite(from.id) ? from.id : null;
  const chatId = chat && typeof chat.id === "number" && Number.isFinite(chat.id) ? chat.id : null;

  if (!textRaw || fromId == null) {
    applyJson(res, 200, { ok: true });
    return;
  }

  const whitelist = parseTelegramWhitelist();
  if (!whitelist.has(fromId)) {
    await tryAudit({
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "not_in_whitelist", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "Доступ к команде восстановления запрещён.");
    applyJson(res, 200, { ok: true });
    return;
  }

  if (textRaw.startsWith("/start")) {
    if (chatId != null) {
      await tgSendMessage(
        chatId,
        "Бот восстановления Tandoor. Отправьте команду /reset, чтобы получить одноразовую ссылку для сброса пароля.",
      );
    }
    applyJson(res, 200, { ok: true });
    return;
  }

  if (textRaw !== "/reset") {
    if (chatId != null) await tgSendMessage(chatId, "Доступна только команда /reset.");
    applyJson(res, 200, { ok: true });
    return;
  }

  await tryAudit({
    actorUserId: null,
    action: "auth.tg_recovery.requested",
    entityType: "telegram_user",
    entityId: String(fromId),
    metadata: { tgUserId: fromId },
  });

  const now = Date.now();
  const prev = tgRecoveryLastIssued.get(fromId);
  if (prev != null && now - prev < 10 * 60 * 1000) {
    await tryAudit({
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "rate_limit", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "Слишком частые запросы. Попробуйте через несколько минут.");
    applyJson(res, 200, { ok: true });
    return;
  }

  const urows = (await sql`
    SELECT id, role, status FROM users WHERE telegram_user_id = ${fromId} LIMIT 1`) as { id: string; role: string; status: string }[];
  const u = urows[0];
  if (!u) {
    await tryAudit({
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "no_user", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "К этому Telegram-аккаунту не привязан пользователь Tandoor.");
    applyJson(res, 200, { ok: true });
    return;
  }
  if (u.role !== "admin") {
    await tryAudit({
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "not_admin", tgUserId: fromId, userId: u.id },
    });
    if (chatId != null) await tgSendMessage(chatId, "Восстановление через Telegram доступно только администраторам.");
    applyJson(res, 200, { ok: true });
    return;
  }
  if (u.status !== "active") {
    await tryAudit({
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "inactive", tgUserId: fromId, userId: u.id },
    });
    if (chatId != null) await tgSendMessage(chatId, "Пользователь неактивен.");
    applyJson(res, 200, { ok: true });
    return;
  }

  const userId = u.id;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);

  await sql`
    UPDATE password_reset_links SET used_at = NOW(), used_ip = 'superseded_by_tg'
    WHERE user_id = ${userId}::uuid AND used_at IS NULL`;

  const ins = (await sql`
    INSERT INTO password_reset_links (user_id, token_hash, created_by, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${userId}::uuid, NOW() + interval '1 hour')
    RETURNING id, expires_at`) as { id: string; expires_at: string }[];
  const linkRow = ins[0];
  if (!linkRow) {
    console.warn("[api/admin] admin-recovery: insert failed");
    applyJson(res, 200, { ok: true });
    return;
  }

  await tryAudit({
    actorUserId: null,
    action: "auth.tg_recovery.issued",
    entityType: "user",
    entityId: userId,
    metadata: { tgUserId: fromId, linkId: linkRow.id, expiresAt: linkRow.expires_at },
  });

  tgRecoveryLastIssued.set(fromId, now);

  const origin = pickPublicAppOrigin(headers);
  const href = `${origin}/#/reset?token=${encodeURIComponent(token)}`;
  if (chatId != null) {
    await tgSendMessage(
      chatId,
      `Ссылка для смены пароля (действует 1 час):\n${href}\n\nПерейдите по ссылке и задайте новый пароль. Не пересылайте её.`,
    );
  }

  applyJson(res, 200, { ok: true });
}
