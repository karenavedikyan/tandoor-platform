/**
 * Запуск: npm run test:distribution-manager-drilldown
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
  buildManagerCityRows,
  buildManagerClientRows,
  buildManagerLevelRows,
  buildManagerModelRows,
  buildManagerTradePointRows,
  selectRefsForPath,
} from "../distribution-manager-drilldown";

function dealer(
  id: string,
  name: string,
  city: string,
  rm: string,
  points: { id: string; name: string; city?: string }[],
): DealerRow {
  return {
    id,
    name,
    city,
    status: "активный",
    clientCategory: "top350",
    regionalManager: rm,
    tradePoints: points.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city ?? city,
      address: "",
      status: "активный",
    })),
  } as DealerRow;
}

const dMoscowA = dealer("d-a", "Клиент А", "Москва", "Иванов", [
  { id: "tp-a1", name: "ТТ А1" },
  { id: "tp-a2", name: "ТТ А2" },
]);
const dMoscowB = dealer("d-b", "Клиент B", "Москва", "Иванов", [{ id: "tp-b1", name: "ТТ B1" }]);
const dSpb = dealer("d-c", "Клиент C", "СПб", "Петров", [{ id: "tp-c1", name: "ТТ C1", city: "СПб" }]);
const dUnassigned = dealer("d-u", "Клиент U", "Казань", "", [{ id: "tp-u1", name: "ТТ U1", city: "Казань" }]);

function ref(d: DealerRow, pointId: string): ScopeTradePointRef {
  const point = d.tradePoints.find((p) => p.id === pointId)!;
  return { dealer: d, point };
}

const allRefs: ScopeTradePointRef[] = [
  ref(dMoscowA, "tp-a1"),
  ref(dMoscowA, "tp-a2"),
  ref(dMoscowB, "tp-b1"),
  ref(dSpb, "tp-c1"),
  ref(dUnassigned, "tp-u1"),
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
setCtx("tp-c1", { planModels: plan("m1", "m2"), entries: [] });
setCtx("tp-u1", { planModels: [], entries: [] });

const managers = buildManagerLevelRows(allRefs, ctxBuilder);
assert.ok(managers.length >= 2, "ожидаем минимум двух менеджеров");
const ivanov = managers.find((r) => r.label === "Иванов");
const petrov = managers.find((r) => r.label === "Петров");
const unassigned = managers.find((r) => r.label === "Без менеджера");
assert.ok(ivanov, "Иванов");
assert.ok(petrov, "Петров");
assert.ok(unassigned, "Без менеджера");
assert.equal(ivanov!.drilldownRef.refs.length, 3);

const ivanovKey = ivanov!.drilldownRef.managerKey;
const narrowedManager = selectRefsForPath(allRefs, { managerKey: ivanovKey });
assert.equal(narrowedManager.length, 3);

const cities = buildManagerCityRows(allRefs, ctxBuilder, ivanovKey);
assert.ok(cities.some((c) => c.label === "Москва"));
const moscow = cities.find((c) => c.label === "Москва")!;
const narrowedCity = selectRefsForPath(allRefs, { managerKey: ivanovKey, city: moscow.label });
assert.equal(narrowedCity.length, 3);

const clients = buildManagerClientRows(allRefs, ctxBuilder, ivanovKey, "Москва");
assert.equal(clients.length, 2);
const clientA = clients.find((c) => c.key === "d-a")!;
const narrowedClient = selectRefsForPath(allRefs, {
  managerKey: ivanovKey,
  city: "Москва",
  dealerId: clientA.key,
});
assert.equal(narrowedClient.length, 2);

const tps = buildManagerTradePointRows(allRefs, ctxBuilder, ivanovKey, "Москва", "d-a");
assert.equal(tps.length, 2);

const models = buildManagerModelRows(allRefs, ctxBuilder, "tp-a1");
assert.ok(models.length >= 1);
assert.ok(models.every((m) => !Number.isNaN(m.coverage.quantitativePct ?? 0)));

const zeroPlan = buildManagerModelRows([ref(dUnassigned, "tp-u1")], ctxBuilder, "tp-u1");
assert.equal(zeroPlan.length, 0);

const emptyPlanRow = buildManagerLevelRows([ref(dMoscowA, "tp-a1")], () => ({
  planModels: [],
  entries: [modelEntry("tp-a1", "x", "installed")],
}));
assert.equal(emptyPlanRow[0]!.coverage.quantitativePct, null);

console.log("distribution-manager-drilldown: ok");
