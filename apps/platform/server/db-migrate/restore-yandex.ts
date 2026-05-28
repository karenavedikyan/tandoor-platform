/**
 * Восстановление JSONL.gz дампа Neon из Vercel Blob в Yandex Managed PostgreSQL.
 */

import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type RestoreMode = "truncate-and-load" | "append";

export type JsonlEntry = {
  table: string;
  row: Record<string, unknown>;
  lineIndex: number;
};

export type RestoreResult = {
  durationMs: number;
  rowCounts: Record<string, number>;
  errors: Array<{ table: string; rowIndex: number; error: string }>;
};

const BATCH_SIZE = 500;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(MODULE_DIR, "yandex-schema.sql");

function resolveSsl(): pg.ClientConfig["ssl"] {
  const ca = process.env.PG_SSL_ROOT_CERT?.trim();
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Распаковка JSONL.gz → массив записей дампа. */
export function parseJsonlGzip(buffer: Buffer): JsonlEntry[] {
  const text = gunzipSync(buffer).toString("utf8");
  const lines = text.split("\n");
  const entries: JsonlEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parsed = JSON.parse(line) as { table?: unknown; row?: unknown };
    if (typeof parsed.table !== "string" || !parsed.table) {
      throw new Error(`invalid jsonl at line ${i + 1}: missing table`);
    }
    if (!parsed.row || typeof parsed.row !== "object" || Array.isArray(parsed.row)) {
      throw new Error(`invalid jsonl at line ${i + 1}: missing row`);
    }
    entries.push({
      table: parsed.table,
      row: parsed.row as Record<string, unknown>,
      lineIndex: i + 1,
    });
  }
  return entries;
}

/** Группировка строк дампа по имени таблицы (порядок внутри таблицы сохраняется). */
export function groupRowsByTable(entries: JsonlEntry[]): Map<string, JsonlEntry[]> {
  const map = new Map<string, JsonlEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.table);
    if (list) list.push(entry);
    else map.set(entry.table, [entry]);
  }
  return map;
}

type ColumnMeta = { name: string; isJson: boolean };

function isJsonColumn(dataType: string, udtName: string): boolean {
  return dataType === "json" || dataType === "jsonb" || udtName === "json" || udtName === "jsonb";
}

/** Нормализация значения ячейки для параметризованного INSERT в pg. */
export function serializeCellValue(value: unknown, isJson: boolean): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (isJson && typeof value === "object") return JSON.stringify(value);
  return value;
}

/** Сборка INSERT … ON CONFLICT DO NOTHING для одной строки. */
export function buildInsertQuery(
  table: string,
  columns: string[],
  conflictColumns: string[],
): { text: string; columnList: string[] } {
  const quotedTable = quoteIdent(table);
  const columnList = columns.map((c) => quoteIdent(c));
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const conflict = conflictColumns.map((c) => quoteIdent(c)).join(", ");
  const text = `INSERT INTO ${quotedTable} (${columnList.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflict}) DO NOTHING`;
  return { text, columnList: columns };
}

async function loadSchemaSql(): Promise<string> {
  const candidates = [
    SCHEMA_SQL_PATH,
    path.join(process.cwd(), "server/db-migrate/yandex-schema.sql"),
    path.join(process.cwd(), "apps/platform/server/db-migrate/yandex-schema.sql"),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("yandex-schema.sql not found");
}

async function fetchBlobGzip(blobUrl: string): Promise<Buffer> {
  const res = await fetch(blobUrl);
  if (!res.ok) {
    throw new Error(`blob download failed: HTTP ${res.status} ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function loadTableMeta(client: pg.Client, table: string): Promise<ColumnMeta[]> {
  const res = await client.query<{ column_name: string; data_type: string; udt_name: string }>(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return res.rows.map((r) => ({
    name: r.column_name,
    isJson: isJsonColumn(r.data_type, r.udt_name),
  }));
}

async function loadPrimaryKeyColumns(client: pg.Client, table: string): Promise<string[]> {
  const res = await client.query<{ attname: string }>(
    `SELECT a.attname
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
     WHERE c.contype = 'p' AND n.nspname = 'public' AND t.relname = $1
     ORDER BY k.ord`,
    [table],
  );
  return res.rows.map((r) => r.attname);
}

async function applyDdl(client: pg.Client, ddl: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(ddl);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

async function truncateTables(client: pg.Client, tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  const list = tables.map(quoteIdent).join(", ");
  await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function insertEntry(
  client: pg.Client,
  table: string,
  entry: JsonlEntry,
  columnMeta: ColumnMeta[],
  pkColumns: string[],
  errors: RestoreResult["errors"],
): Promise<void> {
  const metaByName = new Map(columnMeta.map((c) => [c.name, c]));
  const columns = Object.keys(entry.row).filter((k) => metaByName.has(k));
  if (columns.length === 0) {
    errors.push({ table, rowIndex: entry.lineIndex, error: "no known columns in row" });
    return;
  }
  const conflictColumns =
    pkColumns.length > 0 ? pkColumns : columns.includes("id") ? ["id"] : columns.slice(0, 1);
  const { text } = buildInsertQuery(table, columns, conflictColumns);
  const values = columns.map((col) => serializeCellValue(entry.row[col], metaByName.get(col)!.isJson));
  try {
    await client.query(text, values);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push({ table, rowIndex: entry.lineIndex, error: message });
  }
}

async function countTableRows(client: pg.Client, table: string): Promise<number> {
  const res = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quoteIdent(table)}`);
  return Number(res.rows[0]?.count ?? 0);
}

export async function restoreYandexFromBlob(opts: {
  blobUrl: string;
  mode: RestoreMode;
  yandexUrl?: string;
}): Promise<RestoreResult> {
  const started = Date.now();
  const errors: RestoreResult["errors"] = [];
  const yandexUrl = opts.yandexUrl?.trim() || process.env.YANDEX_DATABASE_URL_UNPOOLED?.trim() || "";
  if (!yandexUrl) {
    throw new Error("YANDEX_DATABASE_URL_UNPOOLED is not configured");
  }

  const gzipBuffer = await fetchBlobGzip(opts.blobUrl);
  const entries = parseJsonlGzip(gzipBuffer);
  const grouped = groupRowsByTable(entries);
  const tables = Array.from(grouped.keys()).sort();

  const client = new pg.Client({
    connectionString: yandexUrl,
    ssl: resolveSsl(),
  });

  await client.connect();
  try {
    const ddl = await loadSchemaSql();
    await applyDdl(client, ddl);

    if (opts.mode === "truncate-and-load") {
      await truncateTables(client, tables);
    }

    const metaCache = new Map<string, ColumnMeta[]>();
    const pkCache = new Map<string, string[]>();

    for (const table of tables) {
      const tableEntries = grouped.get(table)!;
      if (!metaCache.has(table)) {
        metaCache.set(table, await loadTableMeta(client, table));
      }
      if (!pkCache.has(table)) {
        pkCache.set(table, await loadPrimaryKeyColumns(client, table));
      }
      const columnMeta = metaCache.get(table)!;
      const pkColumns = pkCache.get(table)!;

      if (columnMeta.length === 0) {
        for (const entry of tableEntries) {
          errors.push({
            table,
            rowIndex: entry.lineIndex,
            error: `table ${table} not found in target schema`,
          });
        }
        continue;
      }

      for (let i = 0; i < tableEntries.length; i += BATCH_SIZE) {
        const batch = tableEntries.slice(i, i + BATCH_SIZE);
        for (const entry of batch) {
          await insertEntry(client, table, entry, columnMeta, pkColumns, errors);
        }
      }
    }

    const rowCounts: Record<string, number> = {};
    for (const table of tables) {
      rowCounts[table] = await countTableRows(client, table);
    }

    return {
      durationMs: Date.now() - started,
      rowCounts,
      errors,
    };
  } finally {
    await client.end();
  }
}
