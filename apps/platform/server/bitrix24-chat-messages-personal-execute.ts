/**
 * POST /api/bitrix24/chat/messages-personal для Express (Node).
 * im.dialog.messages.get с персональным OAuth access_token.
 */

import {
  DEFAULT_LIMIT,
  extractMessagesArray,
  mapMessageRow,
  MAX_LIMIT,
  MIN_LIMIT,
  type Bitrix24ChatMessageOut,
} from "./bitrix24-chat-messages-execute";
import { getEffectivePersonalSession } from "./bitrix24-oauth-session-service";
import { bitrixOAuthRest, oauthSessionRestContext } from "./bitrix24-oauth-token-http";

export type Bitrix24ChatMessagesPersonalHttpResult = {
  status: number;
  body: Record<string, unknown>;
  setCookies?: string[];
};

function readJsonBody(raw: unknown): unknown {
  if (raw !== undefined && raw !== null) {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return undefined;
      }
    }
    return raw as unknown;
  }
  return undefined;
}

export async function runBitrix24ChatMessagesPersonal(
  body: unknown,
  cookieHeader: string | undefined,
): Promise<Bitrix24ChatMessagesPersonalHttpResult> {
  const parsed = readJsonBody(body) as Record<string, unknown> | undefined;
  const dialogId = typeof parsed?.dialogId === "string" ? parsed.dialogId.trim() : "";
  const limitRaw = parsed?.limit;
  let limit: number | undefined;
  if (typeof limitRaw === "number" && Number.isFinite(limitRaw)) limit = limitRaw;
  else if (typeof limitRaw === "string" && limitRaw.trim()) limit = Number.parseInt(limitRaw.trim(), 10);

  if (!dialogId) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_MESSAGES_PERSONAL_VALIDATION",
        message: "Укажите непустой dialogId в теле JSON.",
      },
    };
  }
  if (limit != null && (!Number.isFinite(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT)) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_MESSAGES_PERSONAL_VALIDATION",
        message: `Поле limit должно быть целым числом от ${MIN_LIMIT} до ${MAX_LIMIT}.`,
      },
    };
  }
  const lim = limit ?? DEFAULT_LIMIT;

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
            : "Персональный аккаунт Bitrix24 не подключён.",
      },
      setCookies: setCookies.length ? setCookies : undefined,
    };
  }

  const bx = await bitrixOAuthRest(oauthSessionRestContext(eff.session), "im.dialog.messages.get", eff.session.access_token, {
    DIALOG_ID: dialogId,
    LIMIT: lim,
  });
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

  const raw = extractMessagesArray(bx.result);
  const messages: Bitrix24ChatMessageOut[] = [];
  for (const row of raw) {
    const m = mapMessageRow(row);
    if (m) messages.push(m);
  }

  return {
    status: 200,
    body: { success: true, dialogId, messages },
    setCookies: setCookies.length ? setCookies : undefined,
  };
}
