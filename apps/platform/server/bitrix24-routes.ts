import type { Express, Request, Response } from "express";
import { runBitrix24TasksCreate } from "./bitrix24-tasks-create-execute";
import { runBitrix24TasksList } from "./bitrix24-tasks-list-execute";
import { runBitrix24TasksTest } from "./bitrix24-tasks-test-execute";
import { runBitrix24UsersList } from "./bitrix24-users-list-execute";
import { runBitrix24ChatDiagnostics } from "./bitrix24-chat-diagnostics-execute";
import { runBitrix24ChatRecent } from "./bitrix24-chat-recent-execute";
import { runBitrix24ChatMessages } from "./bitrix24-chat-messages-execute";
import { runBitrix24ChatSend } from "./bitrix24-chat-send-execute";
import { runBitrix24OAuthStatus } from "./bitrix24-oauth-status-execute";
import { runBitrix24OAuthStart } from "./bitrix24-oauth-start-execute";
import { runBitrix24OAuthCallback, runBitrix24OAuthDisconnect } from "./bitrix24-oauth-callback-execute";
import { runBitrix24ChatRecentPersonal } from "./bitrix24-chat-recent-personal-execute";
import { runBitrix24ChatMessagesPersonal } from "./bitrix24-chat-messages-personal-execute";
import { runBitrix24ChatSendPersonal } from "./bitrix24-chat-send-personal-execute";

function applySetCookies(res: Response, list: string[] | undefined): void {
  if (!list?.length) return;
  for (const c of list) res.append("Set-Cookie", c);
}

export function registerBitrix24Routes(app: Express): void {
  app.get("/api/bitrix24/oauth/status", async (req: Request, res: Response) => {
    try {
      const { status, body, setCookies } = await runBitrix24OAuthStatus(req.headers.cookie);
      applySetCookies(res, setCookies);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth/status", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.get("/api/bitrix24/oauth/start", async (_req: Request, res: Response) => {
    try {
      const { status, body, setCookie } = runBitrix24OAuthStart();
      if (setCookie) res.setHeader("Set-Cookie", setCookie);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth/start", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.get("/api/bitrix24/oauth/callback", async (req: Request, res: Response) => {
    try {
      const out = await runBitrix24OAuthCallback({
        query: req.query as Record<string, unknown>,
        cookieHeader: req.headers.cookie,
      });
      applySetCookies(res, out.setCookies);
      if (out.kind === "redirect") {
        return res.redirect(302, out.location);
      }
      return res.status(out.status).json(out.body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth/callback", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/oauth/disconnect", async (_req: Request, res: Response) => {
    try {
      const { setCookies } = runBitrix24OAuthDisconnect();
      applySetCookies(res, setCookies);
      return res.status(200).json({ success: true, message: "Подключение Bitrix24 сброшено в этом браузере." });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] oauth/disconnect", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/recent-personal", async (req: Request, res: Response) => {
    try {
      const { status, body, setCookies } = await runBitrix24ChatRecentPersonal(req.headers.cookie);
      applySetCookies(res, setCookies);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/recent-personal", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/messages-personal", async (req: Request, res: Response) => {
    try {
      const { status, body, setCookies } = await runBitrix24ChatMessagesPersonal(req.body, req.headers.cookie);
      applySetCookies(res, setCookies);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/messages-personal", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/send-personal", async (req: Request, res: Response) => {
    try {
      const { status, body, setCookies } = await runBitrix24ChatSendPersonal(req.body, req.headers.cookie);
      applySetCookies(res, setCookies);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/send-personal", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/tasks/test", async (_req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24TasksTest();
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] tasks/test", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/tasks/create", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24TasksCreate(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] tasks/create", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/tasks/list", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24TasksList(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] tasks/list", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/users/list", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24UsersList(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] users/list", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/diagnostics", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24ChatDiagnostics(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/diagnostics", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/recent", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24ChatRecent(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/recent", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/messages", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24ChatMessages(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/messages", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });

  app.post("/api/bitrix24/chat/send", async (req: Request, res: Response) => {
    try {
      const { status, body } = await runBitrix24ChatSend(req.body);
      return res.status(status).json(body);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[bitrix24] chat/send", m);
      return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера. Повторите запрос позже.",
      });
    }
  });
}
