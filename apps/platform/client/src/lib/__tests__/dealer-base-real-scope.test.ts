/**
 * Запуск: `npm run test:rop-real-scope` из каталога apps/platform.
 *
 * Промт 423: team_lead/sales_director через DB hooks; catalog helpers — только подписи/drilldown.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import {
  filterRowsByDbScopeExternalKeys,
  roleScopedDealerRowsForReal,
  catalogTeamIdForRealTeamLead,
  realRowsForManagerByUUID,
  realRowsForRopTeam,
} from "../dealer-base-real-scope";
import { getReleaseClients } from "../release-client-data";
import type { OrgSnapshot } from "../use-org-snapshot";

const ROP_KUPIANSKY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const TEAM_KUPIANSKY_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

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

// catalogTeamIdForRealTeamLead (labels only)
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  assert.equal(catalogTeamIdForRealTeamLead(snap), "team-kupiansky");
}

// Промт 423: team_lead / sales_director без drilldown → throw
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  assert.throws(
    () => roleScopedDealerRowsForReal(allRows, snap, "team_lead"),
    /useMyTeamScope\/useOrgScope/,
  );
}
{
  const snap = directorSnap();
  assert.throws(
    () => roleScopedDealerRowsForReal(allRows, snap, "sales_director"),
    /useMyTeamScope\/useOrgScope/,
  );
}

// Менеджер Скляров (Купянский): drilldown по UUID — deprecated helper для подписей
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

// Команда Купянского по UUID РОПа (drilldown директора) — deprecated catalog helper
{
  const snap = ropSnap(ROP_KUPIANSKY, TEAM_KUPIANSKY_UUID);
  const teamScoped = realRowsForRopTeam(allRows, snap, ROP_KUPIANSKY);
  const viaOption = roleScopedDealerRowsForReal(allRows, snap, "sales_director", { ropUserId: ROP_KUPIANSKY });
  assert.equal(teamScoped.length, viaOption.length);
  assert.ok(teamScoped.length >= 640, `Kupiansky team >= 640, got ${teamScoped.length}`);
}

// Штаб менеджера: строгий DB-scope отсекает клиента, даже если снимок каталога матчит ФИО менеджера
{
  const YAKUBOVA_UUID = "0481a81d-160b-422e-8257-cf21d134cd42";
  const BARANOVA_CODE = "MA0002241";
  const baranovaRow = {
    id: "client-ma0002241",
    releaseCode: BARANOVA_CODE,
    name: "ИП Баранова Татьяна Игоревна",
    manager: "Якубова Юлия Сергеевна",
    city: "Москва",
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: "team-kupiansky",
    releaseManagerId: "mgr-yakubova-ys",
  } as DealerRow;
  const inScopeRow = {
    id: "client-ma0001001",
    releaseCode: "MA0001001",
    name: "Клиент в scope Якубовой",
    manager: "Якубова Юлия Сергеевна",
    city: "Москва",
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: "team-kupiansky",
    releaseManagerId: "mgr-yakubova-ys",
  } as DealerRow;
  const rows = [baranovaRow, inScopeRow];
  const snap = {
    me: { id: ROP_KUPIANSKY, role: "rop", fullName: "Купянский", teamId: TEAM_KUPIANSKY_UUID },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: TEAM_KUPIANSKY_UUID, name: "Купянский", ropUserId: ROP_KUPIANSKY, ropName: "Купянский" }],
    users: [
      {
        id: YAKUBOVA_UUID,
        fullName: "Якубова Юлия Сергеевна",
        role: "manager",
        teamId: TEAM_KUPIANSKY_UUID,
        status: "active",
      },
    ],
  } as unknown as OrgSnapshot;
  const fioLeak = realRowsForManagerByUUID(rows, snap, YAKUBOVA_UUID);
  assert.ok(
    fioLeak.some((r) => r.releaseCode === BARANOVA_CODE),
    "deprecated FIO/catalog match would include Baranova MA0002241",
  );
  const strict = filterRowsByDbScopeExternalKeys(rows, ["client-ma0001001"]);
  assert.equal(strict.length, 1);
  assert.equal(strict[0]!.releaseCode, "MA0001001");
  assert.ok(!strict.some((r) => r.releaseCode === BARANOVA_CODE), "DB scope must exclude Baranova");
}

console.log("dealer-base-real-scope: ok");
