import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth/require-auth";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  revokeInvitation,
} from "./auth/invitations-handlers";

const JSON_CT = "application/json; charset=utf-8";

function applyJson(res: Response, status: number, body: Record<string, unknown>, setCookie?: string): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  if (setCookie) res.setHeader("Set-Cookie", setCookie);
  res.status(status).json(body);
}

/**
 * `/api/invitations/*` для локального dev (Express).
 */
export function registerInvitationRoutes(app: Express): void {
  app.post("/api/invitations/create", requireAuth(), async (req: Request, res: Response) => {
    try {
      await createInvitation(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] create", m.slice(0, 200));
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  });

  app.get("/api/invitations/list", requireAuth(), async (req: Request, res: Response) => {
    try {
      await listInvitations(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] list", m.slice(0, 200));
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  });

  app.post("/api/invitations/revoke", requireAuth(), async (req: Request, res: Response) => {
    try {
      await revokeInvitation(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] revoke", m.slice(0, 200));
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  });

  app.post("/api/invitations/accept", async (req: Request, res: Response) => {
    try {
      await acceptInvitation(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] accept", m.slice(0, 200));
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  });

  app.get("/api/invitations/preview", async (req: Request, res: Response) => {
    try {
      await previewInvitation(req, res);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] preview", m.slice(0, 200));
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  });
}
