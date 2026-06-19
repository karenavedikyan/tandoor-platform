/**
 * Промт 435а: read-only диагностика для admin. Сравнивает counts
 * effective_scope с старыми источниками (client_assignments, dealer_overrides).
 * Не меняет прод-логику. Только видимость.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  fetchEffectiveScopeForUser,
  fetchEffectiveScopeTotals,
} from "../../shared/effective-scope.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }
    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED" });
      return;
    }
    if (me.role !== "admin" || me.status !== "active") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN" });
      return;
    }

    const userIdParam = (req.query.userId as string | undefined)?.trim();
    const totals = await fetchEffectiveScopeTotals(pool);

    // Сравнение counts со старыми источниками — на уровне totals.
    const caTotals = await pool.query<{ total: string; users: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(DISTINCT responsible_user_id)::text AS users
         FROM client_assignments`,
    );
    const ovTotals = await pool.query<{ rm: string; rop: string }>(
      `SELECT COUNT(*) FILTER (WHERE regional_manager_id IS NOT NULL)::text AS rm,
              COUNT(*) FILTER (WHERE rop_id IS NOT NULL)::text AS rop
         FROM dealer_overrides`,
    );

    const perUser =
      userIdParam && userIdParam.length > 0
        ? await fetchEffectiveScopeForUser(pool, userIdParam)
        : null;

    sendJson(res, 200, {
      success: true,
      effectiveScope: totals,
      legacy: {
        client_assignments: {
          rows: Number(caTotals.rows[0]?.total ?? 0),
          distinct_users: Number(caTotals.rows[0]?.users ?? 0),
        },
        dealer_overrides: {
          with_rm: Number(ovTotals.rows[0]?.rm ?? 0),
          with_rop: Number(ovTotals.rows[0]?.rop ?? 0),
        },
      },
      perUser: perUser
        ? {
            userId: userIdParam,
            count: perUser.length,
            sample: perUser.slice(0, 10),
          }
        : null,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[diag/effective-scope]", { message: m, stack });
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
