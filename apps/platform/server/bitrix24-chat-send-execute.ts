/**
 * POST /api/bitrix24/chat/send для Express (Node).
 * Логика продублирована из api/bitrix24/chat/send.ts — без импортов из api/.
 */

export type Bitrix24ChatSendHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

const MIN_MESSAGE = 1;
const MAX_MESSAGE = 2000;

type BitrixSuccess = { result?: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

function parseWebhookBase(raw: string | undefined): { ok: true; base: string } | { ok: false; message: string } {
  if (raw == null || !String(raw).trim()) {
    return { ok: false, message: "Пустое значение BITRIX24_WEBHOOK_URL." };
  }
  let t = String(raw).trim();
  if (/profile\.json/i.test(t)) {
    return {
      ok: false,
      message:
        "В BITRIX24_WEBHOOK_URL указан не базовый webhook (обнаружен profile.json). Укажите базовый URL вида https://<портал>/rest/<user>/<token>/ без имени метода.",
    };
  }
  t = t.replace(/\/tasks\.task\.(add|list)\/?$/i, "");
  t = t.replace(/\/user\.get\/?$/i, "");
  t = t.replace(/\/im\.recent\.get\/?$/i, "");
  t = t.replace(/\/im\.dialog\.messages\.get\/?$/i, "");
  t = t.replace(/\/im\.message\.add\/?$/i, "");
  t = t.replace(/\/im\.notify\.personal\.add\/?$/i, "");
  t = t.replace(/\/im\.notify\.system\.add\/?$/i, "");
  t = t.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    return { ok: false, message: "BITRIX24_WEBHOOK_URL должен начинаться с http:// или https://." };
  }
  if (!/\/rest\//i.test(t)) {
    return {
      ok: false,
      message: "BITRIX24_WEBHOOK_URL должен содержать сегмент /rest/ (базовый входящий webhook Bitrix24).",
    };
  }
  return { ok: true, base: t };
}

function buildMethodUrl(webhookBase: string, method: string): string {
  return `${webhookBase}/${method}`;
}

function validateBody(raw: unknown): { ok: true; dialogId: string; message: string } | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: false, message: "Ожидается JSON-объект с полями dialogId и message." };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;
  const did = o.dialogId ?? o.DIALOG_ID;
  if (did == null || (typeof did !== "string" && typeof did !== "number")) {
    return { ok: false, message: "Поле dialogId обязательно и должно быть строкой или числом." };
  }
  const dialogId = String(did).trim();
  if (!dialogId) {
    return { ok: false, message: "Поле dialogId не может быть пустым." };
  }
  const msgRaw = o.message ?? o.MESSAGE;
  if (msgRaw == null || typeof msgRaw !== "string") {
    return { ok: false, message: "Поле message обязательно и должно быть строкой." };
  }
  const message = msgRaw.trim();
  if (message.length < MIN_MESSAGE) {
    return { ok: false, message: "Текст сообщения не может быть пустым." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, message: `Текст сообщения не может быть длиннее ${MAX_MESSAGE} символов.` };
  }
  return { ok: true, dialogId, message };
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

export async function runBitrix24ChatSend(rawBody: unknown): Promise<Bitrix24ChatSendHttpResult> {
  const validated = validateBody(rawBody ?? {});
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_CHAT_SEND_VALIDATION", message: validated.message },
    };
  }

  const webhookRaw = process.env.BITRIX24_WEBHOOK_URL;
  if (!webhookRaw || !String(webhookRaw).trim()) {
    return {
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_NOT_CONFIGURED",
        message: "Запрос к Bitrix24 недоступен: на сервере не задана переменная окружения BITRIX24_WEBHOOK_URL.",
      },
    };
  }

  const parsed = parseWebhookBase(webhookRaw);
  if (!parsed.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_WEBHOOK_URL_INVALID", message: parsed.message },
    };
  }

  const url = buildMethodUrl(parsed.base, "im.message.add");
  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        DIALOG_ID: validated.dialogId,
        MESSAGE: validated.message,
      }),
    });
    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error("[bitrix24] chat/send bitrix non-json");
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_API_ERROR",
          message: "Bitrix24 вернул неожиданный ответ при отправке сообщения. Попробуйте позже.",
        },
      };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24] chat/send bitrix network", m);
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        message: "Не удалось связаться с Bitrix24. Проверьте сеть и доступность портала.",
      },
    };
  }

  if (bitrixJson.error) {
    const bitrixCode = typeof bitrixJson.error === "string" ? bitrixJson.error : "UNKNOWN";
    console.error("[bitrix24] chat/send bitrix api error", { bitrixCode });
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode,
        message: "Bitrix24 не принял отправку сообщения. Проверьте права webhook и идентификатор диалога.",
      },
    };
  }

  const messageId = normalizeMessageId(bitrixJson.result);
  if (messageId == null) {
    console.error("[bitrix24] chat/send unexpected result shape");
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        message: "Bitrix24 вернул ответ без идентификатора сообщения.",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      messageId,
    },
  };
}
