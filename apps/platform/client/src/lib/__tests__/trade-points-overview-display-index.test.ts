import { describe, expect, it } from "vitest";
import type { TradePointsOverviewRopGroup } from "@/lib/trade-points-overview-api";
import {
  buildTradePointsOverviewDisplayIndex,
  filterManagersToTradePointsOverview,
  formatOverviewScopedCount,
} from "@/lib/trade-points-overview-view-model";

const TEAM_ID = "team-kup";

const overviewGroup: TradePointsOverviewRopGroup = {
  teamId: TEAM_ID,
  teamName: "Купянский",
  ropUserId: "rop-uuid",
  ropFullName: "Купянский Родион",
  managerCount: 2,
  tradePoints: 279,
  clientsWithTp: 279,
  cities: 10,
  withoutPhoto: 0,
  notFilled: 0,
  managers: [
    {
      userId: "mgr-yak-uuid",
      fullName: "Якубова",
      tradePoints: 177,
      clientsWithTp: 177,
      cities: 5,
      withoutPhoto: 0,
      notFilled: 0,
    },
    {
      userId: "mgr-orl-uuid",
      fullName: "Орлов",
      tradePoints: 102,
      clientsWithTp: 102,
      cities: 4,
      withoutPhoto: 0,
      notFilled: 0,
    },
  ],
};

describe("trade-points overview display index", () => {
  it("indexes manager clients/TP and team aggregates from overview", () => {
    const catalog = new Map([["mgr-yak-uuid", "mgr-yak-catalog"], ["mgr-orl-uuid", "mgr-orl-catalog"]]);
    const index = buildTradePointsOverviewDisplayIndex([overviewGroup], null, (id) => catalog.get(id));

    expect(index.clientsByManagerId.get("mgr-yak-catalog")).toBe(177);
    expect(index.tradePointsByManagerId.get("mgr-orl-catalog")).toBe(102);
    expect(index.clientsByTeamKey.get(TEAM_ID)).toBe(279);
    expect(index.tradePointsByTeamKey.get(TEAM_ID)).toBe(279);
    expect(index.managerCountByTeamKey.get(TEAM_ID)).toBe(2);
    expect(index.managerIdsByTeamKey.get(TEAM_ID)?.has("mgr-yak-catalog")).toBe(true);
    expect(index.managerIdsByTeamKey.get(TEAM_ID)?.has("rm-melnik")).toBe(false);
  });

  it("filterManagersToTradePointsOverview hides regional managers absent from overview", () => {
    const managers = [
      { managerId: "mgr-yak-catalog", name: "Якубова" },
      { managerId: "rm-melnik", name: "Мельник" },
    ];
    const ids = new Set(["mgr-yak-catalog", "mgr-orl-catalog"]);

    expect(filterManagersToTradePointsOverview(managers, ids, true)).toEqual([managers[0]]);
    expect(filterManagersToTradePointsOverview(managers, ids, false)).toEqual(managers);
  });

  it("formatOverviewScopedCount gates loading and fallback", () => {
    expect(formatOverviewScopedCount(null, { loading: true, ready: false })).toBe("…");
    expect(formatOverviewScopedCount(177, { loading: false, ready: true })).toBe("177");
    expect(formatOverviewScopedCount(null, { loading: false, ready: false, fallback: 113 })).toBe("113");
  });
});
