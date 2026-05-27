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
type Call = { kind: "scope_keys" | "team" | "unknown"; raw: string };

function makeMockSql(
  responses: Partial<{ scopeKeys: Array<{ scope_key: string }>; teamUserIds: Array<{ user_id: string }> }>,
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
    assert.equal(calls.length, 1, "case C: должен быть один SQL");
    assert.equal(calls[0]?.kind, "team", "case C: team-запрос");
  }
  // case D: role="team_lead" (синоним)
  {
    const { sql, calls } = makeMockSql({ teamUserIds: teamRows });
    const r = await fetchTeamScopedUserIds(sql, "rop-kupiansky", "team_lead");
    assert.deepEqual(r.sort(), ["mgr-boyko-em", "mgr-sklyarov-dv", "rop-kupiansky"].sort(), "case D: team_lead → команда");
    assert.equal(calls.length, 1, "case D: один SQL");
  }
  // case C.1: РОП без своего currentUserId в результате — должен быть добавлен (fallback в код).
  {
    const { sql } = makeMockSql({
      teamUserIds: [{ user_id: "mgr-boyko-em" }, { user_id: "mgr-sklyarov-dv" }],
    });
    const r = await fetchTeamScopedUserIds(sql, "rop-kupiansky", "rop");
    assert.ok(r.includes("rop-kupiansky"), "case C.1: currentUserId добавлен в результат");
  }
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

(async () => {
  await testManagerRoles();
  await testRopRoles();
  await testAllAccessRoles();
  await testUnknownRoles();
  await testResolveVisibleScopeKeys();
  console.log("scope-isolation: ok (canonicalize + 7 integration cases)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
