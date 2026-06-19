/**
 * Промт 423: GET /api/dealers/org-scope
 * Запуск: npm run test:org-scope-endpoint
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import { fetchOrgScopeForRequest, canViewerAccessOrgScope } from "../../shared/dealers-org-scope-handlers.js";
import { aggregateOrgTotals } from "../../shared/dealers-scope-aggregation.js";
import type { TeamScopeMember, TeamTotals } from "../../shared/dealers-scope-types.js";

const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "22222222-2222-2222-2222-222222222222";
const MGR_ID = "44444444-4444-4444-4444-444444444444";
const TEAM_A = "team-a";
const TEAM_B = "team-b";
const TEAM_C = "team-c";

// org_totals invariant
{
  const teamTotals: TeamTotals[] = [
    { active_dealers: 100, active_trade_points: 269, trashed_dealers: 4, trashed_trade_points: 0 },
    { active_dealers: 80, active_trade_points: 500, trashed_dealers: 3, trashed_trade_points: 0 },
    { active_dealers: 60, active_trade_points: 627, trashed_dealers: 5, trashed_trade_points: 0 },
  ];
  const orphanTotals: TeamTotals = {
    active_dealers: 2,
    active_trade_points: 0,
    trashed_dealers: 0,
    trashed_trade_points: 0,
  };
  const members: TeamScopeMember[] = [
    {
      user: { id: "m1", name: "M1", email: "", role: "manager" },
      totals: teamTotals[0]!,
      active_dealer_external_keys: Array.from({ length: 100 }, (_, i) => `a-${i}`),
      trashed_dealer_external_keys: [],
      active_trade_points: Array.from({ length: 269 }, (_, i) => ({
        tp_id: `tp-a-${i}`,
        dealer_id: `a-${i % 100}`,
        is_primary: false,
      })),
    },
    {
      user: { id: "m2", name: "M2", email: "", role: "manager" },
      totals: teamTotals[1]!,
      active_dealer_external_keys: Array.from({ length: 80 }, (_, i) => `b-${i}`),
      trashed_dealer_external_keys: [],
      active_trade_points: Array.from({ length: 500 }, (_, i) => ({
        tp_id: `tp-b-${i}`,
        dealer_id: `b-${i % 80}`,
        is_primary: false,
      })),
    },
    {
      user: { id: "orph", name: "O", email: "", role: "manager" },
      totals: orphanTotals,
      active_dealer_external_keys: ["orph-1", "orph-2"],
      trashed_dealer_external_keys: [],
      active_trade_points: [],
    },
  ];
  const org = aggregateOrgTotals(teamTotals, orphanTotals, members);
  assert.equal(org.active_dealers, 182);
  assert.equal(org.active_trade_points, 269 + 500, "SET-union tp_id across members, not sum of team_totals");
}

function mockPool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM teams t") && s.includes("ORDER BY t.name") && !s.includes("rop_user_id =")) {
        return {
          rows: [
            { id: TEAM_A, name: "T1", rop_user_id: ROP_ID, rop_name: "R1", rop_email: "r1@test.ru" },
            { id: TEAM_B, name: "T2", rop_user_id: null, rop_name: null, rop_email: null },
          ],
        };
      }
      if (s.includes("user_team_memberships m") && s.includes("team_id = $1")) {
        return { rows: [] };
      }
      if (s.includes("regional_manager") && s.includes("NOT EXISTS")) {
        return { rows: [] };
      }
      if (s.includes("dealer_overrides d_ov") && s.includes("NOT EXISTS")) {
        return { rows: [] };
      }
      if (s.includes("COALESCE((SELECT name FROM teams")) {
        return { rows: [{ name: "Tandoor" }] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// RBAC
assert.equal(canViewerAccessOrgScope("director"), true);
assert.equal(canViewerAccessOrgScope("admin"), true);
assert.equal(canViewerAccessOrgScope("rop"), false);
assert.equal(canViewerAccessOrgScope("manager"), false);

{
  const pool = mockPool();
  const r = await fetchOrgScopeForRequest(pool, { id: MGR_ID, email: "m@test.ru", role: "manager" });
  assert.ok("forbidden" in r);
}

{
  const pool = mockPool();
  const r = await fetchOrgScopeForRequest(pool, { id: ROP_ID, email: "rop@test.ru", role: "rop" });
  assert.ok("forbidden" in r);
}

{
  const pool = mockPool();
  const r = await fetchOrgScopeForRequest(pool, { id: DIRECTOR_ID, email: "d@test.ru", role: "director" });
  assert.ok(!("forbidden" in r));
  assert.equal((r as { success: boolean }).success, true);
  assert.ok(Array.isArray((r as { teams: unknown[] }).teams));
}

{
  const pool = mockPool();
  const r = await fetchOrgScopeForRequest(pool, { id: ADMIN_ID, email: "a@test.ru", role: "admin" });
  assert.ok(!("forbidden" in r));
}

console.log("org-scope-endpoint.test.ts OK");
