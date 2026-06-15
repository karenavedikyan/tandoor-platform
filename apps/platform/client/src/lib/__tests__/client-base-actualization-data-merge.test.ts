/**
 * Запуск: `npm run test:client-base-actualization-data-merge` из каталога apps/platform.
 *
 * Промт 333: trash-инвариант рабочей базы + releaseDealerRows.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import {
  buildDealerBaseRowsWithActualization,
  excludeTrashedDealersFromWorkingRows,
} from "../client-base-actualization-data-merge";
import { buildDealerRowsFromReleaseClients } from "../dealer-base-mock-data";
import { getReleaseClients } from "../release-client-data";
import { makeTrashedDealerInfo, snapshotDealerFromRow } from "../trash-dealer-helper";
import type { ReleaseDemoProfile } from "../release-demo-profile";

const profile = {
  personaUserId: "u1",
  role: "sales_manager",
} as ReleaseDemoProfile;

const nowIso = new Date().toISOString();
const releaseClients = getReleaseClients();
const releaseRows = buildDealerRowsFromReleaseClients(releaseClients);
const releaseVictim = releaseRows[0]!;
assert.ok(releaseVictim?.id, "fixture: release row");

function stateWithReleaseTrashed(): ReturnType<typeof createEmptyActualizationState> {
  const state = createEmptyActualizationState();
  state.trashedDealersById[releaseVictim.id] = makeTrashedDealerInfo({
    dealerId: releaseVictim.id,
    by: { userId: "u1", userName: "U" },
    snapshot: snapshotDealerFromRow({
      fullName: releaseVictim.name,
      city: releaseVictim.city,
      inn: null,
      dealerCode: releaseVictim.releaseCode ?? null,
      legalEntityName: null,
    }),
    source: "client_bulk_delete",
    nowIso,
  });
  return state;
}

// Release-клиент в trashedDealersById не попадает в рабочий список.
{
  const state = stateWithReleaseTrashed();
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeArchivedDealers: false,
    releaseDealerRows: releaseRows,
  });
  assert.ok(!rows.some((r) => r.id === releaseVictim.id), "working: trashed release client excluded");
}

// Режим архива (UI) — trashed release client тоже не показывается.
{
  const state = stateWithReleaseTrashed();
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeArchivedDealers: true,
    releaseDealerRows: releaseRows,
  });
  assert.ok(!rows.some((r) => r.id === releaseVictim.id), "archive UI mode: trashed release client excluded");
}

// Режим корзины — trashed release client возвращается.
{
  const state = stateWithReleaseTrashed();
  const rows = buildDealerBaseRowsWithActualization(state, profile, {
    includeTrashedDealers: true,
    releaseDealerRows: releaseRows,
  });
  assert.ok(rows.some((r) => r.id === releaseVictim.id), "trash list mode: trashed release client included");
}

// Обходной путь: excludeTrashedDealersFromWorkingRows убирает trashed из «сырых» строк.
{
  const state = stateWithReleaseTrashed();
  const bypassRows = [
    { ...releaseVictim },
    { ...releaseRows[1]!, id: releaseRows[1]!.id },
  ];
  const filtered = excludeTrashedDealersFromWorkingRows(bypassRows, state);
  assert.ok(!filtered.some((r) => r.id === releaseVictim.id), "invariant filter removes trashed");
  assert.equal(filtered.length, 1, "invariant filter keeps active row");
}

console.log("client-base-actualization-data-merge: ok (4 cases)");
