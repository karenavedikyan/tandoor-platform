/**
 * Запуск: `npm run test:api-lru-cache` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  buildCacheKey,
  getCached,
  hashEtag,
  invalidate,
  resetApiLruCache,
  setCached,
} from "../api-lru-cache.js";

resetApiLruCache();

// MISS then HIT
const key = buildCacheKey(["auth-me", "user-a", "admin", ""]);
assert.equal(getCached(key), null);
const etag = setCached(key, { success: true, user: { id: "user-a" } }, 60_000);
assert.ok(etag.startsWith("v1-"));
const hit = getCached(key);
assert.ok(hit);
assert.equal(hit!.etag, etag);
assert.deepEqual(hit!.body, { success: true, user: { id: "user-a" } });

// Per-user isolation
const keyB = buildCacheKey(["auth-me", "user-b", "rop", ""]);
assert.equal(getCached(keyB), null);
setCached(keyB, { success: true, user: { id: "user-b" } }, 60_000);
assert.notEqual(getCached(key)!.body, getCached(keyB)!.body);

// invalidate(prefix)
invalidate("auth-me:user-a:");
assert.equal(getCached(key), null);
assert.ok(getCached(keyB));

// ETag hash stable
assert.equal(hashEtag({ a: 1 }), hashEtag({ a: 1 }));
assert.notEqual(hashEtag({ a: 1 }), hashEtag({ a: 2 }));

// TTL expiry
resetApiLruCache();
const shortKey = buildCacheKey(["test", "ttl"]);
setCached(shortKey, { v: 1 }, 1);
assert.ok(getCached(shortKey));
await new Promise((r) => setTimeout(r, 5));
assert.equal(getCached(shortKey), null);

console.log("api-lru-cache: ok");
