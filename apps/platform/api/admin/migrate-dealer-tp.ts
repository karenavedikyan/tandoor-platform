/**
 * Admin: применить DDL оверрайдов дилера и ТТ к Neon и Yandex (Промт 113).
 * POST /api/admin/migrate-dealer-tp
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
const ddlPath = join(here, "..", "..", "server", "migrations", "2026_05_31_dealer_tp_overrides.sql");
const ddlSql = readFileSync(ddlPath, "utf8");
const writeErrorsPath = join(here, "..", "..", "server", "migrations", "2026_05_31_overrides_write_errors.sql");
const writeErrorsSql = readFileSync(writeErrorsPath, "utf8");
const accessLogPath = join(here, "..", "..", "server", "migrations", "2026_05_31_overrides_api_access_log.sql");
const accessLogSql = readFileSync(accessLogPath, "utf8");
const STMTS = [
  "CREATE EXTENSION IF NOT EXISTS pgcrypto",
  ...splitSqlStatements(ddlSql),
  ...splitSqlStatements(writeErrorsSql),
  ...splitSqlStatements(accessLogSql),
];

const EXPECTED_TABLES = [
  "dealer_overrides",
  "dealer_override_events",
  "dealer_training_state",
  "manual_dealers",
  "trade_point_overrides",
  "trade_point_override_events",
  "trade_point_training_state",
  "overrides_write_errors",
  "overrides_api_access_log",
];

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
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const neonRes = await runOnNeon(STMTS, EXPECTED_TABLES);
    const yandexRes = await runOnYandex(STMTS, EXPECTED_TABLES);

    const ok = isDualMigrateSuccess(neonRes, yandexRes, EXPECTED_TABLES);

    sendJson(res, 200, {
      success: ok,
      neon: neonRes,
      yandex: yandexRes,
      expected_tables: EXPECTED_TABLES,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-dealer-tp]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
