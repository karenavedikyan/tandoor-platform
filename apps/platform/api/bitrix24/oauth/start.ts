/**
 * Vercel Serverless: GET /api/bitrix24/oauth/start
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
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
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth/start unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
