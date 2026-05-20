/**
 * HttpOnly cookie payload for Bitrix24 OAuth (access + refresh).
 * AES-256-GCM; ключ из BITRIX24_OAUTH_COOKIE_SECRET (scrypt).
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export const B24_PERSONAL_SESSION_COOKIE = "b24_personal_sess";

const SALT = "bitrix24-oauth-cookie-v1";
const VERSION = 1;

export type Bitrix24PersonalSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at_ms: number;
  portal_base: string;
  bitrix_user_id?: string;
  user_name?: string;
};

function deriveKey(): Buffer | null {
  const s = process.env.BITRIX24_OAUTH_COOKIE_SECRET?.trim();
  if (!s) return null;
  return scryptSync(s, SALT, 32);
}

/** Возвращает base64url-токен для значения cookie или null, если секрет не задан. */
export function sealPersonalSession(payload: Bitrix24PersonalSessionPayload): string | null {
  const key = deriveKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]);
  return out.toString("base64url");
}

export function unsealPersonalSession(sealed: string): Bitrix24PersonalSessionPayload | null {
  const key = deriveKey();
  if (!key || !sealed.trim()) return null;
  try {
    const raw = Buffer.from(sealed.trim(), "base64url");
    if (raw.length < 1 + 12 + 16 + 1) return null;
    if (raw[0] !== VERSION) return null;
    const iv = raw.subarray(1, 13);
    const tag = raw.subarray(13, 29);
    const enc = raw.subarray(29);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const obj = JSON.parse(dec.toString("utf8")) as unknown;
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return null;
    const o = obj as Record<string, unknown>;
    const access_token = typeof o.access_token === "string" ? o.access_token : "";
    const refresh_token = typeof o.refresh_token === "string" ? o.refresh_token : "";
    const expires_at_ms = typeof o.expires_at_ms === "number" ? o.expires_at_ms : 0;
    const portal_base = typeof o.portal_base === "string" ? o.portal_base : "";
    if (!access_token || !refresh_token || !portal_base || !Number.isFinite(expires_at_ms)) return null;
    const bitrix_user_id = typeof o.bitrix_user_id === "string" ? o.bitrix_user_id : undefined;
    const user_name = typeof o.user_name === "string" ? o.user_name : undefined;
    return { access_token, refresh_token, expires_at_ms, portal_base, bitrix_user_id, user_name };
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader?.trim()) return "";
  for (const p of cookieHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(p.slice(idx + 1).trim());
    } catch {
      return p.slice(idx + 1).trim();
    }
  }
  return "";
}

export function cookieSecureFlag(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.BITRIX24_OAUTH_COOKIE_SECURE === "true";
}

function cookieSuffix(secure: boolean, maxAgeSec: number, path = "/"): string {
  const parts = [`Path=${path}`, "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeSec)}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** ~90 дней для cookie; сами токены Bitrix могут истечь раньше — refresh на запросах. */
export const B24_SESSION_COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60;

export function buildSetPersonalSessionCookie(sealed: string, secure: boolean): string {
  const v = encodeURIComponent(sealed);
  return `${B24_PERSONAL_SESSION_COOKIE}=${v}; ${cookieSuffix(secure, B24_SESSION_COOKIE_MAX_AGE_SEC)}`;
}

export function buildClearPersonalSessionCookie(secure: boolean): string {
  return `${B24_PERSONAL_SESSION_COOKIE}=; ${cookieSuffix(secure, 0)}`;
}
