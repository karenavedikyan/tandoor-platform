import type { Express, Request, Response } from "express";
import { getPool } from "../shared/admin/admin-auth.js";
import { fetchMyClientCodes } from "../shared/my-client-codes-handlers.js";
import { requireAuth } from "./auth/require-auth";

const JSON_CT = "application/json; charset=utf-8";

/** `/api/clients/*` для локального dev (Express). */
export function registerClientsRoutes(app: Express): void {
  app.get("/api/clients/my-codes", requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.auth) {
        res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
        return;
      }
      const pool = getPool();
      if (!pool) {
        res.status(503).json({
          success: false,
          code: "DB_UNAVAILABLE",
          message: "База данных недоступна.",
        });
        return;
      }
      const payload = await fetchMyClientCodes(pool, {
        id: req.auth.userId,
        role: req.auth.role,
      });
      res.setHeader("Content-Type", JSON_CT);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(payload);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/clients/my-codes]", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });
}
