/**
 * Запуск: npm run test:distribution-tradepoint-drilldown
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
  buildDeficitGroupsByTradePoint,
  buildTradePointLevelRows,
  buildTradePointModelRows,
  selectRefsForTradePointPath,
} from "../distribution-tradepoint-drilldown";

function dealer(id: string, name: string, points: { id: string; name: string }[]): DealerRow {
  return {
    id,
    name,
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

const d1 = dealer("d1", "Клиент 1", [
  { id: "tp1", name: "ТТ 1" },
  { id: "tp2", name: "ТТ 2" },
]);
const d2 = dealer("d2", "Клиент 2", [{ id: "tp3", name: "ТТ 3" }]);

function ref(d: DealerRow, pointId: string): ScopeTradePointRef {
  const point = d.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: d, point };
}

const allRefs = [ref(d1, "tp1"), ref(d1, "tp2"), ref(d2, "tp3")];

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

setCtx("tp1", {
  planModels: plan("m1", "m2", "m3"),
  entries: [modelEntry("tp1", "m1", "installed")],
});
setCtx("tp2", {
  planModels: plan("m1", "m2"),
  entries: [],
});
setCtx("tp3", {
  planModels: plan("m1"),
  entries: [modelEntry("tp3", "m1", "installed")],
});

const tpRows = buildTradePointLevelRows(allRefs, ctxBuilder);
assert.equal(tpRows.length, 3);
assert.ok(tpRows.some((r) => r.key === "tp1" && r.label === "ТТ 1"));

const narrowed = selectRefsForTradePointPath(allRefs, { tradePointId: "tp1" });
assert.equal(narrowed.length, 1);
assert.equal(narrowed[0]!.point.id, "tp1");

const models = buildTradePointModelRows(allRefs, ctxBuilder, "tp1");
assert.ok(models.length >= 1);

const groups = buildDeficitGroupsByTradePoint(allRefs, ctxBuilder);
assert.ok(groups.length >= 1);
assert.ok(groups.every((g) => g.deficitCount > 0 && g.items.length === g.deficitCount));
const tp1Group = groups.find((g) => g.tradePointId === "tp1");
const tp2Group = groups.find((g) => g.tradePointId === "tp2");
assert.ok(tp1Group);
assert.ok(tp2Group);
assert.equal(tp1Group!.deficitCount, 2);
assert.equal(tp2Group!.deficitCount, 2);
if (groups.length >= 2) {
  assert.ok(groups[0]!.deficitCount >= groups[1]!.deficitCount);
}
assert.ok(!groups.some((g) => g.tradePointId === "tp3"));

const zeroPlan = buildTradePointLevelRows([ref(d1, "tp1")], () => ({
  planModels: [],
  entries: [modelEntry("tp1", "x", "installed")],
}));
assert.equal(zeroPlan[0]!.coverage.quantitativePct, null);

console.log("distribution-tradepoint-drilldown: ok");
