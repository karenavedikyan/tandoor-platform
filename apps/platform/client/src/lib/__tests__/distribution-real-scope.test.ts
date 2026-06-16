/**
 * Запуск: `npm run test:distribution-real-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { buildDealerRowsFromReleaseClients, DEALER_BASE_ROWS } from "../dealer-base-mock-data";
import {
  distributionEntryScopedDealerRows,
  filterDealersForEntryLeadershipScope,
} from "../distribution-entry-dealer-scope";
import { buildDistributionScopedDealerRows, buildDistributionWorkingDealerRows } from "../distribution-entry-scoped-rows";
import { mapSalesRoleToDealerBaseAccess } from "../dealer-base-role-views";
import { getRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import { loadReleaseDemoProfile, type ReleaseDemoProfile } from "../release-demo-profile";
import { getReleaseClients } from "../release-client-data";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());
const skalabanRows = allRows.filter((r) => r.releaseTeamId === "team-skalaban");
const sapozhkovRows = allRows.filter((r) => r.releaseTeamId === "team-sapozhkov");

const TEAM_SKALABAN = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";
const TEAM_SAPOZHKOV = "3d48d79a-38f3-49c1-ba7d-75bb5ba187dc";
const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const BOGACHEV = "10d1abcd-ee9b-42ff-916f-e9d4c43c9bd2";
const DROGOZHITSKY = "6fe22f7f-d8bb-4a16-92bb-5382034de831";
const NETKACHEVA = "2f85e5b1-0633-45d9-9672-72417cd1daa2";

function regionalSnap(rmId: string, teamUuid: string, ropId: string): OrgSnapshot {
  return {
    me: { id: rmId, role: "regional_manager", fullName: "Регионал", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId: ropId, ropName: "РОП" }],
    users: [{ id: rmId, fullName: "Регионал", role: "regional_manager", teamId: teamUuid, status: "active" }],
  } as unknown as OrgSnapshot;
}

function seedCountByTeam(catalogTeamId: string): number {
  return getReleaseClients().filter((c) => c.teamId === catalogTeamId).length;
}

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

const rmOwnCodes = new Set(
  allRows
    .filter((r) => r.releaseTeamId === "team-kupiansky" && r.releaseCode?.trim())
    .slice(0, 4)
    .map((r) => r.releaseCode!.trim()),
);
assert.ok(rmOwnCodes.size >= 2, "fixture: rm own codes");

const rmProfile: ReleaseDemoProfile = { role: "team_lead", personaUserId: "user-tl-kupiansky" };
const rmRealScope: SidebarNavRealScope = {
  isRealUser: true,
  loading: false,
  ready: true,
  releaseDealerRows: allRows,
  orgScope: { snap: rmSnap, access: "sales_manager" },
  assignmentsScope: { ownCodes: rmOwnCodes, teamCodes: new Set(), grantedCodes: new Set() },
};

// Промт 354: regional_manager — личный scope по ownCodes, не вся команда РОПа
let rmScopedCount = 0;
{
  const rmScoped = distributionEntryScopedDealerRows(allRows, rmProfile, rmRealScope);
  rmScopedCount = rmScoped.length;
  assert.equal(rmScoped.length, rmOwnCodes.size);
  for (const row of rmScoped) {
    const code = row.releaseCode?.trim() ?? "";
    assert.ok(rmOwnCodes.has(code), `код вне ownCodes RM: ${code}`);
  }
  const ropSnap = {
    me: { id: ROP_KUPIANSKY, role: "rop", fullName: "Купянский", teamId: TEAM_KUPIANSKY },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY, name: "Купянский", ropUserId: ROP_KUPIANSKY, ropName: "Купянский" }],
    users: [],
  } as unknown as OrgSnapshot;
  const ropScoped = distributionEntryScopedDealerRows(allRows, teamLeadProfile, {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap: ropSnap, access: "team_lead" },
  });
  assert.ok(rmScoped.length < ropScoped.length, "РМ видит меньше, чем вся команда РОПа");
}

// Real-режим: filterDealersForEntryLeadershipScope НЕ применяется поверх real-scope
{
  const access = mapSalesRoleToDealerBaseAccess(rmProfile.role);
  const realScoped = distributionEntryScopedDealerRows(allRows, rmProfile, rmRealScope);
  const withLeadership = filterDealersForEntryLeadershipScope(realScoped, access, rmProfile);
  const demoScoped = distributionEntryScopedDealerRows(allRows, rmProfile, undefined);
  assert.ok(demoScoped.length > 0);
  assert.equal(realScoped.length, rmScopedCount);
  assert.ok(
    realScoped.length >= withLeadership.length,
    "в real-режиме leadership-фильтр не сужает результат distributionEntryScopedDealerRows",
  );
}

// Patch A: без актуализации, но с releaseDealerRows — не mock DEALER_BASE_ROWS
{
  const working = buildDistributionWorkingDealerRows(
    { role: "team_lead", personaUserId: "user-tl-skalaban" },
    {
      actualizationEnabled: false,
      mergedState: createEmptyActualizationState(),
      releaseDealerRows: skalabanRows,
    },
  );
  assert.equal(working.length, skalabanRows.length);
}

// Богачёв (Скалабан): только ownCodes, не вся команда и не Сапожков
{
  const bogachevOwnCodes = new Set(
    skalabanRows
      .filter((r) => r.releaseCode?.trim())
      .slice(0, 6)
      .map((r) => r.releaseCode!.trim()),
  );
  const snap = regionalSnap(BOGACHEV, TEAM_SKALABAN, ROP_SKALABAN);
  const scope: SidebarNavRealScope = {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access: "sales_manager" },
    assignmentsScope: { ownCodes: bogachevOwnCodes, teamCodes: new Set(), grantedCodes: new Set() },
  };
  const scoped = buildDistributionScopedDealerRows(
    { role: "team_lead", personaUserId: "user-tl-skalaban" },
    {
      actualizationEnabled: false,
      mergedState: createEmptyActualizationState(),
      realScope: scope,
      releaseDealerRows: allRows,
    },
  );
  assert.equal(scoped.length, bogachevOwnCodes.size);
  const sapozhkovIds = new Set(sapozhkovRows.map((r) => r.id));
  assert.ok(!scoped.some((r) => sapozhkovIds.has(r.id)), "Богачёв не должен видеть клиентов Сапожкова");
  assert.ok(scoped.length < seedCountByTeam("team-skalaban"), "Богачёв: ownCodes меньше всей команды");
}

// Дрогобицкий (Сапожков): только ownCodes территории
{
  const drogoOwnCodes = new Set(
    sapozhkovRows
      .filter((r) => r.releaseCode?.trim())
      .slice(0, 5)
      .map((r) => r.releaseCode!.trim()),
  );
  const snap = regionalSnap(DROGOZHITSKY, TEAM_SAPOZHKOV, ROP_SAPOZHKOV);
  const scoped = distributionEntryScopedDealerRows(allRows, { role: "team_lead", personaUserId: "user-tl-sapozhkov" }, {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access: "sales_manager" },
    assignmentsScope: { ownCodes: drogoOwnCodes, teamCodes: new Set(), grantedCodes: new Set() },
  });
  assert.equal(scoped.length, drogoOwnCodes.size);
  assert.ok(scoped.length < seedCountByTeam("team-sapozhkov"));
}

// regional_manager без assignmentsScope → []
{
  const snap = {
    me: { id: BOGACHEV, role: "regional_manager", fullName: "Богачёв", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
  const scoped = distributionEntryScopedDealerRows(allRows, { role: "team_lead", personaUserId: "user-tl-skalaban" }, {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows: allRows,
    orgScope: { snap, access: "sales_manager" },
  });
  assert.deepEqual(scoped, []);
}

// Менеджер Неткачева (Сапожков): только свои
{
  const ownCodes = new Set(
    allRows.filter((r) => r.releaseManagerId === "mgr-netkacheva-ia").map((r) => r.releaseCode ?? r.id),
  );
  const snap = {
    me: { id: NETKACHEVA, role: "manager", fullName: "Неткачева", teamId: TEAM_SAPOZHKOV },
    visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_SAPOZHKOV, name: "Сапожков", ropUserId: ROP_SAPOZHKOV, ropName: "Сапожков" }],
    users: [{ id: NETKACHEVA, fullName: "Неткачева", role: "manager", teamId: TEAM_SAPOZHKOV }],
  } as unknown as OrgSnapshot;
  const scoped = buildDistributionScopedDealerRows(loadReleaseDemoProfile("manager", NETKACHEVA), {
    actualizationEnabled: false,
    mergedState: createEmptyActualizationState(),
    realScope: {
      isRealUser: true,
      loading: false,
      ready: true,
      releaseDealerRows: allRows,
      orgScope: { snap, access: "sales_manager" },
      assignmentsScope: { ownCodes, teamCodes: new Set(), grantedCodes: new Set() },
    },
    releaseDealerRows: allRows,
  });
  assert.ok(scoped.length > 0);
  assert.ok(scoped.length <= ownCodes.size);
}

// РОП Скалабан: вся команда
{
  const snap = {
    me: { id: ROP_SKALABAN, role: "rop", fullName: "Скалабан", teamId: TEAM_SKALABAN },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_SKALABAN, name: "Скалабан", ropUserId: ROP_SKALABAN, ropName: "Скалабан" }],
    users: [],
  } as unknown as OrgSnapshot;
  const scoped = distributionEntryScopedDealerRows(
    allRows,
    loadReleaseDemoProfile("rop", ROP_SKALABAN),
    { isRealUser: true, loading: false, ready: true, orgScope: { snap, access: "team_lead" } },
  );
  assert.equal(scoped.length, seedCountByTeam("team-skalaban"));
}

// Patch C: real-user loading → [] (не mock)
{
  const loadingScope: SidebarNavRealScope = { isRealUser: true, loading: true, ready: false };
  assert.deepEqual(
    getRoleScopedDealerRowsAuto(DEALER_BASE_ROWS, { role: "team_lead", personaUserId: "user-tl-skalaban" }, loadingScope),
    [],
  );
}

console.log("distribution-real-scope: ok", DEMO_BASELINES);
