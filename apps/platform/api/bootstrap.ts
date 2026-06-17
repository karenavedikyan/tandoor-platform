/**
 * GET /api/bootstrap — агрегированный preload для первого экрана (Промт 380-safe).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson, vercelHeaders } from "../shared/admin/admin-auth.js";
import { buildBootstrapPayload } from "../shared/auth-bootstrap-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    const result = await buildBootstrapPayload(getPool(), vercelHeaders(req));
    sendJson(res, result.status, result.body as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bootstrap]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
