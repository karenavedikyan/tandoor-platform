/**
 * Промт 418 / 422-hotfix: каскад dealer → trade_points через dealers.external_key.
 * Запуск: в составе `npm run test:record-status`.
 */
import assert from "node:assert/strict";
import {
  cascadeDealerTradePointsToActive,
  cascadeDealerTradePointsToTrash,
} from "../record-status-cascade.js";

const TEXT_DEALER_A = "client-ma-ma078693";
const TEXT_DEALER_B = "client-ma-other0001";

type TpRow = {
  tp_id: string;
  dealer_external_key: string;
  status: string;
  trashed_at: string | null;
  trashed_by: string | null;
};

function assertExternalKeyCascadeSql(sql: string): void {
  assert.ok(!sql.includes("tp.dealer_id = $1::uuid"), "must not cast dealer external_key to uuid");
  assert.ok(sql.includes("d.external_key = $1"), "SQL must filter by dealers.external_key");
  assert.ok(sql.includes("tp.id::text"), "SQL must use tp.id::text for trade_point_overrides.tp_id");
}

function makePool(tps: TpRow[], opts?: { knownDealers: Set<string> }) {
  const knownDealers = opts?.knownDealers ?? new Set([TEXT_DEALER_A, TEXT_DEALER_B]);
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes("INSERT INTO trade_point_overrides") && s.includes("FROM dealers d")) {
        assertExternalKeyCascadeSql(s);
        const dealerExternalKey = String(params?.[0]);
        if (!knownDealers.has(dealerExternalKey)) return { rows: [] };
        const trashedAt = String(params?.[1]);
        const userId = String(params?.[2]);
        for (const tp of tps) {
          if (tp.dealer_external_key !== dealerExternalKey) continue;
          if (tp.status !== "active") continue;
          tp.status = "in_trash";
          tp.trashed_at = trashedAt;
          tp.trashed_by = userId;
        }
        return { rows: [] };
      }
      if (s.includes("UPDATE trade_point_overrides tpo") && s.includes("status = 'active'")) {
        assertExternalKeyCascadeSql(s);
        const dealerExternalKey = String(params?.[0]);
        if (!knownDealers.has(dealerExternalKey)) return { rows: [] };
        const restoringUserId = String(params?.[1]);
        for (const tp of tps) {
          if (tp.dealer_external_key !== dealerExternalKey) continue;
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

void (async () => {
  const tps: TpRow[] = [
    {
      tp_id: "a1111111-1111-1111-1111-111111111111",
      dealer_external_key: TEXT_DEALER_A,
      status: "active",
      trashed_at: null,
      trashed_by: null,
    },
    {
      tp_id: "a2222222-2222-2222-2222-222222222222",
      dealer_external_key: TEXT_DEALER_A,
      status: "active",
      trashed_at: null,
      trashed_by: null,
    },
    {
      tp_id: "b3333333-3333-3333-3333-333333333333",
      dealer_external_key: TEXT_DEALER_B,
      status: "active",
      trashed_at: null,
      trashed_by: null,
    },
  ];
  const pool = makePool(tps);
  const userId = "44444444-4444-4444-4444-444444444444";

  await cascadeDealerTradePointsToTrash(pool, TEXT_DEALER_A, userId);
  assert.equal(
    tps.filter((t) => t.dealer_external_key === TEXT_DEALER_A && t.status === "in_trash").length,
    2,
    "text dealer_id: active TPs cascade to in_trash",
  );
  assert.equal(tps.find((t) => t.tp_id.endsWith("1111"))?.trashed_by, userId);
  assert.equal(tps.find((t) => t.dealer_external_key === TEXT_DEALER_B)?.status, "active");

  await cascadeDealerTradePointsToActive(pool, TEXT_DEALER_A, userId);
  assert.equal(
    tps.filter((t) => t.dealer_external_key === TEXT_DEALER_A && t.status === "active").length,
    2,
    "restore cascades TPs back to active",
  );

  const unknownPool = makePool([], { knownDealers: new Set([TEXT_DEALER_A]) });
  await cascadeDealerTradePointsToTrash(unknownPool, "client-ma-unknown9999", userId);
  assert.equal(tps.filter((t) => t.status === "in_trash").length, 0, "unknown dealer external_key: 0 rows, no throw");

  console.log("record-status-cascade: ok");
})();
