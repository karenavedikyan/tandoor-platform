/**
 * npm run test:overrides-persona-fields
 */
import assert from "node:assert/strict";
import { sanitizeDealerOverrideFieldsForApi } from "../overrides-persona-fields.js";

const mapped = sanitizeDealerOverrideFieldsForApi({
  regional_manager_id: "mgr-ilyuchenko-an",
  regional_manager_name: "Илюченко Александр Николаевич",
});
assert.equal(mapped.regional_manager_id, "e60f1a83-88ae-41f8-8c32-edd91f666e8d");
assert.equal(mapped.regional_manager_name, "Илюченко Александр Николаевич");

const stripped = sanitizeDealerOverrideFieldsForApi({
  regional_manager_id: "mgr-fake-unknown",
});
assert.equal("regional_manager_id" in stripped, false);

const uuid = sanitizeDealerOverrideFieldsForApi({
  regional_manager_id: "e60f1a83-88ae-41f8-8c32-edd91f666e8d",
});
assert.equal(uuid.regional_manager_id, "e60f1a83-88ae-41f8-8c32-edd91f666e8d");

console.log("overrides-persona-fields: ok");
