import type { Request, RequestHandler } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { UserRole } from "../../shared/auth";
import { loadAuthUserSnapshot, type AuthUserSnapshot } from "./auth-user-snapshot";
import { parseAuthRefreshToken } from "./cookie";
import { getSessionByRefreshToken } from "./session-service";

export type VercelHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

export type AuthPredicate = (ctx: { userId: string }) => boolean | Promise<boolean>;

export type { AuthUserSnapshot } from "./auth-user-snapshot";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUserSnapshot;
    }
  }
}

/**
 * Express: валидирует `tandoor_auth_sess`, кладёт снимок пользователя из `users` в `req.auth`.
 * Сверка хеша refresh-токена — через `crypto.timingSafeEqual` в `getSessionByRefreshToken`.
 */
export function requireAuth(): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = parseAuthRefreshToken(req.headers.cookie);
      if (!token) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const session = await getSessionByRefreshToken(token);
      if (!session) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const snapshot = await loadAuthUserSnapshot(session.userId);
      if (!snapshot) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      req.auth = snapshot;
      next();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[auth] requireAuth", m.slice(0, 200));
      res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  };
}

/**
 * Vercel serverless: то же, что `requireAuth`, для обёртки handler.
 */
export function withAuth(handler: VercelHandler): VercelHandler {
  return async (req, res) => {
    try {
      const token = parseAuthRefreshToken(req.headers.cookie);
      if (!token) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const session = await getSessionByRefreshToken(token);
      if (!session) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const snapshot = await loadAuthUserSnapshot(session.userId);
      if (!snapshot) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      (req as VercelRequest & { auth?: AuthUserSnapshot }).auth = snapshot;
      await handler(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[auth] withAuth", m.slice(0, 200));
      res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  };
}

/**
 * TODO(auth-rbac-scope-cd7c): проверка ролей на API.
 * Сейчас — заглушка (пропускает запрос без проверки); не использовать для защиты до реализации RBAC.
 */
export function requireRole(..._roles: UserRole[]): RequestHandler {
  return (_req, _res, next) => next();
}

/**
 * TODO(auth-rbac-scope-cd7c): произвольные предикаты доступа.
 * Сейчас — заглушка; не использовать для защиты до реализации RBAC.
 */
export function requireAnyOf(..._predicates: AuthPredicate[]): RequestHandler {
  return (_req, _res, next) => next();
}
