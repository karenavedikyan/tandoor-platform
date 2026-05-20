/**
 * GET /api/bitrix24/oauth/callback для Express (Node).
 * Обмен code → token, HttpOnly session cookie, редирект в ЛК.
 * Не логирует code, access_token, refresh_token.
 */

import {
  buildClearPersonalSessionCookie,
  buildSetPersonalSessionCookie,
  cookieSecureFlag,
  readCookieValue,
  sealPersonalSession,
  type Bitrix24PersonalSessionPayload,
} from "./bitrix24-oauth-crypto-cookie";
import { exchangeAuthorizationCode, fetchBitrixUserCurrent, normalizePortalBase } from "./bitrix24-oauth-token-http";

export type Bitrix24OAuthCallbackHttpResult =
  | { kind: "redirect"; location: string; setCookies: string[] }
  | { kind: "json"; status: number; body: Record<string, unknown>; setCookies?: string[] };

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function lkPublicOrigin(): string {
  const o = strEnv("BITRIX24_LK_PUBLIC_ORIGIN").replace(/\/+$/, "");
  return o || "https://tandoor-platform.vercel.app";
}

export async function runBitrix24OAuthCallback(input: {
  query: Record<string, unknown>;
  cookieHeader: string | undefined;
}): Promise<Bitrix24OAuthCallbackHttpResult> {
  const secure = cookieSecureFlag();
  const clearState = ["b24_oauth_state=", "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=0", secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");

  const stateFromQuery = firstQuery(input.query.state);
  const stateFromCookie = readCookieValue(input.cookieHeader, "b24_oauth_state");

  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    return {
      kind: "json",
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_STATE_MISMATCH",
        message: "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
      },
      setCookies: [clearState],
    };
  }

  const code = firstQuery(input.query.code);
  if (!code) {
    return {
      kind: "json",
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_MISSING_CODE",
        message: "В ответе Bitrix24 нет кода авторизации. Попробуйте подключить Bitrix24 снова.",
      },
      setCookies: [clearState],
    };
  }

  if (!strEnv("BITRIX24_OAUTH_COOKIE_SECRET")) {
    return {
      kind: "json",
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_COOKIE_SECRET_MISSING",
        message: "На сервере не задан BITRIX24_OAUTH_COOKIE_SECRET — нельзя безопасно сохранить сессию Bitrix24.",
      },
      setCookies: [clearState],
    };
  }

  const tok = await exchangeAuthorizationCode(code);
  if (!tok.ok) {
    return {
      kind: "json",
      status: tok.status,
      body: { success: false, code: tok.code, message: tok.message },
      setCookies: [clearState],
    };
  }

  const portalBase = normalizePortalBase(strEnv("BITRIX24_PORTAL_DOMAIN"));
  const user = await fetchBitrixUserCurrent(portalBase, tok.tokens.access_token);

  const expires_at_ms = Date.now() + tok.tokens.expires_in * 1000;
  const payload: Bitrix24PersonalSessionPayload = {
    access_token: tok.tokens.access_token,
    refresh_token: tok.tokens.refresh_token,
    expires_at_ms,
    portal_base: portalBase,
    bitrix_user_id: user.bitrixUserId,
    user_name: user.name,
  };

  const sealed = sealPersonalSession(payload);
  if (!sealed) {
    return {
      kind: "json",
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_SEAL_FAILED",
        message: "Не удалось зашифровать сессию Bitrix24. Проверьте BITRIX24_OAUTH_COOKIE_SECRET.",
      },
      setCookies: [clearState],
    };
  }

  if (sealed.length > 3600) {
    return {
      kind: "json",
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_COOKIE_TOO_LARGE",
        message: "Токены Bitrix24 слишком длинные для cookie. Нужно серверное хранилище сессий.",
      },
      setCookies: [clearState],
    };
  }

  const sessionCookie = buildSetPersonalSessionCookie(sealed, secure);
  const location = `${lkPublicOrigin()}/#/communications?bitrix24=connected`;

  return {
    kind: "redirect",
    location,
    setCookies: [clearState, sessionCookie],
  };
}

export function runBitrix24OAuthDisconnect(): { setCookies: string[] } {
  const secure = cookieSecureFlag();
  return { setCookies: [buildClearPersonalSessionCookie(secure)] };
}
