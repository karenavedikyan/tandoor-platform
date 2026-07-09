/**
 * ROP-фильтр для строк 1С-аналитики: матч по dealer.ropId (rop_user_id).
 * Запуск: npx tsx --test client/src/lib/distribution-analytics/__tests__/apply-filters-1c-rop.test.ts
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  applyDistributionAnalyticsFilters,
  emptyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { MergedTradePointEntry } from "@/lib/dealer-trade-points-overrides";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

const ROP_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ROP_UNKNOWN = "00000000-0000-0000-0000-000000000099";

function makeOneCRow(ropId: string | null, ropName: string): TradePointListRow {
  const dealer = {
    id: "legal-1c-uuid",
    name: "Клиент 1С",
    region: "Юг",
    clientCategory: "top150",
    ropId,
    ropName,
  } as DealerRow;
  const point = { id: "store-1c-uuid", name: "ТТ", city: "Шахты" } as DealerTradePoint;
  return {
    tradePointId: "store-1c-uuid",
    dealerId: dealer.id,
    dealer,
    point,
    entry: { point } as MergedTradePointEntry,
    tradePointDisplayCode: "Адрес ТТ",
    dealerClientCode: dealer.id,
    dealerName: dealer.name,
    tradePointName: "ТТ",
    city: "Шахты",
    address: "ул. Тестовая, 1",
    tradePointFormatLabel: null,
    manager: "Менеджер",
    regionalManager: "—",
    rop: ropName,
    clientCategory: "top150",
    clientCategoryLabel: "ТОП 150",
    showcaseBucket: "has_showcase",
    showcaseBucketLabel: "Витрина",
    portalsTotal: null,
    modelsOnShowcaseCount: 0,
    matrixDeficitCount: 0,
    showcaseNewTasksCount: 0,
    portalOverfill: false,
    portalsUnfilled: false,
    hasFreePortals: false,
    hasShowcase: true,
    showcaseUpdatedAt: null,
    unloadingOrder: null,
    isArchived: false,
    isVirtual: false,
    searchHaystack: "",
  };
}

const emptyAct = { dealerOverridesById: {} } as ActualizationState;
const emptyShMap = {};
const emptyInstalled: Record<string, undefined> = {};

test("keeps row when ropIds contains dealer.ropId from 1C source", () => {
  const row = makeOneCRow(ROP_UUID, "Купянский Родион");
  const matched = applyDistributionAnalyticsFilters(
    [row],
    { ...emptyDistributionAnalyticsFilters(), ropIds: [ROP_UUID] },
    emptyShMap,
    emptyAct,
    emptyInstalled,
  );
  assert.equal(matched.length, 1);
});

test("filters out row when ropIds does not match dealer.ropId", () => {
  const row = makeOneCRow(ROP_UUID, "Купянский Родион");
  const rejected = applyDistributionAnalyticsFilters(
    [row],
    { ...emptyDistributionAnalyticsFilters(), ropIds: [ROP_UNKNOWN] },
    emptyShMap,
    emptyAct,
    emptyInstalled,
  );
  assert.equal(rejected.length, 0);
});
