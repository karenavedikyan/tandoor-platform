/**
 * Запуск: `npm run test:team-activity` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  canAccessTeamActivity,
  canViewTeamActivityUser,
  fetchTeamActivity,
  isTeamActivityManagerForbidden,
  parseTeamActivityRange,
  TEAM_ACTIVITY_LIST_SQL_MARKERS,
} from "../team-activity-handlers.js";
import { resetTeamActivityCache } from "../team-activity-cache.js";

type MockRule = {
  match: (sql: string, params?: unknown[]) => boolean;
  rows: Record<string, unknown>[];
};

function mockPool(rules: MockRule[]): PoolLike {
  const calls: string[] = [];
  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      calls.push(s);
      for (const rule of rules) {
        if (rule.match(s, params)) return { rows: rule.rows };
      }
      return { rows: [] };
    },
  };
  (pool as PoolLike & { _calls: string[] })._calls = calls;
  return pool;
}

// RBAC
assert.equal(isTeamActivityManagerForbidden("manager"), true);
assert.equal(canAccessTeamActivity("manager"), false);
assert.equal(canAccessTeamActivity("rop"), true);
assert.equal(canAccessTeamActivity("director"), true);
assert.equal(canAccessTeamActivity("regional_manager"), true);

// range
assert.equal(parseTeamActivityRange(undefined), "7d");
assert.equal(parseTeamActivityRange("30d"), "30d");

// list SQL markers — без dealer_override_events
assert.ok(TEAM_ACTIVITY_LIST_SQL_MARKERS.usesActivitySummary.includes("activity_summary"));
assert.ok(!TEAM_ACTIVITY_LIST_SQL_MARKERS.avoidsOverrideEvents.includes("FROM public.dealer_override_events"));

const KOTENEVA_ID = "11111111-1111-1111-1111-111111111111";
const ILYUCHENKO_ID = "22222222-2222-2222-2222-222222222222";
const YAKUBOVA_ID = "33333333-3333-3333-3333-333333333333";
const ROP_ID = "44444444-4444-4444-4444-444444444444";
const TEAM_ID = "55555555-5555-5555-5555-555555555555";

const summaryRow = (id: string, name: string, events30: number) => ({
  user_id: id,
  full_name: name,
  role: "manager",
  last_login_at: "2026-05-26T08:43:01Z",
  activity_summary: {
    events_30d: events30,
    events_overrides_30d: Math.floor(events30 * 0.1),
    events_contacts_30d: Math.floor(events30 * 0.12),
    events_tp_30d: 1,
    clients_touched_30d: 12,
    events_7d: 40,
    events_overrides_7d: 4,
    events_contacts_7d: 5,
    events_tp_7d: 0,
    clients_touched_7d: 3,
    last_activity_at: "2026-06-10T13:55:18Z",
  },
  activity_summary_updated_at: "2026-06-17T00:00:00Z",
  team_id: TEAM_ID,
  team_name: "Сапожков Артём",
  clients_count: 117,
});

const directorPool = mockPool([
  {
    match: (s) => s.startsWith("SELECT id AS team_id"),
    rows: [{ team_id: TEAM_ID, team_name: "Сапожков Артём" }],
  },
  {
    match: (s) => s.includes("FROM users u") && s.includes("activity_summary"),
    rows: [
      summaryRow(KOTENEVA_ID, "Котенева Анастасия Валерьевна", 697),
      summaryRow(ILYUCHENKO_ID, "Илюченко Александр", 885),
      summaryRow(YAKUBOVA_ID, "Якубова Юлия", 755),
    ],
  },
]);

resetTeamActivityCache();
const first = await fetchTeamActivity(
  directorPool,
  { id: "dir-1", role: "director", status: "active" },
  { range: "30d", useCache: true },
);
assert.equal(first.cacheHit, false);
assert.equal(first.payload.rows.length, 3);
assert.equal(first.payload.rows[0]?.full_name, "Илюченко Александр");
assert.equal(first.payload.rows[0]?.events_total, 885);

const koteneva = first.payload.rows.find((r) => r.user_id === KOTENEVA_ID);
assert.equal(koteneva?.events_total, 697);

resetTeamActivityCache();
await fetchTeamActivity(
  directorPool,
  { id: "dir-1", role: "director", status: "active" },
  { range: "30d", useCache: true },
);
const second = await fetchTeamActivity(
  directorPool,
  { id: "dir-1", role: "director", status: "active" },
  { range: "30d", useCache: true },
);
assert.equal(second.cacheHit, true);

// ROP scope: only team managers
const ropPool = mockPool([
  {
    match: (s) => s.includes("FROM users u") && s.includes("rop_user_id"),
    rows: [summaryRow(KOTENEVA_ID, "Котенева Анастасия Валерьевна", 697)],
  },
]);

const ropView = await fetchTeamActivity(
  ropPool,
  { id: ROP_ID, role: "rop", status: "active" },
  { range: "30d", useCache: false },
);
assert.equal(ropView.payload.rows.length, 1);

// canViewTeamActivityUser
const viewPool = mockPool([
  {
    match: (s) => s.includes("rop_user_id") && s.includes("responsible_user_id"),
    rows: [{ ok: 1 }],
  },
]);
assert.equal(await canViewTeamActivityUser(viewPool, { id: ROP_ID, role: "rop", status: "active" }, KOTENEVA_ID), true);

// manager forbidden
await assert.rejects(
  () =>
    fetchTeamActivity(mockPool([]), { id: "m1", role: "manager", status: "active" }, { useCache: false }),
  (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "FORBIDDEN",
);

console.log("team-activity-handlers.test.ts: ok");
