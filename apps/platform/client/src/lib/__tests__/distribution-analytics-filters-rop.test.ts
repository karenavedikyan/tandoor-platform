/**
 * Матчинг фильтра РОП по rop_id из стора dealer-rop-overrides.
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  applyDistributionAnalyticsFilters,
  emptyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  DEALER_ROP_OVERRIDES_STORAGE_KEY,
  type DealerRopOverridesState,
} from "@/lib/dealer-rop-overrides";
import type { MergedTradePointEntry } from "@/lib/dealer-trade-points-overrides";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

const DEALER_X = "dealer-x";
const ROP_1 = "ROP-1";
const ROP_OTHER = "ROP-OTHER";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

function makeRow(dealerId: string, ropLabel: string): TradePointListRow {
  const dealer = {
    id: dealerId,
    name: "Dealer",
    region: "Юг",
    clientCategory: "top150",
  } as DealerRow;
  const point = { id: "tp-1", name: "TP", city: "Краснодар" } as DealerTradePoint;
  return {
    tradePointId: "tp-1",
    dealerId,
    dealer,
    point,
    entry: { point } as MergedTradePointEntry,
    tradePointDisplayCode: "tp-1",
    dealerClientCode: "C1",
    dealerName: "Dealer",
    tradePointName: "TP",
    city: "Краснодар",
    address: "",
    tradePointFormatLabel: null,
    manager: "Иванов",
    regionalManager: "Петров",
    rop: ropLabel,
    clientCategory: "top150",
    clientCategoryLabel: "ТОП 150",
    showcaseBucket: "partial",
    showcaseBucketLabel: "Частично",
    portalsTotal: null,
    modelsOnShowcaseCount: 0,
    matrixDeficitCount: 0,
    showcaseNewTasksCount: 0,
    portalOverfill: false,
    portalsUnfilled: true,
    hasFreePortals: false,
    hasShowcase: true,
    showcaseUpdatedAt: null,
    unloadingOrder: null,
    isArchived: false,
    isVirtual: false,
    searchHaystack: "",
  };
}

function makeAct(dealerId: string): ActualizationState {
  return {
    tradePointShowcaseActualizationById: {
      "tp-1": {
        tradePointId: "tp-1",
        dealerId,
        hasShowcase: true,
        entrancePortals: 1,
        interiorPortals: null,
        hardwareSections: null,
        selectedShowcaseModels: [],
      },
    },
    dealerOverridesById: {
      [dealerId]: {
        fields: {
          ropName: "Скалабан Александр",
        },
      },
    },
  } as unknown as ActualizationState;
}

function saveRopOverrides(state: DealerRopOverridesState): void {
  localStorageMock.setItem(DEALER_ROP_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
}

describe("applyDistributionAnalyticsFilters rop filter", () => {
  beforeEach(() => {
    store.clear();
    // @ts-expect-error test shim
    globalThis.localStorage = localStorageMock;
    // @ts-expect-error test shim
    globalThis.window = {
      localStorage: localStorageMock,
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  it("matches dealer by rop_id from dealer-rop-overrides store when act has only ropName", () => {
    saveRopOverrides({
      byDealerId: {
        [DEALER_X]: {
          userId: ROP_1,
          displayName: "Скалабан Александр",
          updatedAt: "2026-01-01T00:00:00.000Z",
          updatedBy: "actor",
          updatedByName: "Actor",
        },
      },
    });

    const row = makeRow(DEALER_X, "Скалабан Александр");
    const act = makeAct(DEALER_X);
    const shMap = act.tradePointShowcaseActualizationById;
    const installedEntriesByTradePointId: Record<string, undefined> = {};

    const matched = applyDistributionAnalyticsFilters(
      [row],
      { ...emptyDistributionAnalyticsFilters(), ropIds: [ROP_1] },
      shMap,
      act,
      installedEntriesByTradePointId,
    );
    expect(matched).toHaveLength(1);

    const rejected = applyDistributionAnalyticsFilters(
      [row],
      { ...emptyDistributionAnalyticsFilters(), ropIds: [ROP_OTHER] },
      shMap,
      act,
      installedEntriesByTradePointId,
    );
    expect(rejected).toHaveLength(0);
  });
});
