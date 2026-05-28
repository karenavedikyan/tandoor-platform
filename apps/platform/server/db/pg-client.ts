/**
 * Параллельный pg.Pool-драйвер с API, совместимым с `neon(url)` (@neondatabase/serverless).
 * Не заменяет существующие импорты neon — только для миграции / нового кода.
 */

import pg from "pg";

export type PgSqlQueryResult<T extends pg.QueryResultRow = pg.QueryResultRow> = T[];

export type PgSqlFunction = {
  <T extends pg.QueryResultRow = pg.QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<PgSqlQueryResult<T>>;
  <T extends pg.QueryResultRow = pg.QueryResultRow>(
    query: string,
    params?: unknown[],
  ): Promise<PgSqlQueryResult<T>>;
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    queryText: string,
    params?: unknown[],
  ) => Promise<PgSqlQueryResult<T>>;
};

const poolsByUrl = new Map<string, pg.Pool>();

function resolveSsl(): pg.ConnectionConfig["ssl"] {
  const ca = process.env.PG_SSL_ROOT_CERT?.trim();
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function getPool(url: string): pg.Pool {
  let pool = poolsByUrl.get(url);
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: resolveSsl(),
    });
    poolsByUrl.set(url, pool);
  }
  return pool;
}

/** Преобразует tagged template в параметризованный запрос ($1, $2, …). */
export function buildTaggedQuery(
  strings: TemplateStringsArray,
  values: unknown[],
): { text: string; values: unknown[] } {
  let text = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  return { text, values: params };
}

async function runQuery<T extends pg.QueryResultRow>(
  pool: pg.Pool,
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params ?? []);
  return result.rows;
}

export function pgSql(url: string): PgSqlFunction {
  const pool = getPool(url);

  const execute = <T extends pg.QueryResultRow>(text: string, params?: unknown[]) =>
    runQuery<T>(pool, text, params);

  const fn = (async (
    stringsOrQuery: TemplateStringsArray | string,
    ...rest: unknown[]
  ): Promise<pg.QueryResultRow[]> => {
    if (typeof stringsOrQuery === "string") {
      const params = (rest[0] as unknown[] | undefined) ?? [];
      return execute(stringsOrQuery, params);
    }
    const { text, values } = buildTaggedQuery(stringsOrQuery, rest);
    return execute(text, values);
  }) as PgSqlFunction;

  fn.query = execute;
  return fn;
}

export async function closeAllPools(): Promise<void> {
  const pools = Array.from(poolsByUrl.values());
  poolsByUrl.clear();
  await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
}
