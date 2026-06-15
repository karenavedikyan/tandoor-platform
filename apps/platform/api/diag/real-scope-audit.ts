/**
 * POST /api/diag/real-scope-audit — телеметрия demo-fallback (Промт 338).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  isDiagAuditEnabled,
  parseAuditBody,
  persistRealScopeAuditBatch,
} from "../../shared/real-scope-audit-handlers.js";

function isDebugRequest(req: VercelRequest): boolean {
  const q = req.query?.debug;
  return q === "1" || (Array.isArray(q) && q[0] === "1");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }

    const debug = isDebugRequest(req);

    if (!isDiagAuditEnabled()) {
      if (debug) {
        sendJson(res, 200, { ok: true, written: 0, diagEnabled: false });
        return;
      }
      res.status(204).end();
      return;
    }

    const pool = getPool();
    if (!pool) {
      if (debug) {
        sendJson(res, 200, { ok: false, written: 0, reason: "no-pool" });
        return;
      }
      res.status(204).end();
      return;
    }

    const body = parseAuditBody(req.body);
    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    const userId = me?.id ?? body.userId ?? null;

    const written = await persistRealScopeAuditBatch(pool, { ...body, userId });

    if (debug) {
      sendJson(res, 200, { ok: true, written, diagEnabled: true });
      return;
    }

    res.status(204).end();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? "").slice(0, 500) : "";
    console.error("[api/diag/real-scope-audit] ERROR", m.slice(0, 200), stack);
    try {
      res.setHeader("X-Audit-Error", m.slice(0, 120));
    } catch {
      // ignore header errors
    }
    res.status(204).end();
  }
}
