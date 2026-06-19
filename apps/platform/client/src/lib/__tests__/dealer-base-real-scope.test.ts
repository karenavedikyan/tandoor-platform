/**
 * Запуск: `npm run test:rop-real-scope` из каталога apps/platform.
 *
 * Промт 54-A: roleScopedDealerRowsForReal для РОПов/директора по catalog team.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { roleScopedDealerRowsForReal, catalogTeamIdForRealTeamLead, realRowsForManagerByUUID, realRowsForRopTeam } from "../dealer-base-real-scope";
import { getReleaseClients } from "../release-client-data";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { computeMainDashboardScopeMetrics } from "../main-dashboard-scope-metrics";
import type { OrgSnapshot } from "../use-org-snapshot";
import type { ReleaseDemoProfile } from "../release-demo-profile";

const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const TEAM_KUPIANSKY_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";

const profile = { personaUserId: "demo", role: "team_lead" } as ReleaseDemoProfile;
const emptyAct = createEmptyActualizationState();
const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

function seedCountByTeam(catalogTeamId: string): number {
  return getReleaseClients().filter((c) => c.teamId === catalogTeamId).length;
}

function ropSnap(ropUserId: string, teamUuid: string): OrgSnapshot {
  return {
    me: { id: ropUserId, role: "rop", fullName: "РОП", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId, ropName: "РОП" }],
    users: [],
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

// catalogTeamIdForRealTeamLead
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  assert.equal(catalogTeamIdForRealTeamLead(snap), "team-kupiansky");
}

// РОПы: scope ≈ сид по команде
const ropCases: Array<{ ropId: string; teamUuid: string; catalogTeam: string; min: number }> = [
  { ropId: ROP_KUPIANSKY, teamUuid: TEAM_KUPIANSKY_UUID, catalogTeam: "team-kupiansky", min: 640 },
  { ropId: ROP_SKALABAN, teamUuid: "team-uuid-skalaban", catalogTeam: "team-skalaban", min: 1230 },
  { ropId: ROP_SAPOZHKOV, teamUuid: "team-uuid-sapozhkov", catalogTeam: "team-sapozhkov", min: 840 },
];

for (const { ropId, teamUuid, catalogTeam, min } of ropCases) {
  const snap = ropSnap(ropId, teamUuid);
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "team_lead");
  const expected = seedCountByTeam(catalogTeam);
  assert.equal(scoped.length, expected, `${catalogTeam}: scoped=${scoped.length} expected seed=${expected}`);
  assert.ok(scoped.length >= min, `${catalogTeam} >= ${min}`);
}

// Директор: все клиенты сида
{
  const snap = directorSnap();
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "sales_director");
  assert.equal(scoped.length, allRows.length);
  assert.ok(scoped.length >= 2700, "директор: >= 2700 клиентов");
}

// Метрики на пустом state — только активные клиенты
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  const metrics = computeMainDashboardScopeMetrics(emptyAct, profile, (rows) =>
    roleScopedDealerRowsForReal(rows, snap, "team_lead"),
  );
  assert.ok(metrics.activeClients >= 640);
}


// Менеджер Скляров (Купянский): scope по UUID
{
  const MGR_SKLYAROV = "dc958e02-d80e-4615-bb8a-8a46be70daed";
  const snap = {
    me: { id: ROP_KUPIANSKY, role: "rop", fullName: "Купянский", teamId: TEAM_KUPIANSKY_UUID },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY_UUID, name: "Купянский", ropUserId: ROP_KUPIANSKY, ropName: "Купянский" }],
    users: [{ id: MGR_SKLYAROV, fullName: "Скляров", role: "manager", teamId: TEAM_KUPIANSKY_UUID, status: "active" }],
  } as unknown as OrgSnapshot;
  const scoped = realRowsForManagerByUUID(allRows, snap, MGR_SKLYAROV);
  assert.ok(scoped.length >= 40, `Скляров clients >= 40, got ${scoped.length}`);
  const viaOption = roleScopedDealerRowsForReal(allRows, snap, "sales_manager", { managerUserId: MGR_SKLYAROV });
  assert.equal(viaOption.length, scoped.length);
}


// Команда Купянского по UUID РОПа (drilldown директора)
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  const teamScoped = realRowsForRopTeam(allRows, snap, ROP_KUPIANSKY);
  const viaOption = roleScopedDealerRowsForReal(allRows, snap, "sales_director", { ropUserId: ROP_KUPIANSKY });
  assert.equal(teamScoped.length, viaOption.length);
  assert.ok(teamScoped.length >= 640, `Kupiansky team >= 640, got ${teamScoped.length}`);
}

console.log("dealer-base-real-scope: ok");
