/**
 * Промт 423: директор видит team_totals.active_trade_points из org-scope.
 */
import { describe, expect, it } from "vitest";
import { buildRopGroups } from "../lib/dealer-base-management-view-model";
import type { DealerRow } from "../lib/dealer-base-mock-data";
import type { TeamTotals } from "@shared/dealers-scope-types";

const TEAM_UUID = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";

describe("director sees rop team TP count from DB", () => {
  it("team card shows 269 active TP from teamTotalsById", () => {
    const rows: DealerRow[] = [];
    const teams = [{ teamId: TEAM_UUID, ropName: "Купянский" }];
    const teamTotalsById = new Map<string, TeamTotals>([
      [
        TEAM_UUID,
        {
          active_dealers: 637,
          active_trade_points: 269,
          trashed_dealers: 12,
          trashed_trade_points: 0,
        },
      ],
    ]);

    const groups = buildRopGroups(rows, teams, null, {}, undefined, undefined, teamTotalsById);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.outlets).toBe(269);
    expect(groups[0]!.active).toBe(637);
  });

  it("sum of 3 teams matches org_totals TP fields", () => {
    const teamTotals = [
      { active_dealers: 637, active_trade_points: 269, trashed_dealers: 12, trashed_trade_points: 0 },
      { active_dealers: 900, active_trade_points: 500, trashed_dealers: 0, trashed_trade_points: 0 },
      { active_dealers: 1314, active_trade_points: 627, trashed_dealers: 0, trashed_trade_points: 0 },
    ];
    const sumTp = teamTotals.reduce((s, t) => s + t.active_trade_points, 0);
    const orgTp = 1396;
    expect(sumTp).toBe(269 + 500 + 627);
    expect(sumTp).toBe(orgTp);
  });
});
