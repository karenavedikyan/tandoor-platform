/**
 * Промт 418: каскад dealer → trade_points.
 * Запуск: в составе `npm run test:record-status`.
 */
import assert from "node:assert/strict";
import {
  cascadeDealerTradePointsToActive,
  cascadeDealerTradePointsToTrash,
} from "../record-status-cascade.js";

type TpRow = {
  tp_id: string;
  dealer_id: string;
  status: string;
  trashed_at: string | null;
  trashed_by: string | null;
};

function makePool(tps: TpRow[]) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes("INSERT INTO trade_point_overrides") && s.includes("FROM trade_points tp")) {
        const dealerId = String(params?.[0]);
        const trashedAt = String(params?.[1]);
        const userId = String(params?.[2]);
        for (const tp of tps) {
          if (tp.dealer_id !== dealerId) continue;
          if (tp.status !== "active") continue;
          tp.status = "in_trash";
          tp.trashed_at = trashedAt;
          tp.trashed_by = userId;
        }
        return { rows: [] };
      }
      if (s.includes("UPDATE trade_point_overrides tpo") && s.includes("status = 'active'")) {
        const dealerId = String(params?.[0]);
        const restoringUserId = String(params?.[1]);
        for (const tp of tps) {
          if (tp.dealer_id !== dealerId) continue;
          if (tp.status !== "in_trash" || tp.trashed_by !== restoringUserId) continue;
          tp.status = "active";
          tp.trashed_at = null;
          tp.trashed_by = null;
        }
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

// Cascade trash → restore
void (async () => {
  const tps: TpRow[] = [
    { tp_id: "tp-1", dealer_id: "dealer-a", status: "active", trashed_at: null, trashed_by: null },
    { tp_id: "tp-2", dealer_id: "dealer-a", status: "active", trashed_at: null, trashed_by: null },
    { tp_id: "tp-3", dealer_id: "dealer-b", status: "active", trashed_at: null, trashed_by: null },
  ];
  const pool = makePool(tps);
  const userId = "mgr-uuid";
  await cascadeDealerTradePointsToTrash(pool, "dealer-a", userId);
  assert.equal(tps.filter((t) => t.dealer_id === "dealer-a" && t.status === "in_trash").length, 2);
  assert.equal(tps.find((t) => t.tp_id === "tp-1")?.trashed_by, userId);
  assert.equal(tps.find((t) => t.tp_id === "tp-3")?.status, "active");

  await cascadeDealerTradePointsToActive(pool, "dealer-a", userId);
  assert.equal(tps.filter((t) => t.dealer_id === "dealer-a" && t.status === "active").length, 2);

  console.log("record-status-cascade: ok");
})();
