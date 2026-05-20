/**
 * POST /api/bitrix24/chat/send-personal для Express (Node).
 * MVP: не вызывает Bitrix24 и не использует BITRIX24_WEBHOOK_URL.
 */

export type Bitrix24ChatSendPersonalHttpResult = {
  status: number;
  body: Record<string, unknown>;
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

export function runBitrix24ChatSendPersonal(body: unknown): Bitrix24ChatSendPersonalHttpResult {
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
  if (!message.length) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Укажите непустой текст сообщения.",
      },
    };
  }
  if (message.length > 2000) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Сообщение не может быть длиннее 2000 символов.",
      },
    };
  }

  return {
    status: 401,
    body: {
      success: false,
      code: "BITRIX24_OAUTH_NOT_CONNECTED",
      message:
        "Персональный аккаунт Bitrix24 не подключён. Подключите Bitrix24 в разделе «Коммуникации» после настройки OAuth на сервере.",
    },
  };
}
