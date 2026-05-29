/**
 * Применение DDL к Neon (основная) и Yandex (страховка) — Промт 104.1 / 104.4.
 */

import { neon } from "@neondatabase/serverless";
import { makePoolFromNeon } from "../server/db/neon-client.js";

export type StmtResult = { sql: string; ok: boolean; error?: string };

export type DbMigrateRunResult = {
  applied: StmtResult[];
  tables: string[];
  skipped?: false;
};

export type DbMigrateSkipped = {
  skipped: true;
  reason: string;
};

export type DbMigrateError = { error: string };

export type DualMigrateResult = {
  neon: DbMigrateRunResult | DbMigrateError;
  yandex: DbMigrateRunResult | DbMigrateError | DbMigrateSkipped;
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
): Promise<DbMigrateRunResult | DbMigrateError | DbMigrateSkipped> {
  const proxyUrl = process.env.YANDEX_PROXY_URL?.trim();
  const proxyToken = process.env.YANDEX_PROXY_TOKEN?.trim();
  if (!proxyUrl || !proxyToken) {
    return {
      skipped: true,
      reason: "YANDEX_PROXY_URL/TOKEN не настроены — Yandex DDL применяется руками через прокси.",
    };
  }

  const applied: StmtResult[] = [];
  for (const s of stmts) {
    try {
      const r = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${proxyToken}`,
        },
        body: JSON.stringify({ sql: s }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        applied.push({ sql: truncateSql(s), ok: false, error: `HTTP ${r.status}: ${txt.slice(0, 200)}` });
        continue;
      }
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
    const tableList = tablesToCheck.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
    const r = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY(ARRAY[${tableList}]::text[]) ORDER BY table_name`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      const json: unknown = await r.json().catch(() => null);
      const rows: unknown[] =
        json && typeof json === "object" && json !== null
          ? ((json as { rows?: unknown[]; data?: unknown[] }).rows ??
            (json as { data?: unknown[] }).data ??
            [])
          : [];
      tables = rows
        .map((x) => {
          if (x && typeof x === "object" && "table_name" in x) {
            return String((x as { table_name: unknown }).table_name);
          }
          if (Array.isArray(x)) return String(x[0] ?? "");
          return "";
        })
        .filter(Boolean);
    }
  } catch {
    /* ignore */
  }

  return { applied, tables };
}

function truncateSql(s: string): string {
  return s.slice(0, 80).replace(/\s+/g, " ").trim();
}

export function isDualMigrateSuccess(
  neonRes: DbMigrateRunResult | DbMigrateError,
  yandexRes: DbMigrateRunResult | DbMigrateError | DbMigrateSkipped,
  expectedTables: string[],
): boolean {
  if ("error" in neonRes) return false;

  const neonStmtOk = neonRes.applied.every((x) => x.ok);
  const neonTablesOk = expectedTables.every((t) => neonRes.tables.includes(t));
  if (!neonStmtOk || !neonTablesOk) return false;

  if ("skipped" in yandexRes && yandexRes.skipped) return true;

  if ("error" in yandexRes) return false;

  const yandexStmtOk = yandexRes.applied.every((x) => x.ok);
  const yandexTablesOk = expectedTables.every((t) => yandexRes.tables.includes(t));
  return yandexStmtOk && yandexTablesOk;
}
