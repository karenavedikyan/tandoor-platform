import type { Express, Request, Response } from "express";

const JSON_CT = "application/json; charset=utf-8";

const STUB_501_BODY = {
  success: false,
  code: "NOT_IMPLEMENTED",
  message: "Будет включено в PR auth-email-password-login-cd7c",
} as const;

function send501(_req: Request, res: Response): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(501).json(STUB_501_BODY);
}

/**
 * Заглушки `/api/auth/*` для локального dev (Express).
 * Не выставляют cookie и не обращаются к БД — см. PR `auth-email-password-login-cd7c`.
 */
export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", send501);
  app.post("/api/auth/logout", send501);
  app.post("/api/auth/logout-all", send501);
  app.get("/api/auth/me", send501);
}
