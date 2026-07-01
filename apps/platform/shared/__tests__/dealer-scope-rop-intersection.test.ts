/**
 * Запуск: `npx tsx shared/__tests__/dealer-scope-rop-intersection.test.ts` из apps/platform.
 */
import assert from "node:assert/strict";
import type { DbScopeResult } from "../db-scope-formula.js";
import {
  intersectExternalKeyLists,
  intersectTargetDealerScopeWithViewerZone,
} from "../dealer-scope-rop-intersection.js";

function scopeWithKeys(keys: string[]): DbScopeResult {
  return {
    totals: {
      active_dealers: keys.length,
      active_trade_points: keys.length,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
    active_dealer_ids: keys.map((k, i) => `id-${i}`),
    active_dealer_external_keys: keys,
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    scope_explanation: {
      role: "manager",
      team_ids: [],
      own_codes: keys.length,
      team_codes: 0,
      granted_codes: 0,
      all_codes: keys.length,
      full_catalog: false,
    },
  };
}

// РОП без членства: зона {A,B}, портфель {A,B,C} → {A,B}
{
  const inter = intersectExternalKeyLists(
    ["client-ma-a", "client-ma-b", "client-ma-c"],
    ["client-ma-a", "client-ma-b"],
  );
  assert.deepEqual(inter.sort(), ["client-ma-a", "client-ma-b"]);
  const intersected = intersectTargetDealerScopeWithViewerZone(
    scopeWithKeys(["client-ma-a", "client-ma-b", "client-ma-c"]),
    ["client-ma-a", "client-ma-b"],
  );
  assert.equal(intersected.active_dealer_external_keys.length, 2);
  assert.deepEqual(intersected.active_dealer_external_keys.sort(), ["client-ma-a", "client-ma-b"]);
  assert.equal(intersected.totals.active_dealers, 2);
}

// зона {D}, портфель {A,B,C} → пусто
{
  const inter = intersectExternalKeyLists(
    ["client-ma-a", "client-ma-b", "client-ma-c"],
    ["client-ma-d"],
  );
  assert.equal(inter.length, 0);
}

// нормализация MA-... ↔ client-ma-...
{
  const inter = intersectExternalKeyLists(["client-ma0002241"], ["MA0002241"]);
  assert.deepEqual(inter, ["client-ma0002241"]);
}

console.log("dealer-scope-rop-intersection: ok");
