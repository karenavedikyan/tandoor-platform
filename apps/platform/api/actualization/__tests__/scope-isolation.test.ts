/**
 * Запуск: `npm run test:scope-isolation` из каталога apps/platform.
 *
 * Промт 49 — критичный RBAC-фикс. Менеджер должен видеть только свой scope в
 * GET /api/actualization/state; РОП — свою команду; директор/админ/аналитик/
 * маркетолог — все scope.
 *
 * Тесты в стиле tsx + node:assert/strict (как auth-access / trash / streak).
 */
import assert from "node:assert/strict";
import {
  canonicalizeRole,
  fetchActualizationBatchParts,
  fetchRopGrantOwnerUserIds,
  getBatchUserIds,
  fetchTeamScopedUserIds,
  resolveVisibleUserScopeKeys,
  type SqlFn,
} from "../state";

// =====================================================
// 1. canonicalizeRole
// =====================================================
{
  assert.equal(canonicalizeRole("manager"), "manager", "manager → manager");
  assert.equal(canonicalizeRole("sales_manager"), "manager", "sales_manager → manager");
  assert.equal(canonicalizeRole("MANAGER"), "manager", "case-insensitive");
  assert.equal(canonicalizeRole("  manager  "), "manager", "trim");

  assert.equal(canonicalizeRole("rop"), "rop", "rop → rop");
  assert.equal(canonicalizeRole("team_lead"), "rop", "team_lead → rop");

  assert.equal(canonicalizeRole("director"), "director", "director → director");
  assert.equal(canonicalizeRole("sales_director"), "director", "sales_director → director");

  assert.equal(canonicalizeRole("admin"), "admin", "admin → admin");
  assert.equal(canonicalizeRole("analyst"), "analyst", "analyst → analyst");
  assert.equal(canonicalizeRole("marketer"), "marketer", "marketer → marketer");

  assert.equal(canonicalizeRole(""), "unknown", "empty → unknown");
  assert.equal(canonicalizeRole(null), "unknown", "null → unknown");
  assert.equal(canonicalizeRole(undefined), "unknown", "undefined → unknown");
  assert.equal(canonicalizeRole("unknown_role"), "unknown", "unknown → unknown");
}

// =====================================================
// 2. SQL-mock helper
// =====================================================
type Call = { kind: "scope_keys" | "team" | "grants" | "owners" | "tp_dealer" | "unknown"; raw: string };

function makeMockSql(
  responses: Partial<{
    scopeKeys: Array<{ scope_key: string }>;
    teamUserIds: Array<{ user_id: string }>;
    ropGrants: Array<{ client_code: string | null; trade_point_id: string | null }>;
    grantOwners: Array<{ user_id: string }>;
    tpDealer: Array<{ dealer_id: string }>;
  }>,
): { sql: SqlFn; calls: Call[] } {
  const calls: Call[] = [];
  const sql: SqlFn = (strings, ..._params) => {
    const raw = Array.from(strings).join(" ");
    if (raw.includes("client_base_actualization_state")) {
      calls.push({ kind: "scope_keys", raw });
      return Promise.resolve(responses.scopeKeys ?? []);
    }
    if (raw.includes("user_team_memberships")) {
      calls.push({ kind: "team", raw });
      return Promise.resolve(responses.teamUserIds ?? []);
    }
    if (raw.includes("rop_client_grants")) {
      calls.push({ kind: "grants", raw });
      return Promise.resolve(responses.ropGrants ?? []);
    }
    if (raw.includes("client_assignments") && raw.includes("responsible_user_id")) {
      calls.push({ kind: "owners", raw });
      return Promise.resolve(responses.grantOwners ?? []);
    }
    if (raw.includes("trade_point_overrides")) {
      calls.push({ kind: "tp_dealer", raw });
      return Promise.resolve(responses.tpDealer ?? []);
    }
    calls.push({ kind: "unknown", raw });
    return Promise.resolve([]);
  };
  return { sql, calls };
}

// =====================================================
// 3. fetchTeamScopedUserIds: manager → own scope only, SQL не зовётся
// =====================================================
async function testManagerRoles(): Promise<void> {
  // case A: role="manager"
  {
    const { sql, calls } = makeMockSql({});
    const r = await fetchTeamScopedUserIds(sql, "mgr-boyko-em", "manager");
    assert.deepEqual(r, ["mgr-boyko-em"], "case A: manager → own scope");
    assert.equal(calls.length, 0, "case A: SQL не должен зваться");
  }
  // case B: role="sales_manager" (синоним)
  {
    const { sql, calls } = makeMockSql({});
    const r = await fetchTeamScopedUserIds(sql, "mgr-boyko-em", "sales_manager");
    assert.deepEqual(r, ["mgr-boyko-em"], "case B: sales_manager → own scope");
    assert.equal(calls.length, 0, "case B: SQL не должен зваться");
  }
}

// =====================================================
// 4. rop/team_lead → команда (включая себя)
// =====================================================
async function testRopRoles(): Promise<void> {
  const teamRows = [{ user_id: "mgr-boyko-em" }, { user_id: "mgr-sklyarov-dv" }, { user_id: "rop-kupiansky" }];
  // case C: role="rop"
  {
    const { sql, calls } = makeMockSql({ teamUserIds: teamRows });
    const r = await fetchTeamScopedUserIds(sql, "rop-kupiansky", "rop");
    assert.deepEqual(r.sort(), ["mgr-boyko-em", "mgr-sklyarov-dv", "rop-kupiansky"].sort(), "case C: rop → команда");
    assert.equal(calls.length, 2, "case C: team + rop_client_grants");
    assert.equal(calls[0]?.kind, "team", "case C: team-запрос");
    assert.equal(calls[1]?.kind, "grants", "case C: grants-запрос");
  }
  // case D: role="team_lead" (синоним)
  {
    const { sql, calls } = makeMockSql({ teamUserIds: teamRows });
    const r = await fetchTeamScopedUserIds(sql, "rop-kupiansky", "team_lead");
    assert.deepEqual(r.sort(), ["mgr-boyko-em", "mgr-sklyarov-dv", "rop-kupiansky"].sort(), "case D: team_lead → команда");
    assert.equal(calls.length, 2, "case D: team + grants");
  }
  // case C.1: РОП без своего currentUserId в результате — должен быть добавлен (fallback в код).
  {
    const { sql } = makeMockSql({
      teamUserIds: [{ user_id: "mgr-boyko-em" }, { user_id: "mgr-sklyarov-dv" }],
    });
    const r = await fetchTeamScopedUserIds(sql, "rop-kupiansky", "rop");
    assert.ok(r.includes("rop-kupiansky"), "case C.1: currentUserId добавлен в результат");
  }
  // case C.2: РОП с грантом на чужой client_code — видит userId владельца дополнительно к команде.
  {
    const { sql } = makeMockSql({
      teamUserIds: [{ user_id: "mgr-boyko-em" }, { user_id: "rop-kupiansky" }],
      ropGrants: [{ client_code: "MA-MA138425", trade_point_id: null }],
      grantOwners: [{ user_id: "mgr-yakubova-ys" }],
    });
    const r = await fetchTeamScopedUserIds(sql, "rop-voronezh", "rop");
    assert.ok(r.includes("mgr-boyko-em"), "case C.2: команда сохранена");
    assert.ok(r.includes("rop-voronezh"), "case C.2: self в scope");
    assert.ok(r.includes("mgr-yakubova-ys"), "case C.2: владелец из гранта добавлен");
  }
}

// =====================================================
// 4b. fetchRopGrantOwnerUserIds — только владельцы из грантов
// =====================================================
async function testRopGrantOwners(): Promise<void> {
  const { sql } = makeMockSql({
    ropGrants: [{ client_code: "MA-MA138425", trade_point_id: null }],
    grantOwners: [{ user_id: "mgr-yakubova-ys" }],
  });
  const owners = await fetchRopGrantOwnerUserIds(sql, "rop-voronezh");
  assert.deepEqual(owners, ["mgr-yakubova-ys"], "grant owners: responsible_user_id из client_assignments");
}

// =====================================================
// 5. director / admin / analyst / marketer → all scopes
// =====================================================
async function testAllAccessRoles(): Promise<void> {
  const scopeRows = [{ scope_key: "user:a" }, { scope_key: "user:b" }, { scope_key: "user:c" }];
  // case E: director / sales_director
  {
    const { sql, calls } = makeMockSql({ scopeKeys: scopeRows });
    const r = await fetchTeamScopedUserIds(sql, "dir-1", "director");
    assert.deepEqual(r.sort(), ["a", "b", "c"], "case E: director → все");
    assert.equal(calls[0]?.kind, "scope_keys", "case E: scope_keys-запрос");
  }
  {
    const { sql } = makeMockSql({ scopeKeys: scopeRows });
    const r = await fetchTeamScopedUserIds(sql, "dir-1", "sales_director");
    assert.deepEqual(r.sort(), ["a", "b", "c"], "case E.1: sales_director → все");
  }
  // case F: admin
  {
    const { sql } = makeMockSql({ scopeKeys: scopeRows });
    const r = await fetchTeamScopedUserIds(sql, "admin-1", "admin");
    assert.deepEqual(r.sort(), ["a", "b", "c"], "case F: admin → все");
  }
  // case F.1: analyst, marketer
  {
    const { sql } = makeMockSql({ scopeKeys: scopeRows });
    const r = await fetchTeamScopedUserIds(sql, "ana-1", "analyst");
    assert.deepEqual(r.sort(), ["a", "b", "c"], "case F.1a: analyst → все");
  }
  {
    const { sql } = makeMockSql({ scopeKeys: scopeRows });
    const r = await fetchTeamScopedUserIds(sql, "mkt-1", "marketer");
    assert.deepEqual(r.sort(), ["a", "b", "c"], "case F.1b: marketer → все");
  }
}

// =====================================================
// 6. unknown / "" → only own
// =====================================================
async function testUnknownRoles(): Promise<void> {
  // case G.1
  {
    const { sql, calls } = makeMockSql({});
    const r = await fetchTeamScopedUserIds(sql, "u1", "");
    assert.deepEqual(r, ["u1"], "case G.1: '' → только current");
    assert.equal(calls.length, 0, "case G.1: SQL не зовётся");
  }
  // case G.2: null
  {
    const { sql, calls } = makeMockSql({});
    const r = await fetchTeamScopedUserIds(sql, "u1", null);
    assert.deepEqual(r, ["u1"], "case G.2: null → только current");
    assert.equal(calls.length, 0, "case G.2: SQL не зовётся");
  }
  // case G.3: незнакомая роль
  {
    const { sql, calls } = makeMockSql({});
    const r = await fetchTeamScopedUserIds(sql, "u1", "weird-role");
    assert.deepEqual(r, ["u1"], "case G.3: weird-role → только current");
    assert.equal(calls.length, 0, "case G.3: SQL не зовётся");
  }
}

// =====================================================
// 7. resolveVisibleUserScopeKeys — manager даёт ровно ["user:<id>"]
// =====================================================
async function testResolveVisibleScopeKeys(): Promise<void> {
  {
    const { sql } = makeMockSql({});
    const r = await resolveVisibleUserScopeKeys(sql, "mgr-boyko-em", "manager");
    assert.deepEqual(r, ["user:mgr-boyko-em"], "resolveVisibleUserScopeKeys: manager → own");
  }
  {
    const { sql } = makeMockSql({});
    const r = await resolveVisibleUserScopeKeys(sql, "mgr-boyko-em", "sales_manager");
    assert.deepEqual(r, ["user:mgr-boyko-em"], "resolveVisibleUserScopeKeys: sales_manager → own");
  }
  // Если role не задан вообще — возвращаем own (исторический pre-check ветви).
  {
    const { sql } = makeMockSql({});
    const r = await resolveVisibleUserScopeKeys(sql, "mgr-boyko-em", null);
    assert.deepEqual(r, ["user:mgr-boyko-em"], "resolveVisibleUserScopeKeys: null role → own");
  }
  // РОП → команда с префиксом user: на каждом.
  {
    const teamRows = [{ user_id: "mgr-boyko-em" }, { user_id: "mgr-sklyarov-dv" }];
    const { sql } = makeMockSql({ teamUserIds: teamRows });
    const r = await resolveVisibleUserScopeKeys(sql, "rop-kupiansky", "rop");
    assert.ok(r.includes("user:mgr-boyko-em"), "rop: scope mgr-boyko-em");
    assert.ok(r.includes("user:mgr-sklyarov-dv"), "rop: scope mgr-sklyarov-dv");
    assert.ok(r.includes("user:rop-kupiansky"), "rop: scope self");
  }
}


// =====================================================
// 8. Batch GET parts: порядок, emptyState, один SQL
// =====================================================
async function testBatchFetchParts(): Promise<void> {
  const scopeRows = [
    { scope_key: "user:a", state: { version: 1, trashedDealersById: { x: { dealerId: "x" } } }, updated_at: "2026-01-01T00:00:00.000Z", role: "manager" },
    { scope_key: "user:c", state: { version: 1 }, updated_at: null, role: "manager" },
  ];
  const { sql, calls } = makeMockSql({ scopeKeys: scopeRows });
  const parts = await fetchActualizationBatchParts(sql, ["a", "b", "c"]);
  assert.equal(parts.length, 3, "batch: три части");
  assert.equal(parts[0]?.userId, "a");
  assert.equal(parts[1]?.userId, "b");
  assert.equal(parts[2]?.userId, "c");
  assert.ok((parts[0]?.state.trashedDealersById as Record<string, unknown>)?.x, "batch: state для a");
  assert.deepEqual(parts[1]?.state.trashedDealersById, {}, "batch: b → emptyState");
  assert.equal(calls.filter((c) => c.kind === "scope_keys").length, 1, "batch: один SQL");
}

function testGetBatchUserIdsParsing(): void {
  const ids = getBatchUserIds({ query: { userIds: "a,b,a,c" } } as import("@vercel/node").VercelRequest);
  assert.deepEqual(ids, ["a", "b", "c"], "getBatchUserIds: дедуп и порядок");
  assert.equal(getBatchUserIds({ query: {} } as import("@vercel/node").VercelRequest), null);
}

(async () => {
  testGetBatchUserIdsParsing();
  await testManagerRoles();
  await testRopRoles();
  await testRopGrantOwners();
  await testAllAccessRoles();
  await testUnknownRoles();
  await testResolveVisibleScopeKeys();
  await testBatchFetchParts();
  console.log("scope-isolation: ok (canonicalize + 8 integration cases)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
