/**
 * Запуск: npx tsx client/src/lib/__tests__/client-base-team-actualization-batch.test.ts
 */
import assert from "node:assert/strict";
import {
  __testOnlyTeamActualizationCache,
  getTeamActualizationCacheKey,
  runWithTeamActualizationCache,
} from "../client-base-team-actualization-cache";

let fetchCalls = 0;

async function mockFetch(input: RequestInfo | URL): Promise<Response> {
  fetchCalls += 1;
  const url = typeof input === "string" ? input : input.toString();
  assert.ok(url.includes("userIds=u1"), "batch url contains userIds");
  assert.ok(url.includes("u2"), "batch url contains all ids");
  return new Response(
    JSON.stringify({
      success: true,
      storageMode: "persistent",
      parts: [
        { userId: "u1", state: { version: 1 }, updatedAt: "2026-06-01T00:00:00.000Z" },
        { userId: "u2", state: { version: 1 }, updatedAt: null },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const originalFetch = globalThis.fetch;

async function testBatchApiOneFetch(): Promise<void> {
  fetchCalls = 0;
  globalThis.fetch = mockFetch as typeof fetch;
  __testOnlyTeamActualizationCache().clear();
  const { fetchActualizationStateByUserIdsBatch } = await import("../client-base-actualization-api");
  const parts = await fetchActualizationStateByUserIdsBatch(["u1", "u2"], "team_lead");
  assert.equal(fetchCalls, 1, "one network fetch for two ids");
  assert.equal(parts.length, 2);
  assert.equal(parts[0]?.userId, "u1");
  assert.equal(parts[1]?.userId, "u2");
  assert.equal(parts[0]?.syncStatus, "api_ok");
}

async function testCacheDedupAndTtl(): Promise<void> {
  __testOnlyTeamActualizationCache().clear();
  let runs = 0;
  const key = getTeamActualizationCacheKey("all", ["b", "a"]);
  const fetcher = async () => {
    runs += 1;
    return { value: runs };
  };
  const p1 = runWithTeamActualizationCache(key, fetcher);
  const p2 = runWithTeamActualizationCache(key, fetcher);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.value, 1);
  assert.equal(r2.value, 1, "in-flight dedup");
  assert.equal(runs, 1, "single fetcher run");

  const r3 = await runWithTeamActualizationCache(key, fetcher);
  assert.equal(r3.value, 1, "ttl cache hit");

  await new Promise((r) => setTimeout(r, 20));
  // Force stale by manipulating - run again after short wait still within TTL
  const r4 = await runWithTeamActualizationCache(key, fetcher);
  assert.equal(r4.value, 1, "still cached within 15s window");
}

(async () => {
  try {
    await testBatchApiOneFetch();
    await testCacheDedupAndTtl();
    console.log("client-base-team-actualization-batch.test.ts: ok");
  } finally {
    globalThis.fetch = originalFetch;
    __testOnlyTeamActualizationCache().clear();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
