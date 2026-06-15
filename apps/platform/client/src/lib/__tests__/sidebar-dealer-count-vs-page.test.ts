/**
 * Запуск: `npm run test:sidebar-dealer-count-vs-page` из каталога apps/platform.
 *
 * Промт 332: счётчик «Клиенты-дилеры» в сайдбаре == KPI «Всего» на /dealer-base.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { createEmptyActualizationState, type ActualizationState } from "../client-base-actualization-state";
import { getReleaseClients } from "../release-client-data";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import {
  resolveSidebarTrashCount,
  resolveSidebarWorkingDealerClientCount,
} from "../dealer-base-sidebar-client-count";
import { countDealerBaseHeaderTotal } from "../dealer-base-working-rows";
import { mergeTrashedDealersForUi, mergeTrashedTradePointsForUi } from "../dealer-overrides-runtime";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

function firstManagerRow() {
  const row = allRows.find((r) => r.releaseManagerId && r.manager?.trim());
  assert.ok(row?.releaseManagerId, "fixture: manager row");
  return row;
}

function managerSnapFromRow(row: (typeof allRows)[0]): OrgSnapshot {
  const mgrId = row.releaseManagerId!;
  return {
    me: { id: mgrId, role: "manager", fullName: row.manager, teamId: "team-demo" },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: mgrId, role: "manager", fullName: row.manager, teamId: "team-demo" }],
  } as unknown as OrgSnapshot;
}

function directorSnap(): OrgSnapshot {
  return {
    me: { id: "director-uuid", role: "director", fullName: "Директор", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
}

function ropSnap(): OrgSnapshot {
  return {
    me: { id: "ccffcf6e-2505-4eee-b257-ac65b60bb779", role: "rop", fullName: "РОП", teamId: "e5387f40-c693-44e6-ab17-e61a3ed0bd95" },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: "e5387f40-c693-44e6-ab17-e61a3ed0bd95", name: "Команда", ropUserId: "ccffcf6e-2505-4eee-b257-ac65b60bb779", ropName: "РОП" }],
    users: [],
  } as unknown as OrgSnapshot;
}

function realScope(snap: OrgSnapshot, access: "sales_manager" | "team_lead" | "sales_director", rows = allRows): SidebarNavRealScope {
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: rows,
    orgScope: { snap, access },
  };
}

function pageDealerTotal(profile: ReleaseDemoProfile, act: ActualizationState, realScope?: SidebarNavRealScope): number | null {
  return countDealerBaseHeaderTotal({
    profile,
    actEnabled: true,
    actState: act,
    realScope,
  });
}

function sidebarDealerTotal(profile: ReleaseDemoProfile, act: ActualizationState, realScope?: SidebarNavRealScope): number | null {
  return resolveSidebarWorkingDealerClientCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    realScope,
  });
}

function trashPageTotal(act: ActualizationState): number {
  const dealers = mergeTrashedDealersForUi(act);
  const tps = mergeTrashedTradePointsForUi(act);
  return Object.keys(dealers).length + Object.keys(tps).length;
}

const roles: Array<{ label: string; profile: ReleaseDemoProfile; scope: SidebarNavRealScope }> = (() => {
  const mgrRow = firstManagerRow();
  const mgrSnap = managerSnapFromRow(mgrRow);
  const mgrScopedRows = allRows.filter((r) => r.releaseManagerId === mgrRow.releaseManagerId);
  return [
    {
      label: "sales_manager",
      profile: { personaUserId: mgrRow.releaseManagerId!, role: "sales_manager" } as ReleaseDemoProfile,
      scope: realScope(mgrSnap, "sales_manager", mgrScopedRows),
    },
  {
    label: "team_lead",
    profile: { personaUserId: "rop-demo", role: "team_lead" } as ReleaseDemoProfile,
    scope: realScope(ropSnap(), "team_lead"),
  },
  {
    label: "sales_director",
    profile: { personaUserId: "dir-demo", role: "sales_director" } as ReleaseDemoProfile,
    scope: realScope(directorSnap(), "sales_director"),
  },
  {
    label: "category_manager",
    profile: { personaUserId: "cat-demo", role: "sales_director" } as ReleaseDemoProfile,
    scope: realScope(directorSnap(), "sales_director"),
  },
  ];
})();

for (const { label, profile, scope } of roles) {
  const act = createEmptyActualizationState();
  const page = pageDealerTotal(profile, act, scope);
  const nav = sidebarDealerTotal(profile, act, scope);
  assert.equal(nav, page, `${label}: сайдбар == шапка /dealer-base`);
  assert.ok(page != null && page > 0, `${label}: count > 0`);
}

// Корзина: сайдбар == шапка /trash (одинаковое определение суммы).
{
  const act = createEmptyActualizationState();
  act.trashedDealersById["d-trash-1"] = {
    dealerId: "d-trash-1",
    trashedAt: new Date().toISOString(),
    trashedBy: "u1",
    trashedByName: "Тест",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    source: "test",
    snapshot: {},
  };
  act.trashedTradePointsById["tp-trash-1"] = {
    tradePointId: "tp-trash-1",
    dealerId: "d-trash-1",
    trashedAt: new Date().toISOString(),
    trashedBy: "u1",
    trashedByName: "Тест",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    source: "test",
    snapshot: {},
  };
  const profile = { personaUserId: "m", role: "sales_manager" } as ReleaseDemoProfile;
  const navTrash = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
  });
  assert.equal(navTrash, trashPageTotal(act));
}

console.log("sidebar-dealer-count-vs-page: ok");
