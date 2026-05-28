/**
 * Запуск: `npm run test:management-view-model` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";
import type { DealerRow } from "../dealer-base-mock-data";
import {
  aggregateManagersForTeam,
  buildDbAwareManagerMatcher,
  buildRopGroups,
  findManagerInRopGroups,
} from "../dealer-base-management-view-model";

const TEAM = "team-kupiansky";
const MGR_BOYKO = "mgr-boyko-em";
const MGR_YAKUBOVA = "mgr-yakubova-ys";
const UUID_YAKUBOVA = "0481a81d-160b-422e-8257-cf21d134cd42";

const userIdToCatalogMgrId = new Map(Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE));

function row(id: string, partial: Partial<DealerRow> = {}): DealerRow {
  return {
    id,
    releaseCode: partial.releaseCode ?? id,
    name: partial.name ?? id,
    city: partial.city ?? "Город",
    manager: partial.manager ?? "",
    status: partial.status ?? "активный",
    outlets: partial.outlets ?? 1,
    distribution: partial.distribution ?? 50,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: partial.hasRecentActivity ?? true,
    clientCategory: partial.clientCategory ?? "B",
    releaseTeamId: TEAM,
    releaseManagerId: partial.releaseManagerId ?? MGR_BOYKO,
    ...partial,
  } as DealerRow;
}

const teamRows = [
  row("client-seed-boyko", { releaseCode: "CL-001", releaseManagerId: MGR_BOYKO }),
  row("client-reassigned", { releaseCode: "CL-002", releaseManagerId: MGR_BOYKO }),
  row("client-manual", { releaseCode: "", releaseManagerId: MGR_BOYKO, id: "manual-1" }),
];

// Без БД — по seed: оба CL-* у Бойко (+ manual по id fallback)
{
  const managers = aggregateManagersForTeam(TEAM, teamRows);
  const boyko = managers.find((m) => m.managerId === MGR_BOYKO);
  const yakubova = managers.find((m) => m.managerId === MGR_YAKUBOVA);
  assert.ok(boyko);
  assert.equal(boyko!.rows.length, 3);
  assert.equal(yakubova?.rows.length ?? 0, 0);
}

// С БД: CL-002 переназначен на Якубову — не дублируется у Бойко
{
  const responsibleByCode: Record<string, string> = {
    "CL-001": UUID_YAKUBOVA,
    "CL-002": UUID_YAKUBOVA,
  };
  const managers = aggregateManagersForTeam(TEAM, teamRows, null, responsibleByCode, userIdToCatalogMgrId);
  const boyko = managers.find((m) => m.managerId === MGR_BOYKO);
  const yakubova = managers.find((m) => m.managerId === MGR_YAKUBOVA);
  assert.ok(boyko);
  assert.ok(yakubova);
  assert.equal(boyko!.rows.length, 1);
  assert.equal(boyko!.rows[0]!.releaseCode, "");
  assert.equal(yakubova!.rows.length, 2);
  const yakCodes = new Set(yakubova!.rows.map((r) => r.releaseCode?.trim() || r.id));
  assert.ok(yakCodes.has("CL-001"));
  assert.ok(yakCodes.has("CL-002"));
  const union = new Set([...boyko!.rows, ...yakubova!.rows].map((r) => r.id));
  assert.equal(union.size, 3);
}

// БД: UUID не в каталоге — ни один менеджер команды не получает клиента (без fallback на seed)
{
  const unknownUuid = "00000000-0000-4000-8000-000000000099";
  const r = row("client-unknown-mgr", { releaseCode: "CL-UNK", releaseManagerId: MGR_BOYKO });
  const responsibleByCode: Record<string, string> = { "CL-UNK": unknownUuid };
  const matchBoyko = buildDbAwareManagerMatcher(MGR_BOYKO, "Бойко", TEAM, responsibleByCode, userIdToCatalogMgrId);
  const matchYakubova = buildDbAwareManagerMatcher(MGR_YAKUBOVA, "Якубова", TEAM, responsibleByCode, userIdToCatalogMgrId);
  assert.equal(matchBoyko(r), false);
  assert.equal(matchYakubova(r), false);
  const managers = aggregateManagersForTeam(TEAM, [r], null, responsibleByCode, userIdToCatalogMgrId);
  const boyko = managers.find((m) => m.managerId === MGR_BOYKO);
  const yakubova = managers.find((m) => m.managerId === MGR_YAKUBOVA);
  assert.equal(boyko?.rows.length ?? 0, 0);
  assert.equal(yakubova?.rows.length ?? 0, 0);
}

// БД: нет записи для code — fallback на seed (Бойко)
{
  const r = row("client-seed-only", { releaseCode: "CL-SEED", releaseManagerId: MGR_BOYKO });
  const responsibleByCode: Record<string, string> = { "CL-OTHER": UUID_YAKUBOVA };
  const matchBoyko = buildDbAwareManagerMatcher(MGR_BOYKO, "Бойко", TEAM, responsibleByCode, userIdToCatalogMgrId);
  assert.equal(matchBoyko(r), true);
}

// org snapshot: manager SalesUser.id = UUID, responsibleByCode → catalog mgr
{
  const boykoUuid = Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE).find(([, v]) => v === MGR_BOYKO)?.[0];
  assert.ok(boykoUuid);
  const r = row("client-boyko-uuid-mgr", { releaseCode: "MA-BOYKO-1", releaseManagerId: "" });
  const responsibleByCode: Record<string, string> = { "MA-BOYKO-1": boykoUuid! };
  const snap = {
    me: { id: boykoUuid },
    teams: [{ id: TEAM, name: "Купянский", ropUserId: "rop-1", ropName: "Купянский" }],
    users: [
      { id: boykoUuid, fullName: "Бойко Екатерина Михайловна", role: "manager", teamId: TEAM },
    ],
  } as import("@/lib/use-org-snapshot").OrgSnapshot;
  const managers = aggregateManagersForTeam(TEAM, [r], snap, responsibleByCode, userIdToCatalogMgrId);
  const boyko = managers.find((m) => m.managerId === MGR_BOYKO);
  assert.ok(boyko);
  assert.equal(boyko!.active, 1);
}

// buildRopGroups + findManagerInRopGroups: те же id клиентов, что у aggregateManagersForTeam
{
  const responsibleByCode: Record<string, string> = {
    "CL-001": UUID_YAKUBOVA,
    "CL-002": UUID_YAKUBOVA,
  };
  const teams = [{ teamId: TEAM, ropName: "Купянский" }];
  const groups = buildRopGroups(teamRows, teams, null, responsibleByCode, userIdToCatalogMgrId);
  const boyko = findManagerInRopGroups(groups, { managerCatalogId: MGR_BOYKO, teamId: TEAM });
  const yakubova = findManagerInRopGroups(groups, { managerCatalogId: MGR_YAKUBOVA, teamId: TEAM });
  assert.ok(boyko);
  assert.ok(yakubova);
  assert.equal(boyko!.manager.rows.length, 1);
  assert.equal(boyko!.manager.rows[0]!.id, "manual-1");
  assert.equal(yakubova!.manager.rows.length, 2);
  const yakIds = new Set(yakubova!.manager.rows.map((r) => r.id));
  assert.ok(yakIds.has("client-seed-boyko"));
  assert.ok(yakIds.has("client-reassigned"));
}

console.log("dealer-base-management-view-model.test.ts: OK");
