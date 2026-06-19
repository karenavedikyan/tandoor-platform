/**
 * Промт 420: счётчики сайдбара и корзины из одного DB-источника.
 */
import assert from "node:assert/strict";
import { sidebarCountsFromDbScope, type MyScopeFromDB } from "../hooks/use-my-scope-from-db";
import { mergeTrashedDealersForUi } from "../lib/dealer-overrides-runtime";
import { createEmptyActualizationState } from "../lib/client-base-actualization-state";
import { applyDealerOverridesRuntime } from "../lib/dealer-overrides-runtime";
import type { DealerOverrideRow } from "../../../shared/dealer-overrides-types";

function mockScope(active: number, trashed: number, trashedTp: number): MyScopeFromDB {
  return {
    success: true,
    loading: false,
    ready: true,
    error: false,
    forbidden: false,
    user: { id: "u1", email: "u@test", role: "manager" },
    scopeSubject: { id: "u1", email: "u@test", role: "manager" },
    totals: {
      active_dealers: active,
      active_trade_points: 0,
      trashed_dealers: trashed,
      trashed_trade_points: trashedTp,
    },
    active_dealer_ids: [],
    active_dealer_external_keys: [],
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    scope_explanation: {
      role: "manager",
      team_ids: [],
      own_codes: 0,
      team_codes: 0,
      granted_codes: 0,
      all_codes: 0,
      full_catalog: false,
    },
    activeDealerIdSet: new Set(),
    trashedDealerIdSet: new Set(),
    activeDealerExternalKeySet: new Set(),
    trashedDealerExternalKeySet: new Set(),
  };
}

const act = createEmptyActualizationState();
act.trashedDealersById["legacy-only"] = {
  dealerId: "legacy-only",
  trashedAt: new Date().toISOString(),
  trashedBy: "u1",
  trashedByName: "Legacy",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  source: "test",
  snapshot: {},
};

const overrides: DealerOverrideRow[] = [
  {
    dealer_id: "client-a",
    status: "in_trash",
    trashed_at: new Date().toISOString(),
    trashed_by: "u1",
    trashed_by_name: null,
    purge_requested_at: null,
    purge_requested_by: null,
    purged_at: null,
    purged_by: null,
    updated_at: new Date().toISOString(),
    updated_by: "u1",
  } as DealerOverrideRow,
  {
    dealer_id: "client-b",
    status: "in_trash",
    trashed_at: new Date().toISOString(),
    trashed_by: "u1",
    trashed_by_name: null,
    purge_requested_at: null,
    purge_requested_by: null,
    purged_at: null,
    purged_by: null,
    updated_at: new Date().toISOString(),
    updated_by: "u1",
  } as DealerOverrideRow,
];

applyDealerOverridesRuntime(overrides, [], []);

const sidebar = sidebarCountsFromDbScope(mockScope(53, 2, 0));
assert.equal(sidebar.dealers, 53);
assert.equal(sidebar.trashDealers, 2);

const trashUi = mergeTrashedDealersForUi(act);
assert.equal(Object.keys(trashUi).length, 2, "после гидрации jsonb legacy не влияет на корзину");
assert.ok(!trashUi["legacy-only"]);

console.log("sidebar-trash-badge-matches-page: ok");
