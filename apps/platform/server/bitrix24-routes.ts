import type { Express, Request, Response } from "express";
import { runBitrix24TasksCreate } from "./bitrix24-tasks-create-execute";
import { runBitrix24TasksList } from "./bitrix24-tasks-list-execute";
import { runBitrix24TasksTest } from "./bitrix24-tasks-test-execute";
import { runBitrix24UsersList } from "./bitrix24-users-list-execute";

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
}
