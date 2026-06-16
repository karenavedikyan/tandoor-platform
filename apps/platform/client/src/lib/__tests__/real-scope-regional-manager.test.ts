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

const ROP_SAPOZHKOV = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const TEAM_SAPOZHKOV = "3d48d79a-38f3-49c1-ba7d-75bb5ba187dc";
const DROGOBITSKY = "6fe22f7f-d8bb-4a16-92bb-5382034de831";

const allRows = buildDealerRowsFromReleaseClients(getReleaseClients());

function regionalSnap(rmId: string, teamUuid: string, ropId: string): OrgSnapshot {
  return {
    me: { id: rmId, role: "regional_manager", fullName: "Регионал", teamId: teamUuid },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [{ id: teamUuid, name: "Команда", ropUserId: ropId, ropName: "РОП" }],
    users: [{ id: rmId, fullName: "Регионал", role: "regional_manager", teamId: teamUuid, status: "active" }],
  } as unknown as OrgSnapshot;
}

// realEffectiveTeamUuidFromSnap для RM сохраняется (для бэйджа teamId у РОПа)
{
  const snap = regionalSnap(DROGOBITSKY, TEAM_SAPOZHKOV, ROP_SAPOZHKOV);
  assert.equal(realEffectiveTeamUuidFromSnap(snap), TEAM_SAPOZHKOV);
  assert.equal(catalogTeamIdForTeamUuid(snap, TEAM_SAPOZHKOV), "team-sapozhkov");
}

// Промт 354: RM без assignmentsScope → []
{
  const snap = regionalSnap(DROGOBITSKY, TEAM_SAPOZHKOV, ROP_SAPOZHKOV);
  assert.deepEqual(roleScopedDealerRowsForReal(allRows, snap, "sales_manager"), []);
}

// Промт 354: RM видит только ownCodes, не всю команду
{
  const snap = regionalSnap(DROGOBITSKY, TEAM_SAPOZHKOV, ROP_SAPOZHKOV);
  const sampleCodes = allRows
    .filter((r) => r.releaseTeamId === "team-sapozhkov" && r.releaseCode?.trim())
    .slice(0, 3)
    .map((r) => r.releaseCode!.trim());
  assert.ok(sampleCodes.length >= 2, "fixture: sample own codes");

  const scoped = roleScopedDealerRowsForReal(allRows, snap, "sales_manager", undefined, {
    ownCodes: new Set(sampleCodes),
    teamCodes: new Set(),
    grantedCodes: new Set(),
  });
  assert.equal(scoped.length, sampleCodes.length);
  assert.ok(scoped.every((r) => sampleCodes.includes(r.releaseCode!.trim())));
  assert.ok(
    scoped.length < allRows.filter((r) => r.releaseTeamId === "team-sapozhkov").length,
    "RM ownCodes меньше полной команды",
  );
}

// regional_manager с пустым teamId: teamUuid пуст, но scope по ownCodes работает
{
  const snap = {
    me: { id: DROGOBITSKY, role: "regional_manager", fullName: "Регионал", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [],
    users: [],
  } as unknown as OrgSnapshot;
  assert.equal(realEffectiveTeamUuidFromSnap(snap), "");
  const code = allRows.find((r) => r.releaseCode?.trim())?.releaseCode?.trim();
  assert.ok(code);
  const scoped = roleScopedDealerRowsForReal(allRows, snap, "sales_manager", undefined, {
    ownCodes: new Set([code!]),
    teamCodes: new Set(),
    grantedCodes: new Set(),
  });
  assert.equal(scoped.length, 1);
}

console.log("real-scope-regional-manager: ok");
