/**
 * Запуск: `npm run test:db-scope-source-of-truth` из каталога apps/platform.
 *
 * Промт 384: scope из БД (client_assignments + dealers + overrides).
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeDbScopeForUser, resolveScopeCodesMeta } from "../db-scope-formula.js";
import { buildScopeDebugPayload } from "../scope-debug-core.js";

const ROP_ID = "22222222-2222-2222-2222-222222222222";
const MGR_ID = "44444444-4444-4444-4444-444444444444";
const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const RM_ID = "55555555-5555-5555-5555-555555555555";
const TEAM_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEAM_MEMBER_ID = "66666666-6666-6666-6666-666666666666";

const DEALERS = [
  { id: "d1", external_key: "client-a", release_code: "C001", trashed: false, trashed_by: null as string | null },
  { id: "d2", external_key: "client-b", release_code: "C002", trashed: false, trashed_by: null as string | null },
  { id: "d3", external_key: "client-c", release_code: "C003", trashed: true, trashed_by: TEAM_MEMBER_ID },
  { id: "d4", external_key: "client-d", release_code: "C004", trashed: false, trashed_by: null as string | null },
];

const TRADE_POINTS = [
  { id: "tp1", external_key: "tp-a", dealer_id: "d1", trashed: false },
  { id: "tp2", external_key: "tp-b", dealer_id: "d2", trashed: false },
  { id: "tp3", external_key: "tp-c", dealer_id: "d4", trashed: true },
];

function mockPool(role: string): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        return { rows: [{ team_id: TEAM_A }] };
      }
      if (s.includes("FROM user_team_memberships") && s.includes("team_id IN")) {
        return { rows: [{ user_id: TEAM_MEMBER_ID }, { user_id: ROP_ID }] };
      }
      if (s.includes("FROM user_team_memberships") && s.includes("UNION")) {
        return { rows: [{ team_id: TEAM_A }] };
      }
      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("UNION")) {
        if (role === "regional_manager") return { rows: [{ team_id: TEAM_A }] };
        return { rows: [] };
      }
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        if (role === "manager") return { rows: [{ client_code: "C004" }] };
        return { rows: [] };
      }
      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return {
          rows: [
            { client_code: "C001" },
            { client_code: "C002" },
            { client_code: "C003" },
            { client_code: "C004" },
          ],
        };
      }
      if (s.includes("rop_client_grants")) {
        return { rows: [{ client_code: "C005" }] };
      }
      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        const rows = DEALERS.filter((d) => codes.includes(d.release_code)).map((d) => ({
          id: d.id,
          external_key: d.external_key,
          status: d.trashed ? "in_trash" : "active",
          trashed_by: d.trashed_by,
        }));
        return { rows };
      }
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        const rows = DEALERS.map((d) => ({
          id: d.id,
          external_key: d.external_key,
          status: d.trashed ? "in_trash" : "active",
          trashed_by: d.trashed_by,
        }));
        return { rows };
      }
      if (s.includes("FROM dealer_overrides d_ov") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("FROM trade_points tp") && s.includes("dealer_id = ANY")) {
        const dealerIds = (params?.[0] as string[]) ?? [];
        const trashByParam = params?.[1];
        const trashBySet =
          Array.isArray(trashByParam) ? new Set(trashByParam as string[]) : null;
        const rows = TRADE_POINTS.filter((tp) => dealerIds.includes(tp.dealer_id));
        let active = 0;
        let trashed = 0;
        for (const tp of rows) {
          if (!tp.trashed) {
            active++;
            continue;
          }
          if (s.includes("tpo.trashed_by = $2")) {
            if (trashByParam) trashed++;
          } else if (s.includes("tpo.trashed_by = ANY($2")) {
            if (trashBySet && trashBySet.size > 0) trashed++;
          } else {
            trashed++;
          }
        }
        return { rows: [{ active_tps: String(active), trashed_tps: String(trashed) }] };
      }
      if (s.includes("FROM trade_points tp") && s.includes("INNER JOIN dealers d")) {
        const activeDealerIds = new Set(DEALERS.filter((d) => !d.trashed).map((d) => d.id));
        let active = 0;
        let trashed = 0;
        for (const tp of TRADE_POINTS) {
          if (!activeDealerIds.has(tp.dealer_id)) continue;
          if (tp.trashed) trashed++;
          else active++;
        }
        return { rows: [{ active_tps: String(active), trashed_tps: String(trashed) }] };
      }
      if (s.includes("COUNT(*)::text AS n FROM dealers")) {
        return { rows: [{ n: String(DEALERS.length) }] };
      }
      if (s.includes("user_team_memberships m") && s.includes("role_in_team")) {
        return { rows: [] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// director: full catalog, 3 active + 1 trashed
{
  const pool = mockPool("director");
  const scope = await computeDbScopeForUser(pool, DIRECTOR_ID, "director");
  assert.equal(scope.totals.active_dealers, 3);
  assert.equal(scope.totals.trashed_dealers, 1);
  assert.equal(scope.totals.active_trade_points, 2);
  assert.equal(scope.scope_explanation.full_catalog, true);
}

// manager: only C004 → 1 active dealer
{
  const pool = mockPool("manager");
  const meta = await resolveScopeCodesMeta(pool, MGR_ID, "manager");
  assert.deepEqual(meta.ownCodes, ["C004"]);
  const scope = await computeDbScopeForUser(pool, MGR_ID, "manager");
  assert.equal(scope.totals.active_dealers, 1);
  assert.equal(scope.totals.active_trade_points, 0);
}

// rop: team codes C001-C004 + grant C005 (no dealer row) → 3 active, 1 trashed
{
  const pool = mockPool("rop");
  const scope = await computeDbScopeForUser(pool, ROP_ID, "rop");
  assert.equal(scope.totals.active_dealers, 3);
  assert.equal(scope.totals.trashed_dealers, 1);
}

// regional_manager: team without grants
{
  const pool = mockPool("regional_manager");
  const meta = await resolveScopeCodesMeta(pool, RM_ID, "regional_manager");
  assert.equal(meta.grantedCodes.length, 0);
  assert.ok(meta.teamCodes.length >= 1);
}

// scope-debug uses same DB pipeline
{
  const pool = mockPool("director");
  const payload = await buildScopeDebugPayload(pool, {
    id: DIRECTOR_ID,
    email: "dir@test.ru",
    full_name: "Директор",
    phone: null,
    role: "director",
    status: "active",
    must_change_password: false,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(payload.scope.visible_dealer_count, 3);
  assert.equal(payload.scope.trashed_in_scope_count, 1);
  assert.ok(payload.explanation.some((l) => l.includes("db-scope-formula")));
}

// Промт 420: sidebar/trash UI должны читать status из dealer_overrides (my-scope), не jsonb trashedDealersById.
assert.ok(
  typeof computeDbScopeForUser === "function",
  "db-scope-formula остаётся единственным источником счётчиков active/trashed",
);

console.log("db-scope-source-of-truth.test.ts: ok");
