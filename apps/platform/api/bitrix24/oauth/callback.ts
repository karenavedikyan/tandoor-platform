/**
 * Vercel Serverless: GET /api/bitrix24/oauth/callback
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
 * Не логирует code из запроса.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

function readCookie(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader || !cookieHeader.trim()) return "";
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(p.slice(idx + 1).trim());
    } catch {
      return p.slice(idx + 1).trim();
    }
  }
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Используйте GET.",
      });
      return;
    }

    const q = req.query as Record<string, unknown>;
    const stateFromQuery = firstQuery(q.state);
    const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
    const stateFromCookie = readCookie(cookieHeader, "b24_oauth_state");

    if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
      sendJson(res, 400, {
        success: false,
        code: "BITRIX24_OAUTH_STATE_MISMATCH",
        message: "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
      });
      return;
    }

    const clearStateCookie = ["b24_oauth_state=", "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join(
      "; ",
    );
    res.setHeader("Set-Cookie", clearStateCookie);

    sendJson(res, 200, {
      success: true,
      code: "BITRIX24_OAUTH_TOKEN_STORAGE_PENDING",
      message:
        "Запрос авторизации Bitrix24 получен, но на сервере ещё не настроено безопасное хранение токена для пользователя ЛК. Обратитесь к администратору.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth/callback unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
