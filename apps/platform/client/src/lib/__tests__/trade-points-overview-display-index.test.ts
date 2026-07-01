import { describe, expect, it } from "vitest";
import type { TradePointsOverviewRopGroup } from "@/lib/trade-points-overview-api";
import {
  buildTradePointsOverviewDisplayIndex,
  filterManagersToTradePointsOverview,
  formatOverviewScopedCount,
  unionCatalogManagersWithOverviewCards,
} from "@/lib/trade-points-overview-view-model";
import type { ManagerRowModel } from "@/lib/dealer-base-management-view-model";

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
    expect(index.managerCardsByTeamKey.get(TEAM_ID)?.map((c) => c.userId)).toEqual([
      "mgr-yak-uuid",
      "mgr-orl-uuid",
    ]);
  });

  it("managerCardsByTeamKey includes overview managers absent from catalog", () => {
    const grantOnlyGroup: TradePointsOverviewRopGroup = {
      ...overviewGroup,
      managers: [
        ...overviewGroup.managers,
        {
          userId: "0481a81d-160b-422e-8257-cf21d134cd42",
          fullName: "Якубова Юлия Сергеевна",
          tradePoints: 82,
          clientsWithTp: 82,
          cities: 3,
          withoutPhoto: 0,
          notFilled: 0,
        },
      ],
      managerCount: 3,
    };
    const index = buildTradePointsOverviewDisplayIndex([grantOnlyGroup], null, () => undefined);
    const cards = index.managerCardsByTeamKey.get(TEAM_ID);
    expect(cards?.some((c) => c.userId === "0481a81d-160b-422e-8257-cf21d134cd42")).toBe(true);
    expect(cards?.find((c) => c.userId === "0481a81d-160b-422e-8257-cf21d134cd42")?.clientsWithTp).toBe(82);
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

  it("unionCatalogManagersWithOverviewCards adds overview-only managers without duplicates", () => {
    const catalogManagers: ManagerRowModel[] = [
      {
        managerId: "mgr-a",
        name: "Менеджер A",
        teamId: TEAM_ID,
        active: 10,
        potential: 0,
        attention: 0,
        outlets: 5,
        topSegmentLabel: "—",
        rows: [],
        isExternal: false,
      },
    ];
    const index = buildTradePointsOverviewDisplayIndex(
      [
        {
          ...overviewGroup,
          managers: [
            { userId: "mgr-a", fullName: "Менеджер A", tradePoints: 5, clientsWithTp: 10, cities: 1, withoutPhoto: 0, notFilled: 0 },
            { userId: "mgr-b-uuid", fullName: "Менеджер B", tradePoints: 20, clientsWithTp: 15, cities: 2, withoutPhoto: 0, notFilled: 0 },
          ],
          managerCount: 2,
        },
      ],
      null,
      () => undefined,
    );
    const merged = unionCatalogManagersWithOverviewCards(catalogManagers, TEAM_ID, {
      overviewReady: true,
      overviewManagerIds: index.managerIdsByTeamKey.get(TEAM_ID),
      managerCardsByTeamKey: index.managerCardsByTeamKey,
    });
    expect(merged.map((m) => m.managerId).sort()).toEqual(["mgr-a", "mgr-b-uuid"]);
    const added = merged.find((m) => m.managerId === "mgr-b-uuid");
    expect(added?.isExternal).toBe(true);
    expect(added?.countsFromServerTotals).toBe(true);
    expect(added?.active).toBe(15);
    expect(added?.outlets).toBe(20);
  });

  it("unionCatalogManagersWithOverviewCards returns catalog unchanged when overview not ready", () => {
    const catalogManagers: ManagerRowModel[] = [
      {
        managerId: "mgr-a",
        name: "Менеджер A",
        teamId: TEAM_ID,
        active: 10,
        potential: 0,
        attention: 0,
        outlets: 5,
        topSegmentLabel: "—",
        rows: [],
        isExternal: false,
      },
      {
        managerId: "rm-extra",
        name: "Региональный",
        teamId: TEAM_ID,
        active: 1,
        potential: 0,
        attention: 0,
        outlets: 0,
        topSegmentLabel: "—",
        rows: [],
        isExternal: false,
      },
    ];
    const index = buildTradePointsOverviewDisplayIndex([overviewGroup], null, () => undefined);
    const result = unionCatalogManagersWithOverviewCards(catalogManagers, TEAM_ID, {
      overviewReady: false,
      overviewManagerIds: index.managerIdsByTeamKey.get(TEAM_ID),
      managerCardsByTeamKey: index.managerCardsByTeamKey,
    });
    expect(result).toEqual(catalogManagers);
  });
});
