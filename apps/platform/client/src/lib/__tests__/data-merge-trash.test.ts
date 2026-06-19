/**
 * Запуск: `npm run test:data-merge-trash` из каталога apps/platform.
 *
 * Промт 46 H2: trashed клиенты НЕ показываются в рабочем списке /dealer-base.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { buildDealerBaseRowsWithActualization } from "../client-base-actualization-data-merge";
import {
  mergeTrashedDealersForUi,
  patchDealerTrashRuntime,
} from "../dealer-overrides-runtime";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { roleScopedDealerRowsForReal } from "../dealer-base-real-scope";
import { getReleaseClients } from "../release-client-data";
import { makeTrashedDealerInfo, snapshotDealerFromRow } from "../trash-dealer-helper";

const profile = {
  personaId: "p1",
  personaUserId: "u1",
  role: "sales_director" as const,
  city: "—",
} as unknown as Parameters<typeof buildDealerBaseRowsWithActualization>[1];

const nowIso = new Date().toISOString();
const state = createEmptyActualizationState();
state.manuallyCreatedDealersById = {
  D1: {
    id: "D1",
    fields: { name: "Trashed Co" },
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

// H2.1 default — нет D1 (trashed). D3 в рабочем списке.
{
  const rows = buildDealerBaseRowsWithActualization(state, profile, { releaseDealerRows: [] });
  assert.ok(!rows.find((r) => r.id === "D1"), "Default mode: trashed D1 не показывается");
  assert.ok(rows.find((r) => r.id === "D3"), "Default mode: active D3 присутствует");
}

// H2.2 includeTrashedDealers: true — D1 виден, D3 нет.
{
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeTrashedDealers: true,
    releaseDealerRows: [],
  });
  assert.ok(rows.find((r) => r.id === "D1"), "Trash mode: trashed D1 показывается");
  assert.ok(!rows.find((r) => r.id === "D3"), "Trash mode: active D3 скрыт");
}

// Удаление через trash, не legacy archive.
{
  const deleteState = createEmptyActualizationState();
  deleteState.manuallyCreatedDealersById = {
    DX: {
      id: "DX",
      fields: { name: "To Delete" },
      createdAt: nowIso,
      createdBy: "u1",
      createdByName: "U",
      source: "manual_actualization",
    },
  };
  deleteState.trashedDealersById = {
    DX: makeTrashedDealerInfo({
      dealerId: "DX",
      by: { userId: "u1", userName: "U" },
      snapshot: snapshotDealerFromRow({ fullName: "To Delete" }),
      source: "client_card_delete",
      nowIso,
    }),
  };
  const trashRows = buildDealerBaseRowsWithActualization(deleteState, profile, {
    includeTrashedDealers: true,
    releaseDealerRows: [],
  });
  assert.ok(trashRows.find((r) => r.id === "DX"), "Delete path: клиент в корзине");
}

console.log("data-merge-trash: ok (3 cases)");

// Промт 349B: manual с external1cCode на trashed seed виден в scope по MA-коду.
const seedKishchik = getReleaseClients().find((c) => c.code === "MA-MA078665");
assert.ok(seedKishchik, "fixture: seed Кищик");

const manualState = createEmptyActualizationState();
const manualId = "manual-dealer-20260616112924-xfiqga";
const nowManual = new Date().toISOString();
manualState.manuallyCreatedDealersById[manualId] = {
  id: manualId,
  internalCode: "TND-CL-000001",
  fields: {
    name: "Кищик Владимир Алексеевич ИП",
    city: "Краснодар",
    external1cCode: "MA-MA078665",
    managerUserId: "mgr-avetisyan-rs",
  },
  createdAt: nowManual,
  createdBy: "u1",
  createdByName: "U",
  source: "manual_actualization",
};
manualState.trashedDealersById[seedKishchik!.id] = makeTrashedDealerInfo({
  dealerId: seedKishchik!.id,
  by: { userId: "u1", userName: "U" },
  snapshot: snapshotDealerFromRow({ fullName: null }),
  source: "client_card_delete",
  nowIso: nowManual,
});

const manualRows = buildDealerBaseRowsWithActualization(manualState, profile, {
  releaseDealerRows: buildDealerRowsFromReleaseClients([seedKishchik!]),
});
assert.ok(
  manualRows.some((r) => r.id === manualId),
  "manual Кищик в рабочем списке при trashed seed",
);
assert.ok(
  !manualRows.some((r) => r.id === seedKishchik!.id),
  "trashed seed не в рабочем списке",
);

const manualRow = manualRows.find((r) => r.id === manualId)!;
assert.equal(manualRow.releaseCode, "TND-CL-000001");
assert.equal(manualRow.external1cCode, "MA-MA078665");

const scopeSnap = {
  me: { id: "mgr-uuid", role: "manager", fullName: "Аветисян", teamId: "team-uuid" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [],
} as import("../use-org-snapshot").OrgSnapshot;
const assignmentScope = { ownCodes: new Set(["MA-MA078665"]), teamCodes: new Set<string>() };
const scoped = roleScopedDealerRowsForReal(manualRows, scopeSnap, "sales_manager", undefined, assignmentScope);
assert.equal(scoped.length, 1, "manual матчится по external1cCode в assignments scope");
assert.equal(scoped[0]!.id, manualId);

console.log("data-merge-trash: ok (5 cases incl. prompt 349B)");

// Промт 397: merge trash из jsonb-state + dealer_overrides без флага fallback.
const afterFallbackExpiry = Date.parse("2026-07-01T00:00:00.000Z");
const realDateNow = Date.now;

function withMockedNow<T>(ms: number, fn: () => T): T {
  Date.now = () => ms;
  try {
    return fn();
  } finally {
    Date.now = realDateNow;
  }
}

function trashInfoForMerge(dealerId: string, trashedAt: string) {
  return {
    dealerId,
    trashedAt,
    trashedBy: "u1",
    trashedByName: "U",
    expiresAt: new Date(Date.parse(trashedAt) + 14 * 86400000).toISOString(),
    source: "client_bulk_delete" as const,
    snapshot: {
      fullName: "Test",
      city: null,
      inn: null,
      dealerCode: null,
      legalEntityName: null,
    },
  };
}

// merge-trash-reads-from-blob-without-fallback-flag
{
  const act = createEmptyActualizationState();
  act.trashedDealersById = {
    "client-x": trashInfoForMerge("client-x", "2026-06-17T10:00:00.000Z"),
  };
  const merged = withMockedNow(afterFallbackExpiry, () => mergeTrashedDealersForUi(act));
  assert.equal(Object.keys(merged).length, 1, "merge-trash-reads-from-blob-without-fallback-flag");
  assert.ok(merged["client-x"], "client-x из blob");
}

// merge-trash-collision-prefers-newer-trashedAt
{
  const act = createEmptyActualizationState();
  act.trashedDealersById = {
    "client-x": trashInfoForMerge("client-x", "2026-06-17T10:00:00.000Z"),
  };
  patchDealerTrashRuntime("client-x", trashInfoForMerge("client-x", "2026-06-10T10:00:00.000Z"));
  const merged = withMockedNow(afterFallbackExpiry, () => mergeTrashedDealersForUi(act));
  assert.equal(merged["client-x"]?.trashedAt, "2026-06-17T10:00:00.000Z", "blob побеждает при более свежем trashedAt");
  patchDealerTrashRuntime("client-x", null);
}

// merge-trash-falls-back-to-db-only-when-blob-empty
{
  const act = createEmptyActualizationState();
  patchDealerTrashRuntime("client-y", trashInfoForMerge("client-y", "2026-06-12T10:00:00.000Z"));
  const merged = withMockedNow(afterFallbackExpiry, () => mergeTrashedDealersForUi(act));
  assert.ok(merged["client-y"], "merge-trash-falls-back-to-db-only-when-blob-empty");
  patchDealerTrashRuntime("client-y", null);
}

console.log("data-merge-trash: ok (8 cases incl. prompt 397)");
