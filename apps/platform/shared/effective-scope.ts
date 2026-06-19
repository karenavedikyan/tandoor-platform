/**
 * Промт 435а: тонкий слой доступа к view effective_scope.
 * Пока используется только диагностикой (см. /api/diag/effective-scope).
 * В промте 435b сюда добавятся читалки для my-scope/list-scoped/overview.
 */

import type { PoolLike } from "./responsibility-resolver.js";

export type EffectiveScopeRow = {
  userId: string;
  dealerId: string;
  dealerExternalKey: string;
  responsibleRole: "manager" | "regional_manager" | "rop";
  source: string;
};

export async function fetchEffectiveScopeForUser(
  pool: PoolLike,
  userId: string,
): Promise<EffectiveScopeRow[]> {
  const r = await pool.query<{
    user_id: string;
    dealer_id: string;
    dealer_external_key: string;
    responsible_role: "manager" | "regional_manager" | "rop";
    source: string;
  }>(
    `SELECT user_id, dealer_id, dealer_external_key, responsible_role, source
       FROM effective_scope
      WHERE user_id = $1::text`,
    [userId],
  );
  return r.rows.map((row) => ({
    userId: row.user_id,
    dealerId: row.dealer_id,
    dealerExternalKey: row.dealer_external_key,
    responsibleRole: row.responsible_role,
    source: row.source,
  }));
}

export async function fetchEffectiveScopeTotals(
  pool: PoolLike,
): Promise<{
  totalRows: number;
  byRole: Record<string, number>;
  distinctUsers: number;
  distinctDealers: number;
}> {
  const overall = await pool.query<{ total: string; users: string; dealers: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(DISTINCT user_id)::text AS users,
            COUNT(DISTINCT dealer_id)::text AS dealers
       FROM effective_scope`,
  );
  const byRole = await pool.query<{ responsible_role: string; n: string }>(
    `SELECT responsible_role, COUNT(*)::text AS n
       FROM effective_scope
       GROUP BY responsible_role
       ORDER BY responsible_role`,
  );
  const row = overall.rows[0];
  return {
    totalRows: Number(row?.total ?? 0),
    byRole: Object.fromEntries(byRole.rows.map((r) => [r.responsible_role, Number(r.n)])),
    distinctUsers: Number(row?.users ?? 0),
    distinctDealers: Number(row?.dealers ?? 0),
  };
}
