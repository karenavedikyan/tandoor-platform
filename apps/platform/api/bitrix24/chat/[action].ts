/**
 * Vercel Serverless: POST /api/bitrix24/chat/:action
 *
 * Catch-all handler для чат-эндпоинтов Bitrix24 (общий webhook + persona OAuth).
 * Объединяет recent / messages / send / diagnostics и recent-personal /
 * messages-personal / send-personal в один файл (Vercel Hobby 12-функций).
 *
 * Безопасность fallback'ов:
 *   - Любая необработанная ошибка возвращает JSON 500 INTERNAL_ERROR
 *     (а не raw Vercel FUNCTION_INVOCATION_FAILED).
 *   - Disabled shared-webhook действия возвращают 403 без подгрузки server/-модулей.
 *   - Personal-действия без env-конфигурации/cookie возвращают JSON 401/503
 *     раньше любых import'ов.
 *   - Серверные execute-модули подгружаются через dynamic import внутри try/catch,
 *     поэтому проблема при их загрузке в Vercel-бандле не валит весь handler.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

const SHARED_WEBHOOK_DISABLED_BODY = {
  success: false,
  code: "BITRIX24_COMMUNICATIONS_DISABLED",
  message:
    "Раздел Коммуникации временно отключён: общий webhook Bitrix24 нельзя использовать для личных чатов сотрудников. Нужна персональная авторизация Bitrix24.",
} as const;

function isUnsafeSharedWebhookEnabled(): boolean {
  const v = process.env.BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED;
  return typeof v === "string" && v.trim().toLowerCase() === "true";
}

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function isOAuthConfigured(): boolean {
  return Boolean(
    strEnv("BITRIX24_OAUTH_CLIENT_ID") &&
      strEnv("BITRIX24_OAUTH_CLIENT_SECRET") &&
      strEnv("BITRIX24_PORTAL_DOMAIN"),
  );
}

function isCookieSecretSet(): boolean {
  return Boolean(strEnv("BITRIX24_OAUTH_COOKIE_SECRET"));
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
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

function cookieHeader(req: VercelRequest): string | undefined {
  const h = req.headers.cookie;
  return typeof h === "string" ? h : undefined;
}

function hasPersonalSessionCookie(header: string | undefined): boolean {
  if (!header || !header.trim()) return false;
  for (const p of header.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k === "b24_personal_sess") {
      const v = p.slice(idx + 1).trim();
      return v.length > 0;
    }
  }
  return false;
}

function applySetCookies(res: VercelResponse, list: string[] | undefined): void {
  if (!list?.length) return;
  for (const c of list) {
    const cur = res.getHeader("Set-Cookie");
    if (!cur) res.setHeader("Set-Cookie", c);
    else if (Array.isArray(cur)) res.setHeader("Set-Cookie", [...cur, c]);
    else res.setHeader("Set-Cookie", [String(cur), c]);
  }
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function personalPreflight(req: VercelRequest):
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> } {
  if (!isOAuthConfigured()) {
    return {
      ok: false,
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_NOT_CONFIGURED",
        message:
          "OAuth Bitrix24 не настроен на сервере: задайте BITRIX24_OAUTH_CLIENT_ID, BITRIX24_OAUTH_CLIENT_SECRET и BITRIX24_PORTAL_DOMAIN.",
      },
    };
  }
  if (!isCookieSecretSet()) {
    return {
      ok: false,
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_COOKIE_ERROR",
        message: "На сервере не задан BITRIX24_OAUTH_COOKIE_SECRET — нельзя безопасно проверить сессию Bitrix24.",
      },
    };
  }
  if (!hasPersonalSessionCookie(cookieHeader(req))) {
    return {
      ok: false,
      status: 401,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_NOT_CONNECTED",
        message: "Персональный аккаунт Bitrix24 не подключён. Подключите Bitrix24 в разделе «Коммуникации».",
      },
    };
  }
  return { ok: true };
}

async function runPersonal(
  action: "recent-personal" | "messages-personal" | "send-personal",
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const pre = personalPreflight(req);
  if (!pre.ok) {
    sendJson(res, pre.status, pre.body);
    return;
  }
  try {
    if (action === "recent-personal") {
      const mod = await import("../../../server/bitrix24-chat-recent-personal-execute.js");
      const { status, body, setCookies } = await mod.runBitrix24ChatRecentPersonal(cookieHeader(req));
      applySetCookies(res, setCookies);
      sendJson(res, status, body);
      return;
    }
    if (action === "messages-personal") {
      const mod = await import("../../../server/bitrix24-chat-messages-personal-execute.js");
      const body = readJsonBody(req);
      const { status, body: out, setCookies } = await mod.runBitrix24ChatMessagesPersonal(
        body ?? {},
        cookieHeader(req),
      );
      applySetCookies(res, setCookies);
      sendJson(res, status, out);
      return;
    }
    // send-personal
    const mod = await import("../../../server/bitrix24-chat-send-personal-execute.js");
    const body = readJsonBody(req);
    const { status, body: out, setCookies } = await mod.runBitrix24ChatSendPersonal(
      body ?? {},
      cookieHeader(req),
    );
    applySetCookies(res, setCookies);
    sendJson(res, status, out);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat personal load/run failed", action, m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}

async function runShared(
  action: "recent" | "messages" | "send" | "diagnostics",
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!isUnsafeSharedWebhookEnabled()) {
    sendJson(res, 403, { ...SHARED_WEBHOOK_DISABLED_BODY });
    return;
  }
  try {
    const body = readJsonBody(req) ?? {};
    if (action === "recent") {
      const mod = await import("../../../server/bitrix24-chat-recent-execute.js");
      const { status, body: out } = await mod.runBitrix24ChatRecent(body);
      sendJson(res, status, out);
      return;
    }
    if (action === "messages") {
      const mod = await import("../../../server/bitrix24-chat-messages-execute.js");
      const { status, body: out } = await mod.runBitrix24ChatMessages(body);
      sendJson(res, status, out);
      return;
    }
    if (action === "send") {
      const mod = await import("../../../server/bitrix24-chat-send-execute.js");
      const { status, body: out } = await mod.runBitrix24ChatSend(body);
      sendJson(res, status, out);
      return;
    }
    // diagnostics
    const mod = await import("../../../server/bitrix24-chat-diagnostics-execute.js");
    const { status, body: out } = await mod.runBitrix24ChatDiagnostics(body);
    sendJson(res, status, out);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat shared load/run failed", action, m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
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
    if (action === "recent" || action === "messages" || action === "send" || action === "diagnostics") {
      await runShared(action, req, res);
      return;
    }
    if (action === "recent-personal" || action === "messages-personal" || action === "send-personal") {
      await runPersonal(action, req, res);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный chat-маршрут Bitrix24.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat", action, m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
