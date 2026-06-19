/**
 * Промт 423: РОП видит ТТ менеджера из БД (team-scope totals).
 */
import { describe, expect, it } from "vitest";
import { aggregateManagersForTeam } from "../lib/dealer-base-management-view-model";
import type { DealerRow } from "../lib/dealer-base-mock-data";
import type { MemberTotals } from "@shared/dealers-scope-types";
import { getTeamManagers } from "../lib/sales-control-data";

describe("rop sees manager TP count from DB", () => {
  it("manager card shows 33 active TP from membersTotalsById", () => {
    const demoMgr = getTeamManagers("team-kupiansky")[0]!;
    expect(demoMgr).toBeDefined();

    const teamRows: DealerRow[] = [
      {
        id: "client-x",
        name: "Client",
        status: "активный",
        outlets: 79,
        releaseManagerId: demoMgr.id,
        releaseTeamId: "team-kupiansky",
      } as DealerRow,
    ];

    const membersTotalsById = new Map<string, MemberTotals>([
      [
        demoMgr.id,
        {
          active_dealers: 54,
          active_trade_points: 33,
          trashed_dealers: 0,
          trashed_trade_points: 0,
        },
      ],
    ]);

    const managers = aggregateManagersForTeam(
      "team-kupiansky",
      teamRows,
      null,
      {},
      undefined,
      membersTotalsById,
    );

    const mgr = managers.find((m) => m.managerId === demoMgr.id);
    expect(mgr?.outlets).toBe(33);
    expect(mgr?.active).toBe(54);
  });
});
