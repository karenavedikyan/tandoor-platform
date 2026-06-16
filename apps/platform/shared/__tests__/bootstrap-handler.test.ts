/**
 * Запуск: `npm run test:bootstrap-handler` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../admin/admin-auth.js";
import { buildBootstrapPayloadCore } from "../bootstrap-handler-core.js";
import { hashEtag, resetApiLruCache } from "../api-lru-cache.js";

resetApiLruCache();

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type MockRule = {
  match: (sql: string, params?: unknown[]) => boolean;
  rows: Record<string, unknown>[];
};

function mockPool(rules: MockRule[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      for (const rule of rules) {
        if (rule.match(s, params)) return { rows: rule.rows };
      }
      return { rows: [] };
    },
  };
}

const adminUser = {
  id: ADMIN_ID,
  email: "dir@test.local",
  fullName: "Director",
  role: "director",
  status: "active",
};

const ropUser = {
  id: ROP_ID,
  email: "rop@test.local",
  fullName: "Rop",
  role: "rop",
  status: "active",
};

const stubLoaders = {
  fetchMyClientCodes: async () => ({
    success: true,
    ownCodes: [],
    teamCodes: [],
    grantedCodes: [],
    responsibleByCode: {},
    meta: { role: "director", userId: ADMIN_ID, isAdmin: false, isDirector: true, isRop: false, isManager: false },
  }),
  getFeatureFlags: () => ({ success: true, flags: { USE_DB_DEALERS: true, SHADOW_DIFF_ENABLED: false } }),
  loadActualizationState: async () => ({
    success: true,
    storageMode: "not_configured",
    state: { version: 1 },
    updatedAt: null,
  }),
};

// Director — all visible codes
{
  const pool = mockPool([
    { match: (s) => s.includes("FROM teams t"), rows: [] },
    { match: (s) => s.includes("FROM users u") && s.includes("user_team_memberships"), rows: [] },
    { match: (s) => s.includes("role = 'admin'"), rows: [] },
    { match: (s) => s.includes("user_team_memberships WHERE user_id"), rows: [] },
  ]);
  const body = await buildBootstrapPayloadCore(pool, adminUser, stubLoaders);
  assert.equal(body.user?.id, ADMIN_ID);
  assert.equal(body.my_visible_codes?.all, true);
  assert.ok(body.etag.startsWith("v1-"));
  assert.ok(body.feature_flags);
  assert.ok(body.actualization_state);
}

// ROP — scoped visible codes
{
  const pool = mockPool([
    { match: (s) => s.includes("FROM teams t"), rows: [{ id: "t1", name: "Team", rop_user_id: ROP_ID, rop_name: "Rop" }] },
    {
      match: (s) => s.includes("FROM users u") && s.includes("user_team_memberships"),
      rows: [{ id: ROP_ID, full_name: "Rop", role: "rop", status: "active", team_id: "t1" }],
    },
    { match: (s) => s.includes("role = 'admin'"), rows: [] },
    { match: (s) => s.includes("user_team_memberships WHERE user_id"), rows: [{ team_id: "t1" }] },
    {
      match: (s) => s.includes("FROM client_assignments ca") && s.includes("rop_user_id"),
      rows: [{ client_code: "C001", responsible_user_id: ROP_ID, team_id: "t1" }],
    },
    { match: (s) => s.includes("FROM rop_client_grants"), rows: [] },
    { match: (s) => s.includes("DISTINCT client_code FROM client_assignments WHERE responsible_user_id"), rows: [] },
  ]);
  const body = await buildBootstrapPayloadCore(pool, ropUser, {
    ...stubLoaders,
    fetchMyClientCodes: async () => ({
      success: true,
      ownCodes: [],
      teamCodes: ["C001"],
      grantedCodes: [],
      responsibleByCode: {},
      meta: { role: "rop", userId: ROP_ID, isAdmin: false, isDirector: false, isRop: true, isManager: false },
    }),
  });
  assert.equal(body.my_visible_codes?.all, false);
  assert.ok(body.my_visible_codes?.codes?.includes("C001"));
}

// Partial errors when subsection throws
{
  const poolThrowOrg: PoolLike = {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM teams t")) throw new Error("db_fail");
      return { rows: [] };
    },
  };
  const body = await buildBootstrapPayloadCore(poolThrowOrg, adminUser, stubLoaders);
  assert.ok(body.errors?.includes("my_org_snapshot"));
  assert.equal(body.my_org_snapshot, undefined);
  assert.ok(body.user);
}

// etag in body
{
  const payload = { user: { id: "1" }, feature_flags: { flags: {} }, server_time: "t", etag: "" };
  const { etag: _e, server_time: _s, ...rest } = payload;
  const etag = hashEtag(rest);
  assert.ok(etag.startsWith("v1-"));
}

console.log("bootstrap-handler: ok");
