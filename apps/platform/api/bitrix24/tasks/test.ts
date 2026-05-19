/**
 * Vercel Serverless: POST /api/bitrix24/tasks/test
 * Дублирует поведение Express-маршрута из server/bitrix24-routes.ts без попадания webhook в клиентский бандл.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runBitrix24TasksTest } from "../../../server/bitrix24-tasks-test-execute";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Используйте POST с телом application/json (можно пустой объект {}).",
    });
    return;
  }

  const { status, body } = await runBitrix24TasksTest();
  res.status(status).json(body);
}
