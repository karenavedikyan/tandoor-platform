/**
 * Vercel Serverless: GET /api/bitrix24/oauth/:action
 *
 * Объединённый dynamic handler для OAuth-эндпоинтов Bitrix24, чтобы не упираться
 * в лимит Vercel Hobby (12 serverless functions). Поведение каждого action
 * идентично прежним отдельным файлам api/bitrix24/oauth/*.ts.
 *
 * Поддерживаемые action:
 *   - status:   возвращает признак configured (заданы CLIENT_ID, CLIENT_SECRET и
 *               PORTAL_DOMAIN) и connected=false (хранилище токенов ещё не настроено).
 *   - start:    при настроенном OAuth — возвращает redirectUrl на /oauth/authorize/
 *               Bitrix24 портала и ставит cookie b24_oauth_state.
 *   - callback: проверяет совпадение state из query и cookie, сбрасывает cookie и
 *               отвечает BITRIX24_OAUTH_TOKEN_STORAGE_PENDING (token storage TBD).
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*,
 * client/*, @/.
 * Не логирует code из запроса.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes } from "node:crypto";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

function isOAuthConfigured(): boolean {
  return Boolean(
    strEnv("BITRIX24_OAUTH_CLIENT_ID") && strEnv("BITRIX24_OAUTH_CLIENT_SECRET") && strEnv("BITRIX24_PORTAL_DOMAIN"),
  );
}

function normalizePortalBase(raw: string): string {
  let t = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  return t;
}

function randomState(): string {
  return randomBytes(24).toString("base64url");
}

function readCookie(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader || !cookieHeader.trim()) return "";
  const parts = cookieHeader.split(";");
  for (const p of parts) {
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

function handleStatus(res: VercelResponse): void {
  const configured = isOAuthConfigured();
  sendJson(res, 200, {
    success: true,
    configured,
    connected: false,
  });
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
  const redirectUri = strEnv("BITRIX24_OAUTH_REDIRECT_URI");
  const scopeRaw = strEnv("BITRIX24_OAUTH_SCOPE");
  const scope = scopeRaw || "im,user";

  const state = randomState();
  const authBase = `${portalBase}/oauth/authorize/`;
  const qs = new URLSearchParams();
  qs.set("client_id", clientId);
  qs.set("response_type", "code");
  qs.set("state", state);
  qs.set("scope", scope);
  if (redirectUri) qs.set("redirect_uri", redirectUri);

  const redirectUrl = `${authBase}?${qs.toString()}`;

  const setCookie = ["b24_oauth_state=" + state, "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=600"].join(
    "; ",
  );
  res.setHeader("Set-Cookie", setCookie);

  sendJson(res, 200, {
    success: true,
    redirectUrl,
    state,
    stateBinding: "browser_cookie_mvp",
  });
}

function handleCallback(req: VercelRequest, res: VercelResponse): void {
  const q = req.query as Record<string, unknown>;
  const stateFromQuery = firstQuery(q.state);
  const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
  const stateFromCookie = readCookie(cookieHeader, "b24_oauth_state");

  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    sendJson(res, 400, {
      success: false,
      code: "BITRIX24_OAUTH_STATE_MISMATCH",
      message: "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
    });
    return;
  }

  const clearStateCookie = ["b24_oauth_state=", "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join(
    "; ",
  );
  res.setHeader("Set-Cookie", clearStateCookie);

  sendJson(res, 200, {
    success: true,
    code: "BITRIX24_OAUTH_TOKEN_STORAGE_PENDING",
    message:
      "Запрос авторизации Bitrix24 получен, но на сервере ещё не настроено безопасное хранение токена для пользователя ЛК. Обратитесь к администратору.",
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Используйте GET.",
      });
      return;
    }

    const action = firstQuery((req.query as Record<string, unknown>).action).trim();

    switch (action) {
      case "status":
        handleStatus(res);
        return;
      case "start":
        handleStart(res);
        return;
      case "callback":
        handleCallback(req, res);
        return;
      default:
        sendJson(res, 404, {
          success: false,
          code: "BITRIX24_OAUTH_ACTION_NOT_FOUND",
          message: `Неизвестный action для /api/bitrix24/oauth: ${action || "(пусто)"}`,
        });
        return;
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth/[action] unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
