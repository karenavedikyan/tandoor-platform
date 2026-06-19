/**
 * Промт 423: roleScopedDealerRowsForReal для team_lead/sales_director бросает ошибку.
 */
import { describe, expect, it } from "vitest";
import { roleScopedDealerRowsForReal } from "../lib/dealer-base-real-scope";
import type { OrgSnapshot } from "../lib/use-org-snapshot";

const snap = {
  me: { id: "rop-id", role: "rop", fullName: "ROP", teamId: "team-1" },
  visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
  teams: [{ id: "team-1", name: "T", ropUserId: "rop-id", ropName: "ROP" }],
  users: [],
} as unknown as OrgSnapshot;

describe("no catalog fallback for ROP/director", () => {
  it("team_lead throws", () => {
    expect(() => roleScopedDealerRowsForReal([], snap, "team_lead")).toThrow(
      /useMyTeamScope\/useOrgScope/,
    );
  });

  it("sales_director throws", () => {
    const dirSnap = { ...snap, me: { ...snap.me, role: "director" } } as OrgSnapshot;
    expect(() => roleScopedDealerRowsForReal([], dirSnap, "sales_director")).toThrow(
      /useMyTeamScope\/useOrgScope/,
    );
  });
});
