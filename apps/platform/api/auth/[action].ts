/**
 * Vercel Serverless: `/api/auth/:action` (login | logout | logout-all | me).
 *
 * Ручной запуск миграций auth-schema — `npm run auth:db-push` (не из CI).
 * В этом PR все действия — **501 Not Implemented**; cookie не выставляются, БД не читается.
 * Реальный вход — PR `auth-email-password-login-cd7c`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

const STUB_501_BODY = {
  success: false,
  code: "NOT_IMPLEMENTED",
  message: "Будет включено в PR auth-email-password-login-cd7c",
} as const;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "login" && req.method === "POST") {
      sendJson(res, 501, STUB_501_BODY);
      return;
    }
    if (action === "logout" && req.method === "POST") {
      sendJson(res, 501, STUB_501_BODY);
      return;
    }
    if (action === "logout-all" && req.method === "POST") {
      sendJson(res, 501, STUB_501_BODY);
      return;
    }
    if (action === "me" && req.method === "GET") {
      sendJson(res, 501, STUB_501_BODY);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут auth API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, {
          success: false,
          code: "INTERNAL_ERROR",
          message: "Внутренняя ошибка сервера.",
        });
      }
    } catch {
      /* ignore */
    }
  }
}
