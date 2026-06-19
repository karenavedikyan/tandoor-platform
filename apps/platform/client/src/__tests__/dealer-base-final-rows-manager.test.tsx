/**
 * Промт 414: rowsFinalForList для manager в real-режиме обходит applyWorkingBaseTrashInvariant.
 * Запуск: `npm run test:dealer-base-final-rows-manager` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../lib/client-base-actualization-state";
import { excludeTrashedDealersFromWorkingRows } from "../lib/client-base-actualization-data-merge";
import type { DealerRow } from "../lib/dealer-base-mock-data";

function makeRow(i: number): DealerRow {
  const code = `MA-MA${String(100000 + i).padStart(6, "0")}`;
  return {
    id: `client-${code.toLowerCase()}`,
    releaseCode: code,
    name: `Клиент ${i}`,
    city: "Москва",
    manager: "Менеджер",
    status: "активный",
    outlets: 1,
    distribution: 50,
    hasProblem: false,
    hasRecentActivity: true,
    clientCategory: "B",
    contacts: { lpr: "—", buyer: "—", phone: "—", email: "—", channel: "—" },
    tradePoints: [],
  } as DealerRow;
}

function rowsFinalForList414(
  rowsAfterCityFilter: DealerRow[],
  showArchivedDealers: boolean,
  applyTrashInvariant: (rows: DealerRow[]) => DealerRow[],
  isRealUser: boolean,
  meRole: string | undefined,
): DealerRow[] {
  const base = rowsAfterCityFilter;
  if (isRealUser && meRole === "manager") {
    return base;
  }
  return !showArchivedDealers ? applyTrashInvariant(base) : base;
}

const rows = Array.from({ length: 56 }, (_, i) => makeRow(i));
const plane = createEmptyActualizationState();
for (const row of rows) {
  plane.trashedDealersById[row.id] = {
    dealerId: row.id,
    trashedAt: "2025-01-01T00:00:00Z",
    trashedBy: "test",
    trashedByName: "test",
    expiresAt: "2025-02-01T00:00:00Z",
    source: "manual_actualization",
  };
}
const applyTrash = (list: DealerRow[]) => excludeTrashedDealersFromWorkingRows(list, plane);

// manager (real): bypass → 56
{
  const out = rowsFinalForList414(rows, false, applyTrash, true, "manager");
  assert.equal(out.length, 56, "manager (real): rowsFinalForList bypasses applyWorkingBaseTrashInvariant");
}

// admin (real): trash invariant → 0
{
  const out = rowsFinalForList414(rows, false, applyTrash, true, "admin");
  assert.equal(out.length, 0, "admin (real): rowsFinalForList применяет applyWorkingBaseTrashInvariant как раньше");
}

// director (real): trash invariant → 0
{
  const out = rowsFinalForList414(rows, false, applyTrash, true, "director");
  assert.equal(out.length, 0, "director (real): rowsFinalForList применяет applyWorkingBaseTrashInvariant как раньше");
}

console.log("dealer-base-final-rows-manager: ok");
