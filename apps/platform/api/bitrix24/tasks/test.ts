/**
 * Vercel Serverless: POST /api/bitrix24/tasks/test
 *
 * Полностью автономный handler: только импорты из api/_lib/* (без server/*, без @/).
 * Папка api/_lib/ начинается с подчёркивания — Vercel не регистрирует её как Serverless Functions,
 * поэтому шарить хелперы между функциями безопасно (см. docs/bitrix24-poc.md).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { executeBitrix24TaskAdd } from "../../_lib/webhook-task-core";

const JSON_CT = "application/json; charset=utf-8";

const TEST_TASK_TITLE = "Тестовая задача из Тандор";
const TEST_TASK_DESCRIPTION =
  "POC интеграции Тандор + Bitrix24. Задача создана из встроенной страницы /bitrix24.";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
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

    const out = await executeBitrix24TaskAdd(
      { TITLE: TEST_TASK_TITLE, DESCRIPTION: TEST_TASK_DESCRIPTION },
      {
        successMessage: "Тестовая задача создана в Bitrix24",
        logPrefix: "[bitrix24-api]",
      },
    );
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
