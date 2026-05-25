import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth/require-auth";
import { requirePermission } from "./auth/require-permission";
import {
  getUser,
  listUsers,
  createPasswordResetLink,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
} from "./admin/users-handlers";
import { listAudit } from "./admin/audit-handlers";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export function registerAdminRoutes(app: Express): void {
  app.get(
    "/api/admin/audit-list",
    requireAuth(),
    requirePermission("audit.read"),
    async (req: Request, res: Response) => {
      try {
        await listAudit(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] audit-list", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.get(
    "/api/admin/users-list",
    requireAuth(),
    requirePermission("users.list"),
    async (req: Request, res: Response) => {
      try {
        await listUsers(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] users-list", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.get(
    "/api/admin/users-get",
    requireAuth(),
    requirePermission("users.read_any"),
    async (req: Request, res: Response) => {
      try {
        await getUser(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] users-get", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/users-update-role",
    requireAuth(),
    requirePermission("users.update_role"),
    async (req: Request, res: Response) => {
      try {
        await updateUserRole(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] users-update-role", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/users-update-status",
    requireAuth(),
    requirePermission("users.update_status"),
    async (req: Request, res: Response) => {
      try {
        await updateUserStatus(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] users-update-status", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );


  app.post(
    "/api/admin/password-reset-link-create",
    requireAuth(),
    async (req: Request, res: Response) => {
      try {
        await createPasswordResetLink(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] password-reset-link-create", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );

  app.post(
    "/api/admin/users-reset-password",
    requireAuth(),
    requirePermission("users.reset_password"),
    async (req: Request, res: Response) => {
      try {
        await resetUserPassword(req, res);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[api/admin] users-reset-password", m.slice(0, 200));
        applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    },
  );
}
