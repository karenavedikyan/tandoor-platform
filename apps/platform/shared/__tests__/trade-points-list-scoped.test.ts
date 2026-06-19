/**
 * Промт 393 — scope list-scoped trade points из БД.
 * Запуск: `npm run test:trade-points-list-scoped` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { handleTradePointsListScoped } from "../trade-points-list-scoped-handlers.js";
import { buildTradePointsOverviewFromDb } from "../trade-points-overview-db.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const MGR_ID = "e60f1a83-88ae-41f8-8c32-edd91f666e8d";
const ROP_OTHER_ID = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const RM_ID = "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81";
const TEAM_SKALABAN = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";

const USERS: Record<string, { id: string; email: string; role: string; full_name: string; status: string }> = {
  [ADMIN_ID]: { id: ADMIN_ID, email: "admin@test.ru", role: "admin", full_name: "Admin", status: "active" },
  [ROP_ID]: { id: ROP_ID, email: "rop@test.ru", role: "rop", full_name: "Skalaban", status: "active" },
  [MGR_ID]: { id: MGR_ID, email: "mgr@test.ru", role: "manager", full_name: "Ilyuchenko", status: "active" },
  [ROP_OTHER_ID]: { id: ROP_OTHER_ID, email: "rop2@test.ru", role: "rop", full_name: "Sapozhkov", status: "active" },
  [RM_ID]: { id: RM_ID, email: "rm@test.ru", role: "regional_manager", full_name: "Serebryakov", status: "active" },
};

const SCOPED_TPS = [
  {
    id: "tp1",
    external_key: "tp-ext-1",
    name: "TP 1",
    city: "Москва",
    address: "ул. 1",
    format: "салон",
    is_active: true,
    importance_tier: null,
    dealer_id: "d1",
    dealer_external_key: "client-a",
    dealer_name: "Dealer A",
    dealer_release_code: "C001",
    dealer_city: "Москва",
    dealer_client_category: "top150",
    manager_user_id: MGR_ID,
    manager_full_name: "Ilyuchenko",
    team_id: TEAM_SKALABAN,
    team_name: "Skalaban Team",
    rop_user_id: ROP_ID,
    rop_full_name: "Skalaban",
  },
  {
    id: "tp2",
    external_key: "tp-ext-2",
    name: "TP 2",
    city: "СПб",
    address: "ул. 2",
    format: "салон",
    is_active: true,
    importance_tier: null,
    dealer_id: "d2",
    dealer_external_key: "client-b",
    dealer_name: "Dealer B",
    dealer_release_code: "C002",
    dealer_city: "СПб",
    dealer_client_category: "top350",
    manager_user_id: MGR_ID,
    manager_full_name: "Ilyuchenko",
    team_id: TEAM_SKALABAN,
    team_name: "Skalaban Team",
    rop_user_id: ROP_ID,
    rop_full_name: "Skalaban",
  },
  {
    id: "tp3",
    external_key: "tp-ext-3",
    name: "TP 3",
    city: "Казань",
    address: "ул. 3",
    format: "салон",
    is_active: true,
    importance_tier: null,
    dealer_id: "d3",
    dealer_external_key: "client-c",
    dealer_name: "Dealer C",
    dealer_release_code: "C003",
    dealer_city: "Казань",
    dealer_client_category: "new_client",
    manager_user_id: "other-mgr",
    manager_full_name: "Other",
    team_id: "other-team",
    team_name: "Other Team",
    rop_user_id: ROP_OTHER_ID,
    rop_full_name: "Sapozhkov",
  },
];

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

      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        const userId = params?.[0] as string;
        if (userId === ROP_ID) {
          return { rows: [{ team_id: TEAM_SKALABAN }] };
        }
        return { rows: [] };
      }

      if (s.includes("FROM user_team_memberships") && s.includes("UNION")) {
        const userId = params?.[0] as string;
        if (userId === ROP_ID) return { rows: [{ team_id: TEAM_SKALABAN }] };
        return { rows: [] };
      }

      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("UNION")) {
        return { rows: [] };
      }

      if (s.includes("client_assignments WHERE responsible_user_id")) {
        if (params?.[0] === MGR_ID) return { rows: [{ client_code: "C001" }, { client_code: "C002" }] };
        return { rows: [] };
      }

      if (s.includes("dealer_overrides") && s.includes("regional_manager_id")) {
        const userId = params?.[0] as string;
        if (userId === RM_ID) {
          return { rows: [{ client_code: "C001" }, { client_code: "C002" }] };
        }
        return { rows: [] };
      }

      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: [{ client_code: "C001" }, { client_code: "C002" }] };
      }

      if (s.includes("rop_client_grants")) {
        return { rows: [] };
      }

      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        const map: Record<string, { id: string; external_key: string }> = {
          C001: { id: "d1", external_key: "client-a" },
          C002: { id: "d2", external_key: "client-b" },
          C003: { id: "d3", external_key: "client-c" },
        };
        const rows = codes
          .map((c) => map[c])
          .filter(Boolean)
          .map((d) => ({ ...d, status: "active" }));
        return { rows };
      }

      if (s.includes("FROM dealers d") && s.includes("dealer_overrides") && !s.includes("release_code = ANY")) {
        return {
          rows: [
            { id: "d1", external_key: "client-a", status: "active" },
            { id: "d2", external_key: "client-b", status: "active" },
            { id: "d3", external_key: "client-c", status: "active" },
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
        return { rows: [{ active_tps: "2", trashed_tps: "0" }] };
      }

      if (s.includes("FROM trade_points tp") && s.includes("ORDER BY d.name")) {
        if (s.includes("d.external_key = ANY")) {
          const keys = (params?.[0] as string[]) ?? [];
          const rows = SCOPED_TPS.filter((tp) => keys.includes(tp.dealer_external_key));
          return { rows };
        }
        return { rows: SCOPED_TPS };
      }

      return { rows: [] };
    },
  };
}

// admin without for_user_id sees all active TPs
{
  const pool = mockPool();
  const out = await handleTradePointsListScoped(pool, { id: ADMIN_ID, role: "admin" });
  assert.ok("success" in out && out.success);
  assert.equal(out.tradePoints.length, 3);
  assert.equal(out.meta.scope, "org");
}

// rop sees only own team's trade_points
{
  const pool = mockPool();
  const out = await handleTradePointsListScoped(pool, { id: ROP_ID, role: "rop" });
  assert.ok("success" in out && out.success);
  assert.equal(out.tradePoints.length, 2);
  assert.equal(out.meta.scope, "team");
}

// manager sees only own client_assignments trade_points
{
  const pool = mockPool();
  const out = await handleTradePointsListScoped(pool, { id: MGR_ID, role: "manager" });
  assert.ok("success" in out && out.success);
  assert.equal(out.tradePoints.length, 2);
  assert.equal(out.meta.scope, "self");
}

// admin with for_user_id=ropId sees same as that ROP
{
  const pool = mockPool();
  const out = await handleTradePointsListScoped(pool, { id: ADMIN_ID, role: "admin" }, ROP_ID);
  assert.ok("success" in out && out.success);
  assert.equal(out.tradePoints.length, 2);
}

// regional_manager sees trade points from dealer_overrides scope (prompt 429)
{
  const pool = mockPool();
  const out = await handleTradePointsListScoped(pool, { id: RM_ID, role: "regional_manager" });
  assert.ok("success" in out && out.success);
  assert.equal(out.tradePoints.length, 2);
  assert.equal(out.meta.scope, "team");
  assert.equal(out.meta.total, 2);
}

// trade_points-overview structure.activeTradePoints matches COUNT from db
{
  const pool = mockPool();
  const overview = await buildTradePointsOverviewFromDb(pool, ROP_ID, "rop");
  assert.equal(overview.structure.activeTradePoints, 2);
  assert.equal(overview.ropGroups[0]?.tradePoints, 2);
}

console.log("trade-points-list-scoped.test.ts: ok");
