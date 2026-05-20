/**
 * Vercel Serverless: GET /api/bitrix24/oauth/:action
 *
 * Catch-all handler для OAuth-эндпоинтов Bitrix24, объединяющий status / start /
 * callback / disconnect в один файл (Vercel Hobby — лимит 12 функций).
 *
 * Безопасность fallback'ов:
 *   - Любая необработанная ошибка возвращает JSON 500 INTERNAL_ERROR
 *     (а не raw Vercel FUNCTION_INVOCATION_FAILED).
 *   - status/start без env-конфигурации отвечают сразу, не трогая heavy-модули.
 *   - Тяжёлые серверные модули (crypto, токены, session) подгружаются динамически
 *     через `await import(...)` внутри try/catch — даже если они недоступны
 *     в Vercel-бандле, handler не упадёт на module-load.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes } from "node:crypto";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
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

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function isOAuthConfigured(): boolean {
  return Boolean(
    strEnv("BITRIX24_OAUTH_CLIENT_ID") &&
      strEnv("BITRIX24_OAUTH_CLIENT_SECRET") &&
      strEnv("BITRIX24_PORTAL_DOMAIN"),
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

function resolveRedirectUri(): string {
  const u = strEnv("BITRIX24_OAUTH_REDIRECT_URI");
  return u || "https://tandoor-platform.vercel.app/api/bitrix24/oauth/callback";
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

function buildClearPersonalSessionCookieInline(): string {
  const secure = cookieSecureFlag();
  return [
    "b24_personal_sess=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

async function handleStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!isOAuthConfigured()) {
    sendJson(res, 200, { success: true, configured: false, connected: false });
    return;
  }
  if (!isCookieSecretSet()) {
    sendJson(res, 200, {
      success: true,
      configured: true,
      connected: false,
      warning: "BITRIX24_OAUTH_COOKIE_SECRET",
      message:
        "Задайте BITRIX24_OAUTH_COOKIE_SECRET на сервере, чтобы сохранять OAuth-сессию Bitrix24 в HttpOnly-cookie.",
    });
    return;
  }
  // Heavy path: env configured. Use server module for session/refresh.
  try {
    const mod = await import("../../../server/bitrix24-oauth-status-execute");
    const { status, body, setCookies } = await mod.runBitrix24OAuthStatus(cookieHeader(req));
    applySetCookies(res, setCookies);
    sendJson(res, status, body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth status load/run failed", m);
    sendJson(res, 200, { success: true, configured: true, connected: false });
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

function lkPublicOrigin(): string {
  const o = strEnv("BITRIX24_LK_PUBLIC_ORIGIN").replace(/\/+$/, "");
  return o || "https://tandoor-platform.vercel.app";
}

function buildSpaErrorLocation(code: string, bitrixCode?: string): string {
  const qs = new URLSearchParams();
  qs.set("bitrix24", "error");
  qs.set("code", code);
  if (bitrixCode) qs.set("bitrixCode", bitrixCode);
  return `${lkPublicOrigin()}/#/communications?${qs.toString()}`;
}

/**
 * Низкоуровневый redirect через setHeader+writeHead, без зависимости от
 * Express-style helper'а `res.redirect`. На Vercel Rust-runtime эти helper'ы
 * не всегда привязаны, см. vercel/vercel#16191. setHeader/statusCode/end —
 * чистый Node http.ServerResponse и работает везде.
 */
function rawRedirect(res: VercelResponse, location: string): void {
  res.setHeader("Location", location);
  res.statusCode = 302;
  res.end();
}

async function handleCallback(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!isOAuthConfigured()) {
    res.setHeader("Set-Cookie", buildClearStateCookie());
    rawRedirect(res, buildSpaErrorLocation("BITRIX24_OAUTH_NOT_CONFIGURED"));
    return;
  }
  try {
    const mod = await import("../../../server/bitrix24-oauth-callback-execute");
    const out = await mod.runBitrix24OAuthCallback({
      query: (req.query ?? {}) as Record<string, unknown>,
      cookieHeader: cookieHeader(req),
      prefersBrowserRedirect: true,
    });
    applySetCookies(res, out.setCookies);
    if (out.kind === "redirect") {
      rawRedirect(res, out.location);
      return;
    }
    sendJson(res, out.status, out.body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth callback load/run failed", m);
    res.setHeader("Set-Cookie", buildClearStateCookie());
    rawRedirect(res, buildSpaErrorLocation("BITRIX24_OAUTH_CALLBACK_FAILED"));
  }
}

function handleDisconnect(res: VercelResponse): void {
  res.setHeader("Set-Cookie", buildClearPersonalSessionCookieInline());
  sendJson(res, 200, { success: true, message: "Подключение Bitrix24 сброшено в этом браузере." });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
