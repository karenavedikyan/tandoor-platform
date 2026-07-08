/**
 * Admin: применить DDL clients-1c foundation (view + materialized views).
 * POST /api/admin/migrate-clients-1c
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  resolveNeonUrl,
  runOnNeon,
  runOnYandex,
  type DbMigrateRunResult,
  type DbMigrateSkipped,
} from "../../shared/dual-db-migrate.js";
import { makePoolFromNeon, type PoolLike } from "../../server/db/neon-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, "..", "..", "server", "migrations", "2026_07_11_clients_1c_foundation.sql");

export const CLIENTS_1C_EXPECTED_OBJECTS = [
  { name: "v_store_distribution", type: "view" },
  { name: "mv_stores_1c", type: "materialized_view" },
  { name: "mv_clients_1c", type: "materialized_view" },
  { name: "refresh_clients_1c_mv", type: "function" },
] as const;

export const CLIENTS_1C_MIGRATION_SQL = readFileSync(migrationPath, "utf8");
const STMTS = [CLIENTS_1C_MIGRATION_SQL];

export const CLIENTS_1C_SMOKE_SQL = `
  SELECT
    (SELECT COUNT(*)::int FROM mv_stores_1c) AS stores,
    (SELECT COUNT(*)::int FROM mv_clients_1c) AS clients,
    (SELECT COUNT(*)::int FROM v_store_distribution) AS distribution_rows,
    (SELECT COUNT(*)::int FROM mv_stores_1c WHERE distribution_total_targets > 0) AS stores_with_distribution,
    (SELECT COUNT(*)::int FROM mv_stores_1c WHERE orders_last_90d_count > 0) AS stores_with_orders
`;

export type Clients1cSmokeCounts = {
  stores: number;
  clients: number;
  distribution_rows: number;
  stores_with_distribution: number;
  stores_with_orders: number;
};

export async function verifyClients1cObjects(pool: PoolLike): Promise<boolean> {
  const r = await pool.query<{
    v_store_distribution: boolean;
    mv_stores_1c: boolean;
    mv_clients_1c: boolean;
    refresh_clients_1c_mv: boolean;
  }>(
    `SELECT
       to_regclass('public.v_store_distribution') IS NOT NULL AS v_store_distribution,
       to_regclass('public.mv_stores_1c') IS NOT NULL AS mv_stores_1c,
       to_regclass('public.mv_clients_1c') IS NOT NULL AS mv_clients_1c,
       EXISTS (
         SELECT 1
         FROM pg_proc p
         INNER JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'refresh_clients_1c_mv'
       ) AS refresh_clients_1c_mv`,
  );
  const row = r.rows[0];
  if (!row) return false;
  return (
    row.v_store_distribution &&
    row.mv_stores_1c &&
    row.mv_clients_1c &&
    row.refresh_clients_1c_mv
  );
}

export async function runClients1cSmoke(
  pool: PoolLike,
): Promise<Clients1cSmokeCounts | { error: string }> {
  try {
    const r = await pool.query<Clients1cSmokeCounts>(CLIENTS_1C_SMOKE_SQL);
    const row = r.rows[0];
    if (!row) {
      return {
        stores: 0,
        clients: 0,
        distribution_rows: 0,
        stores_with_distribution: 0,
        stores_with_orders: 0,
      };
    }
    return {
      stores: Number(row.stores),
      clients: Number(row.clients),
      distribution_rows: Number(row.distribution_rows),
      stores_with_distribution: Number(row.stores_with_distribution),
      stores_with_orders: Number(row.stores_with_orders),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function isClients1cNeonApplyOk(
  neonRes: DbMigrateRunResult | { error: string },
): boolean {
  if ("error" in neonRes) return false;
  return neonRes.applied.length > 0 && neonRes.applied.every((x) => x.ok);
}

export function isClients1cYandexApplyOk(
  yandexRes: DbMigrateRunResult | DbMigrateSkipped | { error: string },
): boolean {
  if ("skipped" in yandexRes && yandexRes.skipped) return true;
  if ("error" in yandexRes) return false;
  return yandexRes.applied.length > 0 && yandexRes.applied.every((x) => x.ok);
}

async function postApplyNeonChecks(ms: number): Promise<{
  applied: boolean;
  ms: number;
  objectsVerified: boolean;
  smoke: Clients1cSmokeCounts | { error: string } | null;
}> {
  const url = resolveNeonUrl();
  if (!url) {
    return { applied: false, ms, objectsVerified: false, smoke: { error: "DATABASE_URL is not configured" } };
  }
  const pool = makePoolFromNeon(neon(url));
  const objectsVerified = await verifyClients1cObjects(pool);
  const smoke = objectsVerified ? await runClients1cSmoke(pool) : null;
  return { applied: objectsVerified, ms, objectsVerified, smoke };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }

    const cronSecret = (process.env.CRON_SECRET || "").trim();
    const authHeader = (req.headers.authorization || "").trim();
    const isCronAuth = cronSecret.length > 0 && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      if (!enforceCsrfOrigin(req)) {
        sendJson(res, 403, { ok: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
        return;
      }

      const pool = getPool();
      if (!pool) {
        sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
        return;
      }

      const me = await resolveCurrentUser(pool, vercelHeaders(req));
      if (!me) {
        sendJson(res, 401, { ok: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
        return;
      }
      if (me.role !== "admin") {
        sendJson(res, 403, { ok: false, code: "FORBIDDEN", message: "Только для администратора." });
        return;
      }
    }

    const neonStarted = Date.now();
    const neonRes = await runOnNeon(STMTS, []);
    const neonMs = Date.now() - neonStarted;

    const yandexStarted = Date.now();
    const yandexRes = await runOnYandex(STMTS, []);
    const yandexMs = Date.now() - yandexStarted;

    if (!isClients1cNeonApplyOk(neonRes)) {
      sendJson(res, 500, {
        ok: false,
        error: "error" in neonRes ? neonRes.error : "Neon migration statements failed",
        neon: neonRes,
        yandex: yandexRes,
      });
      return;
    }

    const neonChecks = await postApplyNeonChecks(neonMs);
    if (!neonChecks.objectsVerified) {
      sendJson(res, 500, {
        ok: false,
        error: "clients_1c objects missing after migration on Neon",
        neon: { ...neonChecks, apply: neonRes },
        yandex: {
          applied: isClients1cYandexApplyOk(yandexRes),
          ms: yandexMs,
          result: yandexRes,
        },
      });
      return;
    }

    const yandexOk = isClients1cYandexApplyOk(yandexRes);

    sendJson(res, 200, {
      ok: true,
      neon: {
        applied: true,
        ms: neonChecks.ms,
        objectsVerified: neonChecks.objectsVerified,
        smoke: neonChecks.smoke,
        statements: neonRes,
      },
      yandex: {
        applied: yandexOk,
        ms: yandexMs,
        result: yandexRes,
      },
      expected_objects: CLIENTS_1C_EXPECTED_OBJECTS,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-clients-1c]", m);
    sendJson(res, 500, { ok: false, error: m });
  }
}
