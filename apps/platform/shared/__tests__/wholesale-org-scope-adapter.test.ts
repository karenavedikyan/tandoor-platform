/**
 * Unique counters for overlapping wholesale org scope members.
 * Run: npx tsx shared/__tests__/wholesale-org-scope-adapter.test.ts
 */

import assert from "node:assert/strict";
import { fetchWholesaleOrgScope } from "../wholesale-org-scope-adapter.js";
import type { PoolLike } from "../responsibility-resolver.js";

const CLIENT = "20000000-0000-4000-8000-000000000001";
const STORE = "30000000-0000-4000-8000-000000000001";
const ROP = "10000000-0000-4000-8000-000000000001";
const MGR = "10000000-0000-4000-8000-000000000010";
const RM = "10000000-0000-4000-8000-000000000020";

function mockPool(): PoolLike {
  return {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM wholesale_source_snapshots")) {
        return {
          rows: [
            {
              raw: {
                employeeRoster: [
                  { guid_manager: ROP, name_manager: "РОП", post: "РОП" },
                  { guid_manager: MGR, name_manager: "Менеджер", post: "Менеджер" },
                  { guid_manager: RM, name_manager: "РМ", post: "РМ" },
                ],
              },
              imported_at: "2026-10-04T00:00:00.000Z",
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_client_metadata")) {
        return {
          rows: [
            {
              guid_client: CLIENT,
              external_key: `client-${CLIENT}`,
              name: "Клиент",
              city: null,
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_head_of_the_sales_department: ROP,
                name_head_of_the_sales_department: "РОП",
                guid_manager: MGR,
                name_manager: "Менеджер",
                guid_regional_manager: RM,
                name_regional_manager: "РМ",
              },
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_outlet_metadata")) {
        return {
          rows: [
            {
              guid_store: STORE,
              guid_client: CLIENT,
              closed: false,
              raw: { managers: { manager: { guid: MGR, name: "Менеджер" } } },
            },
          ],
        };
      }
      if (s.includes("employee_account_links")) return { rows: [] };
      return { rows: [] };
    },
  };
}

const scope = await fetchWholesaleOrgScope(mockPool());
assert.equal(scope.teams.length, 1);
const team = scope.teams[0]!;
assert.equal(team.members.length, 2, "manager + RM");
assert.equal(team.team_totals.active_dealers, 1, "unique client, not sum of overlapping members");
assert.equal(team.team_totals.active_trade_points, 1, "unique store");
assert.equal(scope.org_totals.active_dealers, 1);
assert.equal(scope.org_totals.active_trade_points, 1);
assert.equal(scope.org_totals.trashed_trade_points, 0, "closed 1C TT is not LK trash");

console.log("wholesale-org-scope-adapter.test.ts: ok");
