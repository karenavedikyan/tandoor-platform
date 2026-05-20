import {
  B24_PERSONAL_SESSION_COOKIE,
  type Bitrix24PersonalSessionPayload,
  buildClearPersonalSessionCookie,
  buildSetPersonalSessionCookie,
  cookieSecureFlag,
  readCookieValue,
  sealPersonalSession,
  unsealPersonalSession,
} from "./bitrix24-oauth-crypto-cookie";
import { refreshAccessToken } from "./bitrix24-oauth-token-http";

const SKEW_MS = 60_000;

export type EffectiveSessionResult =
  | {
      ok: true;
      session: Bitrix24PersonalSessionPayload;
      setSessionCookie?: string;
      clearSessionCookie?: string;
    }
  | { ok: false; code: "BITRIX24_OAUTH_NOT_CONNECTED" | "BITRIX24_OAUTH_EXPIRED"; clearSessionCookie?: string };

export async function getEffectivePersonalSession(cookieHeader: string | undefined): Promise<EffectiveSessionResult> {
  const secure = cookieSecureFlag();
  const clear = buildClearPersonalSessionCookie(secure);
  const raw = readCookieValue(cookieHeader, B24_PERSONAL_SESSION_COOKIE);
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
