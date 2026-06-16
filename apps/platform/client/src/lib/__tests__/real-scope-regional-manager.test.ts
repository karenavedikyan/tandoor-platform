/**
 * Запуск: `npm run test:real-scope-regional-manager` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import {
  catalogTeamIdForTeamUuid,
  roleScopedDealerRowsForReal,
  realEffectiveTeamUuidFromSnap,
} from "../dealer-base-real-scope";
import { getReleaseClients } from "../release-client-data";
import type { OrgSnapshot } from "../use-org-snapshot";

const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";

const TEAM_KUPIANSKY = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";
const TEAM_SKALABAN = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";
const TEAM_SAPOZHKOV = "3d48d79a-38f3-49c1-ba7d-75bb5ba187dc";

const REGIONALS = [
  {
    name: "Дрогобицкий",
    id: "6fe22f7f-d8bb-4a16-92bb-5382034de831",
    teamUuid: TEAM_SAPOZHKOV,
    ropId: ROP_SAPOZHKOV,
    catalogTeam: "team-sapozhkov",
  },
  {
    name: "Богачёв",
    id: "10d1abcd-ee9b-42ff-916f-e9d4c43c9bd2",
    teamUuid: TEAM_SKALABAN,
    ropId: ROP_SKALABAN,
    catalogTeam: "team-skalaban",
  },
  {
    name: "Дзодзиков",
    id: "88169427-6062-46a1-b292-85eecb109777",
    teamUuid: TEAM_SKALABAN,
    ropId: ROP_SKALABAN,
    catalogTeam: "team-skalaban",
  },
  {
    name: "Серебряков",
    id: "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81",
    teamUuid: TEAM_KUPIANSKY,
    ropId: ROP_KUPIANSKY,
    catalogTeam: "team-kupiansky",
  },
  {
    name: "Мельник",
    id: "bc407508-0bf3-407b-9dcf-6b42de9924ee",
    teamUuid: TEAM_KUPIANSKY,
    ropId: ROP_KUPIANSKY,
    catalogTeam: "team-kupiansky",
  },
] as const;

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

function seedCountByTeam(catalogTeamId: string): number {
  return getReleaseClients().filter((c) => c.teamId === catalogTeamId).length;
}

function regionalSnap(rmId: string, teamUuid: string, ropId: string, ropName: string): OrgSnapshot {
  return {
    me: { id: rmId, role: "regional_manager", fullName: "Регионал", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId: ropId, ropName }],
    users: [{ id: rmId, fullName: "Регионал", role: "regional_manager", teamId: teamUuid, status: "active" }],
  } as unknown as OrgSnapshot;
}

function ropSnap(ropId: string, teamUuid: string, catalogTeam: string): OrgSnapshot {
  return {
    me: { id: ropId, role: "rop", fullName: "РОП", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId: ropId, ropName: "РОП" }],
    users: [],
  } as unknown as OrgSnapshot;
}

// Дрогобицкий (Сапожков): team-scope по releaseTeamId / managerIds
{
  const snap = regionalSnap(REGIONALS[0].id, REGIONALS[0].teamUuid, REGIONALS[0].ropId, "Сапожков");
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "team_lead");
  const expected = seedCountByTeam(REGIONALS[0].catalogTeam);
  assert.equal(scoped.length, expected, `Дрогобицкий: scoped=${scoped.length} expected=${expected}`);
  assert.ok(scoped.every((r) => r.releaseTeamId === REGIONALS[0].catalogTeam));
}

// regional_manager с пустым teamId → []
{
  const snap = {
    me: { id: REGIONALS[0].id, role: "regional_manager", fullName: "Регионал", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
  assert.equal(realEffectiveTeamUuidFromSnap(snap), "");
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "team_lead");
  assert.deepEqual(scoped, []);
}

// Snapshot: все 5 регионалов — только клиенты своей команды, count > 0
const regionalSnapshots: Record<string, number> = {};
for (const rm of REGIONALS) {
  const snap = regionalSnap(rm.id, rm.teamUuid, rm.ropId, rm.name);
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "team_lead");
  const ropScoped = roleScopedDealerRowsForReal(allRows, ropSnap(rm.ropId, rm.teamUuid, rm.catalogTeam), "team_lead");
  assert.ok(scoped.length > 0, `${rm.name}: ожидался ненулевой scope`);
  assert.equal(scoped.length, ropScoped.length, `${rm.name}: scope должен совпадать с РОПом`);
  assert.ok(
    scoped.every((r) => r.releaseTeamId === rm.catalogTeam),
    `${rm.name}: все строки команды ${rm.catalogTeam}`,
  );
  regionalSnapshots[rm.name] = scoped.length;
}

assert.equal(regionalSnapshots["Дрогобицкий"], seedCountByTeam("team-sapozhkov"));
assert.equal(regionalSnapshots["Богачёв"], seedCountByTeam("team-skalaban"));
assert.equal(regionalSnapshots["Серебряков"], seedCountByTeam("team-kupiansky"));

// catalogTeamIdForTeamUuid для команд регионалов
{
  const snap = regionalSnap(REGIONALS[3].id, REGIONALS[3].teamUuid, REGIONALS[3].ropId, "Купянский");
  assert.equal(catalogTeamIdForTeamUuid(snap, TEAM_KUPIANSKY), "team-kupiansky");
}

console.log("real-scope-regional-manager: ok", regionalSnapshots);
