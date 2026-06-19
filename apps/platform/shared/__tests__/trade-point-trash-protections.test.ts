/**
 * Промт 422: trash guards LAST_TP / PRIMARY_TP.
 * Запуск: npm run test:trade-point-trash-protections
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTradePointOverridesTrash } from "../trade-point-overrides-handlers.js";

type TpRow = {
  tp_id: string;
  dealer_id: string;
  status: string;
  is_primary: boolean;
};

function mockRes(): { res: VercelResponse; status: () => number; body: () => Record<string, unknown> } {
  let status = 200;
  let body: Record<string, unknown> = {};
  const res = {
    setHeader: () => undefined,
    status: (s: number) => {
      status = s;
      return res;
    },
    json: (b: Record<string, unknown>) => {
      body = b;
      return res;
    },
  } as unknown as VercelResponse;
  return { res, status: () => status, body: () => body };
}

function makePool(rows: Map<string, TpRow>, activeCountByDealer: Record<string, number>) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes("FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1") && s.includes("is_primary")) {
        const id = String(params?.[0]);
        const row = rows.get(id);
        return { rows: row ? [row] : [] };
      }
      if (s.includes("SELECT dealer_id FROM trade_point_overrides WHERE tp_id")) {
        const id = String(params?.[0]);
        const row = rows.get(id);
        return { rows: row ? [{ dealer_id: row.dealer_id }] : [] };
      }
      if (s.includes("SELECT COUNT(*)::text AS c") && s.includes("FROM trade_points tp")) {
        const dealerId = String(params?.[0]);
        return { rows: [{ c: String(activeCountByDealer[dealerId] ?? 0) }] };
      }
      if (s.includes("SELECT is_primary FROM trade_point_overrides")) {
        const id = String(params?.[0]);
        const row = rows.get(id);
        return { rows: row ? [{ is_primary: row.is_primary }] : [] };
      }
      if (s.includes("FROM client_assignments")) return { rows: [{ c: "1" }] };
      if (s.includes("SELECT COUNT(*)")) return { rows: [{ c: "1" }] };
      if (s.includes("INSERT INTO trade_point_overrides")) return { rows: [] };
      if (s.includes("SELECT * FROM trade_point_overrides WHERE tp_id")) {
        const id = String(params?.[0]);
        const row = rows.get(id);
        if (!row) return { rows: [] };
        return {
          rows: [
            {
              ...row,
              name: null,
              city: null,
              address: null,
              contact_name: null,
              contact_phone: null,
              comment: null,
              showcase_status: null,
              shipment_days: null,
              is_main_warehouse: null,
              is_hardware_warehouse: null,
              trashed_at: null,
              trashed_by: null,
              purge_requested_at: null,
              purge_requested_by: null,
              purged_at: null,
              purged_by: null,
              rop_id: null,
              rop_name: null,
              regional_manager_id: null,
              regional_manager_name: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              updated_by: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
}

void (async () => {
  const sole = new Map<string, TpRow>([
    ["tp-only", { tp_id: "tp-only", dealer_id: "client-1", status: "active", is_primary: true }],
  ]);
  const lastRes = mockRes();
  await handleTradePointOverridesTrash(
    { body: { tp_id: "tp-only" }, method: "POST" } as VercelRequest,
    lastRes.res,
    makePool(sole, { "client-1": 1 }),
    { id: "mgr-1", role: "manager", status: "active" },
  );
  assert.equal(lastRes.status(), 400);
  assert.equal(lastRes.body().code, "LAST_TP");

  const pair = new Map<string, TpRow>([
    ["tp-p", { tp_id: "tp-p", dealer_id: "client-2", status: "active", is_primary: true }],
    ["tp-s", { tp_id: "tp-s", dealer_id: "client-2", status: "active", is_primary: false }],
  ]);
  const primaryRes = mockRes();
  await handleTradePointOverridesTrash(
    { body: { tp_id: "tp-p" }, method: "POST" } as VercelRequest,
    primaryRes.res,
    makePool(pair, { "client-2": 2 }),
    { id: "mgr-1", role: "manager", status: "active" },
  );
  assert.equal(primaryRes.status(), 400);
  assert.equal(primaryRes.body().code, "PRIMARY_TP");

  console.log("trade-point-trash-protections: ok");
})();
