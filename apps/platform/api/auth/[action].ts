/**
 * Vercel Serverless: `/api/auth/:action` (login | logout | logout-all | me).
 *
 * Ручной запуск миграций auth-schema — `npm run auth:db-push` (не из CI).
 * Бизнес-логика — `server/auth/handlers.ts` (общая с Express).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AuthUserSnapshot } from "../../server/auth/auth-user-snapshot";
import type { AuthHttpResult } from "../../server/auth/handlers";
import { loginHandler, logoutHandler, logoutAllHandler, meHandler } from "../../server/auth/handlers";
import { withAuth } from "../../server/auth/require-auth";

const JSON_CT = "application/json; charset=utf-8";

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0]!.trim();
  return "";
}

function vercelHeaders(req: VercelRequest): Record<string, string | string[] | undefined> {
  return (req.headers ?? {}) as Record<string, string | string[] | undefined>;
}

function applyAuthHttpResult(res: VercelResponse, r: AuthHttpResult): void {
  res.setHeader("Content-Type", JSON_CT);
  if (r.cacheControl) res.setHeader("Cache-Control", r.cacheControl);
  if (r.retryAfterSec !== undefined) res.setHeader("Retry-After", String(r.retryAfterSec));
  if (r.setCookie) {
    if (Array.isArray(r.setCookie)) {
      for (const c of r.setCookie) {
        res.appendHeader("Set-Cookie", c);
      }
    } else {
      res.setHeader("Set-Cookie", r.setCookie);
    }
  }
  res.status(r.status).json(r.json);
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

const meWrapped = withAuth(async (req, res) => {
  const auth = (req as VercelRequest & { auth?: AuthUserSnapshot }).auth!;
  applyAuthHttpResult(res, meHandler({ auth }));
});

const logoutAllWrapped = withAuth(async (req, res) => {
  const auth = (req as VercelRequest & { auth?: AuthUserSnapshot }).auth!;
  const result = await logoutAllHandler({ auth, headers: vercelHeaders(req) });
  applyAuthHttpResult(res, result);
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "login" && req.method === "POST") {
      const result = await loginHandler({ body: req.body, headers: vercelHeaders(req) });
      applyAuthHttpResult(res, result);
      return;
    }
    if (action === "logout" && req.method === "POST") {
      const result = await logoutHandler({ headers: vercelHeaders(req) });
      applyAuthHttpResult(res, result);
      return;
    }
    if (action === "logout-all" && req.method === "POST") {
      await logoutAllWrapped(req, res);
      return;
    }
    if (action === "me" && req.method === "GET") {
      await meWrapped(req, res);
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
