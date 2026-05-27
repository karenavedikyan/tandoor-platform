/**
 * Запуск: `npm run test:data-merge-trash` из каталога apps/platform.
 *
 * Промт 46 H2: trashed клиенты НЕ показываются ни в рабочем списке,
 * ни в архивном списке /dealer-base.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { buildDealerBaseRowsWithActualization } from "../client-base-actualization-data-merge";
import { makeTrashedDealerInfo, snapshotDealerFromRow } from "../trash-dealer-helper";

const profile = {
  personaId: "p1",
  personaUserId: "u1",
  role: "sales_director" as const,
  city: "—",
} as unknown as Parameters<typeof buildDealerBaseRowsWithActualization>[1];

const nowIso = new Date().toISOString();
const state = createEmptyActualizationState();
// Два manual-клиента: D1 в корзине, D2 в архиве.
state.manuallyCreatedDealersById = {
  D1: {
    id: "D1",
    fields: { name: "Trashed Co" },
    createdAt: nowIso,
    createdBy: "u1",
    createdByName: "U",
    source: "manual_actualization",
  },
  D2: {
    id: "D2",
    fields: { name: "Archived Co" },
    createdAt: nowIso,
    createdBy: "u1",
    createdByName: "U",
    source: "manual_actualization",
  },
  D3: {
    id: "D3",
    fields: { name: "Active Co" },
    createdAt: nowIso,
    createdBy: "u1",
    createdByName: "U",
    source: "manual_actualization",
  },
};
state.trashedDealersById = {
  D1: makeTrashedDealerInfo({
    dealerId: "D1",
    by: { userId: "u1", userName: "U" },
    snapshot: snapshotDealerFromRow({ fullName: "Trashed Co" }),
    source: "client_card_delete",
    nowIso,
  }),
};
state.archivedDealersById = {
  D2: {
    dealerId: "D2",
    archivedAt: nowIso,
    archivedBy: "u1",
    archivedByName: "U",
    source: "manual_actualization",
  },
};

// H2.1 default — нет D1 (trashed) и нет D2 (archived). Есть D3.
{
  const rows = buildDealerBaseRowsWithActualization(state, profile, { releaseDealerRows: [] });
  assert.ok(!rows.find((r) => r.id === "D1"), "Default mode: trashed D1 не показывается");
  assert.ok(!rows.find((r) => r.id === "D2"), "Default mode: archived D2 не показывается");
  assert.ok(rows.find((r) => r.id === "D3"), "Default mode: active D3 присутствует");
}

// H2.2 includeArchivedDealers: true — D2 есть, D1 НЕТ (trashed не показывается даже в архивном режиме).
{
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeArchivedDealers: true,
    releaseDealerRows: [],
  });
  assert.ok(rows.find((r) => r.id === "D2"), "Archive mode: archived D2 показывается");
  assert.ok(!rows.find((r) => r.id === "D1"), "Archive mode: trashed D1 скрыт");
  assert.ok(!rows.find((r) => r.id === "D3"), "Archive mode: active D3 не показывается");
}

// H2.3 includeTrashedDealers: true — D1 виден, D2/D3 нет.
{
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeTrashedDealers: true,
    releaseDealerRows: [],
  });
  assert.ok(rows.find((r) => r.id === "D1"), "Trash mode: trashed D1 показывается");
  assert.ok(!rows.find((r) => r.id === "D2"), "Trash mode: archived D2 скрыт");
  assert.ok(!rows.find((r) => r.id === "D3"), "Trash mode: active D3 скрыт");
}

console.log("data-merge-trash: ok (3 cases)");
