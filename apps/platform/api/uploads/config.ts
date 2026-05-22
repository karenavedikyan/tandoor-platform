/**
 * Vercel Serverless: GET /api/uploads/config
 *
 * Локально тот же путь в Express: `server/upload-routes.ts`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  try {
    if (res.headersSent) return;
    res.setHeader("Content-Type", JSON_CT);
    res.status(status).json(body);
  } catch {
    /* ignore */
  }
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте GET." });
      return;
    }
    sendJson(res, 200, { configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка конфигурации.";
    sendJson(res, 500, { success: false, message: msg });
  }
}
