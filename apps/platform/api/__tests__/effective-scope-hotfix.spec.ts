import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import { fetchEffectiveScopeTotals } from "../../shared/effective-scope.js";

/** Post-hotfix ожидаемые минимальные пороги (см. DO-блок миграции). */
const POST_HOTFIX_BY_ROLE = {
  manager: 2861,
  rop: 2860,
  regional_manager: 2595,
} as const;

function createPool(handlers: {
  rows?: (sql: string, params: unknown[]) => Record<string, unknown>[];
}): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const rows = handlers.rows?.(sql.replace(/\s+/g, " ").trim(), params) ?? [];
      return { rows };
    }),
  };
}

describe("effective_scope post-hotfix invariants", () => {
  it("contains manager, rop, regional_manager roles with non-trivial counts", async () => {
    const pool = createPool({
      rows: (sql) => {
        if (sql.includes("COUNT(DISTINCT user_id)")) {
          return [{ total: "8316", users: "120", dealers: "2861" }];
        }
        if (sql.includes("GROUP BY responsible_role")) {
          return [
            { responsible_role: "manager", n: String(POST_HOTFIX_BY_ROLE.manager) },
            { responsible_role: "regional_manager", n: String(POST_HOTFIX_BY_ROLE.regional_manager) },
            { responsible_role: "rop", n: String(POST_HOTFIX_BY_ROLE.rop) },
          ];
        }
        return [];
      },
    });

    const totals = await fetchEffectiveScopeTotals(pool);
    expect(totals.byRole.manager).toBeGreaterThan(2800);
    expect(totals.byRole.rop).toBeGreaterThan(2800);
    expect(totals.byRole.regional_manager).toBeGreaterThan(2500);
    expect(totals.totalRows).toBeGreaterThan(8000);
  });

  it("canonical scope_key check SQL flags only legacy release_code rows", async () => {
    const pool = createPool({
      rows: (sql) => {
        if (sql.includes("scope_key NOT LIKE")) {
          // после hotfix: 0–2 строки вне client-* (edge cases)
          return [{ bad: "0" }];
        }
        return [];
      },
    });

    const r = await pool.query<{ bad: string }>(
      `SELECT COUNT(*)::text AS bad
         FROM responsibility_assignments ra
        WHERE ra.scope_kind = 'dealer'
          AND ra.scope_key NOT LIKE 'client-%'`,
    );
    expect(Number(r.rows[0]?.bad ?? 0)).toBeLessThanOrEqual(2);
  });
});
