/**
 * Запуск: `npm run test:dealer-trash-scope` из каталога apps/platform.
 * Промт 398: RBAC корзины и архива.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import {
  buildArchiveScopeFilterRbac,
  buildTrashScopeFilterRbac,
  type TeamContext,
} from "@shared/trash-archive-rbac";
import { buildArchiveScopeFilter, buildTrashScopeFilter } from "../dealer-trash-scope";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import type { OrgSnapshot } from "../use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";

const profile = { role: "sales_manager", personaUserId: "mgr-self" } as ReleaseDemoProfile;
const TEAM = "team-a";
const MGR = "mgr-self";
const OTHER = "mgr-other";
const ROP = "rop-1";

const teamCtx: TeamContext = {
  teamId: TEAM,
  teamMemberIds: [MGR, OTHER, ROP],
  teamCodes: ["MA-001", "MA-002"],
};

function scopedRealScope(role: UserRole, meId: string): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: meId, role, fullName: "Тест", teamId: TEAM },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM, name: "Команда", ropUserId: ROP, ropName: "РОП" }],
    users: [
      { id: MGR, role: "manager", fullName: "M1", teamId: TEAM },
      { id: OTHER, role: "manager", fullName: "M2", teamId: TEAM },
      { id: meId, role, fullName: "Me", teamId: TEAM },
    ],
  } as unknown as OrgSnapshot;
  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: [],
    orgScope: { snap, access },
    assignmentsScope: {
      ownCodes: new Set(["MA-001"]),
      teamCodes: new Set(["MA-001", "MA-002"]),
      grantedCodes: new Set<string>(),
    },
  };
}

// manager: только trashedBy === self
{
  const f = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", MGR),
    userId: MGR,
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, false);
  assert.ok(f.isDealerInScope("x", { trashedBy: MGR }));
  assert.ok(!f.isDealerInScope("x", { trashedBy: OTHER }));
}

// rop: команда + ownerTeamAtTrash
{
  const f = buildTrashScopeFilter({
    role: "rop",
    profile: { role: "team_lead", personaUserId: ROP } as ReleaseDemoProfile,
    realScope: scopedRealScope("rop", ROP),
    userId: ROP,
    teamContext: teamCtx,
  });
  assert.ok(f.isDealerInScope("x", { trashedBy: MGR }));
  assert.ok(f.isDealerInScope("x", { ownerTeamAtTrash: TEAM, trashedBy: "outsider" }));
  assert.ok(!f.isDealerInScope("x", { trashedBy: "outsider", ownerTeamAtTrash: "team-z" }));
}

// director/admin fullView
for (const role of ["admin", "director"] as const) {
  const f = buildTrashScopeFilter({
    role,
    profile,
    realScope: scopedRealScope(role, "dir-1"),
    userId: "dir-1",
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, true);
}

// demo без realScope — не показываем чужое до загрузки scope
{
  const f = buildTrashScopeFilter({ role: "manager", profile, realScope: undefined });
  assert.equal(f.fullView, false);
  assert.ok(!f.isDealerInScope("x", { trashedBy: MGR }));
}

// fail-safe: scope не готов + manager → пустой фильтр (не fullView)
{
  const loadingScope: SidebarNavRealScope = {
    isRealUser: true,
    loading: true,
    ready: false,
  };
  const f = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: loadingScope,
    userId: MGR,
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, false);
  assert.ok(!f.isDealerInScope("x", { trashedBy: MGR }));
}

// fail-safe: scope не готов + admin → fullView
{
  const loadingScope: SidebarNavRealScope = { isRealUser: true, loading: true, ready: false };
  const f = buildTrashScopeFilter({
    role: "admin",
    profile,
    realScope: loadingScope,
    userId: "admin-1",
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, true);
}

// impersonate: isRealUser=false, но scope готов — RBAC по trashedBy
{
  const impersonateScope: SidebarNavRealScope = {
    ...scopedRealScope("manager", MGR),
    isRealUser: false,
  };
  const f = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: impersonateScope,
    userId: MGR,
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, false);
  assert.ok(f.isDealerInScope("x", { trashedBy: MGR }));
  assert.ok(!f.isDealerInScope("x", { trashedBy: OTHER }));
}

// archive manager: 0 пересечений ownCodes → 0 видимых (regression 542)
{
  const sklyarovCodes = new Set(["MA-SK-001", "MA-SK-002"]);
  const foreignArchive = {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: [],
    orgScope: scopedRealScope("manager", MGR).orgScope,
    assignmentsScope: {
      ownCodes: sklyarovCodes,
      teamCodes: new Set<string>(),
      grantedCodes: new Set<string>(),
    },
  } satisfies SidebarNavRealScope;
  const f = buildArchiveScopeFilter({
    role: "manager",
    profile,
    realScope: foreignArchive,
    teamContext: teamCtx,
  });
  assert.equal(f.fullView, false);
  assert.ok(!f.isDealerInScope("client-ma-999", { ownerCode: "MA-999", archivedBy: "other-mgr" }));
  assert.ok(!f.isDealerInScope("client-ma-888", { ownerCode: "MA-888" }));
  assert.ok(f.isDealerInScope("client-ma-sk-001", { ownerCode: "MA-SK-001" }));
}

// slug fallback для manager trash
{
  const f = buildTrashScopeFilterRbac({
    role: "manager",
    userId: "dc958e02-d80e-4615-bb8a-8a46be70daed",
    userSlug: "mgr-sklyarov-dv",
    teamContext: { teamId: TEAM, teamMemberIds: [MGR], teamCodes: [] },
  });
  assert.ok(f.isDealerInScope("x", { trashedBy: "mgr-sklyarov-dv", trashedBySlug: "mgr-sklyarov-dv" }));
}

// archive manager by ownerCode
{
  const f = buildArchiveScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", MGR),
    teamContext: teamCtx,
  });
  assert.ok(f.isDealerInScope("client-ma-001", { ownerCode: "MA-001" }));
  assert.ok(!f.isDealerInScope("client-ma-999", { ownerCode: "MA-999" }));
}

// archive rop team codes
{
  const f = buildArchiveScopeFilter({
    role: "rop",
    profile: { role: "team_lead", personaUserId: ROP } as ReleaseDemoProfile,
    realScope: scopedRealScope("rop", ROP),
    teamContext: teamCtx,
  });
  assert.ok(f.isDealerInScope("client-ma-002", { ownerCode: "MA-002" }));
  assert.ok(!f.isDealerInScope("client-ma-999", { ownerCode: "MA-999", ownerTeamAtArchive: "team-z" }));
}

// team change stability
{
  const oldRop = buildTrashScopeFilterRbac({
    role: "rop",
    userId: "rop-old",
    teamContext: { teamId: "team-old", teamMemberIds: ["rop-old"], teamCodes: [] },
  });
  const newRop = buildTrashScopeFilterRbac({
    role: "rop",
    userId: "rop-new",
    teamContext: { teamId: "team-new", teamMemberIds: ["rop-new"], teamCodes: [] },
  });
  const meta = { trashedBy: MGR, ownerTeamAtTrash: "team-old" };
  assert.ok(oldRop.isDealerInScope("x", meta));
  assert.ok(!newRop.isDealerInScope("x", meta));
}

console.log("dealer-trash-scope: ok (399 fail-safe RBAC)");
