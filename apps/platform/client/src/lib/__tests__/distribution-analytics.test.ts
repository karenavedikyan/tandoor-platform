/**
 * Запуск: npm run test:distribution-analytics
 */
import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";
import {
  aggregateByDealer,
  computeCoverageForTradePoints,
  computeMatrixValueQualitativePct,
  computeNetworkSummary,
  listDeficitPositions,
  staleTradePoints,
  type AnalyticsPlanPosition,
  type DistributionMetricsContext,
} from "../distribution-analytics";

const dealer: DealerRow = {
  id: "d1",
  name: "Дилер А",
  city: "Москва",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp1", name: "ТТ 1", city: "Москва", address: "", status: "активный" },
    { id: "tp2", name: "ТТ 2", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const dealerB: DealerRow = {
  ...dealer,
  id: "d2",
  name: "Дилер B",
  tradePoints: [{ id: "tp3", name: "ТТ 3", city: "СПб", address: "", status: "активный" }],
} as DealerRow;

function ref(dealerRow: DealerRow, pointId: string): ScopeTradePointRef {
  const point = dealerRow.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: dealerRow, point };
}

function modelEntry(
  tradePointId: string,
  targetId: string,
  status: ShowcaseMatrixEntryDto["status"],
  updatedAt: string,
): ShowcaseMatrixEntryDto {
  return {
    id: `e-${tradePointId}-${targetId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "model",
    targetId,
    status,
    comment: null,
    updatedAt,
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
  };
}

function plan(...ids: string[]): AnalyticsPlanPosition[] {
  return ids.map((id) => ({ targetId: id, name: id, valueWeight: 1 }));
}

function ctx(
  planModels: readonly AnalyticsPlanPosition[],
  entries: readonly ShowcaseMatrixEntryDto[],
): DistributionMetricsContext {
  return { planModels, entries };
}

const contexts = new Map<string, DistributionMetricsContext>();

function setCtx(pointId: string, c: DistributionMetricsContext): void {
  contexts.set(pointId, c);
}

function ctxBuilder(r: ScopeTradePointRef): DistributionMetricsContext {
  return contexts.get(r.point.id) ?? { planModels: [], entries: [] };
}

// ЧД: plan=4, fact=3 → 75%
setCtx(
  "tp1",
  ctx(
    plan("m1", "m2", "m3", "m4"),
    [
      modelEntry("tp1", "m1", "installed", "2026-06-01T10:00:00.000Z"),
      modelEntry("tp1", "m2", "installed", "2026-06-01T10:00:00.000Z"),
      modelEntry("tp1", "m3", "installed", "2026-06-01T10:00:00.000Z"),
    ],
  ),
);
const cov75 = computeCoverageForTradePoints([ref(dealer, "tp1")], ctxBuilder);
assert.equal(cov75.planCount, 4);
assert.equal(cov75.factCount, 3);
assert.equal(cov75.quantitativePct, 75);
assert.equal(cov75.deficitCount, 1);

// plan=0 → null
const covZero = computeCoverageForTradePoints([ref(dealer, "tp1")], () =>
  ctx([], [modelEntry("tp1", "x", "installed", "2026-06-01T10:00:00.000Z")]),
);
assert.equal(covZero.planCount, 0);
assert.equal(covZero.quantitativePct, null);
assert.equal(covZero.qualitativePct, null);

// Дефицит не меньше 0
setCtx(
  "tp1",
  ctx(plan("m1", "m2"), [modelEntry("tp1", "m1", "installed", "2026-06-01T10:00:00.000Z")]),
);
const covDef = computeCoverageForTradePoints([ref(dealer, "tp1")], ctxBuilder);
assert.equal(covDef.deficitCount, 1);

// dataCoveragePct: 2 ТТ из 5 с entries → 40%
contexts.clear();
for (let i = 1; i <= 5; i += 1) {
  const tpId = `tp-data-${i}`;
  const d: DealerRow = {
    ...dealer,
    id: `d-${i}`,
    tradePoints: [{ id: tpId, name: `ТТ ${i}`, city: "Москва", address: "", status: "активный" }],
  } as DealerRow;
  const entries =
    i <= 2 ? [modelEntry(tpId, "m1", "installed", "2026-06-01T10:00:00.000Z")] : [];
  setCtx(tpId, ctx(plan("m1"), entries));
}
const dataRefs = Array.from({ length: 5 }, (_, i) =>
  ref(
    {
      ...dealer,
      id: `d-${i + 1}`,
      tradePoints: [
        { id: `tp-data-${i + 1}`, name: `ТТ ${i + 1}`, city: "Москва", address: "", status: "активный" },
      ],
    } as DealerRow,
    `tp-data-${i + 1}`,
  ),
);
const covData = computeCoverageForTradePoints(dataRefs, ctxBuilder);
assert.equal(covData.tradePointsTotal, 5);
assert.equal(covData.tradePointsWithData, 2);
assert.equal(covData.dataCoveragePct, 40);

// КД при равных весах ≈ ЧД
const installed = new Set(["m1", "m2", "m3"]);
const kd = computeMatrixValueQualitativePct(plan("m1", "m2", "m3", "m4"), installed);
assert.equal(kd, 75);
assert.equal(kd, cov75.quantitativePct);

// Агрегатор по дилеру суммирует ТТ
contexts.clear();
setCtx("tp1", ctx(plan("m1", "m2"), [modelEntry("tp1", "m1", "installed", "2026-06-01T10:00:00.000Z")]));
setCtx("tp2", ctx(plan("m1", "m2"), [modelEntry("tp2", "m1", "installed", "2026-06-01T10:00:00.000Z")]));
const byDealer = aggregateByDealer([ref(dealer, "tp1"), ref(dealer, "tp2")], ctxBuilder);
assert.equal(byDealer.length, 1);
assert.equal(byDealer[0]!.coverage.planCount, 4);
assert.equal(byDealer[0]!.coverage.factCount, 2);
assert.equal(byDealer[0]!.coverage.quantitativePct, 50);

// staleTradePoints
contexts.clear();
const old = "2020-01-01T00:00:00.000Z";
const fresh = new Date().toISOString();
setCtx("tp1", ctx(plan("m1"), [modelEntry("tp1", "m1", "installed", old)]));
setCtx("tp2", ctx(plan("m1"), [modelEntry("tp2", "m1", "installed", fresh)]));
const stale = staleTradePoints([ref(dealer, "tp1"), ref(dealer, "tp2")], ctxBuilder, 7);
assert.equal(stale.length, 1);
assert.equal(stale[0]!.key, "tp1");

// Пустой scope
const empty = computeNetworkSummary([], ctxBuilder);
assert.equal(empty.planCount, 0);
assert.equal(empty.tradePointsTotal, 0);
assert.equal(empty.quantitativePct, null);

// listDeficitPositions
contexts.clear();
setCtx(
  "tp1",
  ctx(
    plan("m1", "m2"),
    [modelEntry("tp1", "m1", "need_install", "2026-06-01T10:00:00.000Z")],
  ),
);
const deficits = listDeficitPositions([ref(dealer, "tp1")], ctxBuilder);
assert.equal(deficits.length, 2);
assert.ok(deficits.some((d) => d.targetId === "m2"));

console.log("✓ distribution-analytics tests passed");
