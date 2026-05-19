import type { Express, Request, Response } from "express";

const TEST_TASK_TITLE = "Тестовая задача из Тандор";
const TEST_TASK_DESCRIPTION =
  "POC интеграции Тандор + Bitrix24. Задача создана из встроенной страницы /bitrix24.";

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

function normalizeWebhookBase(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.replace(/\/+$/, "");
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

export function registerBitrix24Routes(app: Express): void {
  app.post("/api/bitrix24/tasks/test", async (_req: Request, res: Response) => {
    const webhookRaw = process.env.BITRIX24_WEBHOOK_URL;
    if (!webhookRaw || !webhookRaw.trim()) {
      return res.status(503).json({
        success: false,
        code: "BITRIX24_NOT_CONFIGURED",
        message: "Создание задачи недоступно: на сервере не задана переменная окружения BITRIX24_WEBHOOK_URL.",
      });
    }

    const webhookBase = normalizeWebhookBase(webhookRaw);
    const url = buildTasksTaskAddUrl(webhookBase);

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
        console.error("[bitrix24] Non-JSON response from Bitrix24", bxRes.status);
        return res.status(502).json({
          success: false,
          code: "BITRIX24_BAD_RESPONSE",
          message: "Bitrix24 вернул неожиданный ответ. Попробуйте позже или проверьте URL webhook.",
        });
      }
    } catch (e) {
      console.error("[bitrix24] Network error calling Bitrix24", e instanceof Error ? e.message : "unknown");
      return res.status(502).json({
        success: false,
        code: "BITRIX24_NETWORK",
        message: "Не удалось связаться с Bitrix24. Проверьте сеть и доступность портала.",
      });
    }

    if (bitrixJson.error) {
      console.error("[bitrix24] Bitrix24 API error", safeBitrixLogPayload(bitrixJson));
      const code = bitrixJson.error;
      let message =
        "Bitrix24 не принял запрос на создание задачи. Проверьте права webhook и настройки задач в портале.";
      if (code === "NO_AUTH_FOUND" || code === "INVALID_CREDENTIALS" || code === "expired_token") {
        message = "Доступ к Bitrix24 отклонён. Проверьте, что webhook URL актуален и не отозван.";
      } else if (code === "ERROR_CORE" && String(bitrixJson.error_description ?? "").includes("Responsible")) {
        message =
          "В портале требуется ответственный за задачу. Укажите на сервере числовой BITRIX24_TASK_RESPONSIBLE_ID (ID пользователя Bitrix24).";
      }
      return res.status(502).json({
        success: false,
        code: "BITRIX24_API_ERROR",
        message,
      });
    }

    const taskId = extractTaskId(bitrixJson.result);
    if (taskId == null) {
      console.error("[bitrix24] Unexpected success shape from Bitrix24");
      return res.status(502).json({
        success: false,
        code: "BITRIX24_UNEXPECTED_RESULT",
        message: "Задача могла быть создана, но сервер не смог прочитать идентификатор из ответа Bitrix24.",
      });
    }

    return res.status(200).json({
      success: true,
      taskId,
      message: "Тестовая задача создана в Bitrix24",
    });
  });
}
