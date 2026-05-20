/**
 * Vercel Serverless: POST /api/bitrix24/chat/:action
 *
 * Объединённый dynamic handler для всех чат-эндпоинтов Bitrix24, чтобы не упираться
 * в лимит Vercel Hobby (12 serverless functions). Поведение каждого action идентично
 * прежним отдельным файлам api/bitrix24/chat/*.ts.
 *
 * Поддерживаемые action:
 *   - recent, messages, send, diagnostics  — старые общие webhook-эндпоинты:
 *     всегда возвращают BITRIX24_COMMUNICATIONS_DISABLED (общий webhook нельзя
 *     использовать для личных чатов сотрудников; нужна персональная OAuth).
 *   - recent-personal, messages-personal, send-personal — персональные эндпоинты:
 *     валидируют тело и возвращают BITRIX24_OAUTH_NOT_CONNECTED, пока не настроено
 *     серверное хранение OAuth-токена.
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*,
 * client/*, @/.
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

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

const SHARED_WEBHOOK_DISABLED_BODY = {
  success: false,
  code: "BITRIX24_COMMUNICATIONS_DISABLED",
  message:
    "Раздел Коммуникации временно отключён: общий webhook Bitrix24 нельзя использовать для личных чатов сотрудников. Нужна персональная авторизация Bitrix24.",
} as const;

const OAUTH_NOT_CONNECTED_BODY = {
  success: false,
  code: "BITRIX24_OAUTH_NOT_CONNECTED",
  message:
    "Персональный аккаунт Bitrix24 не подключён. Подключите Bitrix24 в разделе «Коммуникации» после настройки OAuth на сервере.",
} as const;

function handleSharedWebhookDisabled(res: VercelResponse): void {
  sendJson(res, 403, { ...SHARED_WEBHOOK_DISABLED_BODY });
}

function handleRecentPersonal(res: VercelResponse): void {
  sendJson(res, 401, { ...OAUTH_NOT_CONNECTED_BODY });
}

function handleMessagesPersonal(req: VercelRequest, res: VercelResponse): void {
  const parsed = readJsonBody(req) as Record<string, unknown> | undefined;
  const dialogId = typeof parsed?.dialogId === "string" ? parsed.dialogId.trim() : "";
  const limitRaw = parsed?.limit;
  let limit: number | undefined;
  if (typeof limitRaw === "number" && Number.isFinite(limitRaw)) limit = limitRaw;
  else if (typeof limitRaw === "string" && limitRaw.trim()) limit = Number.parseInt(limitRaw.trim(), 10);

  if (!dialogId) {
    sendJson(res, 400, {
      success: false,
      code: "BITRIX24_CHAT_MESSAGES_PERSONAL_VALIDATION",
      message: "Укажите непустой dialogId в теле JSON.",
    });
    return;
  }
  if (limit != null && (!Number.isFinite(limit) || limit < 1 || limit > 50)) {
    sendJson(res, 400, {
      success: false,
      code: "BITRIX24_CHAT_MESSAGES_PERSONAL_VALIDATION",
      message: "Поле limit должно быть целым числом от 1 до 50.",
    });
    return;
  }

  void limit;
  sendJson(res, 401, { ...OAUTH_NOT_CONNECTED_BODY });
}

function handleSendPersonal(req: VercelRequest, res: VercelResponse): void {
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

  sendJson(res, 401, { ...OAUTH_NOT_CONNECTED_BODY });
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

    const action = firstQuery((req.query as Record<string, unknown>).action).trim();

    switch (action) {
      case "recent":
      case "messages":
      case "send":
      case "diagnostics":
        handleSharedWebhookDisabled(res);
        return;
      case "recent-personal":
        handleRecentPersonal(res);
        return;
      case "messages-personal":
        handleMessagesPersonal(req, res);
        return;
      case "send-personal":
        handleSendPersonal(req, res);
        return;
      default:
        sendJson(res, 404, {
          success: false,
          code: "BITRIX24_CHAT_ACTION_NOT_FOUND",
          message: `Неизвестный action для /api/bitrix24/chat: ${action || "(пусто)"}`,
        });
        return;
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat/[action] unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
