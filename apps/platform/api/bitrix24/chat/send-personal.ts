/**
 * Vercel Serverless: POST /api/bitrix24/chat/send-personal
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
 * Не использует BITRIX24_WEBHOOK_URL.
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

    const parsed = readJsonBody(req) as Record<string, unknown> | undefined;
    const dialogId = typeof parsed?.dialogId === "string" ? parsed.dialogId.trim() : "";
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";

    if (!dialogId) {
      sendJson(res, 400, {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Укажите непустой dialogId в теле JSON.",
      });
      return;
    }
    if (!message.length) {
      sendJson(res, 400, {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Укажите непустой текст сообщения.",
      });
      return;
    }
    if (message.length > 2000) {
      sendJson(res, 400, {
        success: false,
        code: "BITRIX24_CHAT_SEND_PERSONAL_VALIDATION",
        message: "Сообщение не может быть длиннее 2000 символов.",
      });
      return;
    }

    sendJson(res, 401, {
      success: false,
      code: "BITRIX24_OAUTH_NOT_CONNECTED",
      message:
        "Персональный аккаунт Bitrix24 не подключён. Подключите Bitrix24 в разделе «Коммуникации» после настройки OAuth на сервере.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat/send-personal unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
