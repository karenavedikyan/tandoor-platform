import { describe, expect, it, vi } from "vitest";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import { fetchEffectiveScopeForUser } from "../../shared/effective-scope.js";

const SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";

function createPool(rows: Record<string, unknown>[]): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("WHERE user_id = $1::text") && params[0] === SKALABAN) {
        return { rows };
      }
      return { rows: [] };
    }),
  };
}

function mockSkalabanRopRows(teamCount: number, grantCount: number): Record<string, unknown>[] {
  const team = Array.from({ length: teamCount }, (_, i) => ({
    user_id: SKALABAN,
    dealer_id: `team-dealer-${i}`,
    dealer_external_key: `client-ma-team-${i}`,
    responsible_role: "rop",
    source: "responsibility_assignments",
  }));
  const grants = Array.from({ length: grantCount }, (_, i) => ({
    user_id: SKALABAN,
    dealer_id: `grant-dealer-${i}`,
    dealer_external_key: `client-ma-grant-${i}`,
    responsible_role: "rop",
    source: "rop_client_grants",
  }));
  return [...team, ...grants];
}

describe("effective_scope hotfix3 (grants included)", () => {
  it("Skalaban rop scope includes 82 grants (~1323 total)", async () => {
    const pool = createPool(mockSkalabanRopRows(1241, 82));
    const rows = await fetchEffectiveScopeForUser(pool, SKALABAN);
    const ropRows = rows.filter((r) => r.responsibleRole === "rop");
    expect(ropRows.length).toBeGreaterThanOrEqual(1300);
    expect(ropRows.length).toBeLessThanOrEqual(1330);
  });

  it("at least 82 rows for Skalaban have source=rop_client_grants", async () => {
    const pool = createPool(mockSkalabanRopRows(1241, 82));
    const rows = await fetchEffectiveScopeForUser(pool, SKALABAN);
    const grants = rows.filter((r) => r.source === "rop_client_grants");
    expect(grants.length).toBeGreaterThanOrEqual(80);
  });
});
