/**
 * Admin: DDL каталога 1С → Neon и Yandex (Промт 116).
 * POST /api/admin/migrate-catalog-1c
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
  isDualMigrateSuccess,
  resolveNeonUrl,
  runOnNeon,
  runOnYandex,
} from "../../shared/dual-db-migrate.js";
import { splitSqlStatements } from "../../server/db-migrate/restore-yandex.js";
import { makePoolFromNeon } from "../../server/db/neon-client.js";
import { isCronBearerOnly } from "../../shared/cron-auth.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  here,
  "..",
  "..",
  "prisma",
  "migrations",
  "20260601120000_catalog_1c_foundation",
  "migration.sql",
);
const blobMigrationPath = join(
  here,
  "..",
  "..",
  "prisma",
  "migrations",
  "20260601193000_catalog_image_blob_url",
  "migration.sql",
);
const ddlSql = readFileSync(migrationPath, "utf8");
const blobSql = readFileSync(blobMigrationPath, "utf8");

const STMTS = [
  "CREATE EXTENSION IF NOT EXISTS pgcrypto",
  ...splitSqlStatements(ddlSql),
  ...splitSqlStatements(blobSql),
];

export const CATALOG_1C_EXPECTED_TABLES = [
  "catalog_categories",
  "catalog_groups",
  "catalog_products",
  "catalog_product_properties",
  "catalog_product_categories",
  "catalog_product_images",
  "catalog_warehouses",
  "catalog_stocks",
  "catalog_price_types",
  "catalog_prices",
  "catalog_sync_log",
] as const;

const SMOKE_SQL = `
  SELECT
    (SELECT count(*)::int FROM catalog_categories) AS cats,
    (SELECT count(*)::int FROM catalog_products) AS products,
    (SELECT count(*)::int FROM catalog_warehouses) AS warehouses
`;

async function runSmokeCounts(): Promise<{ cats: number; products: number; warehouses: number } | { error: string }> {
  const url = resolveNeonUrl();
  if (!url) return { error: "DATABASE_URL is not configured" };
  try {
    const pool = makePoolFromNeon(neon(url));
    const r = await pool.query<{ cats: number; products: number; warehouses: number }>(SMOKE_SQL);
    const row = r.rows[0];
    if (!row) return { cats: 0, products: 0, warehouses: 0 };
    return {
      cats: Number(row.cats),
      products: Number(row.products),
      warehouses: Number(row.warehouses),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }
    const cronCli = isCronBearerOnly(req);

    if (!cronCli && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    if (!cronCli) {
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
    }

    const neonRes = await runOnNeon(STMTS, [...CATALOG_1C_EXPECTED_TABLES]);
    const yandexRes = await runOnYandex(STMTS, [...CATALOG_1C_EXPECTED_TABLES]);
    const ok = isDualMigrateSuccess(neonRes, yandexRes, [...CATALOG_1C_EXPECTED_TABLES]);
    const smoke = ok ? await runSmokeCounts() : null;

    sendJson(res, 200, {
      success: ok,
      neon: neonRes,
      yandex: yandexRes,
      expected_tables: CATALOG_1C_EXPECTED_TABLES,
      tables_applied: CATALOG_1C_EXPECTED_TABLES.length,
      smoke_counts_neon: smoke,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-catalog-1c]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
