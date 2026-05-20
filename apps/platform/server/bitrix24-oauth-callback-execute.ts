/**
 * GET /api/bitrix24/oauth/callback для Express (Node) и Vercel.
 * Обмен code → token, HttpOnly session cookie, редирект в ЛК.
 * Не логирует code, access_token, refresh_token, client_secret.
 *
 * Ожидаемые ошибки — OAuthCallbackError с точным code; общий BITRIX24_OAUTH_CALLBACK_FAILED
 * только для неизвестных исключений (один catch в конце).
 */

import {
  buildClearPersonalSessionCookie,
  buildSetPersonalSessionCookie,
  cookieSecureFlag,
  readCookieValue,
  sealPersonalSession,
  type Bitrix24PersonalSessionPayload,
} from "./bitrix24-oauth-crypto-cookie";
import { OAuthCallbackError, type OAuthCallbackErrorCode, isOAuthCallbackError } from "./bitrix24-oauth-callback-error";
import {
  exchangeAuthorizationCode,
  fetchBitrixUserCurrent,
  normalizePortalBase,
  resolveTokenEndpoint,
} from "./bitrix24-oauth-token-http";

export type Bitrix24OAuthCallbackHttpResult =
  | { kind: "redirect"; location: string; setCookies: string[] }
  | { kind: "json"; status: number; body: Record<string, unknown>; setCookies?: string[] };

const MAX_SET_COOKIE_HEADER_BYTES = 3900;

function oauthCallbackLog(step: string, data?: Record<string, unknown>): void {
  console.error(`[bitrix24] oauth.callback:${step}`, data ?? {});
}

function fail(status: number, code: OAuthCallbackErrorCode, message: string, bitrixCode?: string): never {
  throw new OAuthCallbackError(status, code, message, bitrixCode);
}

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

function normalizeOAuthState(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
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

function buildClearStateCookie(secure: boolean): string {
  return [
    "b24_oauth_state=",
    "Path=/api/bitrix24/oauth",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function buildSpaErrorLocation(code: string, bitrixCode?: string): string {
  const qs = new URLSearchParams();
  qs.set("bitrix24", "error");
  qs.set("code", code);
  if (bitrixCode) qs.set("bitrixCode", bitrixCode);
  return `${lkPublicOrigin()}/?${qs.toString()}#/communications`;
}

function buildSpaSuccessLocation(): string {
  return `${lkPublicOrigin()}/?bitrix24=connected#/communications`;
}

function jsonError(
  status: number,
  code: string,
  message: string,
  setCookies: string[],
  bitrixCode?: string,
): Bitrix24OAuthCallbackHttpResult {
  const body: Record<string, unknown> = { success: false, code, message };
  if (bitrixCode) body.bitrixCode = bitrixCode;
  return { kind: "json", status, body, setCookies };
}

function portalOriginFromClientEndpoint(ep: string): string | undefined {
  const t = ep.trim().replace(/\/+$/, "");
  if (!/\/rest$/i.test(t)) return undefined;
  return t.replace(/\/rest$/i, "").replace(/\/+$/, "") || undefined;
}

function isUsablePortalUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    if (!u.hostname || u.hostname.length < 3) return false;
    return u.hostname.includes(".") || u.hostname === "localhost";
  } catch {
    return false;
  }
}

function resolvePortalBase(tok: { client_endpoint?: string }, envPortal: string): string {
  const envNorm = envPortal.trim() ? normalizePortalBase(envPortal) : "";
  const fromEp = tok.client_endpoint ? portalOriginFromClientEndpoint(tok.client_endpoint) : undefined;
  const epNorm = fromEp ? normalizePortalBase(fromEp) : "";
  const chosen = isUsablePortalUrl(envNorm) ? envNorm : epNorm;
  if (!isUsablePortalUrl(chosen)) {
    fail(
      503,
      "BITRIX24_OAUTH_NOT_CONFIGURED",
      "Укажите корректный BITRIX24_PORTAL_DOMAIN в переменных окружения (или убедитесь, что ответ OAuth содержит client_endpoint с доменом портала).",
    );
  }
  return chosen;
}

function safeTokenEndpointHost(): string {
  try {
    return new URL(`${resolveTokenEndpoint()}/`).hostname;
  } catch {
    return "invalid-token-endpoint";
  }
}

export async function runBitrix24OAuthCallback(input: {
  query: Record<string, unknown>;
  cookieHeader: string | undefined;
  prefersBrowserRedirect?: boolean;
}): Promise<Bitrix24OAuthCallbackHttpResult> {
  const secure = cookieSecureFlag();
  const clearState = buildClearStateCookie(secure);
  const prefersRedirect = input.prefersBrowserRedirect ?? true;

  const errorResult = (
    status: number,
    code: string,
    message: string,
    bitrixCode?: string,
    extraCookies?: string[],
  ): Bitrix24OAuthCallbackHttpResult => {
    const cookies = [clearState, ...(extraCookies ?? [])];
    if (prefersRedirect) {
      oauthCallbackLog("callback:redirect:error", { code, bitrixCode: bitrixCode ?? null, httpStatus: status });
      return { kind: "redirect", location: buildSpaErrorLocation(code, bitrixCode), setCookies: cookies };
    }
    oauthCallbackLog("callback:redirect:error", { code, bitrixCode: bitrixCode ?? null, httpStatus: status, kind: "json" });
    return jsonError(status, code, message, cookies, bitrixCode);
  };

  oauthCallbackLog("callback:start", {
    hasCookieHeader: Boolean(input.cookieHeader?.trim()),
    tokenEndpointHost: safeTokenEndpointHost(),
  });

  try {
    const stateFromQuery = normalizeOAuthState(firstQuery(input.query.state));
    const stateFromCookie = normalizeOAuthState(readCookieValue(input.cookieHeader, "b24_oauth_state"));

    if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
      oauthCallbackLog("callback:state-failed", {
        hasQueryState: Boolean(stateFromQuery),
        hasCookieState: Boolean(stateFromCookie),
        sameLength: stateFromQuery.length === stateFromCookie.length,
      });
      fail(
        400,
        "BITRIX24_OAUTH_STATE_MISMATCH",
        "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
      );
    }
    oauthCallbackLog("callback:state-ok", {});

    const authCode = firstQuery(input.query.code);
    if (!authCode) {
      const bitrixError = firstQuery(input.query.error);
      if (bitrixError) {
        oauthCallbackLog("callback:missing-code", { hasBitrixErrorParam: true });
        fail(
          400,
          "BITRIX24_OAUTH_AUTHORIZATION_DENIED",
          "Bitrix24 отклонил авторизацию. Попробуйте подключить Bitrix24 снова.",
        );
      }
      oauthCallbackLog("callback:missing-code", { hasBitrixErrorParam: false });
      fail(
        400,
        "BITRIX24_OAUTH_MISSING_CODE",
        "В ответе Bitrix24 нет кода авторизации. Попробуйте подключить Bitrix24 снова.",
      );
    }

    if (!strEnv("BITRIX24_OAUTH_COOKIE_SECRET")) {
      oauthCallbackLog("callback:cookie-seal:failed", { reason: "cookie_secret_missing" });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "На сервере не задан BITRIX24_OAUTH_COOKIE_SECRET — нельзя безопасно сохранить сессию Bitrix24.",
      );
    }

    oauthCallbackLog("callback:token-request:start", {
      tokenEndpointHost: safeTokenEndpointHost(),
      includeRedirectFirst: strEnv("BITRIX24_OAUTH_TOKEN_INCLUDE_REDIRECT_URI") === "true",
      preferPost: strEnv("BITRIX24_OAUTH_TOKEN_HTTP_METHOD").toLowerCase() === "post",
    });

    const tok = await exchangeAuthorizationCode(authCode);
    if (!tok.ok) {
      const ta = tok.tokenAttempt;
      oauthCallbackLog("callback:token-request:failed", {
        bitrixCode: ta.bitrixCode ?? null,
        httpStatus: ta.httpStatus,
        method: ta.httpMethod,
        includeRedirectUri: ta.includeRedirectUri,
      });
      fail(tok.status, tok.code as OAuthCallbackErrorCode, tok.message, tok.bitrixCode);
    }

    oauthCallbackLog("callback:token-request:success", {
      method: tok.exchangeMeta.httpMethod,
      includeRedirectUri: tok.exchangeMeta.includeRedirectUri,
      hasClientEndpoint: Boolean(tok.client_endpoint?.trim()),
    });

    const portalBase = resolvePortalBase(tok, strEnv("BITRIX24_PORTAL_DOMAIN"));
    const tokenRestCtx = (tok.client_endpoint?.trim() || portalBase) as string;

    let user: { bitrixUserId?: string; name?: string } = {};
    oauthCallbackLog("callback:user-current:start", {});
    try {
      const u = await fetchBitrixUserCurrent(tokenRestCtx, tok.tokens.access_token);
      user = { bitrixUserId: u.bitrixUserId, name: u.name };
      if (u.userCurrentError) {
        oauthCallbackLog("callback:user-current:failed", {
          code: "BITRIX24_OAUTH_USER_CURRENT_ERROR",
          bitrixCode: u.userCurrentBitrixCode ?? "unknown",
        });
      } else {
        oauthCallbackLog("callback:user-current:ok", { hasUserId: Boolean(user.bitrixUserId) });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      oauthCallbackLog("callback:user-current:failed", { threw: true, msg: m.slice(0, 200) });
    }

    const expires_at_ms = Date.now() + tok.tokens.expires_in * 1000;
    const restBase = tok.client_endpoint?.trim() || undefined;
    const payload: Bitrix24PersonalSessionPayload = {
      access_token: tok.tokens.access_token,
      refresh_token: tok.tokens.refresh_token,
      expires_at_ms,
      portal_base: portalBase,
      rest_base: restBase,
      bitrix_user_id: user.bitrixUserId,
      user_name: user.name,
    };

    oauthCallbackLog("callback:cookie-seal:start", {});
    let sealed: string | null;
    try {
      sealed = sealPersonalSession(payload);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      oauthCallbackLog("callback:cookie-seal:failed", { reason: "seal_threw", msg: m.slice(0, 200) });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "Не удалось зашифровать сессию Bitrix24. Проверьте BITRIX24_OAUTH_COOKIE_SECRET.",
      );
    }
    if (!sealed) {
      oauthCallbackLog("callback:cookie-seal:failed", { reason: "seal_returned_null" });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "Не удалось зашифровать сессию Bitrix24. Проверьте BITRIX24_OAUTH_COOKIE_SECRET.",
      );
    }

    if (sealed.length > 3600) {
      oauthCallbackLog("callback:cookie-seal:failed", { reason: "payload_too_large", sealedLen: sealed.length });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "Токены Bitrix24 слишком длинные для cookie. Нужно серверное хранилище сессий.",
      );
    }

    let sessionCookie: string;
    try {
      sessionCookie = buildSetPersonalSessionCookie(sealed, secure);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      oauthCallbackLog("callback:cookie-seal:failed", { reason: "build_set_cookie_threw", msg: m.slice(0, 200) });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "Не удалось сформировать cookie сессии Bitrix24. Проверьте размер токенов или секрет.",
      );
    }

    const cookieBytes = Buffer.byteLength(sessionCookie, "utf8");
    if (cookieBytes > MAX_SET_COOKIE_HEADER_BYTES) {
      oauthCallbackLog("callback:cookie-seal:failed", {
        reason: "set_cookie_header_too_large",
        cookieHeaderBytes: cookieBytes,
        maxBytes: MAX_SET_COOKIE_HEADER_BYTES,
      });
      fail(
        503,
        "BITRIX24_OAUTH_COOKIE_ERROR",
        "Слишком длинная cookie сессии для браузера или прокси. Нужно серверное хранилище сессий.",
      );
    }

    oauthCallbackLog("callback:session-cookie:set", { cookieHeaderBytes: cookieBytes });

    oauthCallbackLog("callback:redirect:success", { path: "connected" });
    return {
      kind: "redirect",
      location: buildSpaSuccessLocation(),
      setCookies: [clearState, sessionCookie],
    };
  } catch (e) {
    if (isOAuthCallbackError(e)) {
      return errorResult(e.status, e.code, e.message, e.bitrixCode);
    }
    const msg = e instanceof Error ? e.message : String(e);
    const name = e instanceof Error ? e.name : typeof e;
    oauthCallbackLog("callback:unexpected", { errorName: name, errorMsg: msg.slice(0, 400) });
    return errorResult(
      500,
      "BITRIX24_OAUTH_CALLBACK_FAILED",
      "Не удалось завершить подключение Bitrix24. Попробуйте позже.",
    );
  }
}

export function runBitrix24OAuthDisconnect(): { setCookies: string[] } {
  const secure = cookieSecureFlag();
  return { setCookies: [buildClearPersonalSessionCookie(secure)] };
}
