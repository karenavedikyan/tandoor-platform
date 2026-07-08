import { describe, expect, it } from "vitest";
import {
  type LegalIndexRow,
  type LkUserRow,
  type OneCShowroomContext,
  type StoreIndexRow,
  type TeamRow,
} from "../one-c-showroom-context.js";
import {
  canViewOneCTeamMember,
  legalMatchesScope,
  resolveOneCScope,
  scopeWhereClause,
} from "../one-c-showroom-scope.js";

function makeCtx(): OneCShowroomContext {
  const team1 = "team-1";
  const ropId = "rop-1";
  const rm1Id = "rm-1";
  const mgr1Id = "mgr-1";
  const mgr2Id = "mgr-2";

  const users: LkUserRow[] = [
    {
      id: ropId,
      full_name: "РОП Тест",
      phone: null,
      email: null,
      role: "rop",
      role_in_team: "rop",
      team_id: team1,
    },
    {
      id: rm1Id,
      full_name: "РМ Тест",
      phone: null,
      email: null,
      role: "regional_manager",
      role_in_team: "regional_manager",
      team_id: team1,
    },
    {
      id: mgr1Id,
      full_name: "Менеджер Один",
      phone: null,
      email: null,
      role: "manager",
      role_in_team: "manager",
      team_id: team1,
    },
    {
      id: mgr2Id,
      full_name: "Менеджер Два",
      phone: null,
      email: null,
      role: "manager",
      role_in_team: "manager",
      team_id: team1,
    },
  ];

  const teams: TeamRow[] = [{ id: team1, name: "Команда 1", rop_user_id: ropId }];
  const legals: LegalIndexRow[] = [
    {
      id_1c: "legal-1",
      regional_manager_name: "РМ Тест",
      responsible_manager_name: "Менеджер Один",
    },
  ];
  const storeRows: StoreIndexRow[] = [{ id_1c: "store-1", legal_entity_1c: "legal-1" }];

  const matchedRegionalByUserId = new Map<string, string[]>([[rm1Id, ["РМ Тест"]]]);
  const matchedResponsibleByUserId = new Map<string, string[]>([
    [mgr1Id, ["Менеджер Один"]],
    [mgr2Id, ["Менеджер Два"]],
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const membershipsByTeam = new Map<string, LkUserRow[]>([[team1, users.filter((u) => u.id !== ropId)]]);

  return {
    teams,
    usersById,
    membershipsByTeam,
    regionalNames: ["РМ Тест"],
    responsibleNames: ["Менеджер Один", "Менеджер Два"],
    matchedRegionalByUserId,
    matchedResponsibleByUserId,
    userIdByRegionalName: new Map([["РМ Тест", rm1Id]]),
    userIdByResponsibleName: new Map([
      ["Менеджер Один", mgr1Id],
      ["Менеджер Два", mgr2Id],
    ]),
    activeManagerMatchedNames: ["Менеджер Один", "Менеджер Два"],
    activeRmMatchedNames: ["РМ Тест"],
    activeFilterNames: ["Менеджер Один", "Менеджер Два", "РМ Тест"],
    legalById: new Map(legals.map((l) => [l.id_1c, l])),
    storeRows,
    storesTotal: 1,
    legalsTotal: 1,
    last_imported_at: null,
  };
}

describe("resolveOneCScope", () => {
  const ctx = makeCtx();

  it("admin/director → null-scope", () => {
    expect(resolveOneCScope("admin", "x", ctx)).toEqual({
      responsibleNames: null,
      regionalNames: null,
    });
    expect(resolveOneCScope("director", "x", ctx)).toEqual({
      responsibleNames: null,
      regionalNames: null,
    });
  });

  it("manager → only his responsibleNames", () => {
    expect(resolveOneCScope("manager", "mgr-1", ctx)).toEqual({
      responsibleNames: ["Менеджер Один"],
      regionalNames: [],
    });
  });

  it("rm → regionalNames + subordinate manager responsibleNames", () => {
    const scope = resolveOneCScope("regional_manager", "rm-1", ctx);
    expect(scope.regionalNames).toEqual(["РМ Тест"]);
    expect(scope.responsibleNames).toEqual(["Менеджер Один", "Менеджер Два"]);
  });

  it("rop → team regionalNames + team manager responsibleNames", () => {
    const scope = resolveOneCScope("rop", "rop-1", ctx);
    expect(scope.regionalNames).toEqual(["РМ Тест"]);
    expect(scope.responsibleNames).toEqual(["Менеджер Один", "Менеджер Два"]);
  });

  it("unknown userId → empty scope", () => {
    expect(resolveOneCScope("manager", "missing", ctx)).toEqual({
      responsibleNames: [],
      regionalNames: [],
    });
  });
});

describe("scopeWhereClause", () => {
  it("unrestricted → empty sql", () => {
    expect(scopeWhereClause({ responsibleNames: null, regionalNames: null }, "a", "b", 2)).toEqual({
      sql: "",
      params: [],
    });
  });

  it("empty scope → AND FALSE", () => {
    expect(scopeWhereClause({ responsibleNames: [], regionalNames: [] }, "a", "b", 2)).toEqual({
      sql: " AND FALSE",
      params: [],
    });
  });

  it("builds OR clause with params", () => {
    const { sql, params } = scopeWhereClause(
      { responsibleNames: ["M1"], regionalNames: ["R1"] },
      "l.responsible_manager_name",
      "l.regional_manager_name",
      3,
    );
    expect(sql).toBe(
      " AND (l.responsible_manager_name = ANY($3::text[]) OR l.regional_manager_name = ANY($4::text[]))",
    );
    expect(params).toEqual([["M1"], ["R1"]]);
  });
});

describe("legalMatchesScope", () => {
  it("matches responsible or regional name", () => {
    const scope = { responsibleNames: ["Менеджер Один"], regionalNames: [] as string[] };
    expect(
      legalMatchesScope(
        { responsible_manager_name: "Менеджер Один", regional_manager_name: "РМ Тест" },
        scope,
      ),
    ).toBe(true);
    expect(
      legalMatchesScope(
        { responsible_manager_name: "Чужой", regional_manager_name: "РМ Тест" },
        scope,
      ),
    ).toBe(false);
  });
});

describe("canViewOneCTeamMember", () => {
  const ctx = makeCtx();

  it("manager sees only self", () => {
    expect(canViewOneCTeamMember("manager", "mgr-1", "mgr-1", "manager", ctx)).toBe(true);
    expect(canViewOneCTeamMember("manager", "mgr-1", "mgr-2", "manager", ctx)).toBe(false);
  });

  it("rm sees self and team managers", () => {
    expect(canViewOneCTeamMember("regional_manager", "rm-1", "rm-1", "rm", ctx)).toBe(true);
    expect(canViewOneCTeamMember("regional_manager", "rm-1", "mgr-1", "manager", ctx)).toBe(true);
    expect(canViewOneCTeamMember("regional_manager", "rm-1", "rop-1", "rop", ctx)).toBe(false);
  });

  it("rop sees own team members", () => {
    expect(canViewOneCTeamMember("rop", "rop-1", "rop-1", "rop", ctx)).toBe(true);
    expect(canViewOneCTeamMember("rop", "rop-1", "rm-1", "rm", ctx)).toBe(true);
    expect(canViewOneCTeamMember("rop", "rop-1", "mgr-1", "manager", ctx)).toBe(true);
  });
});
