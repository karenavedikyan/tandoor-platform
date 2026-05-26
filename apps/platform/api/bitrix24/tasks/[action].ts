/**
 * Vercel Serverless: POST /api/bitrix24/tasks/(create|list|test).
 *
 * Один маршрут вместо трёх (лимит Hobby 12 функций).
 * Реальные handler-ы лежат в `_handlers/` (Vercel игнорирует папки с подчёркиванием).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import createHandler from "./_handlers/create";
import listHandler from "./_handlers/list";
import testHandler from "./_handlers/test";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  try {
    res.status(status).setHeader("content-type", JSON_CT).send(JSON.stringify(body));
  } catch {
    /* no-op */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");
    if (action === "create") {
      await createHandler(req, res);
      return;
    }
    if (action === "list") {
      await listHandler(req, res);
      return;
    }
    if (action === "test") {
      await testHandler(req, res);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут bitrix24/tasks.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] tasks/[action] unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
