/**
 * Запуск: `npm run test:perf-endpoint` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  checkWebVitalsRateLimit,
  resetWebVitalsRateLimitForTests,
  validateWebVitalsPayload,
  isWebVitalsEnabled,
} from "../web-vitals-handlers.js";

resetWebVitalsRateLimitForTests();

const valid = validateWebVitalsPayload({
  name: "LCP",
  value: 1850,
  rating: "good",
  pathname: "/dealer-base",
  role: "manager",
  user_hash: "a".repeat(16),
  viewport_width: 1440,
});
assert.equal(valid.ok, true);

const invalidName = validateWebVitalsPayload({ name: "FID", value: 10, pathname: "/tasks" });
assert.equal(invalidName.ok, false);

const invalidValue = validateWebVitalsPayload({ name: "LCP", value: 0, pathname: "/tasks" });
assert.equal(invalidValue.ok, false);

const invalidPath = validateWebVitalsPayload({ name: "INP", value: 120, pathname: "" });
assert.equal(invalidPath.ok, false);

const ip = "203.0.113.10";
for (let i = 0; i < 100; i += 1) {
  assert.equal(checkWebVitalsRateLimit(ip), true);
}
assert.equal(checkWebVitalsRateLimit(ip), false);
assert.equal(checkWebVitalsRateLimit("203.0.113.11"), true);

assert.equal(typeof isWebVitalsEnabled(), "boolean");

console.log("perf-endpoint: ok");
