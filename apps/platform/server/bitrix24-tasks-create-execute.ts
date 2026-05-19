/**
 * Общая логика POST /api/bitrix24/tasks/create для Express (Node).
 *
 * Самодостаточный модуль: никаких импортов из api/* — Vercel-функция живёт
 * со своей копией логики в api/bitrix24/tasks/create.ts. Так серверный бандл
 * не вытягивает что-либо из директории api/ (и наоборот).
 */

const MAX_TITLE = 180;
const MIN_TITLE = 3;
const MAX_DESCRIPTION = 4000;
const MAX_RETURN_URL = 8000;
const MAX_BITRIX_DESCRIPTION = 32000;

export type Bitrix24TasksCreatePayload = {
  title: string;
  description: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  returnUrl?: string;
};

export type Bitrix24TasksCreateHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v.trim();
}

export function validateBitrix24TasksCreateBody(
  raw: unknown,
): { ok: true; value: Bitrix24TasksCreatePayload } | { ok: false; message: string } {
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

  return {
    ok: true,
    value: { title, description, dealerId, dealerName, tradePointId, tradePointName, returnUrl },
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
  t = t.replace(/\/tasks\.task\.add\/?$/i, "");
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

function resolveResponsibleIdForTask(
  webhookBase: string,
): { ok: true; id: number } | { ok: false; message: string } {
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

export async function runBitrix24TasksCreate(rawBody: unknown): Promise<Bitrix24TasksCreateHttpResult> {
  const validated = validateBitrix24TasksCreateBody(rawBody);
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_CREATE_VALIDATION_ERROR", message: validated.message },
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

  const rid = resolveResponsibleIdForTask(parsed.base);
  if (!rid.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_WEBHOOK_URL_INVALID", message: rid.message },
    };
  }

  const fields: Record<string, string | number> = {
    TITLE: validated.value.title,
    DESCRIPTION: buildBitrixTaskDescription(validated.value),
    RESPONSIBLE_ID: rid.id,
    CREATED_BY: rid.id,
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
      console.error("[bitrix24] tasks/create bitrix non-json", "http", bxRes.status);
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
    console.error("[bitrix24] tasks/create bitrix network", m);
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
    console.error("[bitrix24] tasks/create bitrix api error", { bitrixCode });
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
    console.error("[bitrix24] tasks/create bitrix unexpected result shape");
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
