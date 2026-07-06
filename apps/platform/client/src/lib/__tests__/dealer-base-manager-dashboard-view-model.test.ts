/**
 * Запуск: `npx tsx client/src/lib/__tests__/dealer-base-manager-dashboard-view-model.test.ts` из apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import type { ManagerRowModel } from "../dealer-base-management-view-model";
import {
  buildManagerDashboardModel,
  findManagerInRopGroupByTeam,
  findManagerInRopGroups,
  resolveManagerDetailObservationCtx,
} from "../dealer-base-manager-dashboard-view-model";

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
  isExternal: false,
  externalTeamName: null,
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

{
  const scopedRows = [
    row({ id: "ext-1", name: "Клиент 1", city: "Ростов", status: "активный" }),
    row({ id: "ext-2", name: "Клиент 2", city: "Ростов", status: "активный" }),
    row({ id: "ext-3", name: "Клиент 3", city: "Москва", status: "потенциальный" }),
  ];
  const nativeCtx = {
    manager,
    ropName: "Купянский",
    teamId: "team-a",
  };
  const fallbackCtx = resolveManagerDetailObservationCtx({
    managerCtx: null,
    viewingOtherUserScope: true,
    targetScopeReady: true,
    managerId: "0481a81d-160b-422e-8257-cf21d134cd42",
    scopedRows,
    managerDisplayName: "Якубова Юлия Сергеевна",
    observerRopName: "Скалабан",
  });
  assert.ok(fallbackCtx, "fallback ctx for external manager");
  assert.equal(fallbackCtx!.manager.rows.length, scopedRows.length);
  assert.equal(fallbackCtx!.manager.active, 2);
  assert.equal(fallbackCtx!.manager.name, "Якубова Юлия Сергеевна");
  assert.equal(fallbackCtx!.ropName, "Скалабан");

  const dash = buildManagerDashboardModel(fallbackCtx!.manager, fallbackCtx!.ropName, "medium");
  assert.equal(dash.rows.length, scopedRows.length);
  assert.equal(dash.kpis.activeClients, 2);

  const nativeResolved = resolveManagerDetailObservationCtx({
    managerCtx: nativeCtx,
    viewingOtherUserScope: true,
    targetScopeReady: true,
    managerId: "mgr-test",
    scopedRows,
    managerDisplayName: "ignored",
    observerRopName: "ignored",
  });
  assert.equal(nativeResolved, nativeCtx, "native managerCtx wins over fallback");
}

{
  const scopedRows = [
    row({ id: "reg-1", name: "Клиент Р", city: "Львов", status: "активный" }),
  ];
  const regionalCtx = resolveManagerDetailObservationCtx({
    managerCtx: null,
    viewingOtherUserScope: true,
    targetScopeReady: true,
    managerId: "rm-drogo-uuid",
    scopedRows,
    managerDisplayName: "Дрогобицкий",
    observerRopName: "Директор",
  });
  assert.ok(regionalCtx, "synthetic ctx for regional manager absent from ropGroups");
  assert.equal(regionalCtx!.manager.managerId, "rm-drogo-uuid");
  assert.equal(regionalCtx!.manager.name, "Дрогобицкий");
  assert.equal(regionalCtx!.manager.rows.length, scopedRows.length);
  assert.equal(regionalCtx!.ropName, "Директор");
}

{
  const ropGroups = [
    {
      teamId: "team-A",
      ropName: "A",
      managers: [
        {
          managerId: "rm-1",
          name: "M",
          active: 24,
          outlets: 0,
          potential: 0,
          attention: 0,
          rows: [],
          teamId: "team-A",
          topSegmentLabel: "",
          isExternal: false,
          externalTeamName: null,
        },
      ],
    },
    {
      teamId: "team-B",
      ropName: "B",
      managers: [
        {
          managerId: "rm-1",
          name: "M",
          active: 191,
          outlets: 0,
          potential: 0,
          attention: 0,
          rows: [],
          teamId: "team-B",
          topSegmentLabel: "",
          isExternal: false,
          externalTeamName: null,
        },
      ],
    },
  ] satisfies Parameters<typeof findManagerInRopGroupByTeam>[2];
  assert.equal(findManagerInRopGroupByTeam("rm-1", "team-A", ropGroups)?.manager.active, 24);
  assert.equal(findManagerInRopGroupByTeam("rm-1", "team-B", ropGroups)?.manager.active, 191);
  assert.equal(findManagerInRopGroupByTeam("rm-1", null, ropGroups)?.manager.active, 24);
  assert.equal(findManagerInRopGroupByTeam("rm-1", undefined, ropGroups)?.manager.active, 24);
  assert.equal(findManagerInRopGroups("rm-1", ropGroups)?.manager.active, 24);
}

console.log("dealer-base-manager-dashboard-view-model.test.ts: ok");
