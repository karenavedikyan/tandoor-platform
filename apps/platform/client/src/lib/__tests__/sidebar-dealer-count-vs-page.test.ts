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
import { buildTrashNavBadge } from "../auth-access";
import { splitScopedTrashCounts } from "../dealer-trash-scope";
import type { TrashedDealerInfo, TrashedTradePointInfo } from "../client-base-actualization-state";
import { sidebarCountsFromDbScope, type MyScopeFromDB } from "../../hooks/use-my-scope-from-db.js";
import {
  countDealerBaseHeaderTotal,
  defaultDealerBasePickerArgsForCount,
} from "../dealer-base-working-rows";
import { setDealerBaseRowsCache } from "../dealer-base-source";
import { loadReleaseDemoProfile } from "../release-demo-profile";
import { mergeTrashedDealersForUi, mergeTrashedTradePointsForUi } from "../dealer-overrides-runtime";
import type { OrgScopePayload, TeamScopePayload } from "@shared/dealers-scope-types";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import { dealerExternalKeysFromOrgScope, dealerExternalKeysFromTeamScope } from "../dealer-scope-external-keys";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
setDealerBaseRowsCache(allRows);

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

function teamScopeFromKeys(keys: string[]): TeamScopePayload {
  return {
    success: true,
    team: { id: "team-1", name: "Команда", rop: { id: "rop-1", name: "РОП", email: "r@test" } },
    members: [
      {
        user: { id: "mgr-1", name: "Менеджер", email: "m@test", role: "manager" },
        totals: {
          active_dealers: keys.length,
          active_trade_points: 0,
          trashed_dealers: 0,
          trashed_trade_points: 0,
          tp_status_active: 0,
          tp_status_potential: 0,
          tp_status_attention: 0,
          dealer_no_status: 0,
          avg_distribution: 0,
        },
        active_dealer_ids: keys,
        active_dealer_external_keys: keys,
        trashed_dealer_external_keys: [],
        active_trade_points: [],
      },
    ],
    team_totals: {
      active_dealers: keys.length,
      active_trade_points: 0,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
  };
}

function orgScopeFromKeys(keys: string[]): OrgScopePayload {
  return {
    success: true,
    org: { id: "org-1", name: "Орг" },
    teams: [
      {
        team: { id: "team-1", name: "Команда", rop: { id: "rop-1", name: "РОП", email: "r@test" } },
        members: [
          {
            user: { id: "mgr-1", name: "Менеджер", email: "m@test", role: "manager" },
            totals: {
              active_dealers: keys.length,
              active_trade_points: 0,
              trashed_dealers: 0,
              trashed_trade_points: 0,
              tp_status_active: 0,
              tp_status_potential: 0,
              tp_status_attention: 0,
              dealer_no_status: 0,
              avg_distribution: 0,
            },
            active_dealer_ids: keys,
            active_dealer_external_keys: keys,
            trashed_dealer_external_keys: [],
            active_trade_points: [],
          },
        ],
        team_totals: {
          active_dealers: keys.length,
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
      active_dealers: keys.length,
      active_trade_points: 0,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
  };
}

function realScope(
  snap: OrgSnapshot,
  access: "sales_manager" | "team_lead" | "sales_director",
  rows = allRows,
  extra: Partial<SidebarNavRealScope> = {},
): SidebarNavRealScope {
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: rows,
    orgScope: { snap, access },
    ...extra,
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
    scope: realScope(ropSnap(), "team_lead", allRows, {
      platformRole: "rop",
      teamScope: teamScopeFromKeys(allRows.map((r) => r.id)),
    }),
  },
  {
    label: "sales_director",
    profile: { personaUserId: "dir-demo", role: "sales_director" } as ReleaseDemoProfile,
    scope: realScope(directorSnap(), "sales_director", allRows, {
      platformRole: "director",
      orgScopeData: orgScopeFromKeys(allRows.map((r) => r.id)),
    }),
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
  if (label === "category_manager") {
    assert.equal(page, 0, `${label}: safe empty scope without director platformRole`);
    continue;
  }
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
    role: "admin",
    userId: "admin-1",
  });
  assert.equal(navTrash, trashPageTotal(act));
}

// --- Промт 418: active-only scope и бейдж корзины `dealers/tp` ---

function mockDbScope(totals: {
  active_dealers: number;
  active_trade_points: number;
  trashed_dealers: number;
  trashed_trade_points: number;
}): MyScopeFromDB {
  return {
    success: true,
    loading: false,
    ready: true,
    error: false,
    forbidden: false,
    user: { id: "u1", email: "u@test", role: "manager" },
    scopeSubject: { id: "u1", email: "u@test", role: "manager" },
    totals,
    active_dealer_ids: [],
    active_dealer_external_keys: [],
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    scope_explanation: {
      role: "manager",
      team_ids: [],
      own_codes: 56,
      team_codes: 0,
      granted_codes: 0,
      all_codes: 56,
      full_catalog: false,
    },
    activeDealerIdSet: new Set(),
    trashedDealerIdSet: new Set(),
    activeDealerExternalKeySet: new Set(),
    trashedDealerExternalKeySet: new Set(),
  };
}

{
  const counts = sidebarCountsFromDbScope(
    mockDbScope({
      active_dealers: 44,
      active_trade_points: 33,
      trashed_dealers: 12,
      trashed_trade_points: 10,
    }),
  );
  assert.equal(counts.dealers, 44, "418: sidebar dealers = active only");
  assert.equal(counts.trashDealers, 12);
  assert.equal(counts.trashTradePoints, 10);
  assert.deepEqual(buildTrashNavBadge(counts.trashDealers, counts.trashTradePoints), { badge: "12/10" });
  assert.notEqual(counts.dealers, 56, "418: active 44 ≠ assignments 56");
}

{
  const activeKeys = new Set(
    Array.from({ length: 44 }, (_, i) => `client-ma-ma${String(100000 + i).padStart(6, "0")}`),
  );
  const catalog = allRows.slice(0, 100);
  const visible = catalog.filter((r) => activeKeys.has(r.id));
  const scope: SidebarNavRealScope = {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: visible,
    orgScope: { snap: managerSnapFromRow(firstManagerRow()), access: "sales_manager" },
    assignmentsScope: {
      ownCodes: new Set(Array.from(activeKeys).map((k) => k.replace(/^client-/, "").toUpperCase())),
      teamCodes: new Set(),
      grantedCodes: new Set(),
    },
  };
  const profile = { personaUserId: firstManagerRow().releaseManagerId!, role: "sales_manager" } as ReleaseDemoProfile;
  const act = createEmptyActualizationState();
  const page = countDealerBaseHeaderTotal({ profile, actEnabled: true, actState: act, realScope: scope });
  assert.equal(page, visible.length, "418: page count follows active scope rows");
  assert.ok(page != null && page <= 44 + 10, "418: page is not inflated by in_trash dealers");
}

// --- Промт 334: real-РОП не должен резаться profile-based ropTeam ---

const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";

const WRONG_ROP_PERSONA_PROFILE = {
  personaUserId: "user-tl-kupiansky",
  role: "team_lead",
} as ReleaseDemoProfile;

function ropSnapFor(ropUserId: string, teamUuid: string): OrgSnapshot {
  return {
    me: { id: ropUserId, role: "rop", fullName: "РОП", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId, ropName: "РОП" }],
    users: [],
  } as unknown as OrgSnapshot;
}

function rowsForCatalogTeam(catalogTeamId: string) {
  const clients = getReleaseClients().filter((c) => c.teamId === catalogTeamId);
  return buildDealerRowsFromReleaseClients(clients);
}

function countRealRopWithWrongPersona(
  ropUserId: string,
  teamUuid: string,
  catalogTeamId: string,
): number | null {
  const teamRows = rowsForCatalogTeam(catalogTeamId);
  assert.ok(teamRows.length > 0, `fixture: rows for ${catalogTeamId}`);
  const scope: SidebarNavRealScope = {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap: ropSnapFor(ropUserId, teamUuid), access: "team_lead" },
    platformRole: "rop",
    teamScope: teamScopeFromKeys(teamRows.map((r) => r.id)),
  };
  return countDealerBaseHeaderTotal({
    profile: WRONG_ROP_PERSONA_PROFILE,
    actEnabled: true,
    actState: createEmptyActualizationState(),
    realScope: scope,
  });
}

{
  const n = countRealRopWithWrongPersona(ROP_SAPOZHKOV, "team-uuid-sapozhkov", "team-sapozhkov");
  assert.ok(n != null && n > 0, "Сапожков (real): счётчик > 0 при persona user-tl-kupiansky");
}

{
  const n = countRealRopWithWrongPersona(ROP_SKALABAN, "team-uuid-skalaban", "team-skalaban");
  assert.ok(n != null && n > 0, "Скалабан (real): счётчик > 0");
}

{
  const n = countRealRopWithWrongPersona(ROP_KUPIANSKY, "e5387f40-c693-44e6-ab17-e61a3ed0bd95", "team-kupiansky");
  assert.ok(n != null && n > 0, "Купянский (real): счётчик > 0");
}

// demo-режим: profile-based ropTeam применяется.
{
  const picker = defaultDealerBasePickerArgsForCount(WRONG_ROP_PERSONA_PROFILE, "team_lead", false);
  assert.equal(picker.ropTeam, "team-kupiansky", "demo: ropTeam из persona");
  const pickerReal = defaultDealerBasePickerArgsForCount(WRONG_ROP_PERSONA_PROFILE, "team_lead", true);
  assert.equal(pickerReal.ropTeam, "all", "real: ropTeam all");
  const demoCount = countDealerBaseHeaderTotal({
    profile: WRONG_ROP_PERSONA_PROFILE,
    actEnabled: true,
    actState: createEmptyActualizationState(),
  });
  assert.ok(demoCount != null && demoCount > 0, "demo team_lead: count > 0");
}

// --- Промт 334: подбор persona для реальных руководителей ---

function withBrowserWindow<T>(fn: () => T): T {
  const g = globalThis as { window?: unknown };
  const prev = g.window;
  g.window = {};
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.window;
    else g.window = prev;
  }
}

{
  const p = withBrowserWindow(() => loadReleaseDemoProfile("rop", ROP_SAPOZHKOV));
  assert.equal(p.personaUserId, "user-tl-sapozhkov");
  assert.equal(p.role, "team_lead");
}

{
  const p = withBrowserWindow(() => loadReleaseDemoProfile("rop", ROP_SKALABAN));
  assert.equal(p.personaUserId, "user-tl-skalaban");
}

{
  const p = withBrowserWindow(() => loadReleaseDemoProfile("rop", ROP_KUPIANSKY));
  assert.equal(p.personaUserId, "user-tl-kupiansky");
}

{
  const p = withBrowserWindow(() => loadReleaseDemoProfile("rop", "00000000-0000-0000-0000-000000000000"));
  assert.equal(p.personaUserId, "user-tl-kupiansky", "неизвестный UUID РОПа → fallback");
}

// --- Trash badge == page counts (splitScopedTrashCounts, not scope totals) ---

{
  const futureIso = new Date(Date.now() + 86400000).toISOString();
  const teamCtx = { teamId: "team-a", teamMemberIds: ["mgr-1", "rop-1"], teamCodes: ["MA-001"] };
  const dealers: TrashedDealerInfo[] = [
    {
      dealerId: "d1",
      trashedAt: new Date().toISOString(),
      trashedBy: "mgr-1",
      trashedByName: "M",
      expiresAt: futureIso,
      source: "test",
      ownerTeamAtTrash: "team-a",
      snapshot: {},
    },
    {
      dealerId: "d2",
      trashedAt: new Date().toISOString(),
      trashedBy: "outsider",
      trashedByName: "X",
      expiresAt: futureIso,
      source: "test",
      ownerTeamAtTrash: "team-z",
      snapshot: {},
    },
  ];
  const tps: TrashedTradePointInfo[] = [
    {
      tradePointId: "tp1",
      dealerId: "d1",
      trashedAt: new Date().toISOString(),
      trashedBy: "mgr-1",
      trashedByName: "M",
      expiresAt: futureIso,
      source: "test",
      ownerTeamAtTrash: "team-a",
      snapshot: {},
    },
  ];
  const filter = {
    isDealerInScope: (_id: string, meta: { trashedBy?: string }) => meta.trashedBy === "mgr-1",
    isTradePointInScope: (_tpId: string, _dealerId: string | null, meta: { trashedBy?: string }) =>
      meta.trashedBy === "mgr-1",
    fullView: false,
  };
  const pageCounts = splitScopedTrashCounts(dealers, tps, filter);
  const scopeTotals = { trashDealers: 5, trashTradePoints: 2 };
  assert.notEqual(pageCounts.dealers, scopeTotals.trashDealers, "scope totals may differ from RBAC page filter");
  assert.deepEqual(buildTrashNavBadge(pageCounts.dealers, pageCounts.tradePoints), { badge: "1/1" });
  assert.deepEqual(buildTrashNavBadge(scopeTotals.trashDealers, scopeTotals.trashTradePoints), { badge: "5/2" });
}

console.log("sidebar-dealer-count-vs-page: ok");
