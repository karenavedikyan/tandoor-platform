/**
 * Обёртка над @neondatabase/serverless с shadow-write в Yandex (промт 78).
 * Neon остаётся primary; Yandex — best-effort через PG-прокси.
 */

import { neon } from "@neondatabase/serverless";
import { buildTaggedQuery } from "./pg-client.js";
import { shadowWriteAsync } from "./shadow-write.js";

export type NeonHttp = ReturnType<typeof neon>;

export interface PoolLike {
  query: <T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount?: number }>;
}

function resolveDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

/** Определяет, нужно ли дублировать запрос в Yandex (DML, не SELECT). */
export function isMutationSql(sql: string): boolean {
  const op = sql.trim().toUpperCase();
  if (op.startsWith("SELECT") || op.startsWith("SHOW") || op.startsWith("EXPLAIN")) return false;
  if (op.startsWith("INSERT") || op.startsWith("UPDATE") || op.startsWith("DELETE")) return true;
  if (op.startsWith("WITH")) {
    return /\b(INSERT|UPDATE|DELETE)\b/.test(op);
  }
  return false;
}

async function runNeonQuery(sql: NeonHttp, text: string, params: unknown[]): Promise<unknown> {
  const callable = sql as unknown as (s: string, p?: unknown[]) => Promise<unknown>;
  return callable(text, params);
}

function scheduleShadowWrite(sql: string, params: unknown[], tag: string): void {
  if (!isMutationSql(sql)) return;
  shadowWriteAsync(sql, params, tag);
}

/**
 * Оборачивает neon HTTP-клиент: после успешного DML — shadow-write (fire-and-forget).
 */
export function wrapNeonWithShadow(base: NeonHttp, tag = "neon"): NeonHttp {
  const wrapped = (async (
    stringsOrQuery: TemplateStringsArray | string,
    ...rest: unknown[]
  ): Promise<unknown> => {
    let text: string;
    let params: unknown[];
    if (typeof stringsOrQuery === "string") {
      text = stringsOrQuery;
      params = (rest[0] as unknown[] | undefined) ?? [];
    } else {
      const built = buildTaggedQuery(stringsOrQuery, rest);
      text = built.text;
      params = built.values;
    }
    const result = await runNeonQuery(base, text, params);
    scheduleShadowWrite(text, params, tag);
    return result;
  }) as NeonHttp;
  return wrapped;
}

export function createNeonHttp(url?: string): NeonHttp | null {
  const connectionString = url?.trim() || resolveDatabaseUrl();
  if (!connectionString) return null;
  return wrapNeonWithShadow(neon(connectionString), "neon");
}

let cachedNeon: NeonHttp | null | undefined;

export function getNeonHttp(): NeonHttp | null {
  if (cachedNeon !== undefined) return cachedNeon;
  cachedNeon = createNeonHttp();
  return cachedNeon;
}

export function makePoolFromNeon(sql: NeonHttp): PoolLike {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
      const raw = (await runNeonQuery(sql, text, params ?? [])) as unknown;
      scheduleShadowWrite(text, params ?? [], "pool.query");
      if (Array.isArray(raw)) {
        return { rows: raw as T[] };
      }
      if (raw && typeof raw === "object" && "rows" in (raw as object)) {
        const o = raw as { rows: T[]; rowCount?: number; length?: number };
        const rowCount = typeof o.rowCount === "number" ? o.rowCount : o.length;
        return { rows: o.rows ?? [], rowCount };
      }
      return { rows: [] as T[] };
    },
  };
}
