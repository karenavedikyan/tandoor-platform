/**
 * Глобальный поиск: scope по роли (director/rop через DB, остальные через snap).
 * Запуск: `npm run test:global-search-scope` из каталога apps/platform.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { OrgScopePayload, TeamScopePayload } from "@shared/dealers-scope-types";
import * as dealerBaseRealScope from "@/lib/dealer-base-real-scope";
import {
  buildDefaultLocalSearchContext,
  buildLocalGlobalSearch,
  type LocalGlobalSearchContext,
} from "../local-global-search";

const profile: ReleaseDemoProfile = { role: "sales_manager", personaUserId: "mgr-boyko-em" };

const mockRows: DealerRow[] = [
  {
    id: "client-ma-alpha",
    releaseCode: "MA-ALPHA",
    name: "Альфа Дилер",
    city: "Москва",
    manager: "Менеджер",
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "A",
    releaseTeamId: "team-1",
    releaseManagerId: "mgr-1",
    contacts: { phone: null, email: null },
    tradePoints: [],
  } as DealerRow,
  {
    id: "client-ma-beta",
    releaseCode: "MA-BETA",
    name: "Бета Дилер",
    city: "Казань",
    manager: "Менеджер 2",
    status: "активный",
    outlets: 1,
    distribution: 40,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: "team-1",
    releaseManagerId: "mgr-2",
    contacts: { phone: null, email: null },
    tradePoints: [],
  } as DealerRow,
];

vi.mock("@/lib/dealer-base-source", () => ({
  getCatalogDealerRows: () => mockRows,
  getVisibleDealerRows: (rows: DealerRow[]) => rows,
}));

vi.mock("@/lib/trade-point-list-for-actualization", () => ({
  buildTradePointListForActualization: () => [],
}));

vi.mock("@/lib/catalog-data", () => ({
  searchCatalog: () => [],
  buildCatalogProductSearchHaystack: () => "",
  catalogSearchQueryMatchesHaystack: () => false,
}));

function managerSnap(): OrgSnapshot {
  return {
    me: { id: "mgr-1", role: "manager", fullName: "Менеджер", teamId: "team-1" },
    visibility: { all: false, clientCodes: ["MA-ALPHA"], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: "mgr-1", role: "manager", fullName: "Менеджер", teamId: "team-1" }],
  } as OrgSnapshot;
}

function directorSnap(): OrgSnapshot {
  return {
    me: { id: "dir-1", role: "director", fullName: "Директор", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as OrgSnapshot;
}

function ropSnap(): OrgSnapshot {
  return {
    me: { id: "rop-1", role: "rop", fullName: "РОП", teamId: "team-1" },
    visibility: { all: false, clientCodes: null, teamIds: ["team-1"], visibleUserIds: [] },
    teams: [{ id: "team-1", name: "Команда", ropUserId: "rop-1", ropName: "РОП" }],
    users: [],
  } as OrgSnapshot;
}

function teamScopeWithAlpha(): TeamScopePayload {
  return {
    success: true,
    team: { id: "team-1", name: "Команда", rop: { id: "rop-1", name: "РОП", email: "r@test" } },
    members: [
      {
        user: { id: "mgr-1", name: "Менеджер", email: "m@test", role: "manager" },
        totals: {
          active_dealers: 1,
          active_trade_points: 1,
          trashed_dealers: 0,
          trashed_trade_points: 0,
          tp_status_active: 1,
          tp_status_potential: 0,
          tp_status_attention: 0,
          dealer_no_status: 0,
          avg_distribution: 50,
        },
        active_dealer_ids: ["client-ma-alpha"],
        active_dealer_external_keys: ["client-ma-alpha"],
        trashed_dealer_external_keys: [],
        active_trade_points: [],
      },
    ],
    team_totals: {
      active_dealers: 1,
      active_trade_points: 1,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 1,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 50,
    },
  };
}

function orgScopeWithBeta(): OrgScopePayload {
  return {
    success: true,
    org: { id: "org-1", name: "Орг" },
    teams: [
      {
        team: { id: "team-1", name: "Команда", rop: { id: "rop-1", name: "РОП", email: "r@test" } },
        members: [
          {
            user: { id: "mgr-2", name: "Менеджер 2", email: "m2@test", role: "manager" },
            totals: {
              active_dealers: 1,
              active_trade_points: 1,
              trashed_dealers: 0,
              trashed_trade_points: 0,
              tp_status_active: 1,
              tp_status_potential: 0,
              tp_status_attention: 0,
              dealer_no_status: 0,
              avg_distribution: 40,
            },
            active_dealer_ids: ["client-ma-beta"],
            active_dealer_external_keys: ["client-ma-beta"],
            trashed_dealer_external_keys: [],
            active_trade_points: [],
          },
        ],
        team_totals: {
          active_dealers: 1,
          active_trade_points: 1,
          trashed_dealers: 0,
          trashed_trade_points: 0,
          tp_status_active: 1,
          tp_status_potential: 0,
          tp_status_attention: 0,
          dealer_no_status: 0,
          avg_distribution: 40,
        },
      },
    ],
    orphan: {
      label: "Без команды",
      members: [],
      totals: {
        active_dealers: 0,
        active_trade_points: 0,
        trashed_dealers: 0,
        trashed_trade_points: 0,
        tp_status_active: 0,
        tp_status_potential: 0,
        tp_status_attention: 0,
        dealer_no_status: 0,
        avg_distribution: 0,
      },
    },
    org_totals: {
      active_dealers: 1,
      active_trade_points: 1,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 1,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 40,
    },
  };
}

function baseCtx(overrides: Partial<LocalGlobalSearchContext>): LocalGlobalSearchContext {
  return {
    ...buildDefaultLocalSearchContext(profile),
    isRealUser: true,
    visPayload: { all: true, codes: null, assignments: [] },
    snap: managerSnap(),
    teamScope: null,
    orgScope: null,
    actState: createEmptyActualizationState(),
    actEnabled: false,
    incomingAssignments: [],
    outgoingAssignments: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildLocalGlobalSearch scope by role", () => {
  it("sales_director (director): does not throw; uses org scope; snap fn not called", () => {
    const snapSpy = vi.spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal");
    const ctx = baseCtx({
      role: "director",
      snap: directorSnap(),
      orgScope: orgScopeWithBeta(),
    });

    expect(() => buildLocalGlobalSearch(ctx, "бета")).not.toThrow();
    expect(snapSpy).not.toHaveBeenCalled();

    const result = buildLocalGlobalSearch(ctx, "бета");
    expect(result.clients.some((c) => c.id === "client-ma-beta")).toBe(true);
    expect(result.clients.some((c) => c.id === "client-ma-alpha")).toBe(false);
  });

  it("team_lead (rop): does not throw; uses team scope; snap fn not called", () => {
    const snapSpy = vi.spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal");
    const ctx = baseCtx({
      role: "rop",
      snap: ropSnap(),
      teamScope: teamScopeWithAlpha(),
    });

    expect(() => buildLocalGlobalSearch(ctx, "альфа")).not.toThrow();
    expect(snapSpy).not.toHaveBeenCalled();

    const result = buildLocalGlobalSearch(ctx, "альфа");
    expect(result.clients.some((c) => c.id === "client-ma-alpha")).toBe(true);
    expect(result.clients.some((c) => c.id === "client-ma-beta")).toBe(false);
  });

  it("manager regression: snap path still used and returns scoped clients", () => {
    const snapSpy = vi
      .spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal")
      .mockReturnValue([mockRows[0]!]);
    const ctx = baseCtx({
      role: "manager",
      snap: managerSnap(),
      assignmentsScope: {
        ownCodes: new Set(["MA-ALPHA"]),
        teamCodes: new Set<string>(),
        grantedCodes: new Set<string>(),
      },
    });

    const result = buildLocalGlobalSearch(ctx, "альфа");
    expect(snapSpy).toHaveBeenCalled();
    expect(result.clients.length).toBeGreaterThan(0);
    expect(result.clients[0]?.id).toBe("client-ma-alpha");
  });

  it("director without org scope payload returns empty clients (no throw)", () => {
    const ctx = baseCtx({
      role: "director",
      snap: directorSnap(),
      orgScope: null,
    });
    expect(() => buildLocalGlobalSearch(ctx, "тест")).not.toThrow();
    expect(buildLocalGlobalSearch(ctx, "тест").clients).toEqual([]);
  });
});
