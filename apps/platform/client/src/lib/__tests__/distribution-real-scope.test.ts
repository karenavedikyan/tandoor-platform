/**
 * Запуск: `npm run test:distribution-real-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { DEALER_BASE_ROWS } from "../dealer-base-mock-data";
import {
  distributionEntryScopedDealerRows,
  filterDealersForEntryLeadershipScope,
} from "../distribution-entry-dealer-scope";
import { buildDistributionScopedDealerRows } from "../distribution-entry-scoped-rows";
import { mapSalesRoleToDealerBaseAccess } from "../dealer-base-role-views";
import { loadReleaseDemoProfile, type ReleaseDemoProfile } from "../release-demo-profile";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";

const DEMO_BASELINES: Record<string, number> = {};

function captureDemoBaseline(label: string, profile: ReleaseDemoProfile) {
  const scoped = buildDistributionScopedDealerRows(profile, {
    actualizationEnabled: false,
    mergedState: createEmptyActualizationState(),
  });
  DEMO_BASELINES[label] = scoped.length;
  return scoped;
}

const managerProfile = loadReleaseDemoProfile("manager", "6f1ed04c-18a8-412d-a4db-efa8ed2258d6");
const teamLeadProfile = loadReleaseDemoProfile("rop", "ccffcf6e-2505-4eee-b257-ac65b60bb779");
const directorProfile = loadReleaseDemoProfile("director", null);

// Demo-режим: snapshot baseline не меняется
{
  captureDemoBaseline("manager", managerProfile);
  captureDemoBaseline("teamLead", teamLeadProfile);
  captureDemoBaseline("director", directorProfile);

  const managerAgain = buildDistributionScopedDealerRows(managerProfile, {
    actualizationEnabled: false,
    mergedState: createEmptyActualizationState(),
  });
  assert.equal(managerAgain.length, DEMO_BASELINES.manager);
  assert.equal(
    buildDistributionScopedDealerRows(teamLeadProfile, {
      actualizationEnabled: false,
      mergedState: createEmptyActualizationState(),
    }).length,
    DEMO_BASELINES.teamLead,
  );
}

const managerSnap = {
  me: { id: "6f1ed04c-18a8-412d-a4db-efa8ed2258d6", role: "manager", fullName: "Аветисян", teamId: "e5387f40-c693-44e6-ab17-e61a3ed0bd95" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [{ id: "e5387f40-c693-44e6-ab17-e61a3ed0bd95", name: "Купянский", ropUserId: "ccffcf6e-2505-4eee-b257-ac65b60bb779", ropName: "Купянский" }],
  users: [{ id: "6f1ed04c-18a8-412d-a4db-efa8ed2258d6", fullName: "Аветисян", role: "manager", teamId: "e5387f40-c693-44e6-ab17-e61a3ed0bd95" }],
} as unknown as OrgSnapshot;

const ownCodes = new Set(["MA-MA100001", "MA-MA100002", "MA-MA100003"]);
const managerRealScope: SidebarNavRealScope = {
  isRealUser: true,
  loading: false,
  ready: true,
  orgScope: { snap: managerSnap, access: "sales_manager" },
  assignmentsScope: { ownCodes, teamCodes: new Set(), grantedCodes: new Set() },
};

// Real-режим manager: только ownCodes из assignmentsScope
{
  const scoped = buildDistributionScopedDealerRows(managerProfile, {
    actualizationEnabled: false,
    mergedState: createEmptyActualizationState(),
    realScope: managerRealScope,
  });
  assert.ok(scoped.length <= ownCodes.size, `manager real-scope: ${scoped.length} <= ${ownCodes.size}`);
  for (const row of scoped) {
    const code = row.releaseCode?.trim() ?? row.id;
    assert.ok(ownCodes.has(code), `код вне ownCodes: ${code}`);
  }
}

const RM_SEREBRYAKOV = "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81";
const TEAM_KUPIANSKY = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";
const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";

const rmSnap = {
  me: { id: RM_SEREBRYAKOV, role: "regional_manager", fullName: "Серебряков", teamId: TEAM_KUPIANSKY },
  visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
  teams: [{ id: TEAM_KUPIANSKY, name: "Купянский", ropUserId: ROP_KUPIANSKY, ropName: "Купянский" }],
  users: [{ id: RM_SEREBRYAKOV, fullName: "Серебряков", role: "regional_manager", teamId: TEAM_KUPIANSKY }],
} as unknown as OrgSnapshot;

const rmProfile: ReleaseDemoProfile = { role: "team_lead", personaUserId: "user-tl-kupiansky" };
const rmRealScope: SidebarNavRealScope = {
  isRealUser: true,
  loading: false,
  ready: true,
  orgScope: { snap: rmSnap, access: "team_lead" },
  assignmentsScope: { ownCodes: new Set(["MA-MA999999"]), teamCodes: new Set(), grantedCodes: new Set() },
};

// Real-режим regional_manager: team-scope как у РОПа, не ownCodes из overrides
let rmScopedCount = 0;
{
  const rmScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, rmProfile, rmRealScope);
  rmScopedCount = rmScoped.length;
  assert.ok(rmScoped.length > DEMO_BASELINES.manager, "РМ видит больше, чем один менеджер");
  assert.ok(
    rmScoped.every((r) => r.releaseTeamId === "team-kupiansky"),
    "РМ: только клиенты команды Купянский",
  );
  const ropSnap = {
    me: { id: ROP_KUPIANSKY, role: "rop", fullName: "Купянский", teamId: TEAM_KUPIANSKY },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY, name: "Купянский", ropUserId: ROP_KUPIANSKY, ropName: "Купянский" }],
    users: [],
  } as unknown as OrgSnapshot;
  const ropScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, teamLeadProfile, {
    isRealUser: true,
    loading: false,
    ready: true,
    orgScope: { snap: ropSnap, access: "team_lead" },
  });
  assert.equal(rmScoped.length, ropScoped.length, "РМ scope = РОП scope");
}

// Real-режим: filterDealersForEntryLeadershipScope НЕ применяется поверх real-scope
{
  const access = mapSalesRoleToDealerBaseAccess(teamLeadProfile.role);
  const realScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, teamLeadProfile, rmRealScope);
  const withLeadership = filterDealersForEntryLeadershipScope(realScoped, access, teamLeadProfile);
  const demoScoped = distributionEntryScopedDealerRows(DEALER_BASE_ROWS, teamLeadProfile, undefined);
  assert.ok(demoScoped.length > 0);
  assert.equal(realScoped.length, rmScopedCount);
  assert.ok(
    realScoped.length >= withLeadership.length,
    "в real-режиме leadership-фильтр не сужает результат distributionEntryScopedDealerRows",
  );
}

console.log("distribution-real-scope: ok", DEMO_BASELINES);
