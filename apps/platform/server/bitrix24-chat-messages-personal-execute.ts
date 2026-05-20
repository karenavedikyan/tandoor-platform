/**
 * POST /api/bitrix24/chat/messages-personal для Express (Node).
 * MVP: не вызывает Bitrix24 и не использует BITRIX24_WEBHOOK_URL.
 */

export type Bitrix24ChatMessagesPersonalHttpResult = {
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

export function runBitrix24ChatMessagesPersonal(body: unknown): Bitrix24ChatMessagesPersonalHttpResult {
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
  if (limit != null && (!Number.isFinite(limit) || limit < 1 || limit > 50)) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CHAT_MESSAGES_PERSONAL_VALIDATION",
        message: "Поле limit должно быть целым числом от 1 до 50.",
      },
    };
  }

  void limit;
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
