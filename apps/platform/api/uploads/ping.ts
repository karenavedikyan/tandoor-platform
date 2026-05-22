/**
 * Vercel Serverless: GET /api/uploads/ping
 * Минимальная диагностика: без сторонних runtime-импортов, только типы.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  try {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.status(200).json({ ok: true, route: "uploads/ping" });
  } catch {
    try {
      if (!res.headersSent) res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("uploads/ping error");
    } catch {
      /* ignore */
    }
  }
}
