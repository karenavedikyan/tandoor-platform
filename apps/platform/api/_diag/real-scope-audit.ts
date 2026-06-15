/**
 * POST /api/_diag/real-scope-audit — телеметрия demo-fallback (Промт 338).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  isDiagAuditEnabled,
  persistRealScopeAuditBatch,
  type RealScopeAuditPayload,
} from "../../shared/real-scope-audit-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }

    if (!isDiagAuditEnabled()) {
      res.status(204).end();
      return;
    }

    const pool = getPool();
    if (!pool) {
      res.status(204).end();
      return;
    }

    const body = (req.body ?? {}) as RealScopeAuditPayload;
    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    const userId = me?.id ?? body.userId ?? null;

    await persistRealScopeAuditBatch(pool, { ...body, userId });

    res.status(204).end();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/_diag/real-scope-audit]", m.slice(0, 200));
    res.status(204).end();
  }
}
