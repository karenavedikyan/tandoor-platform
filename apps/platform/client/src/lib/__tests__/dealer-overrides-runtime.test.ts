/**
 * Запуск: npm run test:dealer-overrides-runtime (из apps/platform).
 *
 * Промт 113.4: после гидрации runtime отдаёт оверрайд; без записи — null.
 */
import assert from "node:assert/strict";

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
} = await import("../dealer-overrides-runtime.js");

applyDealerOverridesRuntime(
  [
    {
      dealer_id: "client-ma-ma017341",
      name: null,
      city: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      general_comment: null,
      client_category: "top150",
      trashed_at: null,
      trashed_by: null,
      unloading_order: null,
      regional_manager_id: null,
      regional_manager_name: null,
      rop_id: null,
      rop_name: null,
      created_at: "2026-05-27T07:34:38.000Z",
      updated_at: "2026-05-27T07:34:38.000Z",
      updated_by: "u-test",
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

console.log("dealer-overrides-runtime.test.ts: ok");
