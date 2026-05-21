/**
 * Vercel Serverless: GET /api/uploads/config
 *
 * Локально тот же путь в Express: `server/upload-routes.ts`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader("Content-Type", JSON_CT);
  if (req.method !== "GET") {
    res.status(405).json({ message: "Метод не поддерживается. Используйте GET." });
    return;
  }
  res.status(200).json({ configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) });
}
