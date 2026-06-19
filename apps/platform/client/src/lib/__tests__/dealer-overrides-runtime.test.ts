/**
 * Запуск: npm run test:dealer-overrides-runtime (из apps/platform).
 *
 * Промт 113.4: после гидрации runtime отдаёт оверрайд; без записи — null.
 * Промт 402: purge-pending скрыт из корзины, но скрывает из активного списка.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";

// @ts-expect-error test shim
globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

const {
  applyDealerOverridesRuntime,
  getDealerOverride,
  getDbClientCategoryOverride,
  isDealerTrashedInRuntime,
  mergeTrashedDealersForUi,
  patchDealerPurgePendingRuntime,
  patchDealerTrashRuntime,
} = await import("../dealer-overrides-runtime.js");

const DEALER_EMPLOYEE_TRASH = "client-employee-trash";
const DEALER_PURGE_PENDING = "client-purge-pending";
const DEALER_PURGED = "client-purged";
const DEALER_PATCH = "client-patch-purge";

function baseOverride(dealerId: string, status: "active" | "in_trash" | "pending_admin" | "purged" = "active") {
  return {
    dealer_id: dealerId,
    status,
    name: null,
    city: null,
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    general_comment: null,
    client_category: null,
    trashed_at: null,
    trashed_by: null,
    purge_requested_at: null,
    purge_requested_by: null,
    purged_at: null,
    purged_by: null,
    unloading_order: null,
    regional_manager_id: null,
    regional_manager_name: null,
    rop_id: null,
    rop_name: null,
    created_at: "2026-05-27T07:34:38.000Z",
    updated_at: "2026-05-27T07:34:38.000Z",
    updated_by: "u-test",
  };
}

applyDealerOverridesRuntime(
  [
    {
      ...baseOverride("client-ma-ma017341"),
      client_category: "top150",
    },
    {
      ...baseOverride(DEALER_EMPLOYEE_TRASH, "in_trash"),
      trashed_at: "2026-06-01T10:00:00.000Z",
      trashed_by: "mgr-1",
    },
    {
      ...baseOverride(DEALER_PURGE_PENDING, "pending_admin"),
      trashed_at: "2026-06-02T10:00:00.000Z",
      trashed_by: "mgr-1",
      purge_requested_at: "2026-06-03T10:00:00.000Z",
      purge_requested_by: "mgr-1",
    },
    {
      ...baseOverride(DEALER_PURGED, "purged"),
      trashed_at: "2026-06-02T10:00:00.000Z",
      trashed_by: "mgr-1",
      purge_requested_at: "2026-06-03T10:00:00.000Z",
      purge_requested_by: "mgr-1",
      purged_at: "2026-06-04T10:00:00.000Z",
      purged_by: "admin-1",
    },
  ],
  [],
  [],
);

{
  const row = getDealerOverride("client-ma-ma017341");
  assert.ok(row, "override row exists after apply");
  assert.equal(row?.client_category, "top150");
  assert.equal(getDbClientCategoryOverride("client-ma-ma017341"), "top150");
}

{
  assert.equal(getDealerOverride("unknown-dealer"), null);
  assert.equal(getDbClientCategoryOverride("unknown-dealer"), undefined);
}

// employee trash: in runtime trash + merge UI
{
  const act = createEmptyActualizationState();
  assert.equal(isDealerTrashedInRuntime(DEALER_EMPLOYEE_TRASH, act), true);
  const merged = mergeTrashedDealersForUi(act);
  assert.ok(merged[DEALER_EMPLOYEE_TRASH], "employee trash in mergeTrashedDealersForUi");
}

// purge pending: hidden from trash merge, still trashed for active list
{
  const act = createEmptyActualizationState();
  act.trashedDealersById = {
    [DEALER_PURGE_PENDING]: {
      dealerId: DEALER_PURGE_PENDING,
      trashedAt: "2026-06-02T10:00:00.000Z",
      trashedBy: "mgr-1",
      trashedByName: "M",
      expiresAt: "2026-06-16T10:00:00.000Z",
      source: "client_bulk_delete",
      snapshot: { fullName: null, city: null, inn: null, dealerCode: null, legalEntityName: null },
    },
  };
  assert.equal(isDealerTrashedInRuntime(DEALER_PURGE_PENDING, act), true);
  const merged = mergeTrashedDealersForUi(act);
  assert.equal(merged[DEALER_PURGE_PENDING], undefined, "purge pending not in trash UI");
}

// purged: not trashed anywhere
{
  const act = createEmptyActualizationState();
  assert.equal(isDealerTrashedInRuntime(DEALER_PURGED, act), false);
  const merged = mergeTrashedDealersForUi(act);
  assert.equal(merged[DEALER_PURGED], undefined);
}

// optimistic patch: purge pending hides from active + trash
{
  const act = createEmptyActualizationState();
  patchDealerTrashRuntime(DEALER_PATCH, {
    dealerId: DEALER_PATCH,
    trashedAt: "2026-06-10T10:00:00.000Z",
    trashedBy: "mgr-1",
    trashedByName: "M",
    expiresAt: "2026-06-24T10:00:00.000Z",
    source: "client_bulk_delete",
    snapshot: { fullName: null, city: null, inn: null, dealerCode: null, legalEntityName: null },
  });
  assert.equal(isDealerTrashedInRuntime(DEALER_PATCH, act), true);
  patchDealerPurgePendingRuntime(DEALER_PATCH, true);
  patchDealerTrashRuntime(DEALER_PATCH, null);
  assert.equal(isDealerTrashedInRuntime(DEALER_PATCH, act), true, "still hidden from active list");
  assert.equal(mergeTrashedDealersForUi(act)[DEALER_PATCH], undefined, "removed from trash UI");
  patchDealerPurgePendingRuntime(DEALER_PATCH, false);
}

console.log("dealer-overrides-runtime.test.ts: ok (402 purge-pending)");
