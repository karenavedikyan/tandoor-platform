/**
 * GET /api/perf/summary — агрегаты Web Vitals для дашборда.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  buildPerfSummary,
  canAccessPerfSummary,
  isWebVitalsEnabled,
  parsePerfRangeDays,
} from "../../shared/web-vitals-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isWebVitalsEnabled()) {
      sendJson(res, 503, { success: false, code: "DISABLED", message: "WEB_VITALS_ENABLED=false" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE" });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED" });
      return;
    }
    if (!canAccessPerfSummary(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
      return;
    }

    const rangeDays = parsePerfRangeDays(typeof req.query.range === "string" ? req.query.range : undefined);
    const summary = await buildPerfSummary(pool, rangeDays);
    sendJson(res, 200, { success: true, ...summary });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[perf/summary]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
