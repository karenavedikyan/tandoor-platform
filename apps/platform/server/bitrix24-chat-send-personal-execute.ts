/**
 * POST /api/bitrix24/chat/send-personal для Express (Node).
 * im.message.add с персональным OAuth access_token.
 */

import { getEffectivePersonalSession } from "./bitrix24-oauth-session-service";
import { bitrixOAuthRest, oauthSessionRestContext } from "./bitrix24-oauth-token-http";

export type Bitrix24ChatSendPersonalHttpResult = {
  status: number;
  body: Record<string, unknown>;
  setCookies?: string[];
};

const MIN_MESSAGE = 1;
const MAX_MESSAGE = 2000;

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

function normalizeMessageId(result: unknown): string | number | null {
  if (result == null) return null;
  if (typeof result === "number" && Number.isFinite(result)) return result;
  if (typeof result === "string" && result.trim()) return result.trim();
  if (typeof result === "object" && !Array.isArray(result)) {
    const o = result as Record<string, unknown>;
    const id = o.id ?? o.ID ?? o.message_id ?? o.MESSAGE_ID;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

export async function runBitrix24ChatSendPersonal(
  body: unknown,
  cookieHeader: string | undefined,
): Promise<Bitrix24ChatSendPersonalHttpResult> {
  const parsed = readJsonBody(body) as Record<string, unknown> | undefined;
  const dialogId = typeof parsed?.dialogId === "string" ? parsed.dialogId.trim() : "";
  const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";

  if (!dialogId) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Укажите непустой dialogId в теле JSON.",
      },
    };
  }
  if (message.length < MIN_MESSAGE) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Укажите непустой текст сообщения.",
      },
    };
  }
  if (message.length > MAX_MESSAGE) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: `Сообщение не может быть длиннее ${MAX_MESSAGE} символов.`,
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

  const bx = await bitrixOAuthRest(oauthSessionRestContext(eff.session), "im.message.add", eff.session.access_token, {
    DIALOG_ID: dialogId,
    MESSAGE: message,
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

  const mid = normalizeMessageId(bx.result);
  if (mid == null) {
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        message: "Bitrix24 не вернул идентификатор сообщения.",
      },
      setCookies: setCookies.length ? setCookies : undefined,
    };
  }

  return {
    status: 200,
    body: { success: true, messageId: mid },
    setCookies: setCookies.length ? setCookies : undefined,
  };
}
