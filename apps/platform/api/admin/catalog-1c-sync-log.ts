/**
 * GET /api/admin/catalog-1c-sync-log?limit=10
 * Последние записи catalog_sync_log (Neon).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const limitRaw = req.query.limit;
    const limitNum = Number(Array.isArray(limitRaw) ? limitRaw[0] : limitRaw);
    const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(Math.floor(limitNum), 50) : 10;

    const r = await pool.query<{
      id: string;
      source_file: string;
      started_at: string;
      finished_at: string | null;
      status: string;
      rows_total: number;
      rows_upserted: number;
      rows_skipped: number;
      error: string | null;
    }>(
      `SELECT id, source_file, started_at, finished_at, status,
              rows_total, rows_upserted, rows_skipped, error
       FROM catalog_sync_log
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit],
    );

    const hasRunning = r.rows.some((row) => row.status === "running");

    sendJson(res, 200, {
      success: true,
      has_running: hasRunning,
      logs: r.rows.map((row) => ({
        id: String(row.id),
        source_file: row.source_file,
        started_at: row.started_at,
        finished_at: row.finished_at,
        status: row.status,
        rows_total: Number(row.rows_total),
        rows_upserted: Number(row.rows_upserted),
        rows_skipped: Number(row.rows_skipped),
        error: row.error,
        duration_ms:
          row.finished_at && row.started_at
            ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
            : null,
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (m.includes("catalog_sync_log")) {
      sendJson(res, 503, {
        success: false,
        code: "TABLE_MISSING",
        message: "Таблица catalog_sync_log не найдена. Сначала примените миграцию 116.",
      });
      return;
    }
    console.error("[catalog-1c-sync-log]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
