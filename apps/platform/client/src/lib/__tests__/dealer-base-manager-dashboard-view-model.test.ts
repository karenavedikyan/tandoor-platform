/**
 * Запуск: `npx tsx client/src/lib/__tests__/dealer-base-manager-dashboard-view-model.test.ts` из apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import type { ManagerRowModel } from "../dealer-base-management-view-model";
import { buildManagerDashboardModel } from "../dealer-base-manager-dashboard-view-model";

function row(partial: Partial<DealerRow> & Pick<DealerRow, "id" | "name" | "city">): DealerRow {
  return {
    id: partial.id,
    name: partial.name,
    city: partial.city,
    region: "",
    clientCategory: partial.clientCategory ?? "top150",
    importanceTier: "standard",
    status: partial.status ?? "активный",
    format: "розница",
    outlets: partial.outlets ?? 1,
    manager: "Менеджер",
    ropName: "РОП",
    distribution: 0,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: true,
    tradePoints: partial.tradePoints ?? [],
    ...partial,
  } as DealerRow;
}

const manager: ManagerRowModel = {
  managerId: "mgr-test",
  name: "Тестов М.",
  teamId: "team-a",
  active: 2,
  potential: 1,
  attention: 1,
  outlets: 3,
  topSegmentLabel: "ТОП 150",
  rows: [
    row({ id: "1", name: "A", city: "Ростов", status: "активный", clientCategory: "top150" }),
    row({ id: "2", name: "B", city: "Ростов", status: "потенциальный" }),
    row({
      id: "3",
      name: "C",
      city: "Москва",
      status: "требует внимания",
      hasProblem: true,
    }),
  ],
};

{
  const dash = buildManagerDashboardModel(manager, "Купянский", "high");
  assert.equal(dash.managerName, "Тестов М.");
  assert.equal(dash.kpis.activeClients, 2);
  assert.equal(dash.cities.length, 2);
  assert.ok(dash.cities.some((c) => c.displayName === "Ростов"));
  assert.equal(dash.attentionRows.length, 1);
  assert.ok(dash.segments.length > 0);
}

console.log("dealer-base-manager-dashboard-view-model.test.ts: ok");
