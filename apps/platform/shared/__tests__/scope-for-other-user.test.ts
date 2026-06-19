/**
 * Запуск: `npm run test:scope-for-other-user` из каталога apps/platform.
 *
 * Промт 387: GET /api/dealers/my-scope?for_user_id=...
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { fetchMyDealerScopeForRequest } from "../dealers-my-scope-handlers.js";
import { canViewerAccessUserScope } from "../scope-for-user-access.js";
import { computeDbScopeForUser } from "../db-scope-formula.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const ROP_ID = "22222222-2222-2222-2222-222222222222";
const ROP_OTHER_ID = "33333333-3333-3333-3333-333333333333";
const MGR_ID = "44444444-4444-4444-4444-444444444444";
const MGR_OTHER_ID = "55555555-5555-5555-5555-555555555555";
const RM_ID = "66666666-6666-6666-6666-666666666666";
const TEAM_A = "team-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const USERS: Record<string, { id: string; email: string; role: string; full_name: string; status: string }> = {
  [ADMIN_ID]: { id: ADMIN_ID, email: "admin@test.ru", role: "admin", full_name: "Admin", status: "active" },
  [DIRECTOR_ID]: { id: DIRECTOR_ID, email: "dir@test.ru", role: "director", full_name: "Director", status: "active" },
  [ROP_ID]: { id: ROP_ID, email: "rop@test.ru", role: "rop", full_name: "ROP", status: "active" },
  [ROP_OTHER_ID]: { id: ROP_OTHER_ID, email: "rop2@test.ru", role: "rop", full_name: "ROP2", status: "active" },
  [MGR_ID]: { id: MGR_ID, email: "mgr@test.ru", role: "manager", full_name: "Manager", status: "active" },
  [MGR_OTHER_ID]: { id: MGR_OTHER_ID, email: "mgr2@test.ru", role: "manager", full_name: "Manager2", status: "active" },
  [RM_ID]: { id: RM_ID, email: "rm@test.ru", role: "regional_manager", full_name: "RM", status: "active" },
};

function mockPool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM users WHERE id")) {
        const id = params?.[0] as string;
        const u = USERS[id];
        return { rows: u ? [u] : [] };
      }
      if (s.includes("user_team_memberships target_m") && s.includes("rop_user_id")) {
        const ropId = params?.[0] as string;
        const targetId = params?.[1] as string;
        const allowed = ropId === ROP_ID && targetId === MGR_ID;
        return { rows: [{ c: allowed ? "1" : "0" }] };
      }
      if (s.includes("user_team_memberships viewer_m") && s.includes("target_m.team_id")) {
        const viewerId = params?.[0] as string;
        const targetId = params?.[1] as string;
        const allowed = viewerId === RM_ID && targetId === MGR_ID;
        return { rows: [{ c: allowed ? "1" : "0" }] };
      }
      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        return { rows: [{ team_id: TEAM_A }] };
      }
      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("target_m")) {
        return { rows: [] };
      }
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        if (params?.[0] === MGR_ID) return { rows: [{ client_code: "C001" }] };
        return { rows: [] };
      }
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        return {
          rows: [
            { id: "d1", external_key: "client-a", status: "active" },
            { id: "d2", external_key: "client-b", status: "active" },
          ],
        };
      }
      if (s.includes("FROM dealer_overrides d_ov") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("COUNT(*) FILTER") && s.includes("trade_points")) {
        return { rows: [{ active_tps: "3", trashed_tps: "0" }] };
      }
      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: [{ client_code: "C001" }] };
      }
      if (s.includes("rop_client_grants")) return { rows: [] };
      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        return { rows: [{ id: "d1", external_key: "client-a", status: "active" }] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// admin → manager scope: 200
{
  const pool = mockPool();
  const adminScope = await computeDbScopeForUser(pool, ADMIN_ID, "admin");
  const mgrScope = await computeDbScopeForUser(pool, MGR_ID, "manager");
  const result = await fetchMyDealerScopeForRequest(
    pool,
    { id: ADMIN_ID, email: "admin@test.ru", role: "admin" },
    MGR_ID,
  );
  assert.ok(!("forbidden" in result) && !("notFound" in result));
  assert.equal(result.totals.active_dealers, mgrScope.totals.active_dealers);
  assert.equal(result.viewed_user?.id, MGR_ID);
  void adminScope;
}

// rop → manager in team: 200
{
  const pool = mockPool();
  const allowed = await canViewerAccessUserScope(pool, ROP_ID, "rop", MGR_ID);
  assert.equal(allowed, true);
  const result = await fetchMyDealerScopeForRequest(
    pool,
    { id: ROP_ID, email: "rop@test.ru", role: "rop" },
    MGR_ID,
  );
  assert.ok(!("forbidden" in result));
}

// rop → manager from other team: 403
{
  const pool = mockPool();
  const allowed = await canViewerAccessUserScope(pool, ROP_ID, "rop", MGR_OTHER_ID);
  assert.equal(allowed, false);
  const result = await fetchMyDealerScopeForRequest(
    pool,
    { id: ROP_ID, email: "rop@test.ru", role: "rop" },
    MGR_OTHER_ID,
  );
  assert.ok("forbidden" in result);
}

// manager → colleague: 403
{
  const pool = mockPool();
  const result = await fetchMyDealerScopeForRequest(
    pool,
    { id: MGR_ID, email: "mgr@test.ru", role: "manager" },
    MGR_OTHER_ID,
  );
  assert.ok("forbidden" in result);
}

// regional_manager → team manager: 200
{
  const pool = mockPool();
  const allowed = await canViewerAccessUserScope(pool, RM_ID, "regional_manager", MGR_ID);
  assert.equal(allowed, true);
}

console.log("scope-for-other-user.test.ts: ok");
