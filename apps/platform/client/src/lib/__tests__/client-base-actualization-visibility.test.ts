/**
 * Запуск: `npm run test:client-base-actualization-visibility` из каталога apps/platform.
 *
 * Промт 349C: fallback имени в корзине.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { buildDealerBaseRowsWithActualization } from "../client-base-actualization-data-merge";
import { isDealerTrashedInRuntime } from "../dealer-overrides-runtime";
import { resolveTrashedDealerDisplayName } from "../client-base-actualization-visibility";
import { buildReleaseClientByDealerId } from "../trash-archive-helpers";
import { getReleaseClients } from "../release-client-data";
import { makeTrashedDealerInfo, snapshotDealerFromRow } from "../trash-dealer-helper";

const releaseById = buildReleaseClientByDealerId(getReleaseClients());
const seedKishchik = getReleaseClients().find((c) => c.code === "MA-MA078665");
assert.ok(seedKishchik, "fixture: seed Кищик");

const state = createEmptyActualizationState();
const trashed = makeTrashedDealerInfo({
  dealerId: seedKishchik!.id,
  by: { userId: "u1", userName: "U" },
  snapshot: snapshotDealerFromRow({ fullName: null, city: null, inn: null, dealerCode: null }),
  source: "client_card_delete",
});

const display = resolveTrashedDealerDisplayName(trashed, state, releaseById);
assert.equal(display.name, seedKishchik!.name, "пустой snapshot → имя из seed");
assert.notEqual(display.name, "—");
assert.notEqual(display.name, "Клиент без имени");

const manualId = "manual-dealer-empty-name";
state.manuallyCreatedDealersById[manualId] = {
  id: manualId,
  internalCode: "TND-CL-000099",
  fields: { name: "Ручной клиент Тест" },
  createdAt: new Date().toISOString(),
  createdBy: "u1",
  createdByName: "U",
  source: "manual_actualization",
};
const trashedManual = makeTrashedDealerInfo({
  dealerId: manualId,
  by: { userId: "u1", userName: "U" },
  snapshot: snapshotDealerFromRow({ fullName: null }),
  source: "client_card_delete",
});
const manualDisplay = resolveTrashedDealerDisplayName(trashedManual, state, releaseById);
assert.equal(manualDisplay.name, "Ручной клиент Тест");

const unknownId = "client-unknown-xyz";
const trashedUnknown = makeTrashedDealerInfo({
  dealerId: unknownId,
  by: { userId: "u1", userName: "U" },
  snapshot: snapshotDealerFromRow({ fullName: null, dealerCode: "MA-UNK-1" }),
  source: "client_card_delete",
});
const unknownDisplay = resolveTrashedDealerDisplayName(trashedUnknown, state, releaseById);
assert.equal(unknownDisplay.name, "MA-UNK-1", "крайний fallback: код из snapshot");

// dealer-trashed-in-blob-counts-as-trashed-without-fallback-flag (Промт 397)
{
  const afterExpiry = Date.parse("2026-07-01T00:00:00.000Z");
  const realDateNow = Date.now;
  Date.now = () => afterExpiry;
  try {
    const act = createEmptyActualizationState();
    act.manuallyCreatedDealersById = {
      D1: {
        id: "D1",
        fields: { name: "Trashed Co" },
        createdAt: new Date().toISOString(),
        createdBy: "u1",
        createdByName: "U",
        source: "manual_actualization",
      },
    };
    act.trashedDealersById = {
      D1: makeTrashedDealerInfo({
        dealerId: "D1",
        by: { userId: "u1", userName: "U" },
        snapshot: snapshotDealerFromRow({ fullName: "Trashed Co" }),
        source: "client_bulk_delete",
      }),
    };
    assert.ok(isDealerTrashedInRuntime("D1", act), "blob trashed в runtime");
    const rows = buildDealerBaseRowsWithActualization(act, {
      personaId: "p1",
      personaUserId: "u1",
      role: "sales_director",
      city: "—",
    } as Parameters<typeof buildDealerBaseRowsWithActualization>[1], { releaseDealerRows: [] });
    assert.ok(!rows.find((r) => r.id === "D1"), "trashed в blob скрыт из рабочей базы");
  } finally {
    Date.now = realDateNow;
  }
}

console.log("client-base-actualization-visibility.test.ts: OK");
