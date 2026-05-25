import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth/require-auth";
import { requirePermission } from "./auth/require-permission";
import { changePasswordSelf, getSelf, updateSelf } from "./profile/profile-handlers";
import { listSelfSessions, revokeOtherSelfSessions, revokeSelfSession } from "./profile/sessions-handlers";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
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
        await changePasswordSelf(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] profile-change-password", m.slice(0, 200));
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
        await revokeOtherSelfSessions(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] sessions-revoke-others-self", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );
}
