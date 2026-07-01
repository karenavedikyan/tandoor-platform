/**
 * Промт 391 — маркировка внешних (кросс-командных) менеджеров на штабе команды.
 * Запуск: `npm run test:external-managers-view` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "../admin/actualization-dedupe.js";
import type { DealerRow } from "../../client/src/lib/dealer-base-mock-data.js";
import { aggregateManagersForTeam, shouldSuppressPhantomExternalManager } from "../../client/src/lib/dealer-base-management-view-model.js";
import type { OrgSnapshot } from "../../client/src/lib/use-org-snapshot.js";

const TEAM_A = "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa";
const TEAM_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MGR_ILUYCHENKO_UUID = "e60f1a83-88ae-41f8-8c32-edd91f666e8d";
const UUID_YAKUBOVA = "0481a81d-160b-422e-8257-cf21d134cd42";
const MGR_ILUYCHENKO = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[MGR_ILUYCHENKO_UUID] ?? MGR_ILUYCHENKO_UUID;
const MGR_YAKUBOVA = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[UUID_YAKUBOVA] ?? "mgr-yakubova-ys";

const userIdToCatalogMgrId = new Map(Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE));

function dealerRow(id: string, partial: Partial<DealerRow> = {}): DealerRow {
  return {
    id,
    releaseCode: partial.releaseCode ?? id,
    name: partial.name ?? id,
    city: partial.city ?? "Севастополь",
    manager: partial.manager ?? "",
    status: partial.status ?? "активный",
    outlets: partial.outlets ?? 1,
    distribution: partial.distribution ?? 50,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: partial.hasRecentActivity ?? true,
    clientCategory: partial.clientCategory ?? "top150",
    releaseTeamId: TEAM_A,
    releaseManagerId: partial.releaseManagerId ?? MGR_ILUYCHENKO,
    ...partial,
  } as DealerRow;
}

const orgSnap: OrgSnapshot = {
  me: { id: "rop-skalaban", role: "rop", fullName: "Скалабан Александр", teamId: TEAM_A },
  visibility: { all: false, clientCodes: null, teamIds: [TEAM_A], visibleUserIds: [] },
  teams: [
    {
      id: TEAM_A,
      name: "Команда Скалабан Александр",
      ropUserId: "rop-skalaban",
      ropName: "Скалабан Александр",
    },
    {
      id: TEAM_B,
      name: "Команда Купянский Родион",
      ropUserId: "rop-kupiansky",
      ropName: "Купянский Родион",
    },
  ],
  users: [
    {
      id: MGR_ILUYCHENKO_UUID,
      fullName: "Илюченко",
      role: "manager",
      teamId: TEAM_A,
      status: "active",
    },
    {
      id: UUID_YAKUBOVA,
      fullName: "Якубова Юлия Сергеевна",
      role: "manager",
      teamId: TEAM_B,
      status: "active",
    },
  ],
};

const teamRows = [
  dealerRow("client-ilyuchenko", { releaseCode: "CL-INT", releaseManagerId: MGR_ILUYCHENKO }),
  dealerRow("client-yakubova-cross", { releaseCode: "CL-EXT", releaseManagerId: MGR_YAKUBOVA, city: "Севастополь" }),
];

const responsibleByCode: Record<string, string> = {
  "CL-INT": MGR_ILUYCHENKO_UUID,
  "CL-EXT": UUID_YAKUBOVA,
};

const managers = aggregateManagersForTeam(TEAM_A, teamRows, orgSnap, responsibleByCode, userIdToCatalogMgrId);

const ilyuchenko = managers.find((m) => m.managerId === MGR_ILUYCHENKO);
const yakubova = managers.find((m) => m.managerId === MGR_YAKUBOVA);

assert.ok(ilyuchenko, "каталожный менеджер команды A должен быть в списке");
assert.equal(ilyuchenko!.isExternal, false);
assert.equal(ilyuchenko!.externalTeamName ?? null, null);

assert.ok(yakubova, "менеджер команды B с клиентами в команде A — внешний");
assert.equal(yakubova!.isExternal, true);
assert.equal(yakubova!.externalTeamName, "Команда Купянский Родион");
assert.equal(yakubova!.rows.length, 1);
assert.equal(yakubova!.rows[0]!.releaseCode, "CL-EXT");

// orgSnap без чужих команд — externalTeamName null, isExternal остаётся true
const snapNoForeignTeams: OrgSnapshot = {
  ...orgSnap,
  teams: orgSnap.teams.filter((t) => t.id === TEAM_A),
};
const managersNoTeamName = aggregateManagersForTeam(
  TEAM_A,
  teamRows,
  snapNoForeignTeams,
  responsibleByCode,
  userIdToCatalogMgrId,
);
const yakubovaNoName = managersNoTeamName.find((m) => m.managerId === MGR_YAKUBOVA);
assert.ok(yakubovaNoName);
assert.equal(yakubovaNoName!.isExternal, true);
assert.equal(yakubovaNoName!.externalTeamName ?? null, null);

// phantom-desync: override-scope клиент с assignment team A в штабе B — без гранта карточка скрыта
{
  const TEAM_SAPOZH = "3d48d79a-38f3-49c1-ba7d-75bb5ba187dc";
  const MGR_AGADZ = "mgr-agadzhanian-uuid";
  const desyncRow = dealerRow("client-100004", {
    releaseCode: "100004",
    releaseTeamId: TEAM_A,
    releaseManagerId: MGR_AGADZ,
    manager: "Агаджанян",
    ropName: "Сапожков",
  });
  const snapSapozh: OrgSnapshot = {
    ...orgSnap,
    teams: [
      ...orgSnap.teams,
      {
        id: TEAM_SAPOZH,
        name: "Команда Сапожков",
        ropUserId: "rop-sapozhkov",
        ropName: "Сапожков",
      },
    ],
    users: [
      ...orgSnap.users,
      {
        id: MGR_AGADZ,
        fullName: "Агаджанян",
        role: "manager",
        teamId: TEAM_A,
        status: "active",
      },
    ],
  };
  assert.equal(
    shouldSuppressPhantomExternalManager([desyncRow], TEAM_SAPOZH, MGR_AGADZ, snapSapozh, new Set()),
    true,
  );
  const phantomManagers = aggregateManagersForTeam(
    TEAM_SAPOZH,
    [desyncRow],
    snapSapozh,
    { "100004": MGR_AGADZ },
    userIdToCatalogMgrId,
    undefined,
    new Set(),
  );
  assert.equal(phantomManagers.find((m) => m.managerId === MGR_AGADZ), undefined);
}

// grant-external: Якубова по гранту в команде A — карточка остаётся
{
  const grantRow = dealerRow("client-yak-grant", {
    releaseCode: "MA-YAK-GRANT",
    releaseTeamId: TEAM_B,
    releaseManagerId: MGR_YAKUBOVA,
    manager: "Якубова",
  });
  assert.equal(
    shouldSuppressPhantomExternalManager(
      [grantRow],
      TEAM_A,
      UUID_YAKUBOVA,
      orgSnap,
      new Set(["MA-YAK-GRANT"]),
    ),
    false,
  );
  const grantManagers = aggregateManagersForTeam(
    TEAM_A,
    [grantRow],
    orgSnap,
    { "MA-YAK-GRANT": UUID_YAKUBOVA },
    userIdToCatalogMgrId,
    undefined,
    new Set(["MA-YAK-GRANT"]),
  );
  const yakGrant = grantManagers.find((m) => m.managerId === MGR_YAKUBOVA);
  assert.ok(yakGrant, "грантовый внешний менеджер остаётся");
  assert.equal(yakGrant!.isExternal, true);
}

console.log("external-managers-view.test.ts: ok");
