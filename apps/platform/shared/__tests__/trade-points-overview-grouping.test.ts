/**
 * Промт 393b — группировка ropGroups в trade-points-overview.
 * Запуск: `npm run test:overview-grouping` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import {
  buildTradePointsOverviewFromDb,
  type TradePointsOverviewViewerTeam,
} from "../trade-points-overview-db.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const MGR_ID = "e60f1a83-88ae-41f8-8c32-edd91f666e8d";
const GRANTED_MGR_ID = "yakubova-uuid-0000-0000-000000000001";
const TEAM_SKALABAN = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";
const TEAM_KUPIANSKY = "team-kupiansky-uuid-000000000001";

const VIEWER_TEAM: TradePointsOverviewViewerTeam = {
  teamId: TEAM_SKALABAN,
  teamName: "Команда Скалабан Александр",
  ropUserId: ROP_ID,
  ropFullName: "Скалабан Александр",
};

/** 2 ТТ своей команды + 1 granted с чужим ca.team_id */
const MIXED_SCOPE_TPS = [
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
    manager_full_name: "Илюченко",
    team_id: TEAM_SKALABAN,
    team_name: "Команда Скалабан Александр",
    rop_user_id: ROP_ID,
    rop_full_name: "Скалабан Александр",
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
    manager_full_name: "Илюченко",
    team_id: TEAM_SKALABAN,
    team_name: "Команда Скалабан Александр",
    rop_user_id: ROP_ID,
    rop_full_name: "Скалабан Александр",
  },
  {
    id: "tp3",
    external_key: "tp-ext-3",
    name: "TP granted",
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
    manager_user_id: GRANTED_MGR_ID,
    manager_full_name: "Якубова",
    team_id: TEAM_KUPIANSKY,
    team_name: "Команда Купянский Родион",
    rop_user_id: "ccffcf6e-2505-4eee-b257-ac65b60bb779",
    rop_full_name: "Купянский Родион",
  },
];

function mockPoolForOverview(role: string): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s.includes("FROM teams t") && s.includes("rop_user_id") && !s.includes("user_team_memberships")) {
        const userId = params?.[0] as string;
        if (userId === ROP_ID) return { rows: [{ team_id: TEAM_SKALABAN }] };
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
        return { rows: [] };
      }

      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return {
          rows: [{ client_code: "C001" }, { client_code: "C002" }, { client_code: "C003" }],
        };
      }

      if (s.includes("rop_client_grants")) {
        return { rows: [{ client_code: "C003" }] };
      }

      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        const map: Record<string, { id: string; external_key: string }> = {
          C001: { id: "d1", external_key: "client-a" },
          C002: { id: "d2", external_key: "client-b" },
          C003: { id: "d3", external_key: "client-c" },
        };
        return {
          rows: codes
            .map((c) => map[c])
            .filter(Boolean)
            .map((d) => ({ ...d, status: "active" })),
        };
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
        return { rows: [{ active_tps: "3", trashed_tps: "0" }] };
      }

      if (s.includes("FROM trade_points tp") && s.includes("ORDER BY d.name")) {
        if (role === "admin") return { rows: MIXED_SCOPE_TPS };
        if (s.includes("d.external_key = ANY")) {
          const keys = (params?.[0] as string[]) ?? [];
          return { rows: MIXED_SCOPE_TPS.filter((tp) => keys.includes(tp.dealer_external_key)) };
        }
        return { rows: MIXED_SCOPE_TPS };
      }

      return { rows: [] };
    },
  };
}

// overview-rop-single-group: viewerTeam → один ropGroup, sum = structure.activeTradePoints
{
  const pool = mockPoolForOverview("rop");
  const overview = await buildTradePointsOverviewFromDb(pool, ROP_ID, "rop", undefined, VIEWER_TEAM);
  assert.equal(overview.ropGroups.length, 1);
  assert.equal(overview.ropGroups[0]?.teamId, TEAM_SKALABAN);
  assert.equal(overview.ropGroups[0]?.tradePoints, overview.structure.activeTradePoints);
  assert.equal(overview.structure.activeTradePoints, 3);
  const sum = overview.ropGroups.reduce((a, g) => a + g.tradePoints, 0);
  assert.equal(sum, overview.structure.activeTradePoints);
  const uniqueManagers = new Set(
    MIXED_SCOPE_TPS.map((tp) => tp.manager_user_id).filter(Boolean),
  );
  assert.equal(overview.ropGroups[0]?.managerCount, uniqueManagers.size);
}

// overview-admin-multi-group: viewerTeam=null → группировка по tp.teamId
{
  const pool = mockPoolForOverview("admin");
  const overview = await buildTradePointsOverviewFromDb(pool, ADMIN_ID, "admin", undefined, null);
  const uniqueTeams = new Set(MIXED_SCOPE_TPS.map((tp) => tp.team_id));
  assert.equal(overview.ropGroups.length, uniqueTeams.size);
  assert.equal(overview.ropGroups.length, 2);
}

// overview-granted-manager-in-rop-group: Якубова в группе viewer-РОПа, не в чужой
{
  const pool = mockPoolForOverview("rop");
  const overview = await buildTradePointsOverviewFromDb(pool, ROP_ID, "rop", undefined, VIEWER_TEAM);
  assert.equal(overview.ropGroups.length, 1);
  const managers = overview.ropGroups[0]?.managers ?? [];
  const yakubova = managers.find((m) => m.fullName === "Якубова");
  assert.ok(yakubova, "Якубова должна быть в группе viewer-РОПа");
  assert.equal(yakubova.tradePoints, 1);
  const kupianskyGroup = overview.ropGroups.find((g) => g.teamId === TEAM_KUPIANSKY);
  assert.equal(kupianskyGroup, undefined, "Не должно быть отдельной группы Купянского");
}

console.log("trade-points-overview-grouping.test.ts: ok");
