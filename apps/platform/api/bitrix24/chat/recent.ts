/**
 * Vercel Serverless: POST /api/bitrix24/chat/recent
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
 * Вызывает im.recent.get и возвращает нормализованный список чатов.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

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

type Bitrix24RecentChatOut = {
  dialogId: string;
  chatId?: number;
  title: string;
  lastMessageText?: string;
  lastMessageDate?: string;
  unread?: boolean;
  counter?: number;
  type?: string;
  entityType?: string;
  entityId?: string;
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

function extractRecentRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result != null && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    const keys = ["items", "ITEMS", "recent", "RECENT", "chats", "CHATS", "list", "LIST"];
    for (const k of keys) {
      const v = r[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function pickNestedMessage(item: Record<string, unknown>): Record<string, unknown> | null {
  const m = item.message ?? item.MESSAGE ?? item.lastMessage ?? item.LAST_MESSAGE;
  if (m != null && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return null;
}

function pickNestedChat(item: Record<string, unknown>): Record<string, unknown> | null {
  const c = item.chat ?? item.CHAT;
  if (c != null && typeof c === "object" && !Array.isArray(c)) return c as Record<string, unknown>;
  return null;
}

function mapRecentItem(raw: unknown): Bitrix24RecentChatOut | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const chat = pickNestedChat(item);

  const dialogId =
    strOf(item.id ?? item.ID ?? item.dialog_id ?? item.DIALOG_ID ?? item.dialogId ?? item.DIALOGID) ||
    strOf(chat?.id ?? chat?.ID ?? chat?.dialog_id ?? chat?.DIALOG_ID);
  if (!dialogId) return null;

  const titleFromChat = strOf(chat?.title ?? chat?.TITLE ?? chat?.name ?? chat?.NAME);
  const titleFromItem = strOf(item.title ?? item.TITLE ?? item.name ?? item.NAME);
  const title = (titleFromChat || titleFromItem || dialogId).trim() || dialogId;

  const msg = pickNestedMessage(item);
  const lastMessageTextRaw = strOf(
    msg?.text ?? msg?.TEXT ?? msg?.message ?? msg?.MESSAGE ?? item.text ?? item.TEXT ?? item.message ?? item.MESSAGE,
  );
  const lastMessageText = lastMessageTextRaw || undefined;
  const lastMessageDate = strOf(msg?.date ?? msg?.DATE ?? msg?.time ?? msg?.TIME) || undefined;

  const counter =
    numOrUndef(item.counter ?? item.COUNTER ?? item.lines ?? item.LINES ?? chat?.counter ?? chat?.COUNTER) ?? undefined;
  const unreadRaw = boolFromBitrix(item.unread ?? item.UNREAD) ?? (counter != null && counter > 0 ? true : undefined);

  const type = strOf(item.type ?? item.TYPE ?? chat?.type ?? chat?.TYPE) || undefined;

  const msgParams =
    msg && typeof msg.params === "object" && msg.params != null && !Array.isArray(msg.params)
      ? (msg.params as Record<string, unknown>)
      : undefined;

  const entityType =
    strOf(
      item.entity_type ??
        item.ENTITY_TYPE ??
        chat?.entity_type ??
        chat?.ENTITY_TYPE ??
        msgParams?.ENTITY_TYPE ??
        msgParams?.entity_type,
    ) || undefined;
  const entityId =
    strOf(
      item.entity_id ??
        item.ENTITY_ID ??
        chat?.entity_id ??
        chat?.ENTITY_ID ??
        msgParams?.ENTITY_ID ??
        msgParams?.entity_id,
    ) || undefined;

  const chatId = numOrUndef(item.chat_id ?? item.CHAT_ID ?? chat?.id ?? chat?.ID);

  return {
    dialogId,
    ...(chatId != null ? { chatId } : {}),
    title,
    ...(lastMessageText ? { lastMessageText } : {}),
    ...(lastMessageDate ? { lastMessageDate } : {}),
    ...(unreadRaw !== undefined ? { unread: unreadRaw } : {}),
    ...(counter != null ? { counter } : {}),
    ...(type ? { type } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
  };
}

async function runChatRecentCore(_rawBody: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
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

  const url = buildMethodUrl(parsed.base, "im.recent.get");
  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({}),
    });
    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error("[bitrix24-api] chat/recent bitrix non-json");
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_API_ERROR",
          message: "Bitrix24 вернул неожиданный ответ при загрузке чатов. Попробуйте позже.",
        },
      };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24-api] chat/recent bitrix network", m);
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
    console.error("[bitrix24-api] chat/recent bitrix api error", { bitrixCode });
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode,
        message: "Bitrix24 не принял запрос на список чатов. Проверьте права webhook и доступ к мессенджеру.",
      },
    };
  }

  const rows = extractRecentRows(bitrixJson.result);
  const chats: Bitrix24RecentChatOut[] = [];
  for (const row of rows) {
    const m = mapRecentItem(row);
    if (m) chats.push(m);
  }

  return {
    status: 200,
    body: {
      success: true,
      chats,
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

    const body = readJsonBody(req);
    const out = await runChatRecentCore(body ?? {});
    sendJson(res, out.status, out.body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat/recent unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
