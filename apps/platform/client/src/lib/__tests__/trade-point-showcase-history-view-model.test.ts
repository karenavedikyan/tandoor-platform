/**
 * Запуск: `npm run test:trade-point-showcase-history-view-model` из каталога apps/platform.
 */
import { strict as assert } from "node:assert";
import test from "node:test";

import type { ShowcaseMatrixEventDto } from "../showcase-matrix-api.js";
import {
  defaultHistoryFilter,
  filterHistoryEvents,
  groupEventsByDay,
  toHistoryViewModel,
  uniqueUsersFromEvents,
} from "../trade-point-showcase-history-view-model.js";

function ev(overrides: Partial<ShowcaseMatrixEventDto>): ShowcaseMatrixEventDto {
  return {
    id: overrides.id ?? `e-${Math.random()}`,
    entryId: null,
    dealerId: "d",
    tradePointId: "tp",
    targetKind: "model",
    targetId: "model-x",
    oldStatus: null,
    newStatus: "installed",
    comment: null,
    changedBy: "user-1",
    changedByName: "Karen",
    changedAt: "2026-06-15T18:00:00.000Z",
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    ...overrides,
  };
}

test("toHistoryViewModel: status_change для модели", () => {
  const vm = toHistoryViewModel(ev({ oldStatus: "need_install", newStatus: "installed" }));
  assert.equal(vm.action, "status_change");
  assert.equal(vm.newStatusLabel, "Стоит на витрине");
  assert.equal(vm.oldStatusLabel, "Нужно поставить");
});

test("toHistoryViewModel: placement_update — собирает segment+type в targetLabel", () => {
  const vm = toHistoryViewModel(
    ev({ targetKind: "placement", placementSegment: "vh", placementType: "portal" }),
  );
  assert.equal(vm.action, "placement_update");
  assert.ok(vm.targetLabel.includes("ВХ"));
  assert.ok(vm.targetLabel.includes("Портал"));
});

test("filterHistoryEvents: сегмент", () => {
  const events = [
    ev({ id: "1", placementSegment: "vh", targetKind: "placement" }),
    ev({ id: "2", placementSegment: "mk", targetKind: "placement" }),
  ];
  const r = filterHistoryEvents(events, { ...defaultHistoryFilter(), segment: "vh" });
  assert.equal(r.length, 1);
  assert.equal(r[0]?.id, "1");
});

test("filterHistoryEvents: действие", () => {
  const events = [
    ev({ id: "s", oldStatus: "need_install", newStatus: "installed" }),
    ev({ id: "p", targetKind: "placement", placementSegment: "vh", placementType: "portal" }),
  ];
  assert.equal(filterHistoryEvents(events, { ...defaultHistoryFilter(), action: "status_change" }).length, 1);
  assert.equal(filterHistoryEvents(events, { ...defaultHistoryFilter(), action: "placement_update" }).length, 1);
});

test("filterHistoryEvents: пользователь", () => {
  const events = [ev({ id: "a", changedBy: "u1" }), ev({ id: "b", changedBy: "u2" })];
  const r = filterHistoryEvents(events, { ...defaultHistoryFilter(), userId: "u1" });
  assert.equal(r.length, 1);
  assert.equal(r[0]?.id, "a");
});

test("filterHistoryEvents: период last7 отсекает старые", () => {
  const now = new Date("2026-06-15T12:00:00.000Z").getTime();
  const events = [
    ev({ id: "new", changedAt: "2026-06-14T12:00:00.000Z" }),
    ev({ id: "old", changedAt: "2026-05-01T12:00:00.000Z" }),
  ];
  const r = filterHistoryEvents(events, { ...defaultHistoryFilter(), period: "last7" }, now);
  assert.equal(r.length, 1);
  assert.equal(r[0]?.id, "new");
});

test("groupEventsByDay: группирует по дню МСК и сортирует по убыванию", () => {
  const now = new Date("2026-06-15T22:00:00.000Z").getTime();
  const events = [
    ev({ id: "today1", changedAt: "2026-06-15T22:30:00.000Z" }),
    ev({ id: "today2", changedAt: "2026-06-15T22:20:00.000Z" }),
    ev({ id: "yest", changedAt: "2026-06-14T15:00:00.000Z" }),
  ];
  const groups = groupEventsByDay(events, now);
  assert.equal(groups.length, 2);
  assert.ok(groups[0]?.items.length === 2);
  assert.equal(groups[0]?.items[0]?.id, "today1");
});

test("uniqueUsersFromEvents: дедуп + сортировка", () => {
  const events = [
    ev({ changedBy: "u-z", changedByName: "Зайцев" }),
    ev({ changedBy: "u-a", changedByName: "Авдеев" }),
    ev({ changedBy: "u-a", changedByName: "Авдеев" }),
  ];
  const u = uniqueUsersFromEvents(events);
  assert.equal(u.length, 2);
  assert.equal(u[0]?.name, "Авдеев");
});

console.log("trade-point-showcase-history-view-model: ok");
