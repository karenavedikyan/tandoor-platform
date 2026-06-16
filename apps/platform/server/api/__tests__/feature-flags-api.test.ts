/**
 * Запуск: `npm run test:feature-flags-api` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { getFeatureFlags } from "../feature-flags-api.js";

const prevDb = process.env.USE_DB_DEALERS;
const prevShadow = process.env.SHADOW_DIFF_ENABLED;

try {
  process.env.USE_DB_DEALERS = "true";
  process.env.SHADOW_DIFF_ENABLED = "false";
  const on = getFeatureFlags();
  assert.equal(on.flags.USE_DB_DEALERS, true);
  assert.equal(on.flags.SHADOW_DIFF_ENABLED, false);

  process.env.USE_DB_DEALERS = "false";
  const off = getFeatureFlags();
  assert.equal(off.flags.USE_DB_DEALERS, false);
} finally {
  if (prevDb === undefined) delete process.env.USE_DB_DEALERS;
  else process.env.USE_DB_DEALERS = prevDb;
  if (prevShadow === undefined) delete process.env.SHADOW_DIFF_ENABLED;
  else process.env.SHADOW_DIFF_ENABLED = prevShadow;
}

console.log("feature-flags-api.test.ts: ok");
