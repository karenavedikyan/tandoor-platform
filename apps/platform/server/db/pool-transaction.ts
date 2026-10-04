/**
 * Dedicated-connection transactions for pg-backed pools (Timeweb).
 */

import type pg from "pg";
import type { PoolLike } from "./neon-client.js";

export type TransactionCapablePool = PoolLike & {
  withTransaction<T>(fn: (client: PoolLike) => Promise<T>): Promise<T>;
};

export function poolSupportsTransaction(pool: PoolLike): pool is TransactionCapablePool {
  return typeof (pool as TransactionCapablePool).withTransaction === "function";
}

export function attachPgPoolTransaction(
  poolLike: PoolLike,
  pgPool: pg.Pool,
): TransactionCapablePool {
  return {
    ...poolLike,
    async withTransaction<T>(fn: (client: PoolLike) => Promise<T>): Promise<T> {
      const client = await pgPool.connect();
      const clientLike: PoolLike = {
        query: async (text, params) => {
          const result = await client.query(text, params ?? []);
          return { rows: result.rows, rowCount: result.rowCount ?? undefined };
        },
      };
      try {
        await client.query("BEGIN");
        const result = await fn(clientLike);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore rollback failure */
        }
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
