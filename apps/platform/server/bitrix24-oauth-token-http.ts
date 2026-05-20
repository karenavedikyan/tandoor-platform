/**
 * Bitrix24 OAuth token exchange / refresh и REST-вызовы с access_token.
 * Не логирует code, access_token, refresh_token, client_secret.
 *
 * Обмен code → token для облака Bitrix24 по документации: GET на
 * `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=...&client_secret=...&code=...`
 * (без redirect_uri). POST + redirect_uri оставлен как fallback через env.
 */

type TokenOk = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type TokenExchangeOk = TokenOk & {
  /** Из JSON ответа OAuth — `https://{portal}/rest/` */
  client_endpoint?: string;
};

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

export function normalizePortalBase(raw: string): string {
  let t = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  return t;
}

/** База URL token endpoint без завершающего `/` (дальше добавляем `/?…`). */
export function resolveTokenEndpoint(): string {
  const u = strEnv("BITRIX24_OAUTH_TOKEN_URL");
  if (u) return u.replace(/\/+$/, "");
  return "https://oauth.bitrix.info/oauth/token";
}

export const DEFAULT_OAUTH_REDIRECT_URI = "https://tandoor-platform.vercel.app/api/bitrix24/oauth/callback";

export function resolveRedirectUri(): string {
  const u = strEnv("BITRIX24_OAUTH_REDIRECT_URI");
  return u || DEFAULT_OAUTH_REDIRECT_URI;
}

/** Whitelist of safe Bitrix24 OAuth error codes to surface back to the client. */
const SAFE_BITRIX_OAUTH_ERROR_CODES = new Set([
  "invalid_grant",
  "invalid_client",
  "invalid_request",
  "invalid_scope",
  "unauthorized_client",
  "unsupported_grant_type",
  "WRONG_CLIENT",
  "WRONG_APPLICATION_CLIENT",
  "INVALID_CLIENT",
  "INVALID_GRANT",
  "INVALID_REQUEST",
  "EXPIRED_TOKEN",
  "PAYMENT_REQUIRED",
  "PORTAL_DELETED",
]);

export function sanitizeBitrixErrorCode(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (SAFE_BITRIX_OAUTH_ERROR_CODES.has(t)) return t;
  if (/^[A-Za-z0-9_\-]{1,64}$/.test(t)) return t;
  return undefined;
}

function coerceExpiresIn(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 3600;
}

function parseClientEndpoint(o: Record<string, unknown>): string | undefined {
  const v = o.client_endpoint;
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v.trim();
}

/**
 * Собирает URL вызова REST-метода.
 * `restCtx` — либо `BITRIX24_PORTAL_DOMAIN` (без /rest), либо полный `client_endpoint` (`…/rest/`).
 */
export function buildBitrixOAuthRestUrl(restCtx: string, method: string, accessToken: string): string {
  const ctx = restCtx.trim().replace(/\/+$/, "");
  if (/\/rest$/i.test(ctx)) {
    return `${ctx}/${method}?auth=${encodeURIComponent(accessToken)}`;
  }
  const base = normalizePortalBase(ctx);
  return `${base}/rest/${method}?auth=${encodeURIComponent(accessToken)}`;
}

async function fetchOAuthTokenResponse(params: URLSearchParams): Promise<{ httpStatus: number; json: unknown; method: "GET" | "POST" }> {
  const base = resolveTokenEndpoint();
  const getUrl = `${base}/?${params.toString()}`;

  const tryGet = (): Promise<Response> =>
    fetch(getUrl, { method: "GET", headers: { Accept: "application/json" } });

  const tryPost = (): Promise<Response> =>
    fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params.toString(),
    });

  const preferPost = strEnv("BITRIX24_OAUTH_TOKEN_HTTP_METHOD").toLowerCase() === "post";

  let res: Response;
  let method: "GET" | "POST";

  if (preferPost) {
    res = await tryPost();
    method = "POST";
  } else {
    res = await tryGet();
    method = "GET";
    if (res.status === 405 || res.status === 501) {
      res = await tryPost();
      method = "POST";
    }
  }

  const httpStatus = res.status;
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = null;
  }
  return { httpStatus, json, method };
}

export type TokenExchangeMeta = { httpMethod: "GET" | "POST"; includeRedirectUri: boolean };

export type TokenExchangeFailureMeta = TokenExchangeMeta & {
  httpStatus: number;
  bitrixCode?: string;
};

export async function exchangeAuthorizationCode(code: string): Promise<
  | { ok: true; tokens: TokenOk; client_endpoint?: string; exchangeMeta: TokenExchangeMeta }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      bitrixCode?: string;
      tokenAttempt: TokenExchangeFailureMeta;
    }
> {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  const redirectUri = resolveRedirectUri();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 503,
      code: "BITRIX24_OAUTH_NOT_CONFIGURED",
      message: "OAuth Bitrix24 не настроен на сервере.",
      tokenAttempt: {
        httpMethod: "GET",
        includeRedirectUri: false,
        httpStatus: 0,
      },
    };
  }

  const buildParams = (includeRedirectUri: boolean): URLSearchParams => {
    const p = new URLSearchParams();
    p.set("grant_type", "authorization_code");
    p.set("client_id", clientId);
    p.set("client_secret", clientSecret);
    p.set("code", code);
    if (includeRedirectUri) {
      p.set("redirect_uri", redirectUri);
    }
    return p;
  };

  const forceRedirectFirst = strEnv("BITRIX24_OAUTH_TOKEN_INCLUDE_REDIRECT_URI") === "true";

  type AttemptOk = {
    kind: "ok";
    tokens: TokenOk;
    client_endpoint?: string;
    httpMethod: "GET" | "POST";
    includeRedirectUri: boolean;
  };
  type AttemptFail = {
    kind: "fail";
    httpStatus: number;
    bitrixCode?: string;
    httpMethod: "GET" | "POST";
    includeRedirectUri: boolean;
  };

  async function runAttempt(includeRedirectUri: boolean): Promise<AttemptOk | AttemptFail> {
    const params = buildParams(includeRedirectUri);
    let httpStatus = 0;
    let json: unknown;
    let httpMethod: "GET" | "POST" = "GET";
    try {
      const r = await fetchOAuthTokenResponse(params);
      httpStatus = r.httpStatus;
      json = r.json;
      httpMethod = r.method;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth token step", "exchange_code", "network", { msg: m });
      return { kind: "fail", httpStatus: 0, httpMethod: "GET", includeRedirectUri };
    }

    if (json == null || typeof json !== "object" || Array.isArray(json)) {
      console.error("[bitrix24] oauth token step", "exchange_code", "non_json", { httpStatus, httpMethod });
      return { kind: "fail", httpStatus, httpMethod, includeRedirectUri };
    }

    const o = json as Record<string, unknown>;
    if (typeof o.access_token === "string" && o.access_token && typeof o.refresh_token === "string" && o.refresh_token) {
      const expires_in = coerceExpiresIn(o.expires_in);
      const client_endpoint = parseClientEndpoint(o);
      return {
        kind: "ok",
        tokens: { access_token: o.access_token, refresh_token: o.refresh_token, expires_in },
        client_endpoint,
        httpMethod,
        includeRedirectUri,
      };
    }

    const bitrixCode = sanitizeBitrixErrorCode(o.error);
    console.error("[bitrix24] oauth token step", "exchange_code", "bitrix_error", {
      httpStatus,
      httpMethod,
      bitrixCode: bitrixCode ?? "unknown",
      redirectParam: includeRedirectUri ? "with_redirect_uri" : "no_redirect_uri",
      authorizationCodeLen: code.length,
    });
    return { kind: "fail", httpStatus, bitrixCode, httpMethod, includeRedirectUri };
  }

  function toFailure(f: AttemptFail, bitrixOverride?: string): Extract<Awaited<ReturnType<typeof exchangeAuthorizationCode>>, { ok: false }> {
    const bitrixCode = bitrixOverride ?? f.bitrixCode;
    const tokenAttempt: TokenExchangeFailureMeta = {
      httpMethod: f.httpMethod,
      includeRedirectUri: f.includeRedirectUri,
      httpStatus: f.httpStatus,
      bitrixCode,
    };
    if (f.httpStatus === 0) {
      return {
        ok: false,
        status: 502,
        code: "BITRIX24_OAUTH_NETWORK",
        message: "Не удалось связаться с сервером авторизации Bitrix24.",
        bitrixCode,
        tokenAttempt,
      };
    }
    return {
      ok: false,
      status: 400,
      code: "BITRIX24_OAUTH_TOKEN_ERROR",
      message: bitrixCode
        ? `Bitrix24 отклонил обмен кода авторизации (${bitrixCode}). Попробуйте подключить Bitrix24 заново.`
        : "Не удалось обменять код авторизации Bitrix24. Попробуйте подключить Bitrix24 заново.",
      bitrixCode,
      tokenAttempt,
    };
  }

  const first = await runAttempt(forceRedirectFirst);
  if (first.kind === "ok") {
    return {
      ok: true,
      tokens: first.tokens,
      client_endpoint: first.client_endpoint,
      exchangeMeta: { httpMethod: first.httpMethod, includeRedirectUri: forceRedirectFirst },
    };
  }
  if (!forceRedirectFirst) {
    const second = await runAttempt(true);
    if (second.kind === "ok") {
      return {
        ok: true,
        tokens: second.tokens,
        client_endpoint: second.client_endpoint,
        exchangeMeta: { httpMethod: second.httpMethod, includeRedirectUri: true },
      };
    }
    return toFailure(second);
  }
  return toFailure(first);
}

export async function refreshAccessToken(refreshToken: string): Promise<
  | { ok: true; tokens: TokenOk; client_endpoint?: string }
  | { ok: false; status: number; code: string; message: string; bitrixCode?: string }
> {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { ok: false, status: 503, code: "BITRIX24_OAUTH_NOT_CONFIGURED", message: "OAuth Bitrix24 не настроен на сервере." };
  }

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);
  params.set("refresh_token", refreshToken);

  let json: unknown;
  let httpStatus = 0;
  try {
    const r = await fetchOAuthTokenResponse(params);
    httpStatus = r.httpStatus;
    json = r.json;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24] oauth token step", "refresh", "network", { msg: m });
    return {
      ok: false,
      status: 502,
      code: "BITRIX24_OAUTH_NETWORK",
      message: "Не удалось связаться с сервером авторизации Bitrix24.",
    };
  }

  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    console.error("[bitrix24] oauth token step", "refresh", "non_json", { httpStatus });
    return {
      ok: false,
      status: 502,
      code: "BITRIX24_OAUTH_TOKEN_ERROR",
      message: "Bitrix24 вернул неожиданный ответ при обновлении токена.",
    };
  }

  const o = json as Record<string, unknown>;
  if (typeof o.access_token === "string" && o.access_token) {
    const rt = typeof o.refresh_token === "string" && o.refresh_token ? o.refresh_token : refreshToken;
    const expires_in = coerceExpiresIn(o.expires_in);
    const client_endpoint = parseClientEndpoint(o);
    return { ok: true, tokens: { access_token: o.access_token, refresh_token: rt, expires_in }, client_endpoint };
  }

  const bitrixCode = sanitizeBitrixErrorCode(o.error);
  console.error("[bitrix24] oauth token step", "refresh", "bitrix_error", { httpStatus, bitrixCode: bitrixCode ?? "unknown" });
  return {
    ok: false,
    status: 401,
    code: "BITRIX24_OAUTH_EXPIRED",
    message: "Сессия Bitrix24 истекла. Подключите Bitrix24 заново.",
    bitrixCode,
  };
}

type BitrixSuccess = { result?: unknown };
type BitrixErrorBody = { error?: string };

export function oauthSessionRestContext(session: { portal_base: string; rest_base?: string }): string {
  const r = session.rest_base?.trim();
  if (r) return r;
  return session.portal_base;
}

export async function bitrixOAuthRest(
  restCtx: string,
  method: string,
  accessToken: string,
  jsonBody: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; bitrixCode?: string; message: string }> {
  const url = buildBitrixOAuthRestUrl(restCtx, method, accessToken);
  let parsed: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(jsonBody),
    });
    const text = await res.text();
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, message: "Bitrix24 вернул неожиданный ответ REST." };
    }
  } catch {
    return { ok: false, message: "Не удалось связаться с Bitrix24." };
  }
  const b = parsed as BitrixSuccess & BitrixErrorBody;
  if (b.error) {
    const raw = typeof b.error === "string" ? b.error : "UNKNOWN";
    const bitrixCode = sanitizeBitrixErrorCode(raw);
    console.error("[bitrix24] oauth rest error", { method, bitrixCode: bitrixCode ?? "unknown" });
    return {
      ok: false,
      bitrixCode,
      message: "Запрос к Bitrix24 отклонён. Попробуйте позже или переподключите Bitrix24.",
    };
  }
  return { ok: true, result: b.result };
}

export type FetchBitrixUserCurrentResult = {
  bitrixUserId?: string;
  name?: string;
  /** Ошибка user.current не блокирует сохранение OAuth-сессии. */
  userCurrentError?: boolean;
  userCurrentBitrixCode?: string;
};

export async function fetchBitrixUserCurrent(restCtx: string, accessToken: string): Promise<FetchBitrixUserCurrentResult> {
  const r = await bitrixOAuthRest(restCtx, "user.current", accessToken, {});
  if (!r.ok) {
    return {
      userCurrentError: true,
      userCurrentBitrixCode: sanitizeBitrixErrorCode(r.bitrixCode),
    };
  }
  const res = r.result;
  if (res == null || typeof res !== "object" || Array.isArray(res)) return {};
  const u = res as Record<string, unknown>;
  const id = u.ID ?? u.id;
  const name = u.NAME ?? u.name;
  const last = u.LAST_NAME ?? u.last_name;
  const bitrixUserId = id != null ? String(id).trim() : undefined;
  const namePart = typeof name === "string" ? name.trim() : "";
  const lastPart = typeof last === "string" ? last.trim() : "";
  const full = [namePart, lastPart].filter(Boolean).join(" ").trim();
  return { bitrixUserId, name: full || undefined };
}
