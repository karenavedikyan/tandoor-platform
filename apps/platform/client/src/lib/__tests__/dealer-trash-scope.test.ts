/**
 * Запуск: `npm run test:dealer-trash-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { buildArchiveScopeFilter, buildTrashScopeFilter } from "../dealer-trash-scope";
import type { ReleaseDemoProfile } from "../release-demo-profile";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";
import type { OrgSnapshot } from "../use-org-snapshot";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
const profile = { role: "sales_manager", personaUserId: "mgr-boyko-em" } as ReleaseDemoProfile;

function scopedRealScope(
  role: UserRole,
  assignments: { ownCodes?: string[]; teamCodes?: string[]; grantedCodes?: string[] },
  opts?: { meId?: string; releaseDealerRows?: typeof allRows },
): SidebarNavRealScope {
  const meId = opts?.meId ?? "test-user-uuid";
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
    releaseDealerRows: opts?.releaseDealerRows ?? allRows,
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

// Промт 396: manager — персональная корзина всегда fullView (даже без 1С-строк и assignments).
{
  const filter = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", {}, { releaseDealerRows: [] }),
  });
  assert.equal(filter.fullView, true, "trash-scope-manager-personal-state-always-visible");
  assert.ok(filter.isDealerInScope("client-ma-ma145427"), "manager видит удаление без releaseDealerRows");
}

{
  const ownCodes = Array.from({ length: 56 }, (_, i) => `MA-MA${String(100000 + i).padStart(6, "0")}`);
  const trashedIds = ownCodes.slice(0, 15).map((c) => `client-${c.toLowerCase()}`);
  const filter = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", { ownCodes }, { releaseDealerRows: [] }),
  });
  assert.equal(filter.fullView, true, "trash-scope-manager-without-dealer-rows-in-1c");
  for (const id of trashedIds) {
    assert.ok(filter.isDealerInScope(id), `manager видит ${id} без 1С-карточек`);
  }
}

{
  const inScope = allRows.filter((r) => r.releaseCode?.trim()).slice(0, 2);
  const outScope = allRows.filter((r) => r.releaseCode?.trim()).slice(10, 13);
  assert.ok(inScope.length === 2 && outScope.length === 3, "fixture rows");
  const ownCodes = inScope.map((r) => r.releaseCode!.trim());
  const trashFilter = buildTrashScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", { ownCodes }),
  });
  assert.equal(trashFilter.fullView, true, "manager trash: fullView (персональный state)");
  for (const r of [...inScope, ...outScope]) {
    assert.ok(trashFilter.isDealerInScope(r.id), `manager trash видит ${r.id}`);
  }

  const archiveFilter = buildArchiveScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", { ownCodes }),
  });
  assert.equal(archiveFilter.fullView, false, "manager archive: scoped");
  for (const r of inScope) {
    assert.ok(archiveFilter.isDealerInScope(r.id), `manager archive видит ${r.id}`);
  }
  for (const r of outScope) {
    assert.ok(!archiveFilter.isDealerInScope(r.id), `manager archive не видит ${r.id}`);
  }
}

{
  const teamRows = allRows.filter((r) => r.releaseTeamId === "team-skalaban" && r.releaseCode?.trim()).slice(0, 5);
  const otherRows = allRows.filter((r) => r.releaseTeamId !== "team-skalaban" && r.releaseCode?.trim()).slice(0, 3);
  assert.ok(teamRows.length >= 3 && otherRows.length >= 2, "rop fixture");
  const teamCodes = teamRows.map((r) => r.releaseCode!.trim());
  const trashFilter = buildTrashScopeFilter({
    role: "rop",
    profile: { role: "team_lead", personaUserId: "user-tl-skalaban" } as ReleaseDemoProfile,
    realScope: scopedRealScope("rop", { teamCodes }),
  });
  assert.equal(trashFilter.fullView, true, "rop trash: personal state fullView");
  for (const r of [...teamRows, ...otherRows]) {
    assert.ok(trashFilter.isDealerInScope(r.id), `rop trash видит ${r.id}`);
  }

  const archiveFilter = buildArchiveScopeFilter({
    role: "rop",
    profile: { role: "team_lead", personaUserId: "user-tl-skalaban" } as ReleaseDemoProfile,
    realScope: scopedRealScope("rop", { teamCodes }),
  });
  for (const r of teamRows) {
    assert.ok(archiveFilter.isDealerInScope(r.id), `rop archive видит команду ${r.id}`);
  }
  for (const r of otherRows) {
    assert.ok(!archiveFilter.isDealerInScope(r.id), `rop archive не видит чужих ${r.id}`);
  }
}

{
  const ownCodes = allRows
    .filter((r) => r.releaseCode?.trim())
    .slice(20, 23)
    .map((r) => r.releaseCode!.trim());
  const trashFilter = buildTrashScopeFilter({
    role: "regional_manager",
    profile: { role: "team_lead", personaUserId: "user-tl-kupiansky" } as ReleaseDemoProfile,
    realScope: scopedRealScope("regional_manager", { ownCodes }),
  });
  assert.equal(trashFilter.fullView, true, "regional_manager trash: fullView");
  assert.ok(trashFilter.isDealerInScope(ownCodes[0]), "regional_manager trash видит свой код");

  const archiveFilter = buildArchiveScopeFilter({
    role: "regional_manager",
    profile: { role: "team_lead", personaUserId: "user-tl-kupiansky" } as ReleaseDemoProfile,
    realScope: scopedRealScope("regional_manager", { ownCodes }),
  });
  assert.equal(archiveFilter.fullView, false, "regional_manager archive: scoped");
  assert.ok(archiveFilter.isDealerInScope(ownCodes[0]), "regional_manager archive видит свой код");
  assert.ok(!archiveFilter.isDealerInScope("totally-unknown-dealer"), "regional_manager archive не видит чужих");
}

// archive-scope-manager-restricts-to-own-codes
{
  const ownCodes = ["MA-MA145427", "MA-MA121657"];
  const archiveFilter = buildArchiveScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", { ownCodes }, { releaseDealerRows: [] }),
  });
  assert.equal(archiveFilter.fullView, false);
  assert.ok(archiveFilter.isDealerInScope("client-ma-ma145427"), "archive: own code in scope");
  assert.ok(!archiveFilter.isDealerInScope("client-ma-ma000999"), "archive: foreign code out of scope");
}

// archive-scope-admin-full-view
{
  const archiveFilter = buildArchiveScopeFilter({
    role: "admin",
    profile: { role: "sales_director", personaUserId: "user-dir" } as ReleaseDemoProfile,
    realScope: scopedRealScope("admin", {}),
  });
  assert.equal(archiveFilter.fullView, true, "archive-scope-admin-full-view");
}

// archive-scope-manager-empty-assignments → пустой архив, не full catalog
{
  const archiveFilter = buildArchiveScopeFilter({
    role: "manager",
    profile,
    realScope: scopedRealScope("manager", {}, { releaseDealerRows: [] }),
  });
  assert.equal(archiveFilter.fullView, false);
  assert.ok(!archiveFilter.isDealerInScope("client-ma-any"), "пустой scope → ничего в архиве");
}

console.log("dealer-trash-scope: ok");
