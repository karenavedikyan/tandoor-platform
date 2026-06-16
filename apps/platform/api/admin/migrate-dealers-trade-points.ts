/**
 * Admin: применить DDL дилеров и ТТ (Промт 348).
 * POST /api/admin/migrate-dealers-trade-points
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  isDualMigrateSuccess,
  runOnNeon,
  runOnYandex,
} from "../../shared/dual-db-migrate.js";
import { splitSqlStatements } from "../../server/db-migrate/restore-yandex.js";

const here = dirname(fileURLToPath(import.meta.url));
const ddlPath = join(here, "..", "..", "server", "migrations", "2026_06_05_dealers_trade_points.sql");
const ddlSql = readFileSync(ddlPath, "utf8");
const STMTS = ["CREATE EXTENSION IF NOT EXISTS pgcrypto", ...splitSqlStatements(ddlSql)];

const EXPECTED_TABLES = ["dealers", "trade_points"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
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

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.role !== "admin" || me.status !== "active") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin." });
      return;
    }

    const neon = await runOnNeon(STMTS, EXPECTED_TABLES);
    const yandex = await runOnYandex(STMTS, EXPECTED_TABLES);
    if (!isDualMigrateSuccess(neon, yandex, EXPECTED_TABLES)) {
      sendJson(res, 500, {
        success: false,
        code: "MIGRATE_FAILED",
        message: "Миграция dealers/trade_points не применена на всех БД.",
        neon,
        yandex,
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      applied: EXPECTED_TABLES,
      neon,
      yandex,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-dealers-trade-points]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m.slice(0, 300) });
  }
}
