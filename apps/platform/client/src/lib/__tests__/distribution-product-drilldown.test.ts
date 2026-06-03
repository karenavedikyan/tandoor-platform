/**
 * Запуск: npm run test:distribution-product-drilldown
 */
import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type {
  AnalyticsPlanPosition,
  DistributionMetricsContext,
} from "../distribution-analytics";
import {
  buildProductLevelRows,
  buildProductTradePointRows,
  selectModelRefsForTradePoints,
} from "../distribution-product-drilldown";

function dealer(id: string, points: { id: string; name: string }[]): DealerRow {
  return {
    id,
    name: "Клиент",
    city: "Москва",
    status: "активный",
    clientCategory: "top350",
    tradePoints: points.map((p) => ({
      id: p.id,
      name: p.name,
      city: "Москва",
      address: "",
      status: "активный",
    })),
  } as DealerRow;
}

const d1 = dealer("d1", [
  { id: "tp1", name: "ТТ 1" },
  { id: "tp2", name: "ТТ 2" },
]);

function ref(d: DealerRow, pointId: string): ScopeTradePointRef {
  const point = d.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: d, point };
}

const allRefs = [ref(d1, "tp1"), ref(d1, "tp2")];

function modelEntry(
  tradePointId: string,
  targetId: string,
  status: ShowcaseMatrixEntryDto["status"],
): ShowcaseMatrixEntryDto {
  return {
    id: `e-${tradePointId}-${targetId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "model",
    targetId,
    status,
    comment: null,
    updatedAt: "2026-06-01T10:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
  };
}

const contexts = new Map<string, DistributionMetricsContext>();

function plan(...ids: string[]): AnalyticsPlanPosition[] {
  return ids.map((id) => ({ targetId: id, name: id, valueWeight: 1 }));
}

function setCtx(pointId: string, c: DistributionMetricsContext): void {
  contexts.set(pointId, c);
}

function ctxBuilder(r: ScopeTradePointRef): DistributionMetricsContext {
  return contexts.get(r.point.id) ?? { planModels: [], entries: [] };
}

setCtx("tp1", {
  planModels: plan("m1", "m2"),
  entries: [modelEntry("tp1", "m1", "installed")],
});
setCtx("tp2", {
  planModels: plan("m1"),
  entries: [],
});

const products = buildProductLevelRows(allRefs, ctxBuilder);
const m1 = products.find((r) => r.key === "m1");
assert.ok(m1);
assert.equal(m1!.coverage.planCount, 2);
assert.equal(m1!.coverage.factCount, 1);
assert.equal(m1!.coverage.quantitativePct, 50);
assert.equal(m1!.coverage.deficitCount, 1);

const sorted = [...products].sort((a, b) => {
  const av = a.coverage.quantitativePct ?? 101;
  const bv = b.coverage.quantitativePct ?? 101;
  return av - bv;
});
assert.ok((sorted[0]!.coverage.quantitativePct ?? 101) <= (sorted[sorted.length - 1]!.coverage.quantitativePct ?? 101));

const modelRefs = selectModelRefsForTradePoints(allRefs, ctxBuilder, "m1");
assert.equal(modelRefs.length, 2);

const tpRows = buildProductTradePointRows(allRefs, ctxBuilder, "m1");
assert.equal(tpRows.length, 2);
const tp1Row = tpRows.find((r) => r.key === "tp1");
const tp2Row = tpRows.find((r) => r.key === "tp2");
assert.ok(tp1Row);
assert.ok(tp2Row);
assert.equal(tp1Row!.coverage.planCount, 1);
assert.equal(tp1Row!.coverage.factCount, 1);
assert.equal(tp1Row!.coverage.quantitativePct, 100);
assert.equal(tp2Row!.coverage.factCount, 0);
assert.equal(tp2Row!.drilldownRef.modelStatus, null);

const empty = buildProductLevelRows([ref(d1, "tp1")], () => ({
  planModels: [],
  entries: [modelEntry("tp1", "x", "installed")],
}));
assert.equal(empty.length, 0);

console.log("distribution-product-drilldown: ok");
