import type { Express, Request, Response } from "express";
import { getPool } from "../shared/admin/admin-auth.js";
import { fetchMyClientCodes } from "../shared/my-client-codes-handlers.js";
import { fetchMyDealerScopeForRequest } from "../shared/dealers-my-scope-handlers.js";
import { fetchTeamScopeForRequest } from "../shared/dealers-team-scope-handlers.js";
import { fetchOrgScopeForRequest } from "../shared/dealers-org-scope-handlers.js";
import type { UserRole } from "../shared/auth.js";
import { requireAuth } from "./auth/require-auth";

const JSON_CT = "application/json; charset=utf-8";

function parseQueryString(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || undefined;
}

function parseTotalsOnlyQuery(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

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

  app.get("/api/dealers/my-scope", requireAuth(), async (req: Request, res: Response) => {
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
      const forUserId = parseQueryString(req.query.for_user_id);
      const result = await fetchMyDealerScopeForRequest(
        pool,
        {
          id: req.auth.userId,
          email: req.auth.email,
          role: req.auth.role as UserRole,
          full_name: req.auth.fullName,
        },
        forUserId,
      );
      if ("forbidden" in result) {
        res.status(403).json({ success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      if ("notFound" in result) {
        res.status(404).json({ success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
        return;
      }
      res.setHeader("Content-Type", JSON_CT);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/dealers/my-scope]", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.get("/api/dealers/team-scope", requireAuth(), async (req: Request, res: Response) => {
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
      const ropUserId = parseQueryString(req.query.ropUserId) ?? parseQueryString(req.query.rop_user_id);
      const result = await fetchTeamScopeForRequest(
        pool,
        {
          id: req.auth.userId,
          email: req.auth.email,
          role: req.auth.role as UserRole,
          full_name: req.auth.fullName,
        },
        ropUserId,
        { totalsOnly: parseTotalsOnlyQuery(req.query.totalsOnly) },
      );
      if ("forbidden" in result) {
        res.status(403).json({ success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      if ("notFound" in result) {
        res.status(404).json({ success: false, code: "NOT_FOUND", message: "Команда не найдена." });
        return;
      }
      res.setHeader("Content-Type", JSON_CT);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/dealers/team-scope]", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });

  app.get("/api/dealers/org-scope", requireAuth(), async (req: Request, res: Response) => {
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
      const result = await fetchOrgScopeForRequest(pool, {
        id: req.auth.userId,
        email: req.auth.email,
        role: req.auth.role as UserRole,
        full_name: req.auth.fullName,
      });
      if ("forbidden" in result) {
        res.status(403).json({ success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      res.setHeader("Content-Type", JSON_CT);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/dealers/org-scope]", m.slice(0, 200));
      res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера.",
      });
    }
  });
}
