/**
 * Vercel Serverless: POST /api/bitrix24/tasks/test
 *
 * Полностью автономный handler: без импортов из server/*, без path-алиасов @/.
 * Любая ошибка верхнего уровня перехватывается и отдаётся как JSON (не FUNCTION_INVOCATION_FAILED).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

const TEST_TASK_TITLE = "Тестовая задача из Тандор";
const TEST_TASK_DESCRIPTION =
  "POC интеграции Тандор + Bitrix24. Задача создана из встроенной страницы /bitrix24.";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

/**
 * Нормализация и проверка базового URL входящего webhook Bitrix24.
 * Не логирует значение URL.
 */
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
  // пользователь мог вставить полный URL метода
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

function safeBitrixLogPayload(json: BitrixErrorBody): { error?: string } {
  return { error: typeof json.error === "string" ? json.error : undefined };
}

async function runBitrix24TasksTestCore(): Promise<{ status: number; body: Record<string, unknown> }> {
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

  const responsibleRaw = process.env.BITRIX24_TASK_RESPONSIBLE_ID?.trim();
  const responsibleId = responsibleRaw ? Number.parseInt(responsibleRaw, 10) : NaN;

  const fields: Record<string, string | number> = {
    TITLE: TEST_TASK_TITLE,
    DESCRIPTION: TEST_TASK_DESCRIPTION,
  };
  if (Number.isFinite(responsibleId) && responsibleId > 0) {
    fields.RESPONSIBLE_ID = responsibleId;
    fields.CREATED_BY = responsibleId;
  }

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
      console.error("[bitrix24-api] bitrix non-json", "http", bxRes.status);
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
    console.error("[bitrix24-api] bitrix network", m);
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
    console.error("[bitrix24-api] bitrix api error", safeBitrixLogPayload(bitrixJson));
    const code = bitrixJson.error;
    let message =
      "Bitrix24 не принял запрос на создание задачи. Проверьте права webhook и настройки задач в портале.";
    if (code === "NO_AUTH_FOUND" || code === "INVALID_CREDENTIALS" || code === "expired_token") {
      message = "Доступ к Bitrix24 отклонён. Проверьте, что webhook URL актуален и не отозван.";
    } else if (code === "ERROR_CORE" && String(bitrixJson.error_description ?? "").includes("Responsible")) {
      message =
        "В портале требуется ответственный за задачу. Укажите на сервере числовой BITRIX24_TASK_RESPONSIBLE_ID (ID пользователя Bitrix24).";
    }
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        message,
      },
    };
  }

  const taskId = extractTaskId(bitrixJson.result);
  if (taskId == null) {
    console.error("[bitrix24-api] bitrix unexpected result shape");
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
      taskId,
      message: "Тестовая задача создана в Bitrix24",
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
        message: "Используйте POST с заголовком content-type: application/json (тело может быть пустым объектом {}).",
      });
      return;
    }

    const out = await runBitrix24TasksTestCore();
    sendJson(res, out.status, out.body);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
