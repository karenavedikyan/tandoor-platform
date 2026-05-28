/**
 * Запуск: `npm run test:assignments-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  assignmentsScopeIsActive,
  roleScopedDealerRowsForReal,
  type AssignmentsScope,
} from "../dealer-base-real-scope";
import type { DealerRow } from "../dealer-base-mock-data";
import type { OrgSnapshot } from "../use-org-snapshot";

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
    releaseTeamId: partial.releaseTeamId ?? "team-x",
    releaseManagerId: partial.releaseManagerId ?? "mgr-x",
    ...partial,
  } as DealerRow;
}

const rows = [row("c1"), row("c2"), row("c3")];

const managerSnap = {
  me: { id: "mgr-uuid-1", role: "manager", fullName: "Тестов Менеджер", teamId: "team-uuid" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [{ id: "mgr-uuid-1", fullName: "Тестов Менеджер", role: "manager", teamId: "team-uuid" }],
} as unknown as OrgSnapshot;

const ropSnap = {
  me: { id: "rop-uuid-1", role: "rop", fullName: "Тестов РОП", teamId: "team-uuid" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [{ id: "team-uuid", name: "Команда", ropUserId: "rop-uuid-1", ropName: "РОП" }],
  users: [],
} as unknown as OrgSnapshot;

const directorSnap = {
  me: { id: "dir-uuid", role: "director", fullName: "Директор", teamId: null },
  visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [],
} as unknown as OrgSnapshot;

const scope: AssignmentsScope = {
  ownCodes: new Set(["c1", "c2"]),
  teamCodes: new Set([]),
};

{
  assert.equal(assignmentsScopeIsActive(scope), true);
  const out = roleScopedDealerRowsForReal(rows, managerSnap, "sales_manager", undefined, scope);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((r) => r.id).sort(),
    ["c1", "c2"],
  );
}

{
  const teamScope: AssignmentsScope = {
    ownCodes: new Set(["c2"]),
    teamCodes: new Set(["c1", "c3"]),
  };
  const out = roleScopedDealerRowsForReal(rows, ropSnap, "team_lead", undefined, teamScope);
  assert.equal(out.length, 3);
}

{
  const out = roleScopedDealerRowsForReal(rows, directorSnap, "sales_director", undefined, scope);
  assert.equal(out.length, 3, "director: assignments scope does not narrow rows");
}

{
  const noMatch = roleScopedDealerRowsForReal(
    [row("x1", { releaseManagerId: "other-uuid", manager: "Другой Человек" })],
    managerSnap,
    "sales_manager",
  );
  assert.equal(noMatch.length, 0, "fallback without assignments: no id/name match");
}

{
  const uuidMatch = roleScopedDealerRowsForReal(
    [row("x2", { releaseManagerId: "mgr-uuid-1" })],
    managerSnap,
    "sales_manager",
  );
  assert.equal(uuidMatch.length, 1, "fallback: UUID match on releaseManagerId");
}

{
  assert.equal(assignmentsScopeIsActive(undefined), false);
  assert.equal(
    assignmentsScopeIsActive({ ownCodes: new Set(), teamCodes: new Set() }),
    false,
  );
}

// Промт 70.1: scope матчит catalog code (releaseCode), не slug id.
{
  const codeRows = [
    row("client-ma-ma036881", { releaseCode: "MA-MA036881" }),
    row("client-000000027", { releaseCode: "000000027" }),
    row("client-some-other", { releaseCode: "MA-OTHER" }),
  ];
  const codeScope: AssignmentsScope = {
    ownCodes: new Set(["MA-MA036881", "000000027"]),
    teamCodes: new Set(),
  };
  const out = roleScopedDealerRowsForReal(codeRows, managerSnap, "sales_manager", undefined, codeScope);
  assert.deepEqual(
    out.map((r) => r.releaseCode).sort(),
    ["000000027", "MA-MA036881"],
    "matches by releaseCode when id differs from client_assignments.client_code",
  );
  assert.equal(out.length, 2);
  const byIdOnly = roleScopedDealerRowsForReal(codeRows, managerSnap, "sales_manager", undefined, {
    ownCodes: new Set(["client-ma-ma036881"]),
    teamCodes: new Set(),
  });
  assert.equal(byIdOnly.length, 1, "id-only scope still works as fallback");
}

console.log("dealer-base-real-scope-assignments: ok");
