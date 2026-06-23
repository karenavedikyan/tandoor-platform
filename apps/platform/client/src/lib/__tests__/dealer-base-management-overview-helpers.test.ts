import { describe, expect, it } from "vitest";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import {
  buildOverviewCityCardsFromDb,
  computeUnstatusedCatalogClients,
  mergeOverviewClientCountsIntoRopGroups,
  resolveClientKpisFromOverview,
  type RopGroupModel,
} from "@/lib/dealer-base-management-view-model";

const overviewStructure: ClientBaseOverview = {
  success: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  structure: {
    activeClients: 1035,
    tradePoints: 248,
    potentialClients: 2,
    attentionClients: 122,
    averageDistributionPct: 14,
    avgTpPerClient: 0.24,
    managersWithClientsWithoutTp: 20,
    citiesWithClientsWithoutTp: 238,
  },
  topActiveClients: [],
  cities: [
    { city: "Краснодар", clients: 73, tradePoints: 9 },
    { city: null, clients: 5, tradePoints: 1 },
    { city: "Пустой", clients: 0, tradePoints: 0 },
  ],
  withoutCity: { clients: 10, tradePoints: 2 },
  ropGroups: [
    {
      ropUserId: "rop-1",
      ropFullName: "РОП Тест",
      teamId: "team-a",
      teamName: "Команда A",
      clients: 100,
      tradePoints: 20,
      potential: 3,
      attention: 4,
      managerCount: 1,
      managersWithEmptyBase: 0,
      managers: [
        {
          userId: "mgr-catalog-1",
          fullName: "Менеджер",
          active: 50,
          tradePoints: 10,
          segment: null,
          potential: 1,
          attention: 2,
        },
      ],
    },
  ],
};

describe("dealer-base management overview helpers", () => {
  it("resolveClientKpisFromOverview uses DB structure when overview is present", () => {
    const local = { active: 0, potential: 0, attention: 0 };
    expect(resolveClientKpisFromOverview(overviewStructure, local)).toEqual({
      active: 1035,
      potential: 2,
      attention: 122,
    });
  });

  it("resolveClientKpisFromOverview falls back to local structure when overview is null", () => {
    const local = { active: 11, potential: 22, attention: 33 };
    expect(resolveClientKpisFromOverview(null, local)).toEqual(local);
  });

  it("computeUnstatusedCatalogClients reconciles total with active and potential", () => {
    expect(computeUnstatusedCatalogClients(2850, 1035, 2)).toBe(1813);
    expect(1035 + 2 + 1813).toBe(2850);
  });

  it("buildOverviewCityCardsFromDb filters null and zero-client cities", () => {
    const cards = buildOverviewCityCardsFromDb(overviewStructure);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.displayName).toBe("Краснодар");
    expect(cards[0]?.activeClients).toBe(73);
  });

  it("mergeOverviewClientCountsIntoRopGroups applies client counts from overview", () => {
    const catalogGroups: RopGroupModel[] = [
      {
        teamId: "team-a",
        ropName: "Команда A",
        managers: [
          {
            managerId: "mgr-catalog-1",
            name: "Менеджер",
            teamId: "team-a",
            active: 0,
            potential: 0,
            attention: 0,
            outlets: 5,
            topSegmentLabel: "—",
            rows: [],
            isExternal: false,
          },
        ],
        active: 0,
        potential: 0,
        attention: 0,
        outlets: 5,
        managerCatalogCount: 1,
        statusLine: "",
        rows: [],
      },
    ];

    const merged = mergeOverviewClientCountsIntoRopGroups(
      catalogGroups,
      overviewStructure.ropGroups,
      null,
      new Map(),
    );

    expect(merged[0]?.active).toBe(100);
    expect(merged[0]?.potential).toBe(3);
    expect(merged[0]?.attention).toBe(4);
    expect(merged[0]?.managers[0]?.active).toBe(50);
    expect(merged[0]?.managers[0]?.potential).toBe(1);
    expect(merged[0]?.managers[0]?.attention).toBe(2);
    expect(merged[0]?.outlets).toBe(5);
  });
});
