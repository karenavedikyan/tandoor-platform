/**
 * Запуск: npx vitest run client/src/lib/__tests__/showcase-placement-labels.test.ts
 */
import assert from "node:assert/strict";
import {
  allowedTypesForSegment,
  DOOR_PLACEMENT_TYPES,
  PLACEMENT_QUALITY_WEIGHT,
  PLACEMENT_TYPE_LABEL_RU,
} from "../showcase-placement-labels";

assert.equal(PLACEMENT_TYPE_LABEL_RU.portal_second, "2-й план");
assert.equal(PLACEMENT_QUALITY_WEIGHT.portal_second, 1.0);
assert.ok(DOOR_PLACEMENT_TYPES.includes("portal_second"));

const vhTypes = allowedTypesForSegment("vh");
assert.ok(!vhTypes.includes("portal_second"));
assert.deepEqual(vhTypes, ["portal", "cube", "book", "hoof", "unmounted"]);

const mkTypes = allowedTypesForSegment("mk");
assert.ok(mkTypes.includes("portal_second"));
assert.equal(mkTypes.indexOf("portal_second"), mkTypes.indexOf("portal") + 1);
assert.deepEqual(mkTypes, ["portal", "portal_second", "cube", "book", "hoof", "unmounted"]);

const hwTypes = allowedTypesForSegment("hardware");
assert.ok(!hwTypes.includes("portal_second"));

console.log("showcase-placement-labels: ok");
