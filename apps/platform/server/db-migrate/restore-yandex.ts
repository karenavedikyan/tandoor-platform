/**
 * Восстановление JSONL.gz дампа Neon из Vercel Blob в Yandex Managed PostgreSQL.
 * Запросы к Yandex идут через HTTPS PG-прокси (без прямого pg.Client с Vercel Serverless).
 */

import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pgProxyQuery } from "../db/pg-proxy-client.js";

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

/** Макс. строк в одном INSERT; ограничено лимитом параметров pg (65535). */
const BATCH_ROW_TARGET = 200;
const PG_MAX_PARAMS = 65535;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(MODULE_DIR, "yandex-schema.sql");

async function execProxy(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const res = await pgProxyQuery(sql, params, { timeoutMs: 60_000 });
  if (!res.ok) {
    throw new Error(`proxy-query-failed: ${res.error}${res.code ? ` (${res.code})` : ""}`);
  }
  return { rows: res.rows, rowCount: res.rowCount };
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

/** Сборка мульти-строчного INSERT … ON CONFLICT DO NOTHING. */
export function buildBatchInsertQuery(
  table: string,
  columns: string[],
  conflictColumns: string[],
  rowCount: number,
): string {
  if (rowCount < 1) {
    throw new Error("buildBatchInsertQuery: rowCount must be >= 1");
  }
  const quotedTable = quoteIdent(table);
  const columnList = columns.map((c) => quoteIdent(c));
  const conflict = conflictColumns.map((c) => quoteIdent(c)).join(", ");
  const valueGroups: string[] = [];
  let paramIndex = 1;
  for (let r = 0; r < rowCount; r++) {
    const placeholders = columns.map(() => `$${paramIndex++}`).join(", ");
    valueGroups.push(`(${placeholders})`);
  }
  return `INSERT INTO ${quotedTable} (${columnList.join(", ")}) VALUES ${valueGroups.join(", ")} ON CONFLICT (${conflict}) DO NOTHING`;
}

export function batchRowLimitForColumns(columnCount: number): number {
  if (columnCount <= 0) return 1;
  return Math.max(1, Math.min(BATCH_ROW_TARGET, Math.floor(PG_MAX_PARAMS / columnCount)));
}

function resolveBatchColumns(
  entries: JsonlEntry[],
  columnMeta: ColumnMeta[],
): string[] {
  const metaNames = new Set(columnMeta.map((c) => c.name));
  const colSet = new Set<string>();
  for (const entry of entries) {
    for (const k of Object.keys(entry.row)) {
      if (metaNames.has(k)) colSet.add(k);
    }
  }
  return columnMeta.map((c) => c.name).filter((n) => colSet.has(n));
}

function buildBatchValues(
  entries: JsonlEntry[],
  columns: string[],
  columnMeta: ColumnMeta[],
): unknown[] {
  const metaByName = new Map(columnMeta.map((c) => [c.name, c]));
  const values: unknown[] = [];
  for (const entry of entries) {
    for (const col of columns) {
      values.push(serializeCellValue(entry.row[col], metaByName.get(col)!.isJson));
    }
  }
  return values;
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

/**
 * Разбивает SQL-файл на отдельные statement'ы по `;` на верхнем уровне.
 * Учитывает:
 *  - dollar-quoted strings: `$$ ... $$` и `$tag$ ... $tag$`
 *  - одинарные кавычки `'...'` с экранированием `''`
 *  - однострочные комментарии `-- ...`
 *  - блочные комментарии (slash-star … star-slash)
 *
 * Возвращает массив непустых, обрезанных по краям statement'ов
 * без завершающей точки с запятой.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const len = sql.length;

  let mode: "normal" | "single" | "line-comment" | "block-comment" | "dollar" = "normal";
  let dollarTag = "";

  while (i < len) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (mode === "normal") {
      if (ch === "-" && next === "-") {
        current += ch;
        mode = "line-comment";
        i += 1;
        continue;
      }
      if (ch === "/" && next === "*") {
        current += ch + next;
        mode = "block-comment";
        i += 2;
        continue;
      }
      if (ch === "'") {
        current += ch;
        mode = "single";
        i += 1;
        continue;
      }
      if (ch === "$") {
        const m = sql.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
        if (m) {
          dollarTag = m[0];
          current += dollarTag;
          mode = "dollar";
          i += dollarTag.length;
          continue;
        }
      }
      if (ch === ";") {
        const trimmed = current.trim();
        if (trimmed.length > 0) statements.push(trimmed);
        current = "";
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (mode === "single") {
      if (ch === "'" && next === "'") {
        current += "''";
        i += 2;
        continue;
      }
      if (ch === "'") {
        current += ch;
        mode = "normal";
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (mode === "line-comment") {
      current += ch;
      if (ch === "\n") mode = "normal";
      i += 1;
      continue;
    }

    if (mode === "block-comment") {
      current += ch;
      if (ch === "*" && next === "/") {
        current += "/";
        mode = "normal";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (mode === "dollar") {
      if (ch === "$" && sql.slice(i, i + dollarTag.length) === dollarTag) {
        current += dollarTag;
        i += dollarTag.length;
        mode = "normal";
        dollarTag = "";
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function loadTableMeta(table: string): Promise<ColumnMeta[]> {
  const res = await execProxy(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return res.rows.map((r) => ({
    name: String(r.column_name),
    isJson: isJsonColumn(String(r.data_type), String(r.udt_name)),
  }));
}

async function loadPrimaryKeyColumns(table: string): Promise<string[]> {
  const res = await execProxy(
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
  return res.rows.map((r) => String(r.attname));
}

async function applyDdl(ddl: string): Promise<void> {
  const statements = splitSqlStatements(ddl);
  for (const stmt of statements) {
    const clean = stmt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").trim();
    if (!clean) continue;
    await execProxy(stmt);
  }
}

async function truncateTables(tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  const list = tables.map(quoteIdent).join(", ");
  await execProxy(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function insertEntry(
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
    await execProxy(text, values);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push({ table, rowIndex: entry.lineIndex, error: message });
  }
}

async function insertEntriesBatch(
  table: string,
  entries: JsonlEntry[],
  columnMeta: ColumnMeta[],
  pkColumns: string[],
  errors: RestoreResult["errors"],
): Promise<void> {
  if (entries.length === 0) return;

  const columns = resolveBatchColumns(entries, columnMeta);
  if (columns.length === 0) {
    for (const entry of entries) {
      errors.push({ table, rowIndex: entry.lineIndex, error: "no known columns in row" });
    }
    return;
  }

  const conflictColumns =
    pkColumns.length > 0 ? pkColumns : columns.includes("id") ? ["id"] : columns.slice(0, 1);
  const text = buildBatchInsertQuery(table, columns, conflictColumns, entries.length);
  const values = buildBatchValues(entries, columns, columnMeta);

  try {
    await execProxy(text, values);
  } catch {
    for (const entry of entries) {
      await insertEntry(table, entry, columnMeta, pkColumns, errors);
    }
  }
}

async function countTableRows(table: string): Promise<number> {
  const res = await execProxy(`SELECT COUNT(*)::text AS count FROM ${quoteIdent(table)}`);
  return Number(res.rows[0]?.count ?? 0);
}

export async function restoreYandexFromBlob(opts: {
  blobUrl: string;
  mode: RestoreMode;
}): Promise<RestoreResult> {
  const started = Date.now();
  const errors: RestoreResult["errors"] = [];

  const gzipBuffer = await fetchBlobGzip(opts.blobUrl);
  const entries = parseJsonlGzip(gzipBuffer);
  const grouped = groupRowsByTable(entries);
  const tables = Array.from(grouped.keys()).sort();

  const ddl = await loadSchemaSql();
  await applyDdl(ddl);

  if (opts.mode === "truncate-and-load") {
    await truncateTables(tables);
  }

  const metaCache = new Map<string, ColumnMeta[]>();
  const pkCache = new Map<string, string[]>();

  for (const table of tables) {
    const tableEntries = grouped.get(table)!;
    if (!metaCache.has(table)) {
      metaCache.set(table, await loadTableMeta(table));
    }
    if (!pkCache.has(table)) {
      pkCache.set(table, await loadPrimaryKeyColumns(table));
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

    const rowLimit = batchRowLimitForColumns(columnMeta.length);
    for (let i = 0; i < tableEntries.length; i += rowLimit) {
      const batch = tableEntries.slice(i, i + rowLimit);
      await insertEntriesBatch(table, batch, columnMeta, pkColumns, errors);
    }
  }

  const rowCounts: Record<string, number> = {};
  for (const table of tables) {
    rowCounts[table] = await countTableRows(table);
  }

  return {
    durationMs: Date.now() - started,
    rowCounts,
    errors,
  };
}
