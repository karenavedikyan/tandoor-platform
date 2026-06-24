/**
 * Запуск: npm run test:distribution-entry-status
 */
import assert from "node:assert/strict";
import type { DistributionEntryTradePointRow } from "../distribution-entry-tradepoint-view-model";
import {
  compareIncompleteFirst,
  countByStatusTab,
  defaultSortForTab,
  filterRowsByPeriod,
  filterRowsByStatusTab,
  sortEntryRows,
} from "../distribution-entry-tradepoint-status";

function row(
  partial: Partial<DistributionEntryTradePointRow> & { tradePointId: string; tradePointName: string },
): DistributionEntryTradePointRow {
  return {
    dealerId: "d1",
    clientName: "Клиент",
    city: null,
    clientCategory: "top350",
    managerName: null,
    templateModelsCount: 4,
    filledCount: 0,
    coveragePct: 0,
    lastUpdatedAt: null,
    ...partial,
  };
}

const rows: DistributionEntryTradePointRow[] = [
  row({ tradePointId: "tp-empty", tradePointName: "Пустая", filledCount: 0, coveragePct: 0 }),
  row({
    tradePointId: "tp-partial",
    tradePointName: "Частичная",
    filledCount: 2,
    coveragePct: 50,
    lastUpdatedAt: "2026-06-10T12:00:00.000Z",
  }),
  row({
    tradePointId: "tp-full",
    tradePointName: "Полная",
    filledCount: 4,
    coveragePct: 100,
    lastUpdatedAt: "2026-06-16T08:00:00.000Z",
  }),
  row({
    tradePointId: "tp-old",
    tradePointName: "Старая",
    filledCount: 1,
    coveragePct: 25,
    lastUpdatedAt: "2026-05-01T08:00:00.000Z",
  }),
];

assert.deepEqual(filterRowsByStatusTab(rows, "all").map((r) => r.tradePointId), [
  "tp-empty",
  "tp-partial",
  "tp-full",
  "tp-old",
]);
assert.deepEqual(filterRowsByStatusTab(rows, "empty").map((r) => r.tradePointId), ["tp-empty"]);
assert.deepEqual(filterRowsByStatusTab(rows, "filled").map((r) => r.tradePointId), [
  "tp-partial",
  "tp-full",
  "tp-old",
]);

const counts = countByStatusTab(rows);
assert.equal(counts.all, 4);
assert.equal(counts.empty, 1);
assert.equal(counts.filled, 3);

assert.equal(defaultSortForTab("all"), "incomplete-first");
assert.equal(defaultSortForTab("empty"), "incomplete-first");
assert.equal(defaultSortForTab("filled"), "recent-first");

const incompleteOrder = sortEntryRows(rows, "incomplete-first").map((r) => r.tradePointId);
assert.equal(incompleteOrder[0], "tp-empty", "незаполненные сверху при incomplete-first");

const buildOrder = [...rows].sort(compareIncompleteFirst).map((r) => r.tradePointId);
assert.deepEqual(sortEntryRows(rows, "incomplete-first").map((r) => r.tradePointId), buildOrder);

const recentOrder = sortEntryRows(rows.filter((r) => r.filledCount > 0), "recent-first").map(
  (r) => r.tradePointId,
);
assert.equal(recentOrder[0], "tp-full", "свежая заполненная ТТ сверху");
assert.equal(recentOrder[recentOrder.length - 1], "tp-old");

const withNull = [
  ...rows.filter((r) => r.filledCount > 0),
  row({ tradePointId: "tp-null-date", tradePointName: "Без даты", filledCount: 1, coveragePct: 10, lastUpdatedAt: null }),
];
const recentWithNull = sortEntryRows(withNull, "recent-first").map((r) => r.tradePointId);
assert.equal(recentWithNull[recentWithNull.length - 1], "tp-null-date");

const coverageOrder = sortEntryRows(rows, "coverage-desc").map((r) => r.tradePointId);
assert.equal(coverageOrder[0], "tp-full");

const nameOrder = sortEntryRows(rows, "name-asc").map((r) => r.tradePointName);
assert.deepEqual(nameOrder, [...nameOrder].sort((a, b) => a.localeCompare(b, "ru")));

const now = new Date(2026, 5, 16, 15, 0, 0).getTime();
const periodRows = [
  row({
    tradePointId: "tp-today",
    tradePointName: "Сегодня",
    filledCount: 1,
    lastUpdatedAt: new Date(2026, 5, 16, 9, 0, 0).toISOString(),
  }),
  row({
    tradePointId: "tp-week",
    tradePointName: "Неделя",
    filledCount: 1,
    lastUpdatedAt: new Date(2026, 5, 12, 9, 0, 0).toISOString(),
  }),
  row({
    tradePointId: "tp-month",
    tradePointName: "Месяц",
    filledCount: 1,
    lastUpdatedAt: new Date(2026, 5, 1, 9, 0, 0).toISOString(),
  }),
  row({
    tradePointId: "tp-old-period",
    tradePointName: "Давно",
    filledCount: 1,
    lastUpdatedAt: new Date(2026, 3, 1, 9, 0, 0).toISOString(),
  }),
  row({ tradePointId: "tp-no-date", tradePointName: "Без даты", filledCount: 1, lastUpdatedAt: null }),
];

assert.deepEqual(
  filterRowsByPeriod(periodRows, "today", now).map((r) => r.tradePointId),
  ["tp-today"],
);
assert.deepEqual(
  filterRowsByPeriod(periodRows, "week", now).map((r) => r.tradePointId),
  ["tp-today", "tp-week"],
);
assert.deepEqual(
  filterRowsByPeriod(periodRows, "month", now).map((r) => r.tradePointId),
  ["tp-today", "tp-week", "tp-month"],
);
assert.deepEqual(
  filterRowsByPeriod(periodRows, "all", now).map((r) => r.tradePointId),
  periodRows.map((r) => r.tradePointId),
);

console.log("✓ distribution-entry-tradepoint-status tests passed");
