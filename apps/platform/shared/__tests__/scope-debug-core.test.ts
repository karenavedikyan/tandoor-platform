/**
 * Запуск: `npm run test:scope-debug-counters` из каталога apps/platform.
 *
 * Промт 383: счётчики scope-debug совпадают с sidebar pipeline (buildSidebarNavRealScope).
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { buildScopeDebugPayload } from "../scope-debug-core.js";
import { buildDealerRowsFromReleaseClients, type DealerRow } from "../../client/src/lib/dealer-base-mock-data.js";
import { getReleaseClients } from "../../client/src/lib/release-client-data.js";
import type { OrgSnapshot } from "../../client/src/lib/use-org-snapshot.js";
import {
  assignmentsScopeFromCodes,
  buildRealScopeForSidebarCounters,
  computeSidebarScopeCountersFromRealScope,
  profileForScopeCounters,
  visiblePayloadFromCodes,
} from "../../client/src/lib/sidebar-scope-counter-math.js";
import { createEmptyActualizationState } from "../../client/src/lib/client-base-actualization-state.js";

const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const ROP_A_ID = "22222222-2222-2222-2222-222222222222";
const ROP_B_ID = "33333333-3333-3333-3333-333333333333";
const MGR_ID = "44444444-4444-4444-4444-444444444444";
const TEAM_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEAM_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function fixtureDealer(partial: Partial<DealerRow> & Pick<DealerRow, "id" | "releaseCode">): DealerRow {
  const base = buildDealerRowsFromReleaseClients(getReleaseClients())[0];
  return {
    ...base,
    ...partial,
    contacts: partial.contacts ?? base.contacts,
    tradePoints: partial.tradePoints ?? base.tradePoints,
  };
}

const FIXTURE_DEALERS: DealerRow[] = [
  fixtureDealer({
    id: "d-001",
    name: "Dealer A1",
    releaseCode: "C001",
    releaseTeamId: "team-a",
    releaseManagerId: "mgr-1",
    city: "Москва",
    outlets: 1,
    tradePoints: [{ id: "d-001-01", name: "TP1", city: "Москва" }],
  }),
  fixtureDealer({
    id: "d-002",
    name: "Dealer A2",
    releaseCode: "C002",
    releaseTeamId: "team-a",
    releaseManagerId: "mgr-2",
    city: "Москва",
    outlets: 2,
    tradePoints: [
      { id: "d-002-01", name: "TP2a", city: "Москва" },
      { id: "d-002-02", name: "TP2b", city: "Москва" },
    ],
  }),
  fixtureDealer({
    id: "d-003",
    name: "Dealer B1",
    releaseCode: "C003",
    releaseTeamId: "team-b",
    releaseManagerId: "mgr-3",
    city: "СПб",
    outlets: 1,
    tradePoints: [{ id: "d-003-01", name: "TP3", city: "СПб" }],
  }),
  fixtureDealer({
    id: "d-004",
    name: "Dealer M1",
    releaseCode: "C004",
    releaseTeamId: "team-a",
    releaseManagerId: "mgr-1",
    city: "Казань",
    outlets: 1,
    tradePoints: [{ id: "d-004-01", name: "TP4", city: "Казань" }],
  }),
  fixtureDealer({
    id: "d-005",
    name: "Dealer trash",
    releaseCode: "C005",
    releaseTeamId: "team-a",
    releaseManagerId: "mgr-1",
    city: "Тула",
    outlets: 1,
    tradePoints: [{ id: "d-005-01", name: "TP5", city: "Тула" }],
  }),
];

function ropASnap(): OrgSnapshot {
  return {
    me: { id: ROP_A_ID, role: "rop", fullName: "РОП А", teamId: TEAM_A },
    visibility: {
      all: false,
      clientCodes: ["C001", "C002", "C004", "C005"],
      teamIds: [TEAM_A],
      visibleUserIds: [ROP_A_ID],
    },
    teams: [{ id: TEAM_A, name: "Команда A", ropUserId: ROP_A_ID, ropName: "РОП А" }],
    users: [
      { id: ROP_A_ID, fullName: "РОП А", role: "rop", teamId: TEAM_A, status: "active" },
      { id: MGR_ID, fullName: "Менеджер", role: "manager", teamId: TEAM_A, status: "active" },
    ],
  } as OrgSnapshot;
}

function managerSnap(): OrgSnapshot {
  return {
    me: { id: MGR_ID, role: "manager", fullName: "Менеджер", teamId: TEAM_A },
    visibility: { all: false, clientCodes: ["C004"], teamIds: [TEAM_A], visibleUserIds: [MGR_ID, ROP_A_ID] },
    teams: [{ id: TEAM_A, name: "Команда A", ropUserId: ROP_A_ID, ropName: "РОП А" }],
    users: [
      { id: MGR_ID, fullName: "Менеджер", role: "manager", teamId: TEAM_A, status: "active" },
      { id: ROP_A_ID, fullName: "РОП А", role: "rop", teamId: TEAM_A, status: "active" },
    ],
  } as OrgSnapshot;
}

function directorSnap(): OrgSnapshot {
  return {
    me: { id: DIRECTOR_ID, role: "director", fullName: "Директор", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [TEAM_A, TEAM_B], visibleUserIds: [DIRECTOR_ID] },
    teams: [
      { id: TEAM_A, name: "Команда A", ropUserId: ROP_A_ID, ropName: "РОП А" },
      { id: TEAM_B, name: "Команда B", ropUserId: ROP_B_ID, ropName: "РОП Б" },
    ],
    users: [{ id: DIRECTOR_ID, fullName: "Директор", role: "director", teamId: null, status: "active" }],
  } as OrgSnapshot;
}

function sidebarCountersForRopA() {
  const vis = visiblePayloadFromCodes({ all: false, codes: ["C001", "C002", "C004", "C005"] });
  const assignments = assignmentsScopeFromCodes({
    ownCodes: [],
    teamCodes: ["C001", "C002", "C004", "C005"],
    grantedCodes: [],
  });
  const realScope = buildRealScopeForSidebarCounters({
    role: "rop",
    snap: ropASnap(),
    visPayload: vis,
    assignmentsScope: assignments,
    catalogRows: FIXTURE_DEALERS,
  });
  const profile = profileForScopeCounters(ROP_A_ID, "rop");
  const act = createEmptyActualizationState();
  act.trashedDealersById = {
    "d-005": {
      dealerId: "d-005",
      trashedAt: new Date().toISOString(),
      trashedBy: "",
      trashedByName: "",
      expiresAt: new Date().toISOString(),
      source: "manual_actualization",
      snapshot: { fullName: null, city: null, inn: null, dealerCode: null, legalEntityName: null },
    },
  };
  return computeSidebarScopeCountersFromRealScope(profile, "rop", realScope, act, true);
}

function mockRopPool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM users WHERE id")) {
        return {
          rows: [
            {
              id: ROP_A_ID,
              email: "rop-a@test.ru",
              full_name: "РОП А",
              phone: null,
              role: "rop",
              status: "active",
              must_change_password: false,
              last_login_at: null,
              created_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }
      if (s.includes("FROM users WHERE lower(email)")) return { rows: [] };
      if (s.includes("FROM teams t") && s.includes("ORDER BY t.name")) {
        return { rows: [{ id: TEAM_A, name: "Команда A", rop_user_id: ROP_A_ID, role_in_team: "rop" }] };
      }
      if (s.includes("FROM users u") && s.includes("user_team_memberships")) {
        return {
          rows: [
            { id: ROP_A_ID, full_name: "РОП А", role: "rop", status: "active", team_id: TEAM_A },
            { id: MGR_ID, full_name: "Менеджер", role: "manager", status: "active", team_id: TEAM_A },
          ],
        };
      }
      if (s.includes("user_team_memberships WHERE user_id")) {
        return { rows: [{ team_id: TEAM_A }] };
      }
      if (s.includes("role = 'admin'")) return { rows: [] };
      if (s.includes("client_assignments ca") && s.includes("rop_user_id")) {
        return {
          rows: [
            { client_code: "C001", responsible_user_id: MGR_ID, team_id: TEAM_A },
            { client_code: "C002", responsible_user_id: MGR_ID, team_id: TEAM_A },
            { client_code: "C004", responsible_user_id: MGR_ID, team_id: TEAM_A },
            { client_code: "C005", responsible_user_id: MGR_ID, team_id: TEAM_A },
          ],
        };
      }
      if (s.includes("FROM client_assignments WHERE responsible_user_id")) return { rows: [] };
      if (s.includes("rop_client_grants")) return { rows: [] };
      if (s.includes("dealer_overrides WHERE trashed_at")) {
        return { rows: [{ dealer_id: "d-005", trashed_at: "2026-06-17T00:00:00.000Z" }] };
      }
      if (s.includes("trade_point_overrides WHERE trashed_at")) return { rows: [] };
      if (s.includes("user_team_memberships m") && s.includes("role_in_team")) {
        return { rows: [{ id: TEAM_A, name: "Команда A", rop_user_id: ROP_A_ID, role_in_team: "rop" }] };
      }
      if (s.includes("FROM teams") && s.includes("ORDER BY")) {
        return { rows: [{ id: TEAM_A, name: "Команда A", rop_user_id: ROP_A_ID, rop_name: "РОП А" }] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// sidebar vs scope-debug math (ROP A): 4 team codes, 1 trashed → 3 working dealers
{
  const sidebar = sidebarCountersForRopA();
  assert.equal(sidebar.visibleDealerCount, 3, "ROP A sidebar: 3 working dealers (C005 in trash)");
}

// manager: only C004
{
  const vis = visiblePayloadFromCodes({ all: false, codes: ["C004"] });
  const assignments = assignmentsScopeFromCodes({ ownCodes: ["C004"], teamCodes: [], grantedCodes: [] });
  const realScope = buildRealScopeForSidebarCounters({
    role: "manager",
    snap: managerSnap(),
    visPayload: vis,
    assignmentsScope: assignments,
    catalogRows: FIXTURE_DEALERS,
  });
  const c = computeSidebarScopeCountersFromRealScope(
    profileForScopeCounters(MGR_ID, "manager"),
    "manager",
    realScope,
    createEmptyActualizationState(),
    true,
  );
  assert.equal(c.visibleDealerCount, 1);
  assert.equal(c.visibleTradePointCount, 1);
}

// director: all catalog
{
  const vis = visiblePayloadFromCodes({ all: true, codes: null });
  const realScope = buildRealScopeForSidebarCounters({
    role: "director",
    snap: directorSnap(),
    visPayload: vis,
    catalogRows: FIXTURE_DEALERS,
  });
  const c = computeSidebarScopeCountersFromRealScope(
    profileForScopeCounters(DIRECTOR_ID, "director"),
    "director",
    realScope,
    createEmptyActualizationState(),
    true,
  );
  assert.equal(c.visibleDealerCount, 5);
  assert.equal(c.visibleTradePointCount, 6);
}

// scope-debug payload vs sidebar math for ROP (mock pool + catalog override)
{
  const pool = mockRopPool();
  const target = {
    id: ROP_A_ID,
    email: "rop-a@test.ru",
    full_name: "РОП А",
    phone: null,
    role: "rop",
    status: "active",
    must_change_password: false,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  const debug = await buildScopeDebugPayload(pool, target, FIXTURE_DEALERS);
  const sidebar = sidebarCountersForRopA();
  assert.equal(debug.scope.visible_dealer_count, sidebar.visibleDealerCount, "scope-debug dealers == sidebar math");
  assert.equal(debug.scope.visible_trade_point_count, sidebar.visibleTradePointCount);
  assert.ok(debug.scope.visible_dealer_count > 0);
  assert.ok(debug.explanation.length >= 3);
}

console.log("scope-debug-core.test.ts: ok");
