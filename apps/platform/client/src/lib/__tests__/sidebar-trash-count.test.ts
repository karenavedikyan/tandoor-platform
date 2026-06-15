/**
 * Запуск: `npm run test:sidebar-trash-count` из каталога apps/platform.
 *
 * Промт 336: счётчик корзины в сайдбаре учитывает тот же scope, что рабочая база.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { getReleaseClients } from "../release-client-data";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import { resolveSidebarTrashCount } from "../dealer-base-sidebar-client-count";
import {
  patchDealerTrashRuntime,
  patchTradePointTrashRuntime,
} from "../dealer-overrides-runtime";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import type { OrgSnapshot } from "../use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";
import type { UserRole } from "@shared/auth";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
const act = createEmptyActualizationState();

const futureIso = new Date(Date.now() + 86400000).toISOString();

function trashInfo(dealerId: string) {
  return {
    dealerId,
    trashedAt: new Date().toISOString(),
    trashedBy: "u1",
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test",
    snapshot: {},
  };
}

function trashTpInfo(tradePointId: string, dealerId: string) {
  return {
    tradePointId,
    dealerId,
    trashedAt: new Date().toISOString(),
    trashedBy: "u1",
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test",
    snapshot: {},
  };
}

function realScopeForRole(
  role: UserRole,
  assignments: { ownCodes?: string[]; teamCodes?: string[] },
): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess(role);
  const meId = "mgr-test-uuid";
  const snap = {
    me: { id: meId, role, fullName: "Менеджер", teamId: null },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [{ id: meId, role, fullName: "Менеджер", teamId: null }],
  } as unknown as OrgSnapshot;
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access },
    assignmentsScope: {
      ownCodes: new Set(assignments.ownCodes ?? []),
      teamCodes: new Set(assignments.teamCodes ?? []),
      grantedCodes: new Set<string>(),
    },
  };
}

const patchedDealerIds: string[] = [];
const patchedTpIds: string[] = [];

function patchTrashDealer(dealerId: string) {
  patchDealerTrashRuntime(dealerId, trashInfo(dealerId));
  patchedDealerIds.push(dealerId);
}

function patchTrashTp(tpId: string, dealerId: string) {
  patchTradePointTrashRuntime(tpId, trashTpInfo(tpId, dealerId));
  patchedTpIds.push(tpId);
}

function cleanupPatches() {
  for (const id of patchedDealerIds) patchDealerTrashRuntime(id, null);
  for (const id of patchedTpIds) patchTradePointTrashRuntime(id, null);
  patchedDealerIds.length = 0;
  patchedTpIds.length = 0;
}

// manager: 5 удалённых, 2 в scope → счётчик = 2
{
  const inScope = allRows.filter((r) => r.releaseCode?.trim()).slice(0, 2);
  const outScope = allRows.filter((r) => r.releaseCode?.trim()).slice(5, 8);
  for (const r of [...inScope, ...outScope]) patchTrashDealer(r.id);

  const profile = { role: "sales_manager", personaUserId: "mgr-boyko-em" } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "manager",
    realScope: realScopeForRole("manager", {
      ownCodes: inScope.map((r) => r.releaseCode!.trim()),
    }),
  });
  assert.equal(count, 2, "manager: 2 из 5 в scope");
  cleanupPatches();
}

// rop: 10 в команде + 3 вне → счётчик = 10
{
  const teamRows = allRows.filter((r) => r.releaseTeamId === "team-kupiansky" && r.releaseCode?.trim()).slice(0, 10);
  const otherRows = allRows.filter((r) => r.releaseTeamId !== "team-kupiansky" && r.releaseCode?.trim()).slice(0, 3);
  assert.ok(teamRows.length === 10 && otherRows.length === 3, "rop fixture");
  for (const r of [...teamRows, ...otherRows]) patchTrashDealer(r.id);

  const profile = { role: "team_lead", personaUserId: "user-tl-kupiansky" } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "rop",
    realScope: realScopeForRole("rop", {
      teamCodes: teamRows.map((r) => r.releaseCode!.trim()),
    }),
  });
  assert.equal(count, 10, "rop: только команда");
  cleanupPatches();
}

// admin: full view — все удалённые
{
  const ids = allRows.slice(0, 5).map((r) => r.id);
  for (const id of ids) patchTrashDealer(id);
  patchTrashTp("tp-scope-test-1", ids[0]);

  const profile = { role: "sales_director", personaUserId: "user-dir-goncharenko" } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "admin",
    realScope: realScopeForRole("admin", {}),
  });
  assert.equal(count, 6, "admin: full view (5 дилеров + 1 ТТ)");
  cleanupPatches();
}

console.log("sidebar-trash-count: ok (3 cases)");
