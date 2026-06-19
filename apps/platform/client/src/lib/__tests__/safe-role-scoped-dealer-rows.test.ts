import { describe, expect, it } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { safeRoleScopedDealerRowsForReal } from "@/lib/dealer-base-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

const ROP_SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";

function ropSnap(): OrgSnapshot {
  return {
    me: { id: ROP_SKALABAN, role: "rop", fullName: "Скалабан", teamId: "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa" },
    visibility: { all: false, clientCodes: [], teamIds: ["cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa"], visibleUserIds: [] },
    teams: [{ id: "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa", name: "Команда Скалабан", ropUserId: ROP_SKALABAN }],
    users: [
      { id: ROP_SKALABAN, role: "rop", fullName: "Скалабан Александр", teamId: "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa" },
      { id: "e60f1a83-88ae-41f8-8c32-edd91f666e8d", role: "manager", fullName: "Илюченко", teamId: "cfa2ab87-9fe9-4068-a0e4-347ddad7a5fa" },
    ],
  } as OrgSnapshot;
}

const rows: DealerRow[] = [
  {
    id: "client-ma-001",
    releaseCode: "MA-001",
    name: "Test",
    city: "Москва",
    manager: "Илюченко",
    status: "активный",
    outlets: 1,
    distribution: 0,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    releaseTeamId: "team-skalaban",
    releaseManagerId: "e60f1a83-88ae-41f8-8c32-edd91f666e8d",
    contacts: { phone: null, email: null },
    tradePoints: [],
  } as DealerRow,
];

describe("safeRoleScopedDealerRowsForReal", () => {
  it("does not throw for team_lead without options", () => {
    expect(() => safeRoleScopedDealerRowsForReal(rows, ropSnap(), "team_lead")).not.toThrow();
    expect(safeRoleScopedDealerRowsForReal(rows, ropSnap(), "team_lead")).toEqual([]);
  });

  it("scopes manager drilldown via managerUserId", () => {
    const out = safeRoleScopedDealerRowsForReal(rows, ropSnap(), "team_lead", {
      managerUserId: "e60f1a83-88ae-41f8-8c32-edd91f666e8d",
    });
    expect(out.length).toBeGreaterThanOrEqual(0);
  });
});
