/**
 * Bulk trash trade points → trade_point_overrides.
 * Запуск: npm run test:bulk-trash-trade-points
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBulkTrashTradePoints } from "../trade-point-bulk-trash-handlers.js";

type OverrideRow = {
  tp_id: string;
  status: string;
  trashed_by: string | null;
};

function mockRes(): VercelResponse & { statusCode: number; body: Record<string, unknown> | null } {
  const out = {
    statusCode: 0,
    body: null as Record<string, unknown> | null,
    setHeader: () => undefined,
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(b: Record<string, unknown>) {
      out.body = b;
      return out;
    },
  };
  return out as unknown as VercelResponse & { statusCode: number; body: Record<string, unknown> | null };
}

void (async () => {
  const overrides = new Map<string, OverrideRow>();
  overrides.set("tp-a", { tp_id: "tp-a", status: "active", trashed_by: null });

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };
      if (s.includes("INSERT INTO trade_point_overrides") && s.includes("unnest")) {
        const ids = params?.[0] as string[];
        const userId = String(params?.[1]);
        for (const id of ids) {
          overrides.set(id, { tp_id: id, status: "in_trash", trashed_by: userId });
        }
        return { rows: [] };
      }
      if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
        return { rows: [{ c: "1" }] };
      }
      if (s.includes("SELECT COUNT(*)") && s.includes("trade_point")) {
        return { rows: [{ c: "2" }] };
      }
      if (s.includes("is_primary FROM trade_point_overrides")) {
        return { rows: [{ is_primary: false }] };
      }
      if (s.includes("SELECT dealer_id FROM trade_point_overrides")) {
        const tpId = String(params?.[0]);
        return { rows: tpId === "tp-a" ? [{ dealer_id: "client-a" }] : [] };
      }
      if (s.includes("INSERT INTO trade_point_override_events")) return { rows: [] };
      return { rows: [] };
    },
  };

  const req = {
    body: { trade_point_ids: ["tp-a", "tp-foreign"] },
    method: "POST",
  } as VercelRequest;
  const res = mockRes();
  await handleBulkTrashTradePoints(req, res, pool, { id: "mgr-1", role: "manager", status: "active" });

  assert.equal(res.statusCode, 200);
  assert.equal((res.body?.data as { moved: number })?.moved, 1);
  assert.equal(overrides.get("tp-a")?.status, "in_trash");
  assert.equal(overrides.get("tp-a")?.trashed_by, "mgr-1");

  console.log("bulk-trash-trade-points: ok");
})();
