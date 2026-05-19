/**
 * POST /api/bitrix24/chat/diagnostics для Express (Node).
 * Логика продублирована из api/bitrix24/chat/diagnostics.ts — без импортов из api/.
 */

export type Bitrix24ChatDiagnosticsHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

const MAX_STRING = 500;
const MAX_MESSAGE_SEND = 2000;
const NOTIFY_TEXT = "Тестовое уведомление из ЛК Тандор";

type BitrixJson = { result?: unknown; error?: string; error_description?: string };

type DiagnosticEntry = {
  method: string;
  success: boolean;
  bitrixCode?: string;
  message: string;
  sample?: unknown;
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

function extractWebhookUserIdFromBase(webhookBase: string): number | null {
  const m = webhookBase.match(/\/rest\/(\d+)\/[^/?#]+/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function truncateStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function shrinkValue(value: unknown, depth: number): unknown {
  if (depth <= 0) return "[…]";
  if (value == null) return value;
  if (typeof value === "string") return truncateStr(value, MAX_STRING);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((x) => shrinkValue(x, depth - 1));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(o).slice(0, 24);
    for (const k of keys) {
      out[k] = shrinkValue(o[k], depth - 1);
    }
    return out;
  }
  return String(value);
}

function sampleForMethod(method: string, result: unknown): unknown {
  if (result == null) return null;
  if (method === "im.recent.get") {
    if (Array.isArray(result)) return result.slice(0, 3).map((x) => shrinkValue(x, 4));
    if (typeof result === "object" && !Array.isArray(result)) {
      const r = result as Record<string, unknown>;
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (Array.isArray(v)) return { [k]: v.slice(0, 3).map((x) => shrinkValue(x, 4)) };
      }
      return shrinkValue(result, 3);
    }
    return shrinkValue(result, 3);
  }
  if (method === "im.dialog.messages.get") {
    if (typeof result === "object" && result && !Array.isArray(result)) {
      const r = result as Record<string, unknown>;
      const msgs = r.messages ?? r.MESSAGES;
      if (Array.isArray(msgs)) return { messages: msgs.slice(0, 5).map((x) => shrinkValue(x, 4)) };
    }
    if (Array.isArray(result)) return result.slice(0, 5).map((x) => shrinkValue(x, 4));
    return shrinkValue(result, 3);
  }
  if (method === "im.message.add") {
    return shrinkValue(result, 3);
  }
  if (method === "im.notify.personal.add") {
    return shrinkValue(result, 3);
  }
  return shrinkValue(result, 3);
}

async function callBitrixMethod(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; kind: "network" } | { ok: false; kind: "bad_json" } | { ok: false; kind: "bitrix"; code: string }> {
  let parsed: BitrixJson;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await bxRes.text();
    try {
      parsed = JSON.parse(text) as BitrixJson;
    } catch {
      return { ok: false, kind: "bad_json" };
    }
  } catch {
    return { ok: false, kind: "network" };
  }
  if (parsed.error) {
    const code = typeof parsed.error === "string" ? parsed.error : "UNKNOWN";
    return { ok: false, kind: "bitrix", code };
  }
  return { ok: true, result: parsed.result };
}

function entryFromBitrixCall(
  method: string,
  out:
    | { ok: true; result: unknown }
    | { ok: false; kind: "network" }
    | { ok: false; kind: "bad_json" }
    | { ok: false; kind: "bitrix"; code: string },
): DiagnosticEntry {
  if (out.ok) {
    return {
      method,
      success: true,
      message: "Bitrix24 вернул успешный ответ REST.",
      sample: sampleForMethod(method, out.result),
    };
  }
  if (out.kind === "network") {
    return {
      method,
      success: false,
      bitrixCode: "NETWORK",
      message: "Сетевая ошибка при обращении к Bitrix24.",
    };
  }
  if (out.kind === "bad_json") {
    return {
      method,
      success: false,
      bitrixCode: "NON_JSON",
      message: "Bitrix24 вернул не-JSON ответ.",
    };
  }
  console.error("[bitrix24] chat/diagnostics bitrix error", { method, bitrixCode: out.code });
  return {
    method,
    success: false,
    bitrixCode: out.code,
    message: "Bitrix24 отклонил вызов метода (см. bitrixCode).",
  };
}

function validateDiagnosticsBody(raw: unknown): {
  ok: true;
  dialogId: string | null;
  message: string | null;
  testNotify: boolean;
} | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: true, dialogId: null, message: null, testNotify: false };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;
  let dialogId: string | null = null;
  if (Object.prototype.hasOwnProperty.call(o, "dialogId") && o.dialogId != null) {
    if (typeof o.dialogId !== "string" && typeof o.dialogId !== "number") {
      return { ok: false, message: "Поле dialogId должно быть строкой или числом." };
    }
    const t = String(o.dialogId).trim();
    dialogId = t.length ? t : null;
  }
  let message: string | null = null;
  if (Object.prototype.hasOwnProperty.call(o, "message") && o.message != null) {
    if (typeof o.message !== "string") {
      return { ok: false, message: "Поле message должно быть строкой." };
    }
    const t = o.message.trim();
    message = t.length ? t : null;
  }
  let testNotify = false;
  if (Object.prototype.hasOwnProperty.call(o, "testNotify")) {
    if (typeof o.testNotify !== "boolean") {
      return { ok: false, message: "Поле testNotify должно быть boolean." };
    }
    testNotify = o.testNotify;
  }
  return { ok: true, dialogId, message, testNotify };
}

export async function runBitrix24ChatDiagnostics(rawBody: unknown): Promise<Bitrix24ChatDiagnosticsHttpResult> {
  const validated = validateDiagnosticsBody(rawBody ?? {});
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_CHAT_DIAGNOSTICS_VALIDATION", message: validated.message },
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

  const base = parsed.base;
  const diagnostics: DiagnosticEntry[] = [];

  const a = await callBitrixMethod(buildMethodUrl(base, "im.recent.get"), {});
  diagnostics.push(entryFromBitrixCall("im.recent.get", a));

  if (validated.dialogId) {
    const b = await callBitrixMethod(buildMethodUrl(base, "im.dialog.messages.get"), {
      DIALOG_ID: validated.dialogId,
      LIMIT: 10,
    });
    diagnostics.push(entryFromBitrixCall("im.dialog.messages.get", b));
  }

  if (validated.dialogId && validated.message) {
    const msg = truncateStr(validated.message, MAX_MESSAGE_SEND);
    const c = await callBitrixMethod(buildMethodUrl(base, "im.message.add"), {
      DIALOG_ID: validated.dialogId,
      MESSAGE: msg,
    });
    diagnostics.push(entryFromBitrixCall("im.message.add", c));
  }

  if (validated.testNotify) {
    const uid = extractWebhookUserIdFromBase(base);
    if (uid == null) {
      diagnostics.push({
        method: "im.notify.personal.add",
        success: false,
        message: "Не удалось извлечь USER_ID из URL webhook для тестового уведомления.",
      });
    } else {
      const d = await callBitrixMethod(buildMethodUrl(base, "im.notify.personal.add"), {
        USER_ID: uid,
        MESSAGE: NOTIFY_TEXT,
      });
      diagnostics.push(entryFromBitrixCall("im.notify.personal.add", d));
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      diagnostics,
    },
  };
}
