/**
 * Общие утилиты для admin serverless (сессия, пул Neon, CSRF).
 * Не импортировать client seed / sales-control — только для лёгких и seed-эндпоинтов.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  makePoolFromNeon,
  type NeonHttp,
  type PoolLike,
} from "../../server/db/neon-client.js";

export type { NeonHttp, PoolLike };
export { makePoolFromNeon };

let cachedPool: PoolLike | null | undefined;

function resolveDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

export function getPool(): PoolLike | null {
  if (cachedPool !== undefined) return cachedPool;
  const url = resolveDatabaseUrl();
  if (!url) {
    cachedPool = null;
    return null;
  }
  cachedPool = makePoolFromNeon(neon(url));
  return cachedPool;
}

const AUTH_COOKIE = "tandoor_auth_sess";
const JSON_CT = "application/json; charset=utf-8";

export function vercelHeaders(req: VercelRequest): Record<string, string | string[] | undefined> {
  return (req.headers ?? {}) as Record<string, string | string[] | undefined>;
}

export function enforceCsrfOrigin(req: VercelRequest): boolean {
  const allowed = new Set<string>(["https://tandoor-platform.vercel.app"]);
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:5173");
    allowed.add("http://localhost:3000");
  }
  const h = req.headers ?? {};
  const originRaw =
    (typeof h.origin === "string" ? h.origin : undefined) ??
    (typeof h.referer === "string" ? h.referer : undefined);
  if (!originRaw) return true;
  try {
    const u = new URL(originRaw);
    return allowed.has(u.origin);
  } catch {
    return false;
  }
}

export function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function timingSafeEqualHex(storedHex: string, plainToken: string): boolean {
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHex, "hex");
  } catch {
    return false;
  }
  const computed = sha256Buffer(plainToken);
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

export function parseAuthRefreshToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader?.trim()) return null;
  for (const p of cookieHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== AUTH_COOKIE) continue;
    try {
      const raw = decodeURIComponent(p.slice(idx + 1).trim());
      return raw || null;
    } catch {
      return p.slice(idx + 1).trim() || null;
    }
  }
  return null;
}

export type DbUserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  telegram_user_id: string | null;
};

export async function resolveCurrentUser(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<DbUserRow | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<Omit<DbUserRow, "telegram_user_id"> & { refresh_token_hash: string }>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status, u.must_change_password, u.last_login_at, u.created_at,
            s.refresh_token_hash
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  const { refresh_token_hash: _h, ...u } = row;
  return { ...u, telegram_user_id: null };
}
