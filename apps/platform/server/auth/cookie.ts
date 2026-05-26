/**
 * Cookie серверной auth (`tandoor_auth_sess`). Не смешивать с `b24_personal_sess`.
 */

import { sessionTtlSeconds } from "./session-ttl";

export const AUTH_COOKIE = "tandoor_auth_sess";
export const ADMIN_RETURN_COOKIE = "admin_return_sid";
const IMPERSONATION_TTL_SEC = 60 * 60;

function cookieSecureFlag(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.TANDOOR_AUTH_COOKIE_SECURE === "true";
}

function cookieSuffixParts(maxAgeSec: number): string[] {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeSec)}`];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts;
}

/**
 * Значение заголовка `Set-Cookie` для refresh-токена (opaque, без пользовательских данных в открытом виде кроме самого токена).
 */
export function buildAuthCookie(refreshToken: string, opts?: { maxAgeSec?: number }): string {
  const maxAgeSec = opts?.maxAgeSec ?? sessionTtlSeconds();
  const v = encodeURIComponent(refreshToken);
  return `${AUTH_COOKIE}=${v}; ${cookieSuffixParts(maxAgeSec).join("; ")}`;
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE}=; ${cookieSuffixParts(0).join("; ")}`;
}

export function buildAdminReturnCookie(refreshToken: string): string {
  const v = encodeURIComponent(refreshToken);
  return `${ADMIN_RETURN_COOKIE}=${v}; ${cookieSuffixParts(IMPERSONATION_TTL_SEC).join("; ")}`;
}

export function clearAdminReturnCookie(): string {
  return `${ADMIN_RETURN_COOKIE}=; ${cookieSuffixParts(0).join("; ")}`;
}

export function parseAdminReturnToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader?.trim()) return null;
  for (const p of cookieHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== ADMIN_RETURN_COOKIE) continue;
    try {
      const raw = decodeURIComponent(p.slice(idx + 1).trim());
      return raw || null;
    } catch {
      return p.slice(idx + 1).trim() || null;
    }
  }
  return null;
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
