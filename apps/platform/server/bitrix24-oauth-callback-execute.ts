/**
 * GET /api/bitrix24/oauth/callback для Express (Node) и Vercel.
 * Обмен code → token, HttpOnly session cookie, редирект в ЛК.
 * Не логирует code, access_token, refresh_token, client_secret.
 *
 * Контракт результата:
 *   - kind: "redirect" — редирект в SPA `/#/communications?...` с safe-статусом.
 *   - kind: "json" — fallback для машинных вызовов (curl/тесты). Поля
 *     `success/code/message` стабильны; `bitrixCode` появляется только если
 *     Bitrix явно дал безопасный код ошибки (whitelist в token-http).
 */

import {
  buildClearPersonalSessionCookie,
  buildSetPersonalSessionCookie,
  cookieSecureFlag,
  readCookieValue,
  sealPersonalSession,
  type Bitrix24PersonalSessionPayload,
} from "./bitrix24-oauth-crypto-cookie";
import {
  exchangeAuthorizationCode,
  fetchBitrixUserCurrent,
  normalizePortalBase,
} from "./bitrix24-oauth-token-http";

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

/**
 * SPA использует hash-router (wouter `useHashLocation`), поэтому `?...` после `#/path`
 * считается частью маршрута и роут `/communications` не матчится → SPA рисует Not Found.
 *
 * Безопасный для роутера формат: query до `#`, route в hash. То есть
 * `/?bitrix24=error&code=...#/communications` — браузер сначала загружает корень,
 * hash-router переходит на `/communications`, а параметры доступны через
 * `window.location.search`.
 */
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

/**
 * Вернёт redirect, если запрос явно из браузера (есть state cookie или Accept HTML),
 * иначе JSON — чтобы curl/тесты получали машиночитаемый ответ.
 *
 * В callback Bitrix24 редиректит браузер пользователя, поэтому по умолчанию
 * (когда `prefersBrowserRedirect = true`) мы делаем 302 в SPA.
 */
function preferBrowserRedirect(prefersBrowserRedirect: boolean): boolean {
  return prefersBrowserRedirect;
}

export async function runBitrix24OAuthCallback(input: {
  query: Record<string, unknown>;
  cookieHeader: string | undefined;
  /** Если true — ошибки превращаются в 302 на SPA. По умолчанию true (браузерный callback). */
  prefersBrowserRedirect?: boolean;
}): Promise<Bitrix24OAuthCallbackHttpResult> {
  const secure = cookieSecureFlag();
  const clearState = buildClearStateCookie(secure);
  const prefersRedirect = preferBrowserRedirect(input.prefersBrowserRedirect ?? true);

  const errorResult = (
    status: number,
    code: string,
    message: string,
    bitrixCode?: string,
    extraCookies?: string[],
  ): Bitrix24OAuthCallbackHttpResult => {
    const cookies = [clearState, ...(extraCookies ?? [])];
    if (prefersRedirect) {
      return { kind: "redirect", location: buildSpaErrorLocation(code, bitrixCode), setCookies: cookies };
    }
    return jsonError(status, code, message, cookies, bitrixCode);
  };

  try {
    const stateFromQuery = firstQuery(input.query.state);
    const stateFromCookie = readCookieValue(input.cookieHeader, "b24_oauth_state");

    if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
      console.error("[bitrix24] oauth callback state mismatch", {
        hasQueryState: Boolean(stateFromQuery),
        hasCookieState: Boolean(stateFromCookie),
      });
      return errorResult(
        400,
        "BITRIX24_OAUTH_STATE_MISMATCH",
        "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
      );
    }

    const code = firstQuery(input.query.code);
    if (!code) {
      const bitrixError = firstQuery(input.query.error);
      if (bitrixError) {
        console.error("[bitrix24] oauth callback bitrix error param", { error: bitrixError.slice(0, 64) });
        return errorResult(
          400,
          "BITRIX24_OAUTH_AUTHORIZATION_DENIED",
          "Bitrix24 отклонил авторизацию. Попробуйте подключить Bitrix24 снова.",
        );
      }
      return errorResult(
        400,
        "BITRIX24_OAUTH_MISSING_CODE",
        "В ответе Bitrix24 нет кода авторизации. Попробуйте подключить Bitrix24 снова.",
      );
    }

    if (!strEnv("BITRIX24_OAUTH_COOKIE_SECRET")) {
      return errorResult(
        503,
        "BITRIX24_OAUTH_COOKIE_SECRET_MISSING",
        "На сервере не задан BITRIX24_OAUTH_COOKIE_SECRET — нельзя безопасно сохранить сессию Bitrix24.",
      );
    }

    let tok: Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
    try {
      tok = await exchangeAuthorizationCode(code);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth callback token exchange threw", { msg: m });
      return errorResult(
        502,
        "BITRIX24_OAUTH_TOKEN_ERROR",
        "Не удалось обменять код авторизации Bitrix24. Попробуйте подключить Bitrix24 заново.",
      );
    }
    if (!tok.ok) {
      return errorResult(tok.status, tok.code, tok.message, tok.bitrixCode);
    }

    const portalBase = normalizePortalBase(strEnv("BITRIX24_PORTAL_DOMAIN"));

    // fetchBitrixUserCurrent — не критичная часть. Если REST вернул ошибку или
    // упал — продолжаем без user.name/id (статус всё равно сохранит токены).
    let user: { bitrixUserId?: string; name?: string } = {};
    try {
      user = await fetchBitrixUserCurrent(portalBase, tok.tokens.access_token);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth callback user.current threw (non-fatal)", { msg: m });
    }

    const expires_at_ms = Date.now() + tok.tokens.expires_in * 1000;
    const payload: Bitrix24PersonalSessionPayload = {
      access_token: tok.tokens.access_token,
      refresh_token: tok.tokens.refresh_token,
      expires_at_ms,
      portal_base: portalBase,
      bitrix_user_id: user.bitrixUserId,
      user_name: user.name,
    };

    let sealed: string | null;
    try {
      sealed = sealPersonalSession(payload);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth callback seal threw", { msg: m });
      return errorResult(
        503,
        "BITRIX24_OAUTH_SEAL_FAILED",
        "Не удалось зашифровать сессию Bitrix24. Проверьте BITRIX24_OAUTH_COOKIE_SECRET.",
      );
    }
    if (!sealed) {
      return errorResult(
        503,
        "BITRIX24_OAUTH_SEAL_FAILED",
        "Не удалось зашифровать сессию Bitrix24. Проверьте BITRIX24_OAUTH_COOKIE_SECRET.",
      );
    }

    if (sealed.length > 3600) {
      console.error("[bitrix24] oauth callback sealed cookie too large", { length: sealed.length });
      return errorResult(
        503,
        "BITRIX24_OAUTH_COOKIE_TOO_LARGE",
        "Токены Bitrix24 слишком длинные для cookie. Нужно серверное хранилище сессий.",
      );
    }

    const sessionCookie = buildSetPersonalSessionCookie(sealed, secure);
    return {
      kind: "redirect",
      location: buildSpaSuccessLocation(),
      setCookies: [clearState, sessionCookie],
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24] oauth callback unexpected error", { msg: m });
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
