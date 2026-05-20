/**
 * POST /api/bitrix24/chat/recent-personal для Express (Node).
 * MVP: не вызывает Bitrix24 и не использует BITRIX24_WEBHOOK_URL.
 */

export type Bitrix24ChatRecentPersonalHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

export function runBitrix24ChatRecentPersonal(): Bitrix24ChatRecentPersonalHttpResult {
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
