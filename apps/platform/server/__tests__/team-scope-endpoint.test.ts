/**
 * Промт 423: GET /api/dealers/team-scope
 * Запуск: npm run test:team-scope-endpoint
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../../shared/responsibility-resolver.js";
import {
  fetchTeamScopeForRequest,
  buildMemberScope,
  buildTeamScopePayload,
  canViewerAccessTeamScope,
} from "../../shared/dealers-team-scope-handlers.js";
import { aggregateMemberTotals } from "../../shared/dealers-scope-aggregation.js";
import type { TeamScopeMember } from "../../shared/dealers-scope-types.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const ROP_ID = "22222222-2222-2222-2222-222222222222";
const ROP_OTHER_ID = "33333333-3333-3333-3333-333333333333";
const MGR_ID = "44444444-4444-4444-4444-444444444444";
const TEAM_A = "team-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const MEMBERS: TeamScopeMember[] = [
  {
    user: { id: MGR_ID, name: "Mgr", email: "m@test.ru", role: "manager" },
    totals: { active_dealers: 54, active_trade_points: 33, trashed_dealers: 0, trashed_trade_points: 0 },
    active_dealer_external_keys: ["client-a"],
    trashed_dealer_external_keys: [],
    active_trade_points: [{ tp_id: "tp-1", dealer_id: "client-a", is_primary: true }],
  },
  {
    user: { id: "55555555-5555-5555-5555-555555555555", name: "Mgr2", email: "m2@test.ru", role: "manager" },
    totals: { active_dealers: 10, active_trade_points: 5, trashed_dealers: 2, trashed_trade_points: 1 },
    active_dealer_external_keys: ["client-b"],
    trashed_dealer_external_keys: ["client-t1"],
    active_trade_points: [],
  },
];

// team_totals invariant
{
  const totals = aggregateMemberTotals(MEMBERS);
  const sum = {
    active_dealers: MEMBERS.reduce((s, m) => s + m.totals.active_dealers, 0),
    active_trade_points: MEMBERS.reduce((s, m) => s + m.totals.active_trade_points, 0),
    trashed_dealers: MEMBERS.reduce((s, m) => s + m.totals.trashed_dealers, 0),
    trashed_trade_points: MEMBERS.reduce((s, m) => s + m.totals.trashed_trade_points, 0),
  };
  assert.equal(totals.active_trade_points, sum.active_trade_points);
  assert.equal(totals.trashed_trade_points, sum.trashed_trade_points);
  assert.equal(totals.active_dealers, 2, "SET-union active dealers");
  assert.equal(totals.trashed_dealers, 1, "SET-union trashed dealers");
}

function mockPool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM teams t") && s.includes("rop_user_id = $1")) {
        const ropId = params?.[0] as string;
        if (ropId === ROP_ID) {
          return {
            rows: [
              {
                id: TEAM_A,
                name: "Команда A",
                rop_user_id: ROP_ID,
                rop_name: "ROP",
                rop_email: "rop@test.ru",
              },
            ],
          };
        }
        return { rows: [] };
      }
      if (s.includes("user_team_memberships m") && s.includes("team_id = $1")) {
        return {
          rows: [{ id: MGR_ID, email: "mgr@test.ru", role: "manager", full_name: "Manager" }],
        };
      }
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        return { rows: [{ client_code: "C001" }] };
      }
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        return { rows: [{ id: "d1", external_key: "client-a", status: "active", trashed_by: null }] };
      }
      if (s.includes("COUNT(*) FILTER") && s.includes("trade_points")) {
        return { rows: [{ active_tps: "33", trashed_tps: "0" }] };
      }
      if (s.includes("dealer_overrides d_ov") && s.includes("pending_admin")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("rop_client_grants")) return { rows: [] };
      if (s.includes("team_id = ANY")) return { rows: [] };
      void params;
      return { rows: [] };
    },
  };
}

// RBAC
{
  const pool = mockPool();
  assert.equal(await canViewerAccessTeamScope(pool, MGR_ID, "manager", ROP_ID), false);
  assert.equal(await canViewerAccessTeamScope(pool, ROP_ID, "rop", ROP_ID), true);
  assert.equal(await canViewerAccessTeamScope(pool, ROP_OTHER_ID, "rop", ROP_ID), false);
  assert.equal(await canViewerAccessTeamScope(pool, ADMIN_ID, "admin", ROP_ID), true);
  assert.equal(await canViewerAccessTeamScope(pool, DIRECTOR_ID, "director", ROP_ID), true);
}

// manager → 403
{
  const pool = mockPool();
  const r = await fetchTeamScopeForRequest(pool, { id: MGR_ID, email: "m@test.ru", role: "manager" });
  assert.ok("forbidden" in r);
}

// rop → 200 own team
{
  const pool = mockPool();
  const r = await fetchTeamScopeForRequest(pool, { id: ROP_ID, email: "rop@test.ru", role: "rop" });
  assert.ok(!("forbidden" in r) && !("notFound" in r));
  assert.equal((r as { team: { id: string } }).team.id, TEAM_A);
}

// rop → 403 other team
{
  const pool = mockPool();
  const r = await fetchTeamScopeForRequest(pool, { id: ROP_OTHER_ID, email: "rop2@test.ru", role: "rop" }, ROP_ID);
  assert.ok("forbidden" in r);
}

// admin → 200 any
{
  const pool = mockPool();
  const r = await fetchTeamScopeForRequest(pool, { id: ADMIN_ID, email: "a@test.ru", role: "admin" }, ROP_ID);
  assert.ok(!("forbidden" in r));
}

console.log("team-scope-endpoint.test.ts OK");
