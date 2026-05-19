import type { Express, Request, Response } from "express";
import { runBitrix24TasksCreate } from "./bitrix24-tasks-create-execute";
import { runBitrix24TasksList } from "./bitrix24-tasks-list-execute";
import { runBitrix24TasksTest } from "./bitrix24-tasks-test-execute";
import { runBitrix24UsersList } from "./bitrix24-users-list-execute";
import { runBitrix24ChatDiagnostics } from "./bitrix24-chat-diagnostics-execute";
import { runBitrix24ChatRecent } from "./bitrix24-chat-recent-execute";
import { runBitrix24ChatMessages } from "./bitrix24-chat-messages-execute";
import { runBitrix24ChatSend } from "./bitrix24-chat-send-execute";

export function registerBitrix24Routes(app: Express): void {
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
