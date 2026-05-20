/**
 * POST /api/bitrix24/chat/recent-personal для Express (Node).
 * im.recent.get с персональным OAuth access_token (HttpOnly cookie).
 */

import { extractRecentRows, mapRecentItem, type Bitrix24RecentChatOut } from "./bitrix24-chat-recent-execute";
import { getEffectivePersonalSession } from "./bitrix24-oauth-session-service";
import { bitrixOAuthRest, oauthSessionRestContext } from "./bitrix24-oauth-token-http";

export type Bitrix24ChatRecentPersonalHttpResult = {
  status: number;
  body: Record<string, unknown>;
  setCookies?: string[];
};

export async function runBitrix24ChatRecentPersonal(cookieHeader: string | undefined): Promise<Bitrix24ChatRecentPersonalHttpResult> {
  const eff = await getEffectivePersonalSession(cookieHeader);
  const setCookies: string[] = [];
  if (eff.ok) {
    if (eff.setSessionCookie) setCookies.push(eff.setSessionCookie);
  } else if (eff.clearSessionCookie) {
    setCookies.push(eff.clearSessionCookie);
  }

  if (!eff.ok) {
    return {
      status: 401,
      body: {
        success: false,
        code: eff.code,
        message:
          eff.code === "BITRIX24_OAUTH_EXPIRED"
            ? "Сессия Bitrix24 истекла. Подключите Bitrix24 заново."
            : "Персональный аккаунт Bitrix24 не подключён. Подключите Bitrix24 в разделе «Коммуникации».",
      },
      setCookies: setCookies.length ? setCookies : undefined,
    };
  }

  const bx = await bitrixOAuthRest(oauthSessionRestContext(eff.session), "im.recent.get", eff.session.access_token, {});
  if (!bx.ok) {
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode: bx.bitrixCode,
        message: bx.message,
      },
      setCookies: setCookies.length ? setCookies : undefined,
    };
  }

  const rows = extractRecentRows(bx.result);
  const chats: Bitrix24RecentChatOut[] = [];
  for (const row of rows) {
    const m = mapRecentItem(row);
    if (m) chats.push(m);
  }

  return {
    status: 200,
    body: { success: true, chats },
    setCookies: setCookies.length ? setCookies : undefined,
  };
}
