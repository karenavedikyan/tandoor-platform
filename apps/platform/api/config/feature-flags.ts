/**
 * GET /api/config/feature-flags — серверные feature flags для клиента.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../../shared/admin/admin-auth.js";
import { getFeatureFlags } from "../../server/api/feature-flags-api.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  sendJson(res, 200, getFeatureFlags());
}
