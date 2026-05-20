/**
 * Vercel Serverless: GET/POST /api/bitrix24/oauth/:action
 *
 * Полностью self-contained handler: только `node:crypto`, типы `@vercel/node`
 * и глобальные `fetch` / `Buffer`. Без импортов из `server/`, `shared/`, client.
 * Нужно, чтобы Vercel не падал на load-time из-за tracing/bundling проектных путей.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const JSON_CT = "application/json; charset=utf-8";
const MAX_SET_COOKIE_HEADER_BYTES = 3900;
const B24_PERSONAL_SESSION_COOKIE = "b24_personal_sess";
const CRYPTO_SALT = "bitrix24-oauth-cookie-v1";
const CRYPTO_VERSION = 1;
const B24_SESSION_COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60;
const SKEW_MS = 60_000;
const DEFAULT_OAUTH_REDIRECT_URI = "https://tandoor-platform.vercel.app/api/bitrix24/oauth/callback";

type OAuthCallbackErrorCode =
  | "BITRIX24_OAUTH_STATE_MISMATCH"
  | "BITRIX24_OAUTH_MISSING_CODE"
  | "BITRIX24_OAUTH_AUTHORIZATION_DENIED"
  | "BITRIX24_OAUTH_TOKEN_ERROR"
  | "BITRIX24_OAUTH_COOKIE_ERROR"
  | "BITRIX24_OAUTH_NETWORK"
  | "BITRIX24_OAUTH_NOT_CONFIGURED"
  | "BITRIX24_OAUTH_CALLBACK_FAILED";

type Bitrix24PersonalSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at_ms: number;
  portal_base: string;
  rest_base?: string;
  bitrix_user_id?: string;
  user_name?: string;
};

class OAuthCallbackError extends Error {
  readonly status: number;
  readonly code: OAuthCallbackErrorCode;
  readonly bitrixCode?: string;

  constructor(status: number, code: OAuthCallbackErrorCode, message: string, bitrixCode?: string) {
    super(message);
    this.name = "OAuthCallbackError";
    this.status = status;
    this.code = code;
    this.bitrixCode = bitrixCode;
  }
}

function isOAuthCallbackError(e: unknown): e is OAuthCallbackError {
  return e instanceof OAuthCallbackError;
}

function fail(status: number, code: OAuthCallbackErrorCode, message: string, bitrixCode?: string): never {
  throw new OAuthCallbackError(status, code, message, bitrixCode);
}

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

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function oauthHandlerBuildMarker(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (typeof sha === "string" && sha.length >= 7) return sha.slice(0, 7);
  const dep = process.env.VERCEL_DEPLOYMENT_ID;
  if (typeof dep === "string" && dep.length > 0) return dep.slice(0, 12);
  return "local";
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function sendJsonIfWritable(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  try {
    if (res.headersSent || res.writableEnded) return;
  } catch {
    return;
  }
  sendJson(res, status, body);
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

function cookieHeader(req: VercelRequest): string | undefined {
  const h = req.headers.cookie;
  return typeof h === "string" ? h : undefined;
}

function applySetCookies(res: VercelResponse, list: string[] | undefined): void {
  if (!list?.length) return;
  for (const c of list) {
    const cur = res.getHeader("Set-Cookie");
    if (!cur) res.setHeader("Set-Cookie", c);
    else if (Array.isArray(cur)) res.setHeader("Set-Cookie", [...cur, c]);
    else res.setHeader("Set-Cookie", [String(cur), c]);
  }
}

function isOAuthConfigured(): boolean {
  return Boolean(
    strEnv("BITRIX24_OAUTH_CLIENT_ID") && strEnv("BITRIX24_OAUTH_CLIENT_SECRET") && strEnv("BITRIX24_PORTAL_DOMAIN"),
  );
}

function isCookieSecretSet(): boolean {
  return Boolean(strEnv("BITRIX24_OAUTH_COOKIE_SECRET"));
}

function cookieSecureFlag(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.BITRIX24_OAUTH_COOKIE_SECURE === "true";
}

function normalizePortalBase(raw: string): string {
  let t = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  return t;
}

function resolveTokenEndpoint(): string {
  const u = strEnv("BITRIX24_OAUTH_TOKEN_URL");
  if (u) return u.replace(/\/+$/, "");
  return "https://oauth.bitrix.info/oauth/token";
}

function resolveRedirectUri(): string {
  const u = strEnv("BITRIX24_OAUTH_REDIRECT_URI");
  return u || DEFAULT_OAUTH_REDIRECT_URI;
}

function lkPublicOrigin(): string {
  const o = strEnv("BITRIX24_LK_PUBLIC_ORIGIN").replace(/\/+$/, "");
  return o || "https://tandoor-platform.vercel.app";
}

function sanitizeBitrixErrorCode(raw: unknown): string | undefined {
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

function readCookieValue(cookieHeaderVal: string | undefined, name: string): string {
  if (!cookieHeaderVal?.trim()) return "";
  for (const p of cookieHeaderVal.split(";")) {
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

function deriveCookieKey(): Buffer | null {
  const s = process.env.BITRIX24_OAUTH_COOKIE_SECRET?.trim();
  if (!s) return null;
  return scryptSync(s, CRYPTO_SALT, 32);
}

function sealPersonalSession(payload: Bitrix24PersonalSessionPayload): string | null {
  const key = deriveCookieKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([Buffer.from([CRYPTO_VERSION]), iv, tag, enc]);
  return out.toString("base64url");
}

function unsealPersonalSession(sealed: string): Bitrix24PersonalSessionPayload | null {
  const key = deriveCookieKey();
  if (!key || !sealed.trim()) return null;
  try {
    const raw = Buffer.from(sealed.trim(), "base64url");
    if (raw.length < 1 + 12 + 16 + 1) return null;
    if (raw[0] !== CRYPTO_VERSION) return null;
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
    const rest_base = typeof o.rest_base === "string" && o.rest_base.trim() ? o.rest_base.trim() : undefined;
    const bitrix_user_id = typeof o.bitrix_user_id === "string" ? o.bitrix_user_id : undefined;
    const user_name = typeof o.user_name === "string" ? o.user_name : undefined;
    return { access_token, refresh_token, expires_at_ms, portal_base, rest_base, bitrix_user_id, user_name };
  } catch {
    return null;
  }
}

function cookieSuffix(secure: boolean, maxAgeSec: number, path = "/"): string {
  const parts = [`Path=${path}`, "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeSec)}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function buildSetPersonalSessionCookie(sealed: string, secure: boolean): string {
  const v = encodeURIComponent(sealed);
  return `${B24_PERSONAL_SESSION_COOKIE}=${v}; ${cookieSuffix(secure, B24_SESSION_COOKIE_MAX_AGE_SEC)}`;
}

function buildClearPersonalSessionCookie(secure: boolean): string {
  return `${B24_PERSONAL_SESSION_COOKIE}=; ${cookieSuffix(secure, 0)}`;
}

function buildClearStateCookie(): string {
  const secure = cookieSecureFlag();
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

function rawRedirect(res: VercelResponse, location: string): void {
  res.setHeader("Location", location);
  res.statusCode = 302;
  res.end();
}

function buildBitrixOAuthRestUrl(restCtx: string, method: string, accessToken: string): string {
  const ctx = restCtx.trim().replace(/\/+$/, "");
  if (/\/rest$/i.test(ctx)) {
    return `${ctx}/${method}?auth=${encodeURIComponent(accessToken)}`;
  }
  const base = normalizePortalBase(ctx);
  return `${base}/rest/${method}?auth=${encodeURIComponent(accessToken)}`;
}

async function fetchOAuthTokenResponse(
  params: URLSearchParams,
): Promise<{ httpStatus: number; json: unknown; method: "GET" | "POST" }> {
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

type TokenOk = { access_token: string; refresh_token: string; expires_in: number };

type TokenExchangeMeta = { httpMethod: "GET" | "POST"; includeRedirectUri: boolean };
type TokenExchangeFailureMeta = TokenExchangeMeta & { httpStatus: number; bitrixCode?: string };

async function exchangeAuthorizationCode(code: string): Promise<
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
      tokenAttempt: { httpMethod: "GET", includeRedirectUri: false, httpStatus: 0 },
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

async function refreshAccessToken(refreshToken: string): Promise<
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

type EffectiveSessionResult =
  | {
      ok: true;
      session: Bitrix24PersonalSessionPayload;
      setSessionCookie?: string;
      clearSessionCookie?: string;
    }
  | { ok: false; code: "BITRIX24_OAUTH_NOT_CONNECTED" | "BITRIX24_OAUTH_EXPIRED"; clearSessionCookie?: string };

async function getEffectivePersonalSession(cookieHeaderVal: string | undefined): Promise<EffectiveSessionResult> {
  const secure = cookieSecureFlag();
  const clear = buildClearPersonalSessionCookie(secure);
  const raw = readCookieValue(cookieHeaderVal, B24_PERSONAL_SESSION_COOKIE);
  if (!raw) {
    return { ok: false, code: "BITRIX24_OAUTH_NOT_CONNECTED" };
  }
  const session = unsealPersonalSession(raw);
  if (!session) {
    return { ok: false, code: "BITRIX24_OAUTH_NOT_CONNECTED", clearSessionCookie: clear };
  }

  const now = Date.now();
  if (now < session.expires_at_ms - SKEW_MS) {
    return { ok: true, session };
  }

  const rt = await refreshAccessToken(session.refresh_token);
  if (!rt.ok) {
    return {
      ok: false,
      code: rt.code === "BITRIX24_OAUTH_EXPIRED" ? "BITRIX24_OAUTH_EXPIRED" : "BITRIX24_OAUTH_NOT_CONNECTED",
      clearSessionCookie: clear,
    };
  }

  const expires_at_ms = now + rt.tokens.expires_in * 1000;
  const next: Bitrix24PersonalSessionPayload = {
    access_token: rt.tokens.access_token,
    refresh_token: rt.tokens.refresh_token,
    expires_at_ms,
    portal_base: session.portal_base,
    rest_base: rt.client_endpoint?.trim() || session.rest_base,
    bitrix_user_id: session.bitrix_user_id,
    user_name: session.user_name,
  };
  const sealed = sealPersonalSession(next);
  if (!sealed) {
    return { ok: false, code: "BITRIX24_OAUTH_NOT_CONNECTED", clearSessionCookie: clear };
  }
  return { ok: true, session: next, setSessionCookie: buildSetPersonalSessionCookie(sealed, secure) };
}

async function bitrixOAuthRest(
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
  const b = parsed as { result?: unknown; error?: string };
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

async function fetchBitrixUserCurrent(
  restCtx: string,
  accessToken: string,
): Promise<{
  bitrixUserId?: string;
  name?: string;
  userCurrentError?: boolean;
  userCurrentBitrixCode?: string;
}> {
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

function oauthCallbackLog(step: string, data?: Record<string, unknown>): void {
  console.error(`[bitrix24] oauth.callback:${step}`, data ?? {});
}

type CallbackHttpResult =
  | { kind: "redirect"; location: string; setCookies: string[] }
  | { kind: "json"; status: number; body: Record<string, unknown>; setCookies?: string[] };

async function runOAuthCallback(input: {
  query: Record<string, unknown>;
  cookieHeader: string | undefined;
  prefersBrowserRedirect?: boolean;
}): Promise<CallbackHttpResult> {
  const secure = cookieSecureFlag();
  const clearState = buildClearStateCookie();
  const prefersRedirect = input.prefersBrowserRedirect ?? true;

  const errorResult = (
    status: number,
    code: string,
    message: string,
    bitrixCode?: string,
    extraCookies?: string[],
  ): CallbackHttpResult => {
    const cookies = [clearState, ...(extraCookies ?? [])];
    if (prefersRedirect) {
      oauthCallbackLog("callback:redirect:error", { code, bitrixCode: bitrixCode ?? null, httpStatus: status });
      return { kind: "redirect", location: buildSpaErrorLocation(code, bitrixCode), setCookies: cookies };
    }
    oauthCallbackLog("callback:redirect:error", { code, bitrixCode: bitrixCode ?? null, httpStatus: status, kind: "json" });
    const body: Record<string, unknown> = { success: false, code, message };
    if (bitrixCode) body.bitrixCode = bitrixCode;
    return { kind: "json", status, body, setCookies: cookies };
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

async function handleStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  const build = oauthHandlerBuildMarker();
  if (!isOAuthConfigured()) {
    sendJson(res, 200, { success: true, configured: false, connected: false, oauthHandlerBuild: build });
    return;
  }
  if (!isCookieSecretSet()) {
    sendJson(res, 200, {
      success: true,
      configured: true,
      connected: false,
      oauthHandlerBuild: build,
      warning: "BITRIX24_OAUTH_COOKIE_SECRET",
      message:
        "Задайте BITRIX24_OAUTH_COOKIE_SECRET на сервере, чтобы сохранять OAuth-сессию Bitrix24 в HttpOnly-cookie.",
    });
    return;
  }
  try {
    const eff = await getEffectivePersonalSession(cookieHeader(req));
    const setCookies: string[] = [];
    if (eff.ok) {
      if (eff.setSessionCookie) setCookies.push(eff.setSessionCookie);
    } else if (eff.clearSessionCookie) {
      setCookies.push(eff.clearSessionCookie);
    }

    if (!eff.ok) {
      applySetCookies(res, setCookies.length ? setCookies : undefined);
      sendJson(res, 200, {
        success: true,
        configured: true,
        connected: false,
        oauthHandlerBuild: build,
      });
      return;
    }

    const user =
      eff.session.bitrix_user_id || eff.session.user_name
        ? {
            bitrixUserId: eff.session.bitrix_user_id,
            name: eff.session.user_name,
          }
        : undefined;

    applySetCookies(res, setCookies.length ? setCookies : undefined);
    sendJson(res, 200, {
      success: true,
      configured: true,
      connected: true,
      oauthHandlerBuild: build,
      ...(user ? { user } : {}),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth status failed", m.slice(0, 200));
    sendJson(res, 200, {
      success: true,
      configured: true,
      connected: false,
      oauthHandlerBuild: build,
    });
  }
}

function handleStart(res: VercelResponse): void {
  if (!isOAuthConfigured()) {
    sendJson(res, 503, {
      success: false,
      code: "BITRIX24_OAUTH_NOT_CONFIGURED",
      message:
        "OAuth Bitrix24 не настроен на сервере: задайте BITRIX24_OAUTH_CLIENT_ID, BITRIX24_OAUTH_CLIENT_SECRET и BITRIX24_PORTAL_DOMAIN.",
    });
    return;
  }
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const portalBase = normalizePortalBase(strEnv("BITRIX24_PORTAL_DOMAIN"));
  const redirectUri = resolveRedirectUri();
  const scopeRaw = strEnv("BITRIX24_OAUTH_SCOPE");
  const scope = scopeRaw || "im,user";

  const state = randomBytes(24).toString("base64url");
  const authBase = `${portalBase}/oauth/authorize/`;
  const qs = new URLSearchParams();
  qs.set("client_id", clientId);
  qs.set("response_type", "code");
  qs.set("state", state);
  qs.set("scope", scope);
  qs.set("redirect_uri", redirectUri);
  const redirectUrl = `${authBase}?${qs.toString()}`;

  const secure = cookieSecureFlag();
  const setCookie = [
    `b24_oauth_state=${state}`,
    "Path=/api/bitrix24/oauth",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Set-Cookie", setCookie);
  res.status(200).json({
    success: true,
    redirectUrl,
    state,
    stateBinding: "browser_cookie_mvp",
  });
}

async function handleCallback(req: VercelRequest, res: VercelResponse): Promise<void> {
  const build = oauthHandlerBuildMarker();
  console.error("[bitrix24-api] oauth callback:reached", { oauthHandlerBuild: build });
  if (!isOAuthConfigured()) {
    res.setHeader("Set-Cookie", buildClearStateCookie());
    rawRedirect(res, buildSpaErrorLocation("BITRIX24_OAUTH_NOT_CONFIGURED"));
    return;
  }
  try {
    const out = await runOAuthCallback({
      query: (req.query ?? {}) as Record<string, unknown>,
      cookieHeader: cookieHeader(req),
      prefersBrowserRedirect: true,
    });
    applySetCookies(res, out.setCookies);
    if (out.kind === "redirect") {
      try {
        const loc = new URL(out.location);
        const errCode = loc.searchParams.get("code");
        if (
          loc.searchParams.get("bitrix24") === "error" &&
          errCode &&
          errCode.startsWith("BITRIX24_")
        ) {
          console.error("[bitrix24-api] oauth callback:redirect-out", {
            oauthHandlerBuild: build,
            errorCode: errCode,
          });
        }
      } catch {
        /* ignore */
      }
      rawRedirect(res, out.location);
      return;
    }
    sendJson(res, out.status, out.body);
  } catch (e) {
    if (isOAuthCallbackError(e)) {
      console.error("[bitrix24-api] oauth callback:typed-error", {
        oauthHandlerBuild: build,
        errorCode: e.code,
      });
      res.setHeader("Set-Cookie", buildClearStateCookie());
      rawRedirect(res, buildSpaErrorLocation(e.code, e.bitrixCode));
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth callback failed", { oauthHandlerBuild: build, msg: m.slice(0, 200) });
    res.setHeader("Set-Cookie", buildClearStateCookie());
    rawRedirect(res, buildSpaErrorLocation("BITRIX24_OAUTH_CALLBACK_FAILED"));
  }
}

function handleDisconnect(res: VercelResponse): void {
  res.setHeader("Set-Cookie", buildClearPersonalSessionCookie(cookieSecureFlag()));
  sendJson(res, 200, { success: true, message: "Подключение Bitrix24 сброшено в этом браузере." });
}

async function bitrix24OauthRoute(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "status" && req.method === "GET") {
      await handleStatus(req, res);
      return;
    }
    if (action === "start" && req.method === "GET") {
      handleStart(res);
      return;
    }
    if (action === "callback" && req.method === "GET") {
      await handleCallback(req, res);
      return;
    }
    if (action === "disconnect" && req.method === "POST") {
      handleDisconnect(res);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный OAuth-маршрут Bitrix24.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth", action, m);
    sendJsonIfWritable(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await bitrix24OauthRoute(req, res);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth handler:unhandled", m.slice(0, 200));
    sendJsonIfWritable(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
