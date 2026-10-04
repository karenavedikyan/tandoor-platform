/**
 * Duck-typed transaction support for PoolLike (no driver imports).
 */

import type { PoolLike } from "./responsibility-resolver.js";

export type TransactionCapablePool = PoolLike & {
  withTransaction<T>(fn: (client: PoolLike) => Promise<T>): Promise<T>;
};

export function poolSupportsTransaction(pool: PoolLike): pool is TransactionCapablePool {
  return typeof (pool as TransactionCapablePool).withTransaction === "function";
}
