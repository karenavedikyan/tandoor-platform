/**
 * One-shot: массовая привязка РОП/РМ к дилерам и ТТ (Промт 124+).
 * Применяет server/migrations/2026_06_02_seed_rop_rm_assignments.sql
 * к Neon (primary) и Yandex (страховка). Идемпотентно (UPSERT).
 *
 * Авторизация: Bearer CRON_SECRET (как у cron-задач) — без сессии админа.
 * GET или POST /api/admin/seed-rop-rm-assignments
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runOnNeon, runOnYandex } from "../../shared/dual-db-migrate.js";
import { splitSqlStatements } from "../../server/db-migrate/restore-yandex.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(
  here,
  "..",
  "..",
  "server",
  "migrations",
  "2026_06_02_seed_rop_rm_assignments.sql",
);

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers["authorization"];
  const av = Array.isArray(auth) ? auth[0] : auth;
  return typeof av === "string" && av.trim() === `Bearer ${secret}`;
}

const EXPECTED_TABLES = ["dealer_overrides", "trade_point_overrides"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isAuthorized(req)) {
      sendJson(res, 401, { success: false, code: "UNAUTHORIZED" });
      return;
    }

    const sql = readFileSync(sqlPath, "utf8");
    const stmts = splitSqlStatements(sql);

    const neonRes = await runOnNeon(stmts, EXPECTED_TABLES);
    const yandexRes = await runOnYandex(stmts, EXPECTED_TABLES);

    const neonOk = !("error" in neonRes) && neonRes.applied.every((s) => s.ok);
    const neonFailed =
      "error" in neonRes ? [] : neonRes.applied.filter((s) => !s.ok).map((s) => s.error);

    sendJson(res, 200, {
      success: neonOk,
      statements: stmts.length,
      neon: "error" in neonRes ? neonRes : { applied: neonRes.applied.length, failed: neonFailed },
      yandex:
        "error" in yandexRes || "skipped" in yandexRes
          ? yandexRes
          : { applied: yandexRes.applied.length },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[seed-rop-rm-assignments]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
