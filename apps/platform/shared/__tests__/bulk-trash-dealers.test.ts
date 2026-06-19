/**
 * Промт 420: bulk trash active dealers → dealer_overrides.
 * Запуск: в составе `npm run test:bulk-trash-dealers`.
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBulkTrashDealers } from "../dealer-bulk-trash-handlers.js";

type OverrideRow = {
  dealer_id: string;
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
  overrides.set("client-a", { dealer_id: "client-a", status: "active", trashed_by: null });

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };
      if (s.includes("INSERT INTO dealer_overrides") && s.includes("unnest")) {
        const ids = params?.[0] as string[];
        const userId = String(params?.[1]);
        for (const id of ids) {
          overrides.set(id, { dealer_id: id, status: "in_trash", trashed_by: userId });
        }
        return { rows: [] };
      }
      if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
        const dealerId = String(params?.[1]);
        return { rows: dealerId === "client-a" ? [{ c: "1" }] : [{ c: "0" }] };
      }
      if (s.includes("SELECT COUNT(*)")) {
        return { rows: [{ c: "1" }] };
      }
      if (s.includes("INSERT INTO trade_point_overrides")) return { rows: [] };
      if (s.includes("removeDealerFromArchiveEverywhere") || s.includes("archivedDealersById")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const req = { body: { dealer_ids: ["client-a", "client-foreign"] }, method: "POST" } as VercelRequest;
  const res = mockRes();
  await handleBulkTrashDealers(req, res, pool, { id: "mgr-1", role: "manager", status: "active" });

  assert.equal(res.statusCode, 200);
  assert.equal((res.body?.data as { moved: number })?.moved, 1);
  assert.equal(overrides.get("client-a")?.status, "in_trash");
  assert.equal(overrides.get("client-a")?.trashed_by, "mgr-1");

  console.log("bulk-trash-dealers: ok");
})();
