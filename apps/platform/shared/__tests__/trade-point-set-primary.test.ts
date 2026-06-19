/**
 * Промт 422: set-primary transaction, race, RBAC.
 * Запуск: npm run test:trade-point-set-primary
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTradePointOverridesSetPrimary } from "../trade-point-overrides-handlers.js";

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

function makePool(rows: Map<string, TpRow>, opts?: { allowScope?: boolean }) {
  const events: { tp_id: string; event_kind: string }[] = [];
  let inTx = false;
  return {
    events,
    pool: {
      query: async (sql: string, params?: unknown[]) => {
        const s = String(sql);
        if (s === "BEGIN") {
          inTx = true;
          return { rows: [] };
        }
        if (s === "COMMIT" || s === "ROLLBACK") {
          inTx = false;
          return { rows: [] };
        }
        if (s.includes("FROM trade_point_overrides") && s.includes("WHERE tp_id")) {
          const id = String(params?.[0]);
          const row = rows.get(id);
          return { rows: row ? [row] : [] };
        }
        if (s.includes("SET is_primary = false") && s.includes("WHERE dealer_id")) {
          const dealerId = String(params?.[0]);
          for (const row of rows.values()) {
            if (row.dealer_id === dealerId && row.status === "active") row.is_primary = false;
          }
          return { rows: [] };
        }
        if (s.includes("SET is_primary = true") && s.includes("WHERE tp_id")) {
          const id = String(params?.[0]);
          const row = rows.get(id);
          if (row && row.status === "active") row.is_primary = true;
          return { rows: [] };
        }
        if (s.includes("INSERT INTO trade_point_override_events")) {
          events.push({ tp_id: String(params?.[0]), event_kind: String(params?.[3]) });
          return { rows: [] };
        }
        if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
          return { rows: [{ c: opts?.allowScope === false ? "0" : "1" }] };
        }
        if (s.includes("SELECT COUNT(*)")) {
          return { rows: [{ c: opts?.allowScope === false ? "0" : "1" }] };
        }
        return { rows: [] };
      },
    },
  };
}

void (async () => {
  const rows = new Map<string, TpRow>([
    ["tp-a", { tp_id: "tp-a", dealer_id: "client-x", status: "active", is_primary: true }],
    ["tp-b", { tp_id: "tp-b", dealer_id: "client-x", status: "active", is_primary: false }],
  ]);
  const { pool, events } = makePool(rows);
  const { res, status, body } = mockRes();
  await handleTradePointOverridesSetPrimary(
    { body: { tp_id: "tp-b" }, method: "POST" } as VercelRequest,
    res,
    pool,
    { id: "mgr-1", role: "manager", status: "active" },
  );
  assert.equal(status(), 200);
  assert.equal(body().success, true);
  assert.equal(rows.get("tp-a")?.is_primary, false);
  assert.equal(rows.get("tp-b")?.is_primary, true);
  assert.ok(events.some((e) => e.event_kind === "tp_set_primary"));

  const denied = makePool(rows, { allowScope: false });
  const deniedRes = mockRes();
  await handleTradePointOverridesSetPrimary(
    { body: { tp_id: "tp-b" }, method: "POST" } as VercelRequest,
    deniedRes.res,
    denied.pool,
    { id: "mgr-2", role: "manager", status: "active" },
  );
  assert.equal(deniedRes.status(), 403);

  console.log("trade-point-set-primary: ok");
})();
