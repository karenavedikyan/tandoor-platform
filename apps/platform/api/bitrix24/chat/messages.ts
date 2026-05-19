/**
 * Vercel Serverless: POST /api/bitrix24/chat/messages
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
 * Вызывает im.dialog.messages.get и возвращает нормализованные сообщения (plain text).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";
const DEFAULT_LIMIT = 30;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function readJsonBody(req: VercelRequest): unknown {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body) as unknown;
      } catch {
        return undefined;
      }
    }
    return req.body as unknown;
  }
  return undefined;
}

type BitrixSuccess = { result?: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

export type Bitrix24ChatMessageOut = {
  id: number | string;
  authorId?: number;
  text: string;
  date?: string;
  unread?: boolean;
};

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

function strOf(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** MVP: убрать BBCode/разметку Bitrix24 для безопасного plain text в UI. */
function stripBbCodeToPlainText(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/\[br\s*\/\]/gi, "\n").replace(/\[br\]/gi, "\n");
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, "$2");
  s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, "$1");
  s = s.replace(/\[USER=([^\]]+)\]([\s\S]*?)\[\/USER\]/gi, "$2");
  s = s.replace(/\[user=([^\]]+)\]([\s\S]*?)\[\/user\]/gi, "$2");
  for (let i = 0; i < 24; i++) {
    const next = s.replace(/\[[^\]]{0,400}?\]/gi, " ");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return s;
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number.parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function boolFromBitrix(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  if (v === "Y" || v === "y") return true;
  if (v === "N" || v === "n") return false;
  return undefined;
}

function extractMessagesArray(result: unknown): unknown[] {
  if (result == null) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    const msgs = r.messages ?? r.MESSAGES ?? r.items ?? r.ITEMS;
    if (Array.isArray(msgs)) return msgs;
  }
  return [];
}

function mapMessageRow(raw: unknown): Bitrix24ChatMessageOut | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.ID ?? o.message_id ?? o.MESSAGE_ID;
  if (idRaw == null || (typeof idRaw !== "string" && typeof idRaw !== "number")) return null;
  const id = typeof idRaw === "number" ? idRaw : String(idRaw);
  const textRaw = strOf(o.text ?? o.TEXT ?? o.message ?? o.MESSAGE ?? "");
  const text = stripBbCodeToPlainText(textRaw) || "(пустое сообщение)";
  const authorId = numOrUndef(o.author_id ?? o.AUTHOR_ID ?? o.senderId ?? o.SENDER_ID ?? o.user_id ?? o.USER_ID);
  const date = strOf(o.date ?? o.DATE ?? o.time ?? o.TIME) || undefined;
  const unread = boolFromBitrix(o.unread ?? o.UNREAD);
  return {
    id,
    text,
    ...(authorId != null ? { authorId } : {}),
    ...(date ? { date } : {}),
    ...(unread !== undefined ? { unread } : {}),
  };
}

function validateBody(raw: unknown): { ok: true; dialogId: string; limit: number } | { ok: false; message: string } {
  if (raw == null || raw === "" || (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length === 0)) {
    return { ok: false, message: "Ожидается JSON-объект с полем dialogId." };
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
  let limit = DEFAULT_LIMIT;
  if (Object.prototype.hasOwnProperty.call(o, "limit")) {
    const lv = o.limit;
    const n = typeof lv === "number" ? lv : typeof lv === "string" ? Number.parseInt(String(lv).trim(), 10) : NaN;
    if (!Number.isFinite(n) || n < MIN_LIMIT || n > MAX_LIMIT) {
      return { ok: false, message: `Поле limit должно быть числом от ${MIN_LIMIT} до ${MAX_LIMIT}.` };
    }
    limit = Math.floor(n);
  }
  return { ok: true, dialogId, limit };
}

async function runChatMessagesCore(rawBody: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const validated = validateBody(rawBody ?? {});
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_CHAT_MESSAGES_VALIDATION", message: validated.message },
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

  const url = buildMethodUrl(parsed.base, "im.dialog.messages.get");
  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        DIALOG_ID: validated.dialogId,
        LIMIT: validated.limit,
      }),
    });
    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error("[bitrix24-api] chat/messages bitrix non-json");
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_API_ERROR",
          message: "Bitrix24 вернул неожиданный ответ при загрузке сообщений. Попробуйте позже.",
        },
      };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24-api] chat/messages bitrix network", m);
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
    console.error("[bitrix24-api] chat/messages bitrix api error", { bitrixCode });
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode,
        message: "Bitrix24 не принял запрос на сообщения чата. Проверьте права webhook и идентификатор диалога.",
      },
    };
  }

  const rows = extractMessagesArray(bitrixJson.result);
  const messages: Bitrix24ChatMessageOut[] = [];
  for (const row of rows) {
    const m = mapMessageRow(row);
    if (m) messages.push(m);
  }

  return {
    status: 200,
    body: {
      success: true,
      dialogId: validated.dialogId,
      messages,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Используйте POST с заголовком content-type: application/json.",
      });
      return;
    }

    if (process.env.BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED !== "true") {
      sendJson(res, 403, {
        success: false,
        code: "BITRIX24_COMMUNICATIONS_DISABLED",
        message:
          "Раздел Коммуникации временно отключён: общий webhook Bitrix24 нельзя использовать для личных чатов сотрудников. Нужна персональная авторизация Bitrix24.",
      });
      return;
    }

    const body = readJsonBody(req);
    const out = await runChatMessagesCore(body ?? {});
    sendJson(res, out.status, out.body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat/messages unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
