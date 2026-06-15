/**
 * Запуск: `npm run test:dealer-trash-scope-server` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../admin/admin-auth.js";
import { canUserTrashDealer, canUserTrashTradePoint } from "../dealer-trash-scope-server.js";

const MGR_A = "11111111-1111-1111-1111-111111111111";
const ROP_C = "33333333-3333-3333-3333-333333333333";
const RM_D = "44444444-4444-4444-4444-444444444444";
const DEALER_X = "client-MA001";
const DEALER_Y = "client-MA999";
const TP_X = "client-MA001-01";
const TP_ORPHAN = "tp-no-dealer";

type MockRule = {
  match: (sql: string) => boolean;
  count: number;
};

function mockPool(rules: MockRule[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      for (const rule of rules) {
        if (rule.match(s)) return { rows: [{ c: String(rule.count) }] };
      }
      if (s.includes("SELECT dealer_id FROM trade_point_overrides")) {
        const tpId = String(params?.[0] ?? "");
        if (tpId === TP_ORPHAN) return { rows: [{ dealer_id: null }] };
        return { rows: [{ dealer_id: DEALER_X }] };
      }
      return { rows: [{ c: "0" }] };
    },
  };
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "admin", DEALER_Y);
  assert.equal(r.allowed, true, "admin");
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "director", DEALER_Y);
  assert.equal(r.allowed, true, "director");
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "category_manager", DEALER_Y);
  assert.equal(r.allowed, true, "category_manager");
}

{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM client_assignments") && s.includes("responsible_user_id"),
      count: 1,
    },
  ]);
  const ok = await canUserTrashDealer(pool, MGR_A, "manager", DEALER_X);
  const bad = await canUserTrashDealer(mockPool([]), MGR_A, "manager", DEALER_Y);
  assert.equal(ok.allowed, true);
  assert.equal(bad.allowed, false);
  assert.equal(bad.reason, "not_in_manager_assignments");
}

{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM dealer_overrides") && s.includes("regional_manager_id"),
      count: 1,
    },
  ]);
  const ok = await canUserTrashDealer(pool, RM_D, "regional_manager", DEALER_X);
  const bad = await canUserTrashDealer(mockPool([]), RM_D, "regional_manager", DEALER_Y);
  assert.equal(ok.allowed, true);
  assert.equal(bad.allowed, false);
}

{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM rop_client_grants"),
      count: 1,
    },
  ]);
  const ok = await canUserTrashDealer(pool, ROP_C, "rop", DEALER_X);
  const bad = await canUserTrashDealer(mockPool([]), ROP_C, "rop", DEALER_Y);
  assert.equal(ok.allowed, true);
  assert.equal(bad.allowed, false);
  assert.equal(bad.reason, "not_in_rop_scope");
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "marketer", DEALER_X);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "role_no_trash_access");
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "analyst", DEALER_X);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "role_no_trash_access");
}

{
  const r = await canUserTrashDealer(mockPool([]), MGR_A, "guest", DEALER_X);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "unknown_role");
}

{
  const r = await canUserTrashTradePoint(mockPool([]), MGR_A, "manager", TP_ORPHAN);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "tp_without_dealer");
}

{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM rop_client_grants") && s.includes("trade_point_id"),
      count: 1,
    },
  ]);
  const r = await canUserTrashTradePoint(pool, ROP_C, "rop", TP_X);
  assert.equal(r.allowed, true);
}

console.log("dealer-trash-scope-server: ok (11 cases)");
