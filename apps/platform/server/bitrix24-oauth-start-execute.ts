/**
 * GET /api/bitrix24/oauth/start для Express (Node).
 * Самодостаточный модуль — без импортов из api/.
 */

import { randomBytes } from "node:crypto";

export type Bitrix24OAuthStartHttpResult = {
  status: number;
  body: Record<string, unknown>;
  /** Полная строка Set-Cookie для state (HttpOnly). */
  setCookie?: string;
};

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

export function runBitrix24OAuthStart(): Bitrix24OAuthStartHttpResult {
  if (!isOAuthConfigured()) {
    return {
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_NOT_CONFIGURED",
        message:
          "OAuth Bitrix24 не настроен на сервере: задайте BITRIX24_OAUTH_CLIENT_ID, BITRIX24_OAUTH_CLIENT_SECRET и BITRIX24_PORTAL_DOMAIN.",
      },
    };
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

  return {
    status: 200,
    body: {
      success: true,
      redirectUrl,
      state,
      /**
       * TODO: привязать state к идентификатору пользователя ЛК после появления серверной сессии / JWT.
       * Сейчас state дополнительно фиксируется только в HttpOnly-cookie для того же браузера.
       */
      stateBinding: "browser_cookie_mvp",
    },
    setCookie,
  };
}
