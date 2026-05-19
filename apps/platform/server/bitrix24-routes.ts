import type { Express, Request, Response } from "express";
import { runBitrix24TasksTest } from "./bitrix24-tasks-test-execute";

export function registerBitrix24Routes(app: Express): void {
  app.post("/api/bitrix24/tasks/test", async (_req: Request, res: Response) => {
    const { status, body } = await runBitrix24TasksTest();
    return res.status(status).json(body);
  });
}
