/**
 * npm run test:overrides-uuid-validation
 */
import assert from "node:assert/strict";
import {
  OverridesValidationError,
  sanitizeDealerOverrideUuidFields,
} from "../overrides-uuid-validation.js";

const ok = sanitizeDealerOverrideUuidFields({
  regional_manager_id: "mgr-ilyuchenko-an",
});
assert.equal(ok.regional_manager_id, "e60f1a83-88ae-41f8-8c32-edd91f666e8d");

assert.throws(
  () =>
    sanitizeDealerOverrideUuidFields({
      regional_manager_id: "mgr-fake-code",
    }),
  (e) => e instanceof OverridesValidationError && e.field === "regional_manager_id",
);

console.log("overrides-uuid-validation: ok");
