/**
 * Промт 400: GET /api/actualization/state резолвит userId из сессии.
 * Запуск: `npm run test:state-session-userid` из apps/platform.
 */
import assert from "node:assert/strict";
import type { VercelRequest } from "@vercel/node";
import { resolveRequestUserId } from "../../../shared/actualization-request-user.js";

const SKLYAROV = "dc958e02-d80e-4615-bb8a-8a46be70daed";
const ADMIN = "admin-uuid-0000-0000-0000-000000000001";

function mockReq(input: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): VercelRequest {
  return {
    query: input.query ?? {},
    headers: input.headers ?? {},
  } as VercelRequest;
}

const fakePool = {} as import("../../../shared/admin/admin-auth.js").PoolLike;

// explicit query userId wins over session
{
  const r = await resolveRequestUserId(
    mockReq({ query: { userId: "mgr-explicit" } }),
    {
      pool: fakePool,
      resolveSession: async () => ({
        me: { id: SKLYAROV, role: "manager", status: "active" },
        impersonatorUserId: null,
      }),
    },
  );
  assert.equal(r.userId, "mgr-explicit");
  assert.equal(r.fromSession, false);
}

// manager session without explicit userId → own id from session
{
  const r = await resolveRequestUserId(mockReq({ headers: { cookie: "session=manager" } }), {
    pool: fakePool,
    resolveSession: async () => ({
      me: { id: SKLYAROV, role: "manager", status: "active" },
      impersonatorUserId: null,
    }),
  });
  assert.equal(r.userId, SKLYAROV);
  assert.equal(r.fromSession, true);
  assert.equal(r.sessionRole, "manager");
}

// impersonate session → impersonated user (not admin)
{
  const r = await resolveRequestUserId(mockReq({ headers: { cookie: "session=impersonate" } }), {
    pool: fakePool,
    resolveSession: async () => ({
      me: { id: SKLYAROV, role: "manager", status: "active" },
      impersonatorUserId: ADMIN,
    }),
  });
  assert.equal(r.userId, SKLYAROV);
  assert.equal(r.fromSession, true);
  assert.equal(r.sessionRole, "manager");
}

// no explicit userId and no session → null
{
  const r = await resolveRequestUserId(mockReq({}), { pool: null });
  assert.equal(r.userId, null);
  assert.equal(r.fromSession, false);
}

// inactive session → null
{
  const r = await resolveRequestUserId(mockReq({ headers: { cookie: "session=inactive" } }), {
    pool: fakePool,
    resolveSession: async () => ({
      me: { id: SKLYAROV, role: "manager", status: "blocked" },
      impersonatorUserId: null,
    }),
  });
  assert.equal(r.userId, null);
  assert.equal(r.fromSession, false);
}

console.log("state-session-userid: ok (400)");
