/**
 * GET /api/bitrix24/oauth/status для Express (Node).
 */

import { getEffectivePersonalSession } from "./bitrix24-oauth-session-service";

export type Bitrix24OAuthStatusHttpResult = {
  status: number;
  body: Record<string, unknown>;
  setCookies?: string[];
};

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

export async function runBitrix24OAuthStatus(cookieHeader: string | undefined): Promise<Bitrix24OAuthStatusHttpResult> {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  const portalDomain = strEnv("BITRIX24_PORTAL_DOMAIN");
  const configured = Boolean(clientId && clientSecret && portalDomain);

  if (!configured) {
    return {
      status: 200,
      body: {
        success: true,
        configured: false,
        connected: false,
      },
    };
  }

  const cookieSecretOk = Boolean(strEnv("BITRIX24_OAUTH_COOKIE_SECRET"));
  if (!cookieSecretOk) {
    return {
      status: 200,
      body: {
        success: true,
        configured: true,
        connected: false,
        warning: "BITRIX24_OAUTH_COOKIE_SECRET",
        message:
          "Задайте BITRIX24_OAUTH_COOKIE_SECRET на сервере, чтобы сохранять OAuth-сессию Bitrix24 в HttpOnly-cookie.",
      },
    };
  }

  const eff = await getEffectivePersonalSession(cookieHeader);
  const setCookies: string[] = [];
  if (eff.ok) {
    if (eff.setSessionCookie) setCookies.push(eff.setSessionCookie);
  } else if (eff.clearSessionCookie) {
    setCookies.push(eff.clearSessionCookie);
  }

  if (!eff.ok) {
    return {
      status: 200,
      body: {
        success: true,
        configured: true,
        connected: false,
      },
      setCookies: setCookies.length ? setCookies : undefined,
    };
  }

  const user =
    eff.session.bitrix_user_id || eff.session.user_name
      ? {
          bitrixUserId: eff.session.bitrix_user_id,
          name: eff.session.user_name,
        }
      : undefined;

  return {
    status: 200,
    body: {
      success: true,
      configured: true,
      connected: true,
      ...(user ? { user } : {}),
    },
    setCookies: setCookies.length ? setCookies : undefined,
  };
}
