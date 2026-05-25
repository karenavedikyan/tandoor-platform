import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth/require-auth";
import { requirePermission } from "./auth/require-permission";
import { changePasswordSelf, getSelf, updateSelf } from "./profile/profile-handlers";
import { getOnboardingStatus, postOnboardingComplete, postProfileTelegramLinkToken } from "./profile/onboarding-handlers";
import { listSelfSessions, revokeOtherSelfSessions, revokeSelfSession } from "./profile/sessions-handlers";
import { enforceCsrfOrigin } from "./security/csrf-origin";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function rejectCsrf(res: Response): void {
  applyJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
}

export function registerProfileRoutes(app: Express): void {
  app.get(
    "/api/admin/profile-get-self",
    requireAuth(),
    requirePermission("profile.read_self"),
    async (req: Request, res: Response) => {
      try {
        await getSelf(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] profile-get-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/profile-update-self",
    requireAuth(),
    requirePermission("profile.update_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await updateSelf(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] profile-update-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/profile-change-password",
    requireAuth(),
    requirePermission("profile.update_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await changePasswordSelf(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] profile-change-password", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.get(
    "/api/admin/onboarding-status",
    requireAuth(),
    requirePermission("profile.read_self"),
    async (req: Request, res: Response) => {
      try {
        await getOnboardingStatus(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] onboarding-status", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/onboarding-complete",
    requireAuth(),
    requirePermission("profile.update_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await postOnboardingComplete(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] onboarding-complete", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/profile-telegram-link-token",
    requireAuth(),
    requirePermission("profile.update_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await postProfileTelegramLinkToken(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] profile-telegram-link-token", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.get(
    "/api/admin/sessions-list-self",
    requireAuth(),
    requirePermission("sessions.read_self"),
    async (req: Request, res: Response) => {
      try {
        await listSelfSessions(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] sessions-list-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/sessions-revoke-self",
    requireAuth(),
    requirePermission("sessions.revoke_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await revokeSelfSession(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] sessions-revoke-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/sessions-revoke-others-self",
    requireAuth(),
    requirePermission("sessions.revoke_self"),
    async (req: Request, res: Response) => {
      try {
        if (!enforceCsrfOrigin(req)) {
          rejectCsrf(res);
          return;
        }
        await revokeOtherSelfSessions(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] sessions-revoke-others-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );
}
