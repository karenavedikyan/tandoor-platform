// MIGRATION-ONLY: health-check PG-прокси и shadow-write (промт 78).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import { isPgProxyConfigured, pgProxyHealth, pgProxyQuery } from "../../../server/db/pg-proxy-client.js";
import { isShadowWriteEnabled } from "../../../server/db/shadow-write.js";

const COMPARE_TABLES = [
  "users",
  "sessions",
  "teams",
  "client_assignments",
  "client_base_actualization_state",
  "sales_plan_fact_state",
  "legal_entities",
  "client_contacts",
  "dealer_work_plan",
  "client_comments",
  "audit_log",
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now();
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, { ok: false, error: "method-not-allowed" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 500, { ok: false, error: "env-not-configured", missing: ["DATABASE_URL"] });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.role !== "admin" || me.status !== "active") {
      sendJson(res, 403, { ok: false, error: "unauthorized" });
      return;
    }

    const configured = isPgProxyConfigured();
    const shadowWriteEnabled = isShadowWriteEnabled();
    const compare = req.query?.compare === "1" || req.query?.compare === "true";

    const pgReachable = configured ? await pgProxyHealth() : false;
    const proxyReachable = configured && pgReachable;

    if (!compare) {
      sendJson(res, 200, {
        ok: true,
        configured,
        proxyReachable,
        pgReachable,
        shadowWriteEnabled,
        durationMs: Date.now() - started,
      });
      return;
    }

    const counts: Array<{
      table: string;
      neon: number | null;
      yandex: number | null;
      delta: number | null;
      error?: string;
    }> = [];

    for (const table of COMPARE_TABLES) {
      let neonCount: number | null = null;
      let yandexCount: number | null = null;
      let error: string | undefined;
      try {
        const neonRes = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "${table.replace(/"/g, '""')}"`,
        );
        neonCount = Number(neonRes.rows[0]?.count ?? 0);
      } catch (e) {
        error = `neon: ${e instanceof Error ? e.message : String(e)}`;
      }
      if (configured) {
        const yRes = await pgProxyQuery<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "${table.replace(/"/g, '""')}"`,
        );
        if (yRes.ok) {
          yandexCount = Number(yRes.rows[0]?.count ?? 0);
        } else if (!error) {
          error = `yandex: ${yRes.error}`;
        }
      }
      const delta =
        neonCount !== null && yandexCount !== null ? yandexCount - neonCount : null;
      counts.push({ table, neon: neonCount, yandex: yandexCount, delta, error });
    }

    sendJson(res, 200, {
      ok: true,
      configured,
      proxyReachable,
      pgReachable,
      shadowWriteEnabled,
      durationMs: Date.now() - started,
      counts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[db-migrate/proxy-health]", message);
    sendJson(res, 500, { ok: false, error: "proxy-health-failed", message });
  }
}
