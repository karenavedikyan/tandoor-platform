/**
 * Запуск: `npm run test:db-scope-formula` из каталога apps/platform.
 *
 * Промт 406: trashed_dealers/trashed_trade_points по trashed_by (RBAC), не по scope-кодам.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeDbScopeForUser } from "../db-scope-formula.js";

const MANAGER_ID = "44444444-4444-4444-4444-444444444444";
const ROP_ID = "22222222-2222-2222-2222-222222222222";
const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "33333333-3333-3333-3333-333333333333";
const TEAM_MEMBER_ID = "66666666-6666-6666-6666-666666666666";

type DealerRow = {
  id: string;
  external_key: string;
  release_code: string;
  trashed: boolean;
  trashed_by: string | null;
};

const DEALERS: DealerRow[] = [
  {
    id: "d-active",
    external_key: "client-active",
    release_code: "C100",
    trashed: false,
    trashed_by: null,
  },
  {
    id: "d-own-trash",
    external_key: "client-own",
    release_code: "C100",
    trashed: true,
    trashed_by: MANAGER_ID,
  },
  {
    id: "d-foreign-trash",
    external_key: "client-foreign",
    release_code: "C100",
    trashed: true,
    trashed_by: OTHER_ID,
  },
  {
    id: "d-team-trash",
    external_key: "client-team",
    release_code: "C200",
    trashed: true,
    trashed_by: TEAM_MEMBER_ID,
  },
  {
    id: "d-rop-foreign",
    external_key: "client-rop-foreign",
    release_code: "C200",
    trashed: true,
    trashed_by: OTHER_ID,
  },
];

function mockPool(opts: {
  role: string;
  teamMemberIds?: string[];
  tradePoints?: { dealer_id: string; trashed: boolean; trashed_by: string | null }[];
}): PoolLike {
  const teamMemberIds = opts.teamMemberIds ?? [TEAM_MEMBER_ID, ROP_ID];
  const tradePoints = opts.tradePoints ?? [];

  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s.includes("FROM user_team_memberships") && s.includes("team_id IN")) {
        return { rows: teamMemberIds.map((user_id) => ({ user_id })) };
      }
      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("team_id IN")) {
        return { rows: [] };
      }
      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        return { rows: [{ team_id: "team-1" }] };
      }
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        if (opts.role === "manager") return { rows: [{ client_code: "C100" }] };
        if (opts.role === "rop") return { rows: [{ client_code: "C200" }] };
        return { rows: [] };
      }
      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: [{ client_code: "C100" }, { client_code: "C200" }] };
      }
      if (s.includes("rop_client_grants")) {
        return { rows: [] };
      }
      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        const rows = DEALERS.filter((d) => codes.includes(d.release_code)).map((d) => ({
          id: d.id,
          external_key: d.external_key,
          is_purged: false,
          is_employee_trash: d.trashed,
          trashed_by: d.trashed_by,
        }));
        return { rows };
      }
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        const rows = DEALERS.map((d) => ({
          id: d.id,
          external_key: d.external_key,
          is_purged: false,
          is_employee_trash: d.trashed,
          trashed_by: d.trashed_by,
        }));
        return { rows };
      }
      if (s.includes("FROM trade_points tp") && s.includes("dealer_id = ANY")) {
        const dealerIds = (params?.[0] as string[]) ?? [];
        const trashByParam = params?.[1];
        const trashBySet =
          Array.isArray(trashByParam) ? new Set(trashByParam as string[]) : null;
        const rows = tradePoints.filter((tp) => dealerIds.includes(tp.dealer_id));
        let active = 0;
        let trashed = 0;
        for (const tp of rows) {
          if (!tp.trashed) {
            active++;
            continue;
          }
          if (s.includes("tpo.trashed_by = $2")) {
            if (tp.trashed_by === trashByParam) trashed++;
          } else if (s.includes("tpo.trashed_by = ANY($2")) {
            if (tp.trashed_by && trashBySet?.has(tp.trashed_by)) trashed++;
          } else {
            trashed++;
          }
        }
        return { rows: [{ active_tps: String(active), trashed_tps: String(trashed) }] };
      }
      if (s.includes("FROM dealer_overrides d_ov") && s.includes("purge_requested_at IS NOT NULL")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("purge_requested_at IS NOT NULL")) {
        return { rows: [{ n: "0" }] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// manager: чужой trashed не в totals
{
  const pool = mockPool({ role: "manager" });
  const scope = await computeDbScopeForUser(pool, MANAGER_ID, "manager");
  assert.equal(scope.totals.active_dealers, 1);
  assert.equal(scope.totals.trashed_dealers, 1);
  assert.ok(scope.trashed_dealer_ids.includes("d-own-trash"));
  assert.ok(!scope.trashed_dealer_ids.includes("d-foreign-trash"));
}

// manager: свой trashed в totals
{
  const pool = mockPool({ role: "manager" });
  const scope = await computeDbScopeForUser(pool, MANAGER_ID, "manager");
  assert.ok(scope.trashed_dealer_ids.includes("d-own-trash"));
}

// rop: trashed team member в totals
{
  const pool = mockPool({ role: "rop" });
  const scope = await computeDbScopeForUser(pool, ROP_ID, "rop");
  assert.equal(scope.totals.trashed_dealers, 1);
  assert.ok(scope.trashed_dealer_ids.includes("d-team-trash"));
  assert.ok(!scope.trashed_dealer_ids.includes("d-rop-foreign"));
}

// rop: trashed не из команды — не в totals
{
  const pool = mockPool({ role: "rop", teamMemberIds: [TEAM_MEMBER_ID, ROP_ID] });
  const scope = await computeDbScopeForUser(pool, ROP_ID, "rop");
  assert.ok(!scope.trashed_dealer_ids.includes("d-rop-foreign"));
}

// director: все trashed
{
  const pool = mockPool({ role: "director" });
  const scope = await computeDbScopeForUser(pool, DIRECTOR_ID, "director");
  const trashedCount = DEALERS.filter((d) => d.trashed).length;
  assert.equal(scope.totals.trashed_dealers, trashedCount);
}

// trade points: trashed_by RBAC для manager
{
  const pool = mockPool({
    role: "manager",
    tradePoints: [
      { dealer_id: "d-active", trashed: false, trashed_by: null },
      { dealer_id: "d-active", trashed: true, trashed_by: MANAGER_ID },
      { dealer_id: "d-active", trashed: true, trashed_by: OTHER_ID },
    ],
  });
  const scope = await computeDbScopeForUser(pool, MANAGER_ID, "manager");
  assert.equal(scope.totals.trashed_trade_points, 1);
}

console.log("db-scope-formula.test.ts: ok");
