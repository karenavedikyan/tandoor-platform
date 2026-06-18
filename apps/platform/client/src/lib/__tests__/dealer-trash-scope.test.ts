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

// demo без realScope
{
  const f = buildTrashScopeFilter({ role: "manager", profile, realScope: undefined });
  assert.equal(f.fullView, true);
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

console.log("dealer-trash-scope: ok (398 RBAC)");
