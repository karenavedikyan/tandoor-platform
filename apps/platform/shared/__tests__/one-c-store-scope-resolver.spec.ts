import { describe, expect, it } from "vitest";
import { buildReverseNameLookup } from "../one-c-name-matching.js";
import type { LkUserRow, OneCShowroomContext, TeamRow } from "../one-c-showroom-context.js";
import { resolveOneCStoreScope } from "../one-c-store-scope-resolver.js";

const TEAM_ID = "team-kup";
const ROP_ID = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const RM_SEREBRYAKOV_ID = "rm-serebryakov";
const MGR_AVETISYAN_ID = "mgr-avetisyan";

function makeCtx(overrides: {
  userIdByRegionalName?: Map<string, string>;
  userIdByResponsibleName?: Map<string, string>;
  users?: LkUserRow[];
  teams?: TeamRow[];
}): OneCShowroomContext {
  const users: LkUserRow[] = overrides.users ?? [
    {
      id: ROP_ID,
      full_name: "Купянский Родион",
      phone: null,
      email: null,
      role: "rop",
      role_in_team: "rop",
      team_id: TEAM_ID,
    },
    {
      id: RM_SEREBRYAKOV_ID,
      full_name: "Серебряков Юрий",
      phone: null,
      email: null,
      role: "regional_manager",
      role_in_team: "regional_manager",
      team_id: TEAM_ID,
    },
    {
      id: MGR_AVETISYAN_ID,
      full_name: "Аветисян Рачик",
      phone: null,
      email: null,
      role: "manager",
      role_in_team: "manager",
      team_id: TEAM_ID,
    },
  ];
  const teams: TeamRow[] = overrides.teams ?? [
    { id: TEAM_ID, name: "Купянский", rop_user_id: ROP_ID },
  ];
  const usersById = new Map(users.map((u) => [u.id, u]));
  const rmUsers = users.filter((u) => u.role_in_team === "regional_manager");
  const mgrUsers = users.filter((u) => u.role_in_team === "manager");
  const regionalNames = ["Серебряков Юрий Витальевич", "Мельник Владимир Викторович"];
  const responsibleNames = ["Аветисян Рачик Сергеевич"];

  return {
    teams,
    usersById,
    membershipsByTeam: new Map([[TEAM_ID, users]]),
    regionalNames,
    responsibleNames,
    matchedRegionalByUserId: new Map(),
    matchedResponsibleByUserId: new Map(),
    userIdByRegionalName:
      overrides.userIdByRegionalName ??
      buildReverseNameLookup(rmUsers, regionalNames),
    userIdByResponsibleName:
      overrides.userIdByResponsibleName ??
      buildReverseNameLookup(mgrUsers, responsibleNames),
    activeManagerMatchedNames: [],
    activeRmMatchedNames: [],
    activeFilterNames: [],
    legalById: new Map(),
    storeRows: [],
    storesTotal: 0,
    legalsTotal: 0,
    last_imported_at: null,
  };
}

describe("resolveOneCStoreScope", () => {
  it("fuzzy regional match resolves ROP via regional manager team", () => {
    const ctx = makeCtx({});
    const result = resolveOneCStoreScope(
      {
        legal_regional_manager_name: "Серебряков Юрий Витальевич",
        legal_responsible_manager_name: null,
        parent_regional_manager_name: null,
        parent_responsible_manager_name: null,
      },
      ctx,
    );
    expect(result.regional_manager_user_id).toBe(RM_SEREBRYAKOV_ID);
    expect(result.rop_user_id).toBe(ROP_ID);
    expect(result.rop_name).toBe("Купянский Родион");
  });

  it("falls back to responsible manager when regional name has no user match", () => {
    const ctx = makeCtx({});
    const result = resolveOneCStoreScope(
      {
        legal_regional_manager_name: "Мельник Владимир Викторович",
        legal_responsible_manager_name: "Аветисян Рачик Сергеевич",
        parent_regional_manager_name: null,
        parent_responsible_manager_name: null,
      },
      ctx,
    );
    expect(result.regional_manager_user_id).toBeNull();
    expect(result.responsible_manager_user_id).toBe(MGR_AVETISYAN_ID);
    expect(result.rop_user_id).toBe(ROP_ID);
    expect(result.rop_name).toBe("Купянский Родион");
  });

  it("prefers parent legal regional manager over direct legal", () => {
    const ctx = makeCtx({});
    const result = resolveOneCStoreScope(
      {
        legal_regional_manager_name: null,
        legal_responsible_manager_name: null,
        parent_regional_manager_name: "Серебряков Юрий Витальевич",
        parent_responsible_manager_name: null,
      },
      ctx,
    );
    expect(result.effective_regional_manager_name).toBe("Серебряков Юрий Витальевич");
    expect(result.regional_manager_user_id).toBe(RM_SEREBRYAKOV_ID);
    expect(result.rop_user_id).toBe(ROP_ID);
  });

  it("returns null ids when all manager names are empty", () => {
    const ctx = makeCtx({});
    const result = resolveOneCStoreScope(
      {
        legal_regional_manager_name: null,
        legal_responsible_manager_name: null,
        parent_regional_manager_name: null,
        parent_responsible_manager_name: null,
      },
      ctx,
    );
    expect(result.regional_manager_user_id).toBeNull();
    expect(result.responsible_manager_user_id).toBeNull();
    expect(result.rop_user_id).toBeNull();
    expect(result.rop_name).toBeNull();
  });
});
