/**
 * Запуск: npx tsx client/src/lib/__tests__/distribution-fullscreen-entry-segments.test.ts
 */
import assert from "node:assert/strict";
import {
  activeFullscreenSegmentCategory,
  isFullscreenSegmentTabsVisible,
  segmentContextFromCategories,
} from "../distribution-fullscreen-entry-segments.js";

assert.equal(isFullscreenSegmentTabsVisible("all"), true);
assert.equal(isFullscreenSegmentTabsVisible("installed"), true);
assert.equal(isFullscreenSegmentTabsVisible("need_install"), true);

assert.equal(segmentContextFromCategories([]), "vh");
assert.equal(segmentContextFromCategories(["vh"]), "vh");
assert.equal(segmentContextFromCategories(["mk"]), "mk");
assert.equal(segmentContextFromCategories(["hardware"]), "hardware");
assert.equal(segmentContextFromCategories(["vh", "mk"]), "mk");

assert.equal(activeFullscreenSegmentCategory([], false), "all");
assert.equal(activeFullscreenSegmentCategory([], true), "vh");
assert.equal(activeFullscreenSegmentCategory(["mk"], true), "mk");
assert.equal(activeFullscreenSegmentCategory(["hardware", "vh"], true), "vh");

console.log("distribution-fullscreen-entry-segments: ok");
