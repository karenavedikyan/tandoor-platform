/**
 * Промт 398: RBAC корзины и архива.
 * Запуск: vitest run shared/__tests__/trash-archive-rbac.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  buildArchiveScopeFilterRbac,
  buildTrashScopeFilterRbac,
  type TeamContext,
} from "./trash-archive-rbac.js";

const TEAM_A = "team-a";
const MGR_SELF = "mgr-self";
const MGR_OTHER = "mgr-other";
const ROP_ID = "rop-1";

const teamContextRop: TeamContext = {
  teamId: TEAM_A,
  teamMemberIds: [MGR_SELF, MGR_OTHER, ROP_ID],
  teamCodes: ["MA-001", "MA-002"],
};

describe("trash RBAC", () => {
  it("manager sees only own trashedBy", () => {
    const f = buildTrashScopeFilterRbac({
      role: "manager",
      userId: MGR_SELF,
      teamContext: { teamId: TEAM_A, teamMemberIds: [MGR_SELF], teamCodes: [] },
    });
    expect(f.fullView).toBe(false);
    expect(f.isDealerInScope("x", { trashedBy: MGR_SELF })).toBe(true);
    expect(f.isDealerInScope("x", { trashedBy: MGR_OTHER })).toBe(false);
  });

  it("rop sees team members and ownerTeamAtTrash", () => {
    const f = buildTrashScopeFilterRbac({ role: "rop", userId: ROP_ID, teamContext: teamContextRop });
    expect(f.isDealerInScope("x", { trashedBy: MGR_SELF })).toBe(true);
    expect(f.isDealerInScope("x", { trashedBy: MGR_OTHER })).toBe(true);
    expect(f.isDealerInScope("x", { ownerTeamAtTrash: TEAM_A, trashedBy: "foreign-user" })).toBe(true);
    expect(f.isDealerInScope("x", { trashedBy: "foreign-user", ownerTeamAtTrash: "team-other" })).toBe(false);
  });

  it("regional_manager behaves like rop", () => {
    const f = buildTrashScopeFilterRbac({
      role: "regional_manager",
      userId: ROP_ID,
      teamContext: teamContextRop,
    });
    expect(f.isDealerInScope("x", { trashedBy: MGR_SELF })).toBe(true);
    expect(f.isDealerInScope("x", { trashedBy: "outsider", ownerTeamAtTrash: "team-z" })).toBe(false);
  });

  it("director and admin fullView", () => {
    for (const role of ["admin", "director"] as const) {
      const f = buildTrashScopeFilterRbac({ role, userId: "x", teamContext: teamContextRop });
      expect(f.fullView).toBe(true);
    }
  });

  it("manager team change: old ROP sees ownerTeamAtTrash, new ROP does not", () => {
    const oldRop = buildTrashScopeFilterRbac({
      role: "rop",
      userId: "rop-old",
      teamContext: { teamId: "team-old", teamMemberIds: ["rop-old"], teamCodes: [] },
    });
    const newRop = buildTrashScopeFilterRbac({
      role: "rop",
      userId: "rop-new",
      teamContext: { teamId: "team-new", teamMemberIds: ["rop-new"], teamCodes: [] },
    });
    const meta = { trashedBy: MGR_SELF, ownerTeamAtTrash: "team-old" };
    expect(oldRop.isDealerInScope("x", meta)).toBe(true);
    expect(newRop.isDealerInScope("x", meta)).toBe(false);
  });
});

describe("archive RBAC", () => {
  it("manager archive by ownerCode in ownCodes", () => {
    const f = buildArchiveScopeFilterRbac({
      role: "manager",
      assignmentsScope: { ownCodes: new Set(["MA-001"]), teamCodes: new Set() },
      teamContext: { teamId: TEAM_A, teamMemberIds: [MGR_SELF], teamCodes: [] },
    });
    expect(f.isDealerInScope("client-ma-001", { ownerCode: "MA-001" })).toBe(true);
    expect(f.isDealerInScope("client-ma-999", { ownerCode: "MA-999" })).toBe(false);
  });

  it("rop archive by teamCodes and ownerTeamAtArchive", () => {
    const f = buildArchiveScopeFilterRbac({
      role: "rop",
      assignmentsScope: { ownCodes: new Set(), teamCodes: new Set(["MA-001"]) },
      teamContext: teamContextRop,
    });
    expect(f.isDealerInScope("client-ma-001", { ownerCode: "MA-001" })).toBe(true);
    expect(f.isDealerInScope("client-ma-999", { ownerTeamAtArchive: TEAM_A })).toBe(true);
    expect(f.isDealerInScope("client-ma-999", { ownerTeamAtArchive: "team-other" })).toBe(false);
  });
});
