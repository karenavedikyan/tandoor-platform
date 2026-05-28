/**
 * Запуск: `tsx client/src/lib/__tests__/dealer-base-city-detail-view-model.test.ts` из apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import { buildCityDetailModel, resolveCityRowSegmentKey } from "../dealer-base-city-detail-view-model";

function row(partial: Partial<DealerRow> & Pick<DealerRow, "id" | "name" | "city">): DealerRow {
  return {
    id: partial.id,
    name: partial.name,
    city: partial.city,
    region: partial.region ?? "",
    clientCategory: partial.clientCategory ?? "uncategorized",
    importanceTier: partial.importanceTier ?? "standard",
    status: partial.status ?? "активный",
    format: partial.format ?? "розница",
    outlets: partial.outlets ?? 0,
    manager: partial.manager ?? "Менеджер",
    ropName: partial.ropName ?? "",
    distribution: partial.distribution ?? 0,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: partial.hasRecentActivity ?? true,
    tradePoints: partial.tradePoints ?? [],
    ...partial,
  } as DealerRow;
}

{
  const rows = [
    row({ id: "1", name: "A", city: "Ростов", status: "активный", outlets: 2, clientCategory: "top150" }),
    row({ id: "2", name: "B", city: "Ростов", status: "потенциальный", outlets: 0 }),
    row({ id: "3", name: "C", city: "Москва", status: "активный", outlets: 1 }),
  ];
  const detail = buildCityDetailModel("Ростов", rows);
  assert.ok(detail);
  assert.equal(detail!.displayName, "Ростов");
  assert.equal(detail!.kpis.activeClients, 1);
  assert.equal(detail!.kpis.potential, 1);
  assert.equal(detail!.kpis.tradePoints, 2);
  assert.ok(detail!.segments.some((s) => s.key === "top150"));
  assert.ok(detail!.segments.some((s) => s.key === "potential"));
}

assert.equal(buildCityDetailModel("Несуществующий", []), null);

{
  const key = resolveCityRowSegmentKey(
    row({
      id: "x",
      name: "X",
      city: "Ростов",
      status: "требует внимания",
      clientCategory: "top150",
    }),
    new Map(),
  );
  assert.equal(key, "attention");
}

console.log("dealer-base-city-detail-view-model.test.ts: ok");
