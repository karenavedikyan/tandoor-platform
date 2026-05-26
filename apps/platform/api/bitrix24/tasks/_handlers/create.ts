/**
 * Vercel Serverless: POST /api/bitrix24/tasks/create
 *
 * Полностью автономный handler: НИКАКИХ импортов из server/*, client/*, @/ или api/_lib/*.
 * Логика валидации и вызова Bitrix24 продублирована из api/_lib/* намеренно — на этом
 * проекте Vercel падал с FUNCTION_INVOCATION_FAILED при любом межфайловом импорте
 * внутри api/. Любая ошибка верхнего уровня перехватывается и отдаётся как JSON.
 *
 * Express-маршрут /api/bitrix24/tasks/create живёт отдельно в server/ и не зависит от этого файла.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

const MAX_TITLE = 180;
const MIN_TITLE = 3;
const MAX_DESCRIPTION = 4000;
const MAX_RETURN_URL = 8000;
const MAX_BITRIX_DESCRIPTION = 32000;

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

type Bitrix24TasksCreatePayload = {
  title: string;
  description: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  returnUrl?: string;
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v.trim();
}

function validateBody(
  raw: unknown,
): { ok: true; value: Bitrix24TasksCreatePayload; responsibleId: number | null } | { ok: false; message: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;

  const title = asTrimmedString(o.title);
  if (!title) return { ok: false, message: "Поле title обязательно." };
  if (title.length < MIN_TITLE) return { ok: false, message: `Заголовок задачи: минимум ${MIN_TITLE} символа.` };
  if (title.length > MAX_TITLE) return { ok: false, message: `Заголовок задачи: максимум ${MAX_TITLE} символов.` };

  const descRaw = o.description;
  const description = typeof descRaw === "string" ? descRaw : descRaw == null ? "" : null;
  if (description === null) return { ok: false, message: "Поле description должно быть строкой." };
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, message: `Описание: максимум ${MAX_DESCRIPTION} символов.` };
  }

  const dealerId = asTrimmedString(o.dealerId);
  if (!dealerId) return { ok: false, message: "Поле dealerId обязательно." };

  const dealerName = asTrimmedString(o.dealerName);
  if (!dealerName) return { ok: false, message: "Поле dealerName обязательно." };

  let tradePointId: string | undefined;
  if (o.tradePointId !== undefined && o.tradePointId !== null) {
    const tp = asTrimmedString(o.tradePointId);
    if (!tp) return { ok: false, message: "Поле tradePointId не может быть пустой строкой." };
    tradePointId = tp;
  }

  let tradePointName: string | undefined;
  if (o.tradePointName !== undefined && o.tradePointName !== null) {
    const tn = asTrimmedString(o.tradePointName);
    if (!tn) return { ok: false, message: "Поле tradePointName не может быть пустой строкой." };
    tradePointName = tn;
  }

  let returnUrl: string | undefined;
  if (o.returnUrl !== undefined && o.returnUrl !== null) {
    const ru = asTrimmedString(o.returnUrl);
    if (!ru) return { ok: false, message: "Поле returnUrl не может быть пустой строкой." };
    if (ru.length > MAX_RETURN_URL) return { ok: false, message: "Поле returnUrl слишком длинное." };
    returnUrl = ru;
  }

  const rid = parseOptionalResponsibleIdFromBody(o);
  if (!rid.ok) {
    return { ok: false, message: rid.message };
  }

  return {
    ok: true,
    value: { title, description, dealerId, dealerName, tradePointId, tradePointName, returnUrl },
    responsibleId: rid.id,
  };
}

function buildBitrixTaskDescription(payload: Bitrix24TasksCreatePayload): string {
  const lines: string[] = [];
  if (payload.description.trim()) lines.push(payload.description.trim());
  lines.push(`Клиент: ${payload.dealerName.trim()}`);
  if (payload.tradePointName?.trim()) {
    lines.push(`Торговая точка: ${payload.tradePointName.trim()}`);
  }
  if (payload.returnUrl?.trim()) {
    lines.push(`Ссылка в ЛК: ${payload.returnUrl.trim()}`);
  }
  let body = lines.join("\n\n");
  if (body.length > MAX_BITRIX_DESCRIPTION) {
    body = `${body.slice(0, MAX_BITRIX_DESCRIPTION - 20)}\n\n…(обрезано)`;
  }
  return body;
}

type BitrixSuccess = { result: unknown };
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

function buildTasksTaskAddUrl(webhookBase: string): string {
  return `${webhookBase}/tasks.task.add`;
}

function extractWebhookUserIdFromBase(webhookBase: string): number | null {
  const m = webhookBase.match(/\/rest\/(\d+)\/[^/?#]+/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveResponsibleIdForTask(webhookBase: string): { ok: true; id: number } | { ok: false; message: string } {
  const overrideRaw = process.env.BITRIX24_TASK_RESPONSIBLE_ID?.trim();
  if (overrideRaw) {
    const n = Number.parseInt(overrideRaw, 10);
    if (Number.isFinite(n) && n > 0) return { ok: true, id: n };
    return {
      ok: false,
      message:
        "BITRIX24_TASK_RESPONSIBLE_ID задан, но должен быть положительным целым числом (ID пользователя Bitrix24).",
    };
  }
  const fromUrl = extractWebhookUserIdFromBase(webhookBase);
  if (fromUrl != null) return { ok: true, id: fromUrl };
  return {
    ok: false,
    message:
      "Не удалось извлечь ID пользователя из BITRIX24_WEBHOOK_URL (ожидается шаблон .../rest/<число>/.../). Укажите BITRIX24_TASK_RESPONSIBLE_ID вручную.",
  };
}

/** Опциональный responsibleId: положительное целое; иначе fallback как раньше. */
function parseOptionalResponsibleIdFromBody(o: Record<string, unknown>):
  | { ok: true; id: number | null }
  | { ok: false; message: string } {
  if (!Object.prototype.hasOwnProperty.call(o, "responsibleId")) {
    return { ok: true, id: null };
  }
  const v = o.responsibleId;
  if (v === null || v === undefined) {
    return { ok: true, id: null };
  }
  if (typeof v === "boolean") {
    return { ok: false, message: "Поле responsibleId должно быть положительным целым числом." };
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
      return { ok: false, message: "Поле responsibleId должно быть положительным целым числом." };
    }
    return { ok: true, id: v };
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") {
      return { ok: true, id: null };
    }
    if (!/^[1-9]\d*$/.test(s)) {
      return { ok: false, message: "Поле responsibleId должно быть положительным целым числом." };
    }
    return { ok: true, id: Number.parseInt(s, 10) };
  }
  return { ok: false, message: "Поле responsibleId должно быть положительным целым числом." };
}

function extractTaskId(result: unknown): string | number | null {
  if (result == null) return null;
  if (typeof result === "number" || typeof result === "string") return result;
  if (typeof result === "object" && "task" in (result as Record<string, unknown>)) {
    const task = (result as { task?: { id?: unknown } }).task;
    const id = task?.id;
    if (typeof id === "number" || typeof id === "string") return id;
  }
  return null;
}

async function runBitrix24TasksCreateCore(
  rawBody: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const validated = validateBody(rawBody);
  if (!validated.ok) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CREATE_VALIDATION_ERROR",
        message: validated.message,
      },
    };
  }

  const webhookRaw = process.env.BITRIX24_WEBHOOK_URL;
  if (!webhookRaw || !String(webhookRaw).trim()) {
    return {
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_NOT_CONFIGURED",
        message: "Создание задачи недоступно: на сервере не задана переменная окружения BITRIX24_WEBHOOK_URL.",
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

  const url = buildTasksTaskAddUrl(parsed.base);

  let responsibleNumeric: number;
  if (validated.responsibleId != null) {
    responsibleNumeric = validated.responsibleId;
  } else {
    const rid = resolveResponsibleIdForTask(parsed.base);
    if (!rid.ok) {
      return {
        status: 400,
        body: { success: false, code: "BITRIX24_WEBHOOK_URL_INVALID", message: rid.message },
      };
    }
    responsibleNumeric = rid.id;
  }

  const fields: Record<string, string | number> = {
    TITLE: validated.value.title,
    DESCRIPTION: buildBitrixTaskDescription(validated.value),
    RESPONSIBLE_ID: responsibleNumeric,
    CREATED_BY: responsibleNumeric,
  };

  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fields }),
    });

    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error("[bitrix24-api] tasks/create bitrix non-json", "http", bxRes.status);
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_BAD_RESPONSE",
          message: "Bitrix24 вернул неожиданный ответ. Попробуйте позже или проверьте URL webhook.",
        },
      };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24-api] tasks/create bitrix network", m);
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_NETWORK",
        message: "Не удалось связаться с Bitrix24. Проверьте сеть и доступность портала.",
      },
    };
  }

  if (bitrixJson.error) {
    const bitrixCode = typeof bitrixJson.error === "string" ? bitrixJson.error : "UNKNOWN";
    console.error("[bitrix24-api] tasks/create bitrix api error", { bitrixCode });
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode,
        message:
          "Bitrix24 не принял запрос на создание задачи. Проверьте права webhook, ответственного и настройки задач в портале.",
      },
    };
  }

  const taskId = extractTaskId(bitrixJson.result);
  if (taskId == null) {
    console.error("[bitrix24-api] tasks/create bitrix unexpected result shape");
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_UNEXPECTED_RESULT",
        message: "Задача могла быть создана, но сервер не смог прочитать идентификатор из ответа Bitrix24.",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      taskId: String(taskId),
      message: "Задача создана в Bitrix24",
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
    const out = await runBitrix24TasksCreateCore(body);
    sendJson(res, out.status, out.body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] tasks/create unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
