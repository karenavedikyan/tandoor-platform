/**
 * Общий минимальный слой вызова Bitrix24 `tasks.task.add` по входящему webhook.
 * Без импортов из server/* — подходит для Vercel Serverless и для бандла Express.
 * Не логирует и не возвращает URL webhook или секрет.
 */

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

export type Bitrix24TaskAddHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Нормализация и проверка базового URL входящего webhook Bitrix24.
 */
export function parseWebhookBase(raw: string | undefined): { ok: true; base: string } | { ok: false; message: string } {
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

export function buildTasksTaskAddUrl(webhookBase: string): string {
  return `${webhookBase}/tasks.task.add`;
}

/** ID пользователя из входящего webhook Bitrix24: `.../rest/{userId}/{token}` (слэш в конце опционален). */
export function extractWebhookUserIdFromBase(webhookBase: string): number | null {
  const m = webhookBase.match(/\/rest\/(\d+)\/[^/?#]+/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveResponsibleIdForTask(
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

export function extractTaskId(result: unknown): string | number | null {
  if (result == null) return null;
  if (typeof result === "number" || typeof result === "string") return result;
  if (typeof result === "object" && "task" in (result as Record<string, unknown>)) {
    const task = (result as { task?: { id?: unknown } }).task;
    const id = task?.id;
    if (typeof id === "number" || typeof id === "string") return id;
  }
  return null;
}

export type Bitrix24TaskFields = Record<string, string | number>;

/**
 * Выполняет `tasks.task.add` с полями задачи (TITLE, DESCRIPTION, …) и выставляет RESPONSIBLE_ID / CREATED_BY.
 */
export async function executeBitrix24TaskAdd(
  taskFields: Bitrix24TaskFields,
  options?: { successMessage?: string; logPrefix?: string },
): Promise<Bitrix24TaskAddHttpResult> {
  const logPrefix = options?.logPrefix ?? "[bitrix24]";
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
      body: {
        success: false,
        code: "BITRIX24_WEBHOOK_URL_INVALID",
        message: parsed.message,
      },
    };
  }

  const url = buildTasksTaskAddUrl(parsed.base);

  const rid = resolveResponsibleIdForTask(parsed.base);
  if (!rid.ok) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_WEBHOOK_URL_INVALID",
        message: rid.message,
      },
    };
  }

  const fields: Bitrix24TaskFields = {
    ...taskFields,
    RESPONSIBLE_ID: rid.id,
    CREATED_BY: rid.id,
  };

  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error(`${logPrefix} bitrix non-json`, "http", bxRes.status);
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
    console.error(`${logPrefix} bitrix network`, m);
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
    console.error(`${logPrefix} bitrix api error`, { bitrixCode });
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
    console.error(`${logPrefix} bitrix unexpected result shape`);
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_UNEXPECTED_RESULT",
        message: "Задача могла быть создана, но сервер не смог прочитать идентификатор из ответа Bitrix24.",
      },
    };
  }

  const successMessage =
    options?.successMessage?.trim() || "Задача создана в Bitrix24";

  return {
    status: 200,
    body: {
      success: true,
      taskId,
      message: successMessage,
    },
  };
}
