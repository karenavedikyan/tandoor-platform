/**
 * Запуск: `npm run test:sidebar-trade-points-count` из каталога apps/platform.
 *
 * Промт 332: счётчик ТТ в сайдбаре == summary.total на /trade-points.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { createEmptyActualizationState, type ActualizationState } from "../client-base-actualization-state";
import { getReleaseClients } from "../release-client-data";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import { buildSidebarNavRealScope, type SidebarNavRealScope } from "../sidebar-nav-real-scope";
import {
  buildTradePointsWorkingRowsForCount,
  countTradePointsWorkingRows,
} from "../trade-points-working-rows";
import { resolveSidebarTradePointsCount } from "../sidebar-trade-points-count";

const ORLOV_MANAGER_ID = "f8e2f0b0-6f5a-4c2e-9c1d-8a7b6c5d4e3f";

function managerProfile(): ReleaseDemoProfile {
  return { personaUserId: ORLOV_MANAGER_ID, role: "sales_manager" } as ReleaseDemoProfile;
}

function directorProfile(): ReleaseDemoProfile {
  return { personaUserId: "director-demo", role: "sales_director" } as ReleaseDemoProfile;
}

function ropProfile(): ReleaseDemoProfile {
  return { personaUserId: ROP_KUPIANSKY, role: "team_lead" } as ReleaseDemoProfile;
}

function categoryManagerProfile(): ReleaseDemoProfile {
  return { personaUserId: "cat-mgr-demo", role: "sales_director" } as ReleaseDemoProfile;
}

const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const TEAM_KUPIANSKY_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";

const allReleaseRows = buildDealerRowsFromReleaseClients(getReleaseClients());

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
    me: { id: ROP_KUPIANSKY, role: "rop", fullName: "РОП", teamId: TEAM_KUPIANSKY_UUID },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY_UUID, name: "Команда", ropUserId: ROP_KUPIANSKY, ropName: "РОП" }],
    users: [],
  } as unknown as OrgSnapshot;
}

function managerSnap(managerId: string, managerName: string): OrgSnapshot {
  return {
    me: { id: managerId, role: "manager", fullName: managerName, teamId: TEAM_KUPIANSKY_UUID },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY_UUID, name: "Команда", ropUserId: ROP_KUPIANSKY, ropName: "РОП" }],
    users: [{ id: managerId, role: "manager", fullName: managerName, teamId: TEAM_KUPIANSKY_UUID }],
  } as unknown as OrgSnapshot;
}

function realScopeFor(
  snap: OrgSnapshot,
  access: "sales_manager" | "team_lead" | "sales_director",
  releaseDealerRows = allReleaseRows,
): SidebarNavRealScope {
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows,
    orgScope: { snap, access },
  };
}

function countWith(input: {
  profile: ReleaseDemoProfile;
  act: ActualizationState;
  realScope?: SidebarNavRealScope;
}): number | null {
  return countTradePointsWorkingRows({
    profile: input.profile,
    actEnabled: true,
    actState: input.act,
    realScope: input.realScope,
  });
}

function sidebarCount(input: {
  profile: ReleaseDemoProfile;
  act: ActualizationState;
  realScope?: SidebarNavRealScope;
}): number | null {
  return resolveSidebarTradePointsCount(input.profile, {
    enabled: true,
    loading: false,
    state: input.act,
    realScope: input.realScope,
  });
}

// 1. Менеджер: релиз-ТТ + manual − trashed ТТ − trashed клиент.
{
  const scopedRows = roleScopedDealerRowsForReal(allReleaseRows, directorSnap(), "sales_director").slice(0, 3);
  assert.ok(scopedRows.length >= 1, "fixture: есть клиенты");
  const dealer = scopedRows[0]!;
  const manualTpId = "manual-tp-test-001";
  const trashedTpId = dealer.tradePoints[1]?.id ?? `${dealer.id}-tp-2`;

  const act = createEmptyActualizationState();
  act.manuallyCreatedTradePointsById[manualTpId] = {
    id: manualTpId,
    dealerId: dealer.id,
    fields: { name: "Ручная ТТ", city: "Луганск", address: "ул. Тест" },
    createdAt: new Date().toISOString(),
    createdBy: "u1",
    createdByName: "Тест",
    source: "manual_actualization",
  };
  if (trashedTpId) {
    act.trashedTradePointsById[trashedTpId] = {
      tradePointId: trashedTpId,
      dealerId: dealer.id,
      trashedAt: new Date().toISOString(),
      trashedBy: "u1",
      trashedByName: "Тест",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "test",
      snapshot: {
        name: null,
        address: null,
        city: null,
        tradePointCode: null,
        dealerFullName: null,
      },
    };
  }
  const trashedDealer = scopedRows[1];
  if (trashedDealer) {
    act.trashedDealersById[trashedDealer.id] = {
      dealerId: trashedDealer.id,
      trashedAt: new Date().toISOString(),
      trashedBy: "u1",
      trashedByName: "Тест",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      source: "test",
      snapshot: {},
    };
  }

  const mgrRows = roleScopedDealerRowsForReal(allReleaseRows, managerSnap(dealer.releaseManagerId ?? "mgr", dealer.manager), "sales_manager");
  const mgrScope = realScopeFor(managerSnap(dealer.releaseManagerId ?? "mgr", dealer.manager), "sales_manager", mgrRows);
  const n = countWith({ profile: managerProfile(), act, realScope: mgrScope });
  assert.ok(n != null && n >= 1, "менеджер: счётчик > 0");
  const rows = buildTradePointsWorkingRowsForCount({
    profile: managerProfile(),
    actEnabled: true,
    actState: act,
    realScope: mgrScope,
  })!;
  assert.ok(!rows.some((r) => r.tradePointId === trashedTpId), "trashed ТТ исключена");
  if (trashedDealer) {
    assert.ok(!rows.some((r) => r.dealerId === trashedDealer.id), "trashed клиент исключён");
  }
  assert.ok(rows.some((r) => r.tradePointId === manualTpId), "manual ТТ включена");
}

// 2. Менеджер без state → число релиз-ТТ в scope.
{
  const act = createEmptyActualizationState();
  const mgrRows = allReleaseRows.filter((r) => r.releaseManagerId).slice(0, 40);
  const mgrId = mgrRows[0]?.releaseManagerId;
  assert.ok(mgrId, "fixture manager id");
  const scoped = roleScopedDealerRowsForReal(mgrRows, managerSnap(mgrId!, mgrRows[0]!.manager), "sales_manager");
  const scope = realScopeFor(managerSnap(mgrId!, mgrRows[0]!.manager), "sales_manager", scoped);
  const n = countWith({ profile: managerProfile(), act, realScope: scope });
  assert.ok(n != null && n > 0, "без state: релиз-ТТ в scope");
}

// 3. Пустой scope → 0.
{
  const act = createEmptyActualizationState();
  const scope = realScopeFor(managerSnap("unknown-mgr", "Никто"), "sales_manager", []);
  assert.equal(countWith({ profile: managerProfile(), act, realScope: scope }), 0);
}

// 4. РОП → сумма по команде.
{
  const act = createEmptyActualizationState();
  const scope = realScopeFor(ropSnap(), "team_lead");
  const ropCount = countWith({ profile: ropProfile(), act, realScope: scope });
  const directorCount = countWith({ profile: directorProfile(), act, realScope: realScopeFor(directorSnap(), "sales_director") });
  assert.ok(ropCount != null && directorCount != null);
  assert.ok(ropCount > 0, "РОП: > 0 ТТ");
  assert.ok(ropCount < directorCount, "РОП < директор");
}

// 5. Директор → все ТТ.
{
  const act = createEmptyActualizationState();
  const n = countWith({ profile: directorProfile(), act, realScope: realScopeFor(directorSnap(), "sales_director") });
  assert.ok(n != null && n > 100, "директор: много ТТ");
}

// 6. Категорийный менеджер (sales_director access) → все ТТ.
{
  const act = createEmptyActualizationState();
  const n = countWith({
    profile: categoryManagerProfile(),
    act,
    realScope: realScopeFor(directorSnap(), "sales_director"),
  });
  const directorN = countWith({ profile: directorProfile(), act, realScope: realScopeFor(directorSnap(), "sales_director") });
  assert.equal(n, directorN, "категорийный менеджер == директор по ТТ");
}

// 7. Сайдбар == общий хелпер для тех же входов.
{
  const act = createEmptyActualizationState();
  const scope = realScopeFor(directorSnap(), "sales_director");
  const pageTotal = countTradePointsWorkingRows({ profile: directorProfile(), actEnabled: true, actState: act, realScope: scope });
  const navTotal = sidebarCount({ profile: directorProfile(), act, realScope: scope });
  assert.equal(navTotal, pageTotal);
  const rows = buildTradePointsWorkingRowsForCount({
    profile: directorProfile(),
    actEnabled: true,
    actState: act,
    realScope: scope,
  });
  assert.equal(rows?.length, pageTotal);
}

// buildSidebarNavRealScope: loading → null downstream.
{
  const loadingScope = buildSidebarNavRealScope({
    isRealUser: true,
    authLoading: false,
    authError: false,
    role: "manager",
    snap: null,
    visPayload: null,
    orgSnapError: false,
    visCodesError: false,
    orgSnapLoading: true,
    visCodesLoading: false,
    assignmentsScope: undefined,
  });
  assert.equal(loadingScope.loading, true);
  assert.equal(
    countTradePointsWorkingRows({
      profile: managerProfile(),
      actEnabled: true,
      actState: createEmptyActualizationState(),
      realScope: loadingScope,
    }),
    null,
  );
}

console.log("sidebar-trade-points-count: ok (7 cases)");
