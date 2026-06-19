import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import {
  fetchEffectiveScopeForUser,
  fetchEffectiveScopeTotals,
} from "../../shared/effective-scope.js";

const USER_ID = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";

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

describe("fetchEffectiveScopeForUser", () => {
  it("шлёт корректный SQL и маппит ответ", async () => {
    const pool = createPool({
      rows: (sql, params) => {
        expect(sql).toContain("FROM effective_scope");
        expect(sql).toContain("WHERE user_id = $1::text");
        expect(params).toEqual([USER_ID]);
        return [
          {
            user_id: USER_ID,
            dealer_id: "dealer-1",
            dealer_external_key: "client-a",
            responsible_role: "rop",
            source: "responsibility_assignments",
          },
        ];
      },
    });

    const rows = await fetchEffectiveScopeForUser(pool, USER_ID);
    expect(rows).toEqual([
      {
        userId: USER_ID,
        dealerId: "dealer-1",
        dealerExternalKey: "client-a",
        responsibleRole: "rop",
        source: "responsibility_assignments",
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe("fetchEffectiveScopeTotals", () => {
  it("агрегирует ответы в totalRows, byRole, distinctUsers, distinctDealers", async () => {
    const pool = createPool({
      rows: (sql) => {
        if (sql.includes("COUNT(DISTINCT user_id)")) {
          return [{ total: "8200", users: "42", dealers: "2861" }];
        }
        if (sql.includes("GROUP BY responsible_role")) {
          return [
            { responsible_role: "manager", n: "2861" },
            { responsible_role: "regional_manager", n: "2595" },
            { responsible_role: "rop", n: "2744" },
          ];
        }
        return [];
      },
    });

    const totals = await fetchEffectiveScopeTotals(pool);
    expect(totals).toEqual({
      totalRows: 8200,
      byRole: {
        manager: 2861,
        regional_manager: 2595,
        rop: 2744,
      },
      distinctUsers: 42,
      distinctDealers: 2861,
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("возвращает нули при пустом view", async () => {
    const pool = createPool({
      rows: (sql) => {
        if (sql.includes("COUNT(DISTINCT user_id)")) {
          return [{ total: "0", users: "0", dealers: "0" }];
        }
        if (sql.includes("GROUP BY responsible_role")) {
          return [];
        }
        return [];
      },
    });

    const totals = await fetchEffectiveScopeTotals(pool);
    expect(totals).toEqual({
      totalRows: 0,
      byRole: {},
      distinctUsers: 0,
      distinctDealers: 0,
    });
  });
});
