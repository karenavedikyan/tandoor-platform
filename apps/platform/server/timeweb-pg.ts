import pg from "pg";

const pools = new Map<string, pg.Pool>();
type Options = { arrayMode?: boolean; fullResults?: boolean };

/** Native PostgreSQL transport for the former Neon callable interface.
 * Only the Timeweb build aliases imports here; Vercel builds are unchanged.
 */
export function neon(connectionString: string, defaults: Options = {}) {
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("INVALID_DATABASE_URL");
  for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey", "channel_binding"]) url.searchParams.delete(name);
  const key = url.toString();
  let pool = pools.get(key);
  if (!pool) {
    const ssl = process.env.LK_TEST_PG_NO_TLS === "1" && process.env.NODE_ENV === "test"
      ? false
      : { rejectUnauthorized: true, ...(process.env.PG_SSL_ROOT_CERT ? { ca: process.env.PG_SSL_ROOT_CERT } : {}),
        ...(process.env.PG_TLS_SERVERNAME ? {servername:process.env.PG_TLS_SERVERNAME} : {}) };
    pool = new pg.Pool({ connectionString: key, ssl, max: 8, connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000, statement_timeout: 30000 });
    pool.on("error", () => console.error("[postgres] idle connection error"));
    pools.set(key, pool);
  }
  const execute = async (text: string, values: unknown[] = [], options: Options = {}) => {
    const opts = { ...defaults, ...options };
    const result = await pool!.query({ text, values, ...(opts.arrayMode ? { rowMode: "array" as const } : {}) });
    return opts.fullResults ? result : result.rows;
  };
  const sql = (strings: TemplateStringsArray | string, ...args: any[]) => {
    if (typeof strings === "string") return execute(strings, args[0] || [], args[1] || {});
    let text = "";
    strings.forEach((s, i) => { text += s + (i < args.length ? `$${i + 1}` : ""); });
    return execute(text, args);
  };
  sql.query = execute;
  // Never pretend independent pooled queries provide transaction semantics.
  sql.transaction = () => { throw new Error("USE_DEDICATED_PG_TRANSACTION"); };
  (sql as TimewebPgSql & { __pgPool: pg.Pool }).__pgPool = pool;
  return sql as TimewebPgSql;
}

export type TimewebPgSql = ReturnType<typeof neon> & { __pgPool?: pg.Pool };

export function getTimewebPgPool(connectionString: string): pg.Pool {
  neon(connectionString);
  const url = new URL(connectionString);
  for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey", "channel_binding"]) url.searchParams.delete(name);
  const pool = pools.get(url.toString());
  if (!pool) throw new Error("TIMWEB_PG_POOL_NOT_INITIALIZED");
  return pool;
}
export async function closeTimewebPools() {
  await Promise.all(Array.from(pools.values()).map(p => p.end()));
  pools.clear();
}
