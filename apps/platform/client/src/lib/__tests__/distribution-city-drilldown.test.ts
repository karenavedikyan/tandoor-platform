/**
 * Запуск: npm run test:distribution-city-drilldown
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
  buildCityLevelRows,
  buildCityTradePointRows,
  getCityDrilldownLevel,
  selectRefsForCityPath,
} from "../distribution-city-drilldown";

function dealer(
  id: string,
  city: string,
  points: { id: string; name: string; city?: string }[],
): DealerRow {
  return {
    id,
    name: `Клиент ${id}`,
    city,
    status: "активный",
    clientCategory: "top350",
    tradePoints: points.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city ?? city,
      address: "",
      status: "активный",
    })),
  } as DealerRow;
}

const krasnodar = dealer("d1", "Краснодар", [
  { id: "tp-k1", name: "ТТ К1" },
  { id: "tp-k2", name: "ТТ К2" },
]);
const moscow = dealer("d2", "Москва", [{ id: "tp-m1", name: "ТТ М1" }]);

function ref(d: DealerRow, pointId: string): ScopeTradePointRef {
  const point = d.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: d, point };
}

const allRefs = [ref(krasnodar, "tp-k1"), ref(krasnodar, "tp-k2"), ref(moscow, "tp-m1")];

function modelEntry(
  tradePointId: string,
  targetId: string,
  status: ShowcaseMatrixEntryDto["status"],
): ShowcaseMatrixEntryDto {
  return {
    id: `e-${tradePointId}-${targetId}`,
    dealerId: "x",
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

assert.equal(getCityDrilldownLevel({}), "cities");
assert.equal(getCityDrilldownLevel({ city: "Краснодар" }), "tradePoints");

setCtx("tp-k1", { planModels: plan("m1"), entries: [modelEntry("tp-k1", "m1", "installed")] });
setCtx("tp-k2", { planModels: plan("m1"), entries: [] });
setCtx("tp-m1", { planModels: plan("m1"), entries: [] });

const cities = buildCityLevelRows(allRefs, ctxBuilder);
assert.equal(cities.length, 2);
const kRow = cities.find((r) => r.label === "Краснодар");
const mRow = cities.find((r) => r.label === "Москва");
assert.ok(kRow);
assert.ok(mRow);
assert.equal(kRow!.drilldownRef.refs.length, 2);
assert.equal(mRow!.drilldownRef.refs.length, 1);

const narrowed = selectRefsForCityPath(allRefs, { city: "Краснодар" });
assert.equal(narrowed.length, 2);

const tps = buildCityTradePointRows(allRefs, ctxBuilder, "Краснодар");
assert.equal(tps.length, 2);
assert.ok(tps.every((r) => r.key === "tp-k1" || r.key === "tp-k2"));

const emptyPlan = buildCityLevelRows([ref(krasnodar, "tp-k1")], () => ({
  planModels: [],
  entries: [modelEntry("tp-k1", "x", "installed")],
}));
assert.equal(emptyPlan[0]!.coverage.quantitativePct, null);

console.log("distribution-city-drilldown: ok");
