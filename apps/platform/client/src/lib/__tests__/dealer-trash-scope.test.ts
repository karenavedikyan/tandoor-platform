/**
 * Запуск: `npm run test:dealer-trash-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { buildTrashScopeFilter } from "../dealer-trash-scope";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import type { OrgSnapshot } from "../use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
const profile = { role: "sales_manager", personaUserId: "mgr-boyko-em" } as ReleaseDemoProfile;

function scopedRealScope(
  role: UserRole,
  assignments: { ownCodes?: string[]; teamCodes?: string[]; grantedCodes?: string[] },
  meId = "test-user-uuid",
): SidebarNavRealScope {
  const access = mapUserRoleToDealerBaseAccess(role);
  const snap = {
    me: { id: meId, role, fullName: "Тест", teamId: role === "rop" ? "team-demo" : null },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams:
      role === "rop"
        ? [{ id: "team-demo", name: "Команда", ropUserId: meId, ropName: "РОП" }]
        : [],
    users: [{ id: meId, role, fullName: "Тест", teamId: role === "rop" ? "team-demo" : null }],
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
      grantedCodes: new Set(assignments.grantedCodes ?? []),
    },
  };
}

for (const role of ["admin", "director", "category_manager"] as const) {
  const filter = buildTrashScopeFilter({
    role,
    profile,
    realScope: scopedRealScope(role, {}),
  });
  assert.equal(filter.fullView, true, `${role}: fullView`);
  assert.ok(filter.isDealerInScope("any-dealer"), `${role}: видит любого дилера`);
}

{
  const filter = buildTrashScopeFilter({ role: "manager", profile, realScope: undefined });
  assert.equal(filter.fullView, true, "demo без realScope: fullView");
}

{
  const inScope = allRows.filter((r) => r.releaseCode?.trim()).slice(0, 2);
  const outScope = allRows.filter((r) => r.releaseCode?.trim()).slice(10, 13);
  assert.ok(inScope.length === 2 && outScope.length === 3, "fixture rows");
  const ownCodes = inScope.map((r) => r.releaseCode!.trim());
  const filter = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", { ownCodes }),
  });
  assert.equal(filter.fullView, false, "manager: scoped");
  for (const r of inScope) {
    assert.ok(filter.isDealerInScope(r.id), `manager видит ${r.id}`);
  }
  for (const r of outScope) {
    assert.ok(!filter.isDealerInScope(r.id), `manager не видит ${r.id}`);
  }
}

{
  const teamRows = allRows.filter((r) => r.releaseTeamId === "team-skalaban" && r.releaseCode?.trim()).slice(0, 5);
  const otherRows = allRows.filter((r) => r.releaseTeamId !== "team-skalaban" && r.releaseCode?.trim()).slice(0, 3);
  assert.ok(teamRows.length >= 3 && otherRows.length >= 2, "rop fixture");
  const teamCodes = teamRows.map((r) => r.releaseCode!.trim());
  const filter = buildTrashScopeFilter({
    role: "rop",
    profile: { role: "team_lead", personaUserId: "user-tl-skalaban" } as ReleaseDemoProfile,
    realScope: scopedRealScope("rop", { teamCodes }),
  });
  for (const r of teamRows) {
    assert.ok(filter.isDealerInScope(r.id), `rop видит команду ${r.id}`);
  }
  for (const r of otherRows) {
    assert.ok(!filter.isDealerInScope(r.id), `rop не видит чужих ${r.id}`);
  }
}

{
  const ownCodes = allRows
    .filter((r) => r.releaseCode?.trim())
    .slice(20, 23)
    .map((r) => r.releaseCode!.trim());
  const filter = buildTrashScopeFilter({
    role: "regional_manager",
    profile: { role: "team_lead", personaUserId: "user-tl-kupiansky" } as ReleaseDemoProfile,
    realScope: scopedRealScope("regional_manager", { ownCodes }),
  });
  assert.equal(filter.fullView, false, "regional_manager: scoped");
  assert.ok(filter.isDealerInScope(ownCodes[0]), "regional_manager видит свой код");
  assert.ok(!filter.isDealerInScope("totally-unknown-dealer"), "regional_manager не видит чужих");
}

console.log("dealer-trash-scope: ok");
