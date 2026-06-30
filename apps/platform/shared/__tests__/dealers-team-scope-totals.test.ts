/**
 * team_totals из канонического scope РОПа, не union членов.
 * Запуск: `npm run test:dealers-team-scope-totals` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeDbScopeForUser } from "../db-scope-formula.js";
import { aggregateMemberTotals } from "../dealers-scope-aggregation.js";
import { buildTeamScopePayload, buildTeamScopeTotalsOnly } from "../dealers-team-scope-handlers.js";
import { fetchScopedTradePointsRows } from "../trade-points-list-scoped-handlers.js";

const TEAM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "22222222-2222-2222-2222-222222222222";
const RM_ID = "55555555-5555-5555-5555-555555555555";
const ROP_CANONICAL_TP = 896;
const RM_SCOPE_TP = 482;

function makeTeamScopePool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      const userId = params?.[0] as string | undefined;

      if (s.includes("user_team_memberships m") && s.includes("team_id = $1")) {
        return {
          rows: [{ id: RM_ID, email: "rm@test.ru", role: "regional_manager", full_name: "Regional" }],
        };
      }

      if (s.includes("FROM user_team_memberships m") && s.includes("m.user_id = $1") && userId === ROP_ID) {
        return { rows: [{ team_id: TEAM_ID }] };
      }

      if (s.includes("FROM user_team_memberships WHERE user_id = $1") && userId === RM_ID) {
        return { rows: [{ team_id: TEAM_ID }] };
      }

      if (s.includes("client_assignments WHERE responsible_user_id") && userId === ROP_ID) {
        return { rows: [] };
      }

      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: [{ client_code: "ROP01" }, { client_code: "ROP02" }] };
      }

      if (s.includes("rop_client_grants") && userId === ROP_ID) {
        return { rows: [] };
      }

      if (s.includes("dealer_overrides") && s.includes("regional_manager_id") && userId === RM_ID) {
        return { rows: [{ client_code: "RM01" }, { client_code: "RM02" }, { client_code: "RM03" }] };
      }

      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        if (codes.includes("ROP01")) {
          return {
            rows: [
              { id: "d-rop-1", external_key: "client-rop-1", status: "active", trashed_by: null },
              { id: "d-rop-2", external_key: "client-rop-2", status: "active", trashed_by: null },
            ],
          };
        }
        if (codes.includes("RM01")) {
          return {
            rows: [
              { id: "d-rm-1", external_key: "client-rm-1", status: "active", trashed_by: null },
              { id: "d-rm-2", external_key: "client-rm-2", status: "active", trashed_by: null },
              { id: "d-rm-3", external_key: "client-rm-3", status: "active", trashed_by: null },
            ],
          };
        }
        return { rows: [] };
      }

      if (s.includes("COUNT(*)::text AS active_tps") && s.includes("trade_points")) {
        const dealerIds = params?.[0] as string[] | undefined;
        if (dealerIds?.includes("d-rop-1") && dealerIds.length === 1) {
          return { rows: [{ active_tps: "5" }] };
        }
        if (dealerIds?.includes("d-rop-1")) {
          return { rows: [{ active_tps: String(ROP_CANONICAL_TP) }] };
        }
        if (dealerIds?.includes("d-rm-1")) {
          return { rows: [{ active_tps: String(RM_SCOPE_TP) }] };
        }
        return { rows: [{ active_tps: "0" }] };
      }

      if (s.includes("COUNT(*)::text AS trashed_tps") && s.includes("trade_points")) {
        return { rows: [{ trashed_tps: "2" }] };
      }

      if (s.includes("FROM dealers d") && s.includes("has_problem")) {
        return { rows: [{ status: "активный", has_problem: false, distribution: 0 }] };
      }

      if (s.includes("d.external_key = ANY")) {
        const keys = (params?.[0] as string[]) ?? [];
        if (keys.includes("client-rm-1")) {
          return {
            rows: [
              { tp_id: "tp-rm-1", dealer_id: "client-rm-1", is_primary: true },
              { tp_id: "tp-rm-2", dealer_id: "client-rm-2", is_primary: false },
            ],
          };
        }
        if (keys.includes("client-rop-1")) {
          return { rows: [{ tp_id: "tp-rop-1", dealer_id: "client-rop-1", is_primary: true }] };
        }
        return { rows: [] };
      }

      if (s.includes("pending_admin")) {
        return { rows: [{ n: "0" }] };
      }

      return { rows: [] };
    },
  };
}

{
  const pool = makeTeamScopePool();
  const payload = await buildTeamScopePayload(pool, {
    id: TEAM_ID,
    name: "Команда тест",
    rop_user_id: ROP_ID,
    rop_name: "ROP",
    rop_email: "rop@test.ru",
  });

  const ropScope = await computeDbScopeForUser(pool, ROP_ID, "rop");
  assert.equal(payload.team_totals.active_trade_points, ropScope.totals.active_trade_points);
  assert.equal(payload.team_totals.active_trade_points, ROP_CANONICAL_TP);

  const rmMember = payload.members.find((m) => m.user.id === RM_ID);
  assert.ok(rmMember, "regional_manager member present");
  assert.equal(rmMember.totals.active_trade_points, RM_SCOPE_TP);
  assert.notEqual(payload.team_totals.active_trade_points, ROP_CANONICAL_TP + RM_SCOPE_TP);
}

{
  const pool = makeTeamScopePool();
  const payload = await buildTeamScopePayload(pool, {
    id: TEAM_ID,
    name: "Без РОП",
    rop_user_id: null,
    rop_name: null,
    rop_email: null,
  });
  const unionTotals = aggregateMemberTotals(payload.members);
  assert.equal(payload.team_totals.active_dealers, unionTotals.active_dealers);
}

{
  const pool = makeTeamScopePool();
  const team = {
    id: TEAM_ID,
    name: "Команда тест",
    rop_user_id: ROP_ID,
    rop_name: "ROP",
    rop_email: "rop@test.ru",
  };
  const full = await buildTeamScopePayload(pool, team);
  const totalsOnly = await buildTeamScopeTotalsOnly(pool, team);

  assert.equal(totalsOnly.members.length, 0);
  assert.equal(totalsOnly.team_totals.active_trade_points, full.team_totals.active_trade_points);
  assert.equal(totalsOnly.team_totals.active_dealers, full.team_totals.active_dealers);
  assert.equal(totalsOnly.team_totals.active_trade_points, ROP_CANONICAL_TP);
}

{
  const TRASHED_DEALER_EXTRA_TP = 35;
  const ACTIVE_DEALER_TP = 5;

  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      const userId = params?.[0] as string | undefined;

      if (s.includes("FROM user_team_memberships m") && s.includes("m.user_id = $1") && userId === ROP_ID) {
        return { rows: [{ team_id: TEAM_ID }] };
      }
      if (s.includes("client_assignments WHERE responsible_user_id") && userId === ROP_ID) {
        return { rows: [] };
      }
      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: [{ client_code: "ROP01" }] };
      }
      if (s.includes("rop_client_grants") && userId === ROP_ID) {
        return { rows: [] };
      }
      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        return {
          rows: [
            { id: "d-rop-1", external_key: "client-rop-1", status: "active", trashed_by: null },
            { id: "d-trash-1", external_key: "client-trash-1", status: "in_trash", trashed_by: ROP_ID },
          ],
        };
      }
      if (s.includes("COUNT(*)::text AS active_tps") && s.includes("trade_points")) {
        const dealerIds = params?.[0] as string[] | undefined;
        assert.deepEqual(dealerIds, ["d-rop-1"], "active TPs only for active dealers");
        return { rows: [{ active_tps: String(ACTIVE_DEALER_TP) }] };
      }
      if (s.includes("COUNT(*)::text AS trashed_tps") && s.includes("trade_points")) {
        return { rows: [{ trashed_tps: "1" }] };
      }
      if (s.includes("FROM dealers d") && s.includes("has_problem")) {
        return { rows: [{ status: "активный", has_problem: false, distribution: 0 }] };
      }
      if (s.includes("SELECT tp.id::text") && s.includes("d.external_key = ANY")) {
        const keys = params?.[0] as string[];
        assert.deepEqual(keys, ["client-rop-1"]);
        return {
          rows: Array.from({ length: ACTIVE_DEALER_TP }, (_, i) => ({
            id: `tp-${i + 1}`,
            external_key: `tp-ext-${i + 1}`,
            name: `TP ${i + 1}`,
            city: "Москва",
            address: "ул. 1",
            format: "салон",
            is_active: true,
            is_primary: i === 0,
            importance_tier: null,
            dealer_id: "d-rop-1",
            dealer_external_key: "client-rop-1",
            dealer_name: "Active",
            dealer_release_code: "ROP01",
            dealer_city: "Москва",
            dealer_client_category: "top150",
            manager_user_id: null,
            manager_full_name: null,
            team_id: null,
            team_name: null,
            rop_user_id: ROP_ID,
            rop_full_name: "ROP",
          })),
        };
      }
      if (s.includes("pending_admin")) {
        return { rows: [{ n: "0" }] };
      }
      return { rows: [] };
    },
  };

  const scope = await computeDbScopeForUser(pool, ROP_ID, "rop");
  const scopedRows = await fetchScopedTradePointsRows(pool, scope, { activeOnly: true });

  assert.equal(scope.totals.active_trade_points, ACTIVE_DEALER_TP);
  assert.equal(scopedRows.length, ACTIVE_DEALER_TP);
  assert.equal(scope.totals.active_trade_points, scopedRows.length);
  assert.notEqual(scope.totals.active_trade_points, ACTIVE_DEALER_TP + TRASHED_DEALER_EXTRA_TP);
}

console.log("dealers-team-scope-totals: ok");
