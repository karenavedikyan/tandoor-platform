/**
 * Применение DDL к Neon (основная) и Yandex (страховка) — Промт 104.1.
 */

import pg from "pg";
import { neon } from "@neondatabase/serverless";
import { makePoolFromNeon } from "../server/db/neon-client.js";

export type StmtResult = { sql: string; ok: boolean; error?: string };

export type DbMigrateRunResult = {
  applied: StmtResult[];
  tables: string[];
};

export type DbMigrateError = { error: string };

export type DualMigrateResult = {
  neon: DbMigrateRunResult | DbMigrateError;
  yandex: DbMigrateRunResult | DbMigrateError;
};

export function resolveNeonUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.NEON_DATABASE_URL?.trim() ||
    null
  );
}

export function resolveYandexUrl(): string | null {
  return (
    process.env.YANDEX_DATABASE_URL_UNPOOLED?.trim() ||
    process.env.YANDEX_DATABASE_URL?.trim() ||
    null
  );
}

export async function runOnNeon(
  stmts: string[],
  tablesToCheck: string[],
): Promise<DbMigrateRunResult | DbMigrateError> {
  const url = resolveNeonUrl();
  if (!url) return { error: "DATABASE_URL is not configured" };

  const pool = makePoolFromNeon(neon(url));
  const applied: StmtResult[] = [];

  for (const s of stmts) {
    try {
      await pool.query(s);
      applied.push({ sql: truncateSql(s), ok: true });
    } catch (e) {
      applied.push({
        sql: truncateSql(s),
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let tables: string[] = [];
  try {
    const r = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [tablesToCheck],
    );
    tables = r.rows.map((x) => String(x.table_name));
  } catch {
    /* ignore */
  }

  return { applied, tables };
}

export async function runOnYandex(
  stmts: string[],
  tablesToCheck: string[],
): Promise<DbMigrateRunResult | DbMigrateError> {
  const url = resolveYandexUrl();
  if (!url) return { error: "YANDEX_DATABASE_URL_UNPOOLED is not configured" };

  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  const applied: StmtResult[] = [];

  try {
    for (const s of stmts) {
      try {
        await pool.query(s);
        applied.push({ sql: truncateSql(s), ok: true });
      } catch (e) {
        applied.push({
          sql: truncateSql(s),
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    let tables: string[] = [];
    try {
      const r = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])
         ORDER BY table_name`,
      [tablesToCheck],
      );
      tables = r.rows.map((x) => String(x.table_name));
    } catch {
      /* ignore */
    }

    return { applied, tables };
  } finally {
    await pool.end().catch(() => {});
  }
}

function truncateSql(s: string): string {
  return s.slice(0, 80).replace(/\s+/g, " ").trim();
}

export function isDualMigrateSuccess(
  neonRes: DbMigrateRunResult | DbMigrateError,
  yandexRes: DbMigrateRunResult | DbMigrateError,
  expectedTables: string[],
): boolean {
  if ("error" in neonRes || "error" in yandexRes) return false;
  const stmtOk =
    neonRes.applied.every((x) => x.ok) && yandexRes.applied.every((x) => x.ok);
  if (!stmtOk) return false;
  return expectedTables.every((t) => neonRes.tables.includes(t) && yandexRes.tables.includes(t));
}
