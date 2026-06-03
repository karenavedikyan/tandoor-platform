/**
 * Запуск: npm run test:distribution-client-drilldown
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
  buildClientLevelRows,
  buildClientModelRows,
  buildClientTradePointRows,
  selectRefsForClientPath,
} from "../distribution-client-drilldown";

function dealer(
  id: string,
  name: string,
  points: { id: string; name: string }[],
): DealerRow {
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

const clientA = dealer("d-a", "Клиент А", [
  { id: "tp-a1", name: "ТТ А1" },
  { id: "tp-a2", name: "ТТ А2" },
]);
const clientB = dealer("d-b", "Клиент B", [{ id: "tp-b1", name: "ТТ B1" }]);

function ref(d: DealerRow, pointId: string): ScopeTradePointRef {
  const point = d.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: d, point };
}

const allRefs: ScopeTradePointRef[] = [
  ref(clientA, "tp-a1"),
  ref(clientA, "tp-a2"),
  ref(clientB, "tp-b1"),
];

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

setCtx("tp-a1", { planModels: plan("m1", "m2"), entries: [modelEntry("tp-a1", "m1", "installed")] });
setCtx("tp-a2", { planModels: plan("m1"), entries: [] });
setCtx("tp-b1", { planModels: plan("m1"), entries: [modelEntry("tp-b1", "m1", "installed")] });

const clients = buildClientLevelRows(allRefs, ctxBuilder);
assert.equal(clients.length, 2);
const rowA = clients.find((r) => r.key === "d-a");
const rowB = clients.find((r) => r.key === "d-b");
assert.ok(rowA);
assert.ok(rowB);
assert.equal(rowA!.label, "Клиент А");
assert.equal(rowA!.drilldownRef.refs.length, 2);

const narrowedDealer = selectRefsForClientPath(allRefs, { dealerId: "d-a" });
assert.equal(narrowedDealer.length, 2);

const tps = buildClientTradePointRows(allRefs, ctxBuilder, "d-a");
assert.equal(tps.length, 2);

const narrowedTp = selectRefsForClientPath(allRefs, { dealerId: "d-a", tradePointId: "tp-a1" });
assert.equal(narrowedTp.length, 1);
assert.equal(narrowedTp[0]!.point.id, "tp-a1");

const models = buildClientModelRows(allRefs, ctxBuilder, "tp-a1");
assert.ok(models.length >= 1);
assert.ok(models.every((m) => !Number.isNaN(m.coverage.quantitativePct ?? 0)));

const zeroPlan = buildClientLevelRows([ref(clientA, "tp-a1")], () => ({
  planModels: [],
  entries: [modelEntry("tp-a1", "x", "installed")],
}));
assert.equal(zeroPlan[0]!.coverage.quantitativePct, null);

console.log("distribution-client-drilldown: ok");
