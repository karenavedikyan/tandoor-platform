import type { Express, Request, Response } from "express";
import type { AuthHttpResult } from "./auth/handlers";
import {
  impersonateStartHandler,
  impersonateStopHandler,
  loginHandler,
  logoutHandler,
  logoutAllHandler,
  meHandler,
  myVisibleClientCodesHandler,
  passwordResetLinkRedeemHandler,
} from "./auth/handlers";
import { requireAuth } from "./auth/require-auth";
import { enforceCsrfOrigin } from "./security/csrf-origin";

const JSON_CT = "application/json; charset=utf-8";

function applyAuthHttpResult(res: Response, r: AuthHttpResult): void {
  res.setHeader("Content-Type", JSON_CT);
  if (r.cacheControl) res.setHeader("Cache-Control", r.cacheControl);
  if (r.retryAfterSec !== undefined) res.setHeader("Retry-After", String(r.retryAfterSec));
  if (r.setCookie) {
    if (Array.isArray(r.setCookie)) {
      res.setHeader("Set-Cookie", r.setCookie);
    } else {
      res.setHeader("Set-Cookie", r.setCookie);
    }
  }
  res.status(r.status).json(r.json);
}

function rejectCsrfJson(res: Response): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(403).json({ success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
}

/**
 * `/api/auth/*` для локального dev (Express); поведение совпадает с Vercel `api/auth/[action].ts`.
 */
export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      const result = await loginHandler({
        body: req.body,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] login", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      const result = await logoutHandler({
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] logout", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.post("/api/auth/logout-all", requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      if (!req.auth) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const result = await logoutAllHandler({
        auth: req.auth,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] logout-all", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.post("/api/auth/impersonate-start", requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      if (!req.auth) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const result = await impersonateStartHandler({
        auth: req.auth,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] impersonate-start", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.post("/api/auth/impersonate-stop", async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      const result = await impersonateStopHandler({
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] impersonate-stop", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.get("/api/auth/me", requireAuth(), (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      applyAuthHttpResult(res, meHandler({ auth: req.auth }));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] me", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.get("/api/auth/my-visible-codes", requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        res.status(401).json({ success: false, code: "UNAUTHORIZED" });
        return;
      }
      const result = await myVisibleClientCodesHandler({ auth: req.auth });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] my-visible-codes", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.post("/api/auth/password-reset-link-redeem", async (req: Request, res: Response) => {
    try {
      if (!enforceCsrfOrigin(req)) {
        rejectCsrfJson(res);
        return;
      }
      const result = await passwordResetLinkRedeemHandler({
        body: req.body,
        headers: req.headers as Record<string, string | string[] | undefined>,
        socketRemoteAddress: req.socket?.remoteAddress,
      });
      applyAuthHttpResult(res, result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] password-reset-link-redeem", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });
}
