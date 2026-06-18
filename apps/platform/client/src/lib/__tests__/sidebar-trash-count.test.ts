/**
 * Запуск: `npm run test:sidebar-trash-count` из каталога apps/platform.
 *
 * Промт 398: счётчик корзины учитывает RBAC (trashedBy / team).
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
const MGR = "mgr-test-uuid";
const TEAM = "team-kupiansky";

const futureIso = new Date(Date.now() + 86400000).toISOString();

function trashInfo(dealerId: string, trashedBy: string) {
  return {
    dealerId,
    trashedAt: new Date().toISOString(),
    trashedBy,
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test" as const,
    ownerTeamAtTrash: TEAM,
    snapshot: {},
  };
}

function trashTpInfo(tradePointId: string, dealerId: string, trashedBy: string) {
  return {
    tradePointId,
    dealerId,
    trashedAt: new Date().toISOString(),
    trashedBy,
    trashedByName: "Тест",
    expiresAt: futureIso,
    source: "test" as const,
    ownerTeamAtTrash: TEAM,
    snapshot: {},
  };
}

function realScopeForRole(
  role: UserRole,
  meId: string,
  assignments: { ownCodes?: string[]; teamCodes?: string[] },
): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: meId, role, fullName: "Менеджер", teamId: TEAM },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM, name: "Команда", ropUserId: "rop-uuid", ropName: "РОП" }],
    users: [{ id: meId, role, fullName: "Менеджер", teamId: TEAM }],
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

function patchTrashDealer(dealerId: string, trashedBy: string) {
  patchDealerTrashRuntime(dealerId, trashInfo(dealerId, trashedBy));
  patchedDealerIds.push(dealerId);
}

function patchTrashTp(tpId: string, dealerId: string, trashedBy: string) {
  patchTradePointTrashRuntime(tpId, trashTpInfo(tpId, dealerId, trashedBy));
  patchedTpIds.push(tpId);
}

function cleanupPatches() {
  for (const id of patchedDealerIds) patchDealerTrashRuntime(id, null);
  for (const id of patchedTpIds) patchTradePointTrashRuntime(id, null);
  patchedDealerIds.length = 0;
  patchedTpIds.length = 0;
}

// manager: только свои удаления (2 own + 0 foreign)
{
  const inScope = allRows.filter((r) => r.releaseCode?.trim()).slice(0, 2);
  const outScope = allRows.filter((r) => r.releaseCode?.trim()).slice(5, 8);
  for (const r of inScope) patchTrashDealer(r.id, MGR);
  for (const r of outScope) patchTrashDealer(r.id, "other-mgr");

  const profile = { role: "sales_manager", personaUserId: MGR } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "manager",
    userId: MGR,
    teamContext: { teamId: TEAM, teamMemberIds: [MGR], teamCodes: [] },
    realScope: realScopeForRole("manager", MGR, {
      ownCodes: inScope.map((r) => r.releaseCode!.trim()),
    }),
  });
  assert.equal(count, 2, "manager: только свои 2 удаления");
  cleanupPatches();
}

// rop: все удаления команды (10 + 3)
{
  const teamRows = allRows.filter((r) => r.releaseTeamId === "team-kupiansky" && r.releaseCode?.trim()).slice(0, 10);
  const otherRows = allRows.filter((r) => r.releaseTeamId !== "team-kupiansky" && r.releaseCode?.trim()).slice(0, 3);
  assert.ok(teamRows.length === 10 && otherRows.length === 3, "rop fixture");
  for (const r of [...teamRows, ...otherRows]) patchTrashDealer(r.id, MGR);

  const profile = { role: "team_lead", personaUserId: "rop-uuid" } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "rop",
    userId: "rop-uuid",
    teamContext: {
      teamId: TEAM,
      teamMemberIds: [MGR, "rop-uuid"],
      teamCodes: teamRows.map((r) => r.releaseCode!.trim()),
    },
    realScope: realScopeForRole("rop", "rop-uuid", {
      teamCodes: teamRows.map((r) => r.releaseCode!.trim()),
    }),
  });
  assert.equal(count, 13, "rop: все удаления команды по trashedBy");
  cleanupPatches();
}

// admin: full view
{
  const ids = allRows.slice(0, 5).map((r) => r.id);
  for (const id of ids) patchTrashDealer(id, MGR);
  patchTrashTp("tp-scope-test-1", ids[0], MGR);

  const profile = { role: "sales_director", personaUserId: "user-dir" } as ReleaseDemoProfile;
  const count = resolveSidebarTrashCount(profile, {
    enabled: true,
    loading: false,
    state: act,
    role: "admin",
    userId: "admin-uuid",
    realScope: realScopeForRole("admin", "admin-uuid", {}),
  });
  assert.equal(count, 6, "admin: full view (5 дилеров + 1 ТТ)");
  cleanupPatches();
}

console.log("sidebar-trash-count: ok (3 cases)");
