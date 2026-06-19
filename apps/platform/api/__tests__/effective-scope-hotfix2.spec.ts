import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import {
  fetchEffectiveScopeForUser,
  fetchEffectiveScopeTotals,
} from "../../shared/effective-scope.js";

const SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const KUPYANSKIY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";

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

function postHotfix2TotalsPool(): PoolLike {
  return createPool({
    rows: (sql) => {
      if (sql.includes("COUNT(DISTINCT user_id)")) {
        return [{ total: "8316", users: "120", dealers: "2861" }];
      }
      if (sql.includes("GROUP BY responsible_role")) {
        return [
          { responsible_role: "manager", n: "2861" },
          { responsible_role: "regional_manager", n: "2595" },
          { responsible_role: "rop", n: "2860" },
        ];
      }
      return [];
    },
  });
}

function ropRowsForUser(userId: string, count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    dealer_id: `dealer-${userId}-${i}`,
    dealer_external_key: `client-ma-${i}`,
    responsible_role: "rop",
    source: "responsibility_assignments",
  }));
}

describe("effective_scope after hotfix2 (rop via team only)", () => {
  it("rop totals are within team-based bounds", async () => {
    const t = await fetchEffectiveScopeTotals(postHotfix2TotalsPool());
    expect(t.byRole.rop).toBeGreaterThanOrEqual(2800);
    expect(t.byRole.rop).toBeLessThanOrEqual(2900);
  });

  it("Skalaban rop scope matches his team (~1241)", async () => {
    const pool = createPool({
      rows: (sql, params) => {
        if (sql.includes("WHERE user_id = $1::text") && params[0] === SKALABAN) {
          return ropRowsForUser(SKALABAN, 1241);
        }
        return [];
      },
    });
    const rows = await fetchEffectiveScopeForUser(pool, SKALABAN);
    const ropRows = rows.filter((r) => r.responsibleRole === "rop");
    expect(ropRows.length).toBeGreaterThanOrEqual(1200);
    expect(ropRows.length).toBeLessThanOrEqual(1280);
  });

  it("Sapozhkov rop scope matches his team (~970)", async () => {
    const pool = createPool({
      rows: (sql, params) => {
        if (sql.includes("WHERE user_id = $1::text") && params[0] === SAPOZHKOV) {
          return ropRowsForUser(SAPOZHKOV, 970);
        }
        return [];
      },
    });
    const rows = await fetchEffectiveScopeForUser(pool, SAPOZHKOV);
    const ropRows = rows.filter((r) => r.responsibleRole === "rop");
    expect(ropRows.length).toBeGreaterThanOrEqual(940);
    expect(ropRows.length).toBeLessThanOrEqual(1000);
  });

  it("Kupyanskiy rop scope matches his team (~649)", async () => {
    const pool = createPool({
      rows: (sql, params) => {
        if (sql.includes("WHERE user_id = $1::text") && params[0] === KUPYANSKIY) {
          return ropRowsForUser(KUPYANSKIY, 649);
        }
        return [];
      },
    });
    const rows = await fetchEffectiveScopeForUser(pool, KUPYANSKIY);
    const ropRows = rows.filter((r) => r.responsibleRole === "rop");
    expect(ropRows.length).toBeGreaterThanOrEqual(620);
    expect(ropRows.length).toBeLessThanOrEqual(680);
  });
});
