/**
 * Промт 441b: trade-point list status filter.
 * Запуск: npm run test:trade-point-overrides-list-status
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTradePointOverridesList } from "../trade-point-overrides-handlers.js";

type TpRow = {
  tp_id: string;
  dealer_id: string;
  status: string;
  is_primary: boolean;
  trashed_at: string | null;
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

const rows: TpRow[] = [
  { tp_id: "tp-trash", dealer_id: "d1", status: "in_trash", is_primary: false, trashed_at: "2026-06-01T00:00:00.000Z" },
  { tp_id: "tp-active", dealer_id: "d1", status: "active", is_primary: true, trashed_at: null },
];

function makePool() {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes("FROM trade_point_overrides")) {
        let filtered = [...rows];
        if (s.includes("status = $")) {
          const status = String(params?.[params.length - 1]);
          filtered = filtered.filter((r) => r.status === status);
        }
        if (s.includes("dealer_id = $")) {
          const dealerId = String(params?.[0]);
          filtered = filtered.filter((r) => r.dealer_id === dealerId);
        }
        return { rows: filtered };
      }
      if (s.includes("FROM trade_point_training_state")) return { rows: [] };
      return { rows: [] };
    },
  };
}

{
  const { res, status, body } = mockRes();
  const req = { query: { status: "in_trash" } } as unknown as VercelRequest;
  await handleTradePointOverridesList(req, res, makePool() as never, { id: "admin", role: "admin", status: "active" });
  assert.equal(status(), 200);
  const data = body().data as { overrides: { tp_id: string; status: string }[] };
  assert.equal(data.overrides.length, 1);
  assert.equal(data.overrides[0]?.tp_id, "tp-trash");
  assert.equal(data.overrides[0]?.status, "in_trash");
}

console.log("trade-point-overrides-list-status: ok");
