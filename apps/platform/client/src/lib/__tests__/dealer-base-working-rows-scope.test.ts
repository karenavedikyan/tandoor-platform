/**
 * dealer-base-working-rows: scope по роли (director/rop через DB, остальные через snap).
 * Запуск: `npm run test:dealer-base-working-rows-scope` из каталога apps/platform.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { OrgScopePayload, TeamScopePayload } from "@shared/dealers-scope-types";
import * as dealerBaseRealScope from "@/lib/dealer-base-real-scope";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import { buildDealerBaseWorkingRowsForCount } from "../dealer-base-working-rows";

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "dir-demo" };

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
    contacts: { phone: null, email: null, lpr: null },
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
    contacts: { phone: null, email: null, lpr: null },
    tradePoints: [],
  } as DealerRow,
];

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

function managerSnap(): OrgSnapshot {
  return {
    me: { id: "mgr-1", role: "manager", fullName: "Менеджер", teamId: "team-1" },
    visibility: { all: false, clientCodes: ["MA-ALPHA"], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: "mgr-1", role: "manager", fullName: "Менеджер", teamId: "team-1" }],
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

function baseRealScope(overrides: Partial<SidebarNavRealScope>): SidebarNavRealScope {
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: mockRows,
    orgScope: { snap: directorSnap(), access: "sales_director" },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildDealerBaseWorkingRowsForCount scope by role", () => {
  it("director: does not throw; filters by orgScopeData; snap not called", () => {
    const snapSpy = vi.spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal");
    const realScope = baseRealScope({
      platformRole: "director",
      orgScope: { snap: directorSnap(), access: "sales_director" },
      orgScopeData: orgScopeWithBeta(),
    });

    expect(() =>
      buildDealerBaseWorkingRowsForCount({
        profile,
        actEnabled: false,
        actState: createEmptyActualizationState(),
        realScope,
      }),
    ).not.toThrow();
    expect(snapSpy).not.toHaveBeenCalled();

    const rows = buildDealerBaseWorkingRowsForCount({
      profile,
      actEnabled: false,
      actState: createEmptyActualizationState(),
      realScope,
    });
    expect(rows?.map((r) => r.id)).toEqual(["client-ma-beta"]);
  });

  it("rop/team_lead: does not throw; filters by teamScope; snap not called", () => {
    const snapSpy = vi.spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal");
    const realScope = baseRealScope({
      platformRole: "rop",
      orgScope: { snap: ropSnap(), access: "team_lead" },
      teamScope: teamScopeWithAlpha(),
    });

    expect(() =>
      buildDealerBaseWorkingRowsForCount({
        profile: { role: "team_lead", personaUserId: "rop-demo" },
        actEnabled: false,
        actState: createEmptyActualizationState(),
        realScope,
      }),
    ).not.toThrow();
    expect(snapSpy).not.toHaveBeenCalled();

    const rows = buildDealerBaseWorkingRowsForCount({
      profile: { role: "team_lead", personaUserId: "rop-demo" },
      actEnabled: false,
      actState: createEmptyActualizationState(),
      realScope,
    });
    expect(rows?.map((r) => r.id)).toEqual(["client-ma-alpha"]);
  });

  it("rop without teamScope returns [] without throw", () => {
    const realScope = baseRealScope({
      platformRole: "rop",
      orgScope: { snap: ropSnap(), access: "team_lead" },
      teamScope: null,
    });

    const rows = buildDealerBaseWorkingRowsForCount({
      profile: { role: "team_lead", personaUserId: "rop-demo" },
      actEnabled: false,
      actState: createEmptyActualizationState(),
      realScope,
    });
    expect(rows).toEqual([]);
  });

  it("manager regression: snap path still used", () => {
    const snapSpy = vi
      .spyOn(dealerBaseRealScope, "roleScopedDealerRowsForReal")
      .mockReturnValue([mockRows[0]!]);
    const realScope = baseRealScope({
      platformRole: "manager",
      orgScope: { snap: managerSnap(), access: "sales_manager" },
      assignmentsScope: {
        ownCodes: new Set(["MA-ALPHA"]),
        teamCodes: new Set<string>(),
        grantedCodes: new Set<string>(),
      },
    });

    const rows = buildDealerBaseWorkingRowsForCount({
      profile: { role: "sales_manager", personaUserId: "mgr-1" },
      actEnabled: false,
      actState: createEmptyActualizationState(),
      realScope,
    });
    expect(snapSpy).toHaveBeenCalled();
    expect(rows?.length).toBe(1);
    expect(rows?.[0]?.id).toBe("client-ma-alpha");
  });
});
