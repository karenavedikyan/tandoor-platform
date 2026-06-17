/**
 * Запуск: `npm run test:web-vitals-reporter` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  buildWebVitalsPayload,
  currentAppPathname,
  isClientWebVitalsEnabled,
  resetWebVitalsReporterForTests,
} from "../web-vitals-reporter";
import { serializeWebVitalsBeaconPayload, validateWebVitalsPayload } from "../../../../shared/web-vitals-handlers.js";

resetWebVitalsReporterForTests();

const payload = buildWebVitalsPayload(
  {
    name: "LCP",
    value: 2100,
    rating: "good",
    entries: [],
    id: "v1",
    navigationType: "navigate",
    delta: 2100,
  },
  "director",
  "abc123def4567890",
);

assert.equal(payload.name, "LCP");
assert.equal(payload.value, 2100);
assert.equal(payload.rating, "good");
assert.equal(payload.role, "director");
assert.equal(payload.user_hash, "abc123def4567890");
assert.ok(typeof payload.pathname === "string");
assert.ok(!JSON.stringify(payload).includes("user_id"));
assert.equal(payload.user_hash.length, 16);

const json = serializeWebVitalsBeaconPayload({
  name: "LCP",
  value: 3200,
  rating: "needs-improvement",
  pathname: "/catalog",
  role: "admin",
  user_hash: "deadbeefcafebabe",
  user_agent: "test",
  connection: "4g",
  viewport_width: 390,
  timestamp: 1_700_000_000_000,
});
assert.ok(json.includes('"pathname":"/catalog"'));
assert.ok(json.includes('"rating":"needs-improvement"'));

const parsed = validateWebVitalsPayload(JSON.parse(json));
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.data.name, "LCP");
  assert.equal(parsed.data.pathname, "/catalog");
}

assert.equal(typeof isClientWebVitalsEnabled(), "boolean");
assert.equal(typeof currentAppPathname(), "string");

console.log("web-vitals-reporter: ok");
