/**
 * Запуск: vitest run client/src/lib/__tests__/dealer-archive-scope.test.ts
 */
import { describe, expect, it } from "vitest";
import { buildArchiveScopeFilterRbac } from "@shared/trash-archive-rbac";

describe("dealer-archive-scope", () => {
  it("manager restricts to ownCodes", () => {
    const f = buildArchiveScopeFilterRbac({
      role: "manager",
      assignmentsScope: { ownCodes: new Set(["MA-145427"]), teamCodes: new Set() },
      teamContext: { teamId: "t1", teamMemberIds: ["m1"], teamCodes: [] },
    });
    expect(f.isDealerInScope("client-ma-ma145427", { ownerCode: "MA-145427" })).toBe(true);
    expect(f.isDealerInScope("client-ma-ma000999", { ownerCode: "MA-000999" })).toBe(false);
  });

  it("admin fullView", () => {
    const f = buildArchiveScopeFilterRbac({
      role: "admin",
      assignmentsScope: undefined,
      teamContext: { teamId: null, teamMemberIds: [], teamCodes: [] },
    });
    expect(f.fullView).toBe(true);
  });
});
