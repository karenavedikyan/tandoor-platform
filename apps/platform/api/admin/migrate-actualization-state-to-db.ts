/**
 * Admin: миграция trash/archive из jsonb actualization_state → dealer_overrides (Промт 420).
 * POST /api/admin/migrate-actualization-state-to-db
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

type TrashEntry = {
  dealerId?: string;
  trashedAt?: string;
  trashedBy?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "POST only." });
    return;
  }
  if (!enforceCsrfOrigin(req)) {
    sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
    return;
  }

  const pool = getPool();
  if (!pool) {
    sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
    return;
  }

  const headers = vercelHeaders(req);
  const me = await resolveCurrentUser(pool, headers);
  if (!me || me.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin." });
    return;
  }

  const dryRun = Boolean((req.body as Record<string, unknown>)?.dry_run);

  const rowsQ = await pool.query<{ user_id: string; state: Record<string, unknown> }>(
    `SELECT user_id::text, state FROM client_base_actualization_state`,
  );

  let migratedDealers = 0;
  let clearedBlobs = 0;

  await pool.query("BEGIN");
  try {
    for (const row of rowsQ.rows) {
      const state = row.state ?? {};
      const trashMap = (state.trashedDealersById ?? {}) as Record<string, TrashEntry>;
      const trashIds = Object.keys(trashMap);
      if (trashIds.length === 0) continue;

      for (const dealerId of trashIds) {
        const info = trashMap[dealerId];
        if (!info) continue;
        const trashedBy = info.trashedBy?.trim() || row.user_id;
        const trashedAt = info.trashedAt ?? new Date().toISOString();
        if (!dryRun) {
          await pool.query(
            `INSERT INTO dealer_overrides (dealer_id, status, trashed_at, trashed_by, updated_by)
             VALUES ($1, 'in_trash', $2::timestamptz, $3::uuid, $3::uuid)
             ON CONFLICT (dealer_id) DO UPDATE SET
               status = CASE
                 WHEN dealer_overrides.status IN ('purged', 'pending_admin') THEN dealer_overrides.status
                 WHEN dealer_overrides.status = 'in_trash' THEN dealer_overrides.status
                 ELSE 'in_trash'::record_status
               END,
               trashed_at = COALESCE(dealer_overrides.trashed_at, EXCLUDED.trashed_at),
               trashed_by = COALESCE(dealer_overrides.trashed_by, EXCLUDED.trashed_by),
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
            [dealerId, trashedAt, trashedBy],
          );
        }
        migratedDealers += 1;
      }

      if (!dryRun) {
        await pool.query(
          `UPDATE client_base_actualization_state
           SET state = jsonb_set(
                 jsonb_set(COALESCE(state, '{}'::jsonb), '{trashedDealersById}', '{}'::jsonb, true),
                 '{archivedDealersById}', '{}'::jsonb, true
               ),
               updated_at = NOW()
           WHERE user_id = $1::uuid`,
          [row.user_id],
        );
      }
      clearedBlobs += 1;
    }

    if (dryRun) await pool.query("ROLLBACK");
    else await pool.query("COMMIT");

    sendJson(res, 200, {
      success: true,
      dry_run: dryRun,
      migrated_dealers: migratedDealers,
      cleared_user_blobs: clearedBlobs,
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-actualization-state-to-db]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
