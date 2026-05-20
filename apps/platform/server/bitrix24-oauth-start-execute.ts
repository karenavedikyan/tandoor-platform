/**
 * GET /api/bitrix24/oauth/start для Express (Node).
 */

import { randomBytes } from "node:crypto";
import { cookieSecureFlag } from "./bitrix24-oauth-crypto-cookie";
import { normalizePortalBase, resolveRedirectUri } from "./bitrix24-oauth-token-http";

export type Bitrix24OAuthStartHttpResult = {
  status: number;
  body: Record<string, unknown>;
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
  const redirectUri = resolveRedirectUri();
  const scopeRaw = strEnv("BITRIX24_OAUTH_SCOPE");
  const scope = scopeRaw || "im,user";

  const state = randomState();
  const authBase = `${portalBase}/oauth/authorize/`;
  const qs = new URLSearchParams();
  qs.set("client_id", clientId);
  qs.set("response_type", "code");
  qs.set("state", state);
  qs.set("scope", scope);
  qs.set("redirect_uri", redirectUri);

  const redirectUrl = `${authBase}?${qs.toString()}`;

  const sec = cookieSecureFlag();
  const setCookie = ["b24_oauth_state=" + state, "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=600", sec ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");

  return {
    status: 200,
    body: {
      success: true,
      redirectUrl,
      state,
      stateBinding: "browser_cookie_mvp",
    },
    setCookie,
  };
}
