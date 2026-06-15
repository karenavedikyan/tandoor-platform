/**
 * Запуск: `npm run test:real-scope-audit-handlers` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  parseAuditBody,
  persistRealScopeAuditBatch,
  type RealScopeAuditPayload,
} from "../real-scope-audit-handlers.js";

// parseAuditBody
{
  assert.deepEqual(parseAuditBody(undefined), { events: [] });
  assert.deepEqual(parseAuditBody(null), { events: [] });
  assert.deepEqual(parseAuditBody("not-json"), { events: [] });
}

{
  const payload: RealScopeAuditPayload = {
    events: [
      {
        callSite: "smoke@unit",
        profileRole: "team_lead",
        personaUserId: "user-tl-kupiansky",
        reason: "demo-fallback-for-real-user",
      },
    ],
    timestamp: 1,
  };
  assert.deepEqual(parseAuditBody(JSON.stringify(payload)), payload);
  assert.deepEqual(parseAuditBody(payload), payload);
}

// persistRealScopeAuditBatch — count валидных строк
{
  let queryCalls = 0;
  const pool: PoolLike = {
    query: async () => {
      queryCalls++;
      return { rows: [] };
    },
  };

  const written = await persistRealScopeAuditBatch(pool, {
    events: [
      {
        callSite: "valid@x",
        profileRole: "team_lead",
        personaUserId: "p1",
        reason: "demo-fallback-for-real-user",
      },
      {
        callSite: "",
        profileRole: "team_lead",
        personaUserId: "p2",
        reason: "demo-fallback-for-real-user",
      },
      {
        callSite: "valid2@x",
        profileRole: "team_lead",
        personaUserId: "p3",
        reason: "demo-fallback-for-real-user",
        eventCount: 2,
      },
    ],
  });

  assert.equal(written, 2);
  assert.equal(queryCalls, 2);
}

{
  const pool: PoolLike = { query: async () => ({ rows: [] }) };
  const written = await persistRealScopeAuditBatch(pool, { events: [] });
  assert.equal(written, 0);
}

// string body → persist (сценарий Vercel @vercel/node)
{
  let queryCalls = 0;
  const pool: PoolLike = {
    query: async () => {
      queryCalls++;
      return { rows: [] };
    },
  };

  const body = parseAuditBody(
    '{"events":[{"callSite":"string-body@x","profileRole":"team_lead","personaUserId":"p","reason":"demo-fallback-for-real-user"}]}',
  );
  assert.equal(Array.isArray(body.events), true);
  assert.equal(body.events?.length, 1);

  const written = await persistRealScopeAuditBatch(pool, body);
  assert.equal(written, 1);
  assert.equal(queryCalls, 1);
}

console.log("real-scope-audit-handlers: ok");
