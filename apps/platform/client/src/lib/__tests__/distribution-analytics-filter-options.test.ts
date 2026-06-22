/**
 * Промт 441-fix3: filter options from scopedDealers bypass scope guard.
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildDistributionAnalyticsFilterOptionsFromDealers,
  DISTRIBUTION_ANALYTICS_FILTER_OPTIONS_MAX_DEALERS,
} from "@/lib/distribution-analytics/distribution-analytics-filter-options";

function makeDealer(partial: Partial<DealerRow> & Pick<DealerRow, "id" | "name">): DealerRow {
  return {
    city: "Казань",
    region: "ПФО",
    manager: "Иванов",
    regionalManager: "Петров",
    ropName: "Сидоров",
    releaseCode: "MA0001",
    tradePoints: [
      {
        id: "tp-1",
        name: "ТТ Центр",
        city: "Казань",
        address: "",
        format: "",
        status: "",
        equipment: "",
        hardwareStockStatus: "",
        doorsStockStatus: "",
        distribution: { mk: 0, vh: 0, total: 0 },
        showcaseStatus: "",
        showcaseNeeds: "",
        lastVisitDate: "",
        nextVisitDate: "",
        responsibleRegionalManager: "",
      },
    ],
    ...partial,
  } as DealerRow;
}

describe("buildDistributionAnalyticsFilterOptionsFromDealers (441-fix3)", () => {
  it("builds geography and client options from dealer scope", () => {
    const options = buildDistributionAnalyticsFilterOptionsFromDealers([
      makeDealer({ id: "d1", name: "Дилер 1" }),
      makeDealer({
        id: "d2",
        name: "Дилер 2",
        city: "Москва",
        region: "ЦФО",
        releaseCode: "MA0002",
        tradePoints: [
          {
            id: "tp-2",
            name: "ТТ 2",
            city: "Москва",
            address: "",
            format: "",
            status: "",
            equipment: "",
            hardwareStockStatus: "",
            doorsStockStatus: "",
            distribution: { mk: 0, vh: 0, total: 0 },
            showcaseStatus: "",
            showcaseNeeds: "",
            lastVisitDate: "",
            nextVisitDate: "",
            responsibleRegionalManager: "",
          },
        ],
      }),
    ]);

    expect(options.cityOptions.map((o) => o.value)).toEqual(expect.arrayContaining(["Казань", "Москва"]));
    expect(options.regionOptions.map((o) => o.value)).toEqual(expect.arrayContaining(["ПФО", "ЦФО"]));
    expect(options.dealerOptions).toHaveLength(2);
    expect(options.tradePointOptions).toHaveLength(2);
    expect(options.managerOptions[0]?.value).toBe("mgr:Иванов");
  });

  it("returns empty options when dealer count exceeds max threshold", () => {
    const dealers = Array.from({ length: DISTRIBUTION_ANALYTICS_FILTER_OPTIONS_MAX_DEALERS + 1 }, (_, i) =>
      makeDealer({ id: `d-${i}`, name: `D${i}` }),
    );
    const options = buildDistributionAnalyticsFilterOptionsFromDealers(dealers);
    expect(options.cityOptions).toEqual([]);
    expect(options.dealerOptions).toEqual([]);
  });

  it("builds options for director-scale scope below max threshold", () => {
    const dealers = Array.from({ length: 801 }, (_, i) =>
      makeDealer({
        id: `dealer-${i}`,
        name: `Dealer ${i}`,
        city: i % 2 === 0 ? "Москва" : "Казань",
        region: i % 2 === 0 ? "ЦФО" : "ПФО",
        releaseCode: `MA${String(i).padStart(4, "0")}`,
        tradePoints: [
          {
            id: `tp-${i}`,
            name: `ТТ ${i}`,
            city: i % 2 === 0 ? "Москва" : "Казань",
            address: "",
            format: "",
            status: "",
            equipment: "",
            hardwareStockStatus: "",
            doorsStockStatus: "",
            distribution: { mk: 0, vh: 0, total: 0 },
            showcaseStatus: "",
            showcaseNeeds: "",
            lastVisitDate: "",
            nextVisitDate: "",
            responsibleRegionalManager: "",
          },
        ],
      }),
    );
    const options = buildDistributionAnalyticsFilterOptionsFromDealers(dealers);
    expect(options.cityOptions.length).toBeGreaterThan(0);
    expect(options.regionOptions.length).toBeGreaterThan(0);
    expect(options.dealerOptions).toHaveLength(801);
    expect(options.tradePointOptions).toHaveLength(801);
  });
});
