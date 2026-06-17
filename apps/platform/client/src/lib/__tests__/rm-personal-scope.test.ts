import { describe, expect, it } from "vitest";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope.js";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { OrgSnapshot } from "../use-org-snapshot.js";

function makeRow(id: string, releaseCode: string): DealerRow {
  return {
    id,
    name: `Dealer ${id}`,
    releaseCode,
    manager: "",
    region: "",
    city: "",
    clientCategory: "top500",
    status: "active",
    external1cCode: "",
    releaseTeamId: "team-sapozhkov",
    releaseManagerId: "",
  } as DealerRow;
}

const SNAP = {
  me: { id: "rm-1", role: "regional_manager", teamId: "team-sapozhkov", fullName: "RM-1" },
  teams: [{ id: "team-sapozhkov", ropUserId: "rop-sapozhkov", name: "Sapozhkov" }],
  users: [
    { id: "rm-1", role: "regional_manager", teamId: "team-sapozhkov", fullName: "RM-1" },
    { id: "rop-sapozhkov", role: "rop", teamId: "team-sapozhkov", fullName: "Sapozhkov" },
  ],
  visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
} as unknown as OrgSnapshot;

function scope(ownCodes: string[]) {
  return {
    ownCodes: new Set(ownCodes),
    teamCodes: new Set<string>(),
    grantedCodes: new Set<string>(),
  };
}

describe("Промт 354: RM видит только клиентов своей территории", () => {
  it("ownCodes фильтрует строки по releaseCode", () => {
    const rows = [makeRow("d1", "MA0000001"), makeRow("d2", "MA0000002"), makeRow("d3", "MA0000003")];
    const filtered = roleScopedDealerRowsForReal(
      rows,
      SNAP,
      "sales_manager",
      undefined,
      scope(["MA0000001", "MA0000003"]),
    );
    expect(filtered.map((r) => r.id).sort()).toEqual(["d1", "d3"]);
  });

  it("ownCodes пустой → []", () => {
    const rows = [makeRow("d1", "MA0000001")];
    const filtered = roleScopedDealerRowsForReal(rows, SNAP, "sales_manager", undefined, scope([]));
    expect(filtered).toEqual([]);
  });

  it("assignmentsScope не передан → [] (защитный fallback)", () => {
    const rows = [makeRow("d1", "MA0000001")];
    const filtered = roleScopedDealerRowsForReal(rows, SNAP, "sales_manager", undefined, undefined);
    expect(filtered).toEqual([]);
  });

  it("регистр кода игнорируется", () => {
    const rows = [makeRow("d1", "ma0000001")];
    const filtered = roleScopedDealerRowsForReal(
      rows,
      SNAP,
      "sales_manager",
      undefined,
      scope(["MA0000001"]),
    );
    expect(filtered.map((r) => r.id)).toEqual(["d1"]);
  });

  it("не утекают клиенты другого RM той же команды", () => {
    const rows = [makeRow("d-mine", "MA0000111"), makeRow("d-other-rm-same-team", "MA0000222")];
    const filtered = roleScopedDealerRowsForReal(
      rows,
      SNAP,
      "sales_manager",
      undefined,
      scope(["MA0000111"]),
    );
    expect(filtered.map((r) => r.id)).toEqual(["d-mine"]);
  });
});
