/**
 * Промт 417: smoke-тесты единой модели status.
 * Запуск: `npm run test:record-status` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeAdminPurgeQueue, computeDbScopeForUser } from "../db-scope-formula.js";
import {
  dealerJoinStatusActive,
  dealerStatusActive,
  dealerStatusPendingAdmin,
  dealerStatusTrash,
} from "../record-status.js";

const MANAGER_ID = "dc958e02-d80e-4615-bb8a-8a46be70daed";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

type DealerSeed = {
  id: string;
  external_key: string;
  release_code: string;
  status: "active" | "in_trash" | "pending_admin" | "purged";
  trashed_by: string | null;
};

const MIXED_DEALERS: DealerSeed[] = [
  { id: "d-a", external_key: "client-a", release_code: "C100", status: "active", trashed_by: null },
  { id: "d-b", external_key: "client-b", release_code: "C100", status: "in_trash", trashed_by: MANAGER_ID },
  { id: "d-c", external_key: "client-c", release_code: "C100", status: "pending_admin", trashed_by: MANAGER_ID },
  { id: "d-d", external_key: "client-d", release_code: "C100", status: "purged", trashed_by: MANAGER_ID },
];

function createScopePool(dealers: DealerSeed[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        return { rows: [{ client_code: "C100" }] };
      }
      if (s.includes("user_team_memberships") || s.includes("rop_client_grants") || s.includes("FROM teams")) {
        return { rows: [] };
      }
      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        return {
          rows: dealers
            .filter((d) => codes.includes(d.release_code))
            .map((d) => ({
              id: d.id,
              external_key: d.external_key,
              status: d.status,
              trashed_by: d.trashed_by,
            })),
        };
      }
      if (s.includes("FROM dealers d") && s.includes(dealerStatusPendingAdmin("d_ov"))) {
        return {
          rows: dealers
            .filter((d) => d.status === "pending_admin")
            .map((d) => ({
              id: d.id,
              external_key: d.external_key,
              name: d.external_key,
              release_code: d.release_code,
              trashed_at: null,
              trashed_by: d.trashed_by,
              purge_requested_at: new Date().toISOString(),
              purge_requested_by: d.trashed_by,
              trashed_by_name: null,
              purge_requested_by_name: null,
            })),
        };
      }
      if (s.includes("FROM dealer_overrides d_ov") && s.includes(dealerStatusPendingAdmin("d_ov"))) {
        const n = dealers.filter((d) => d.status === "pending_admin").length;
        return { rows: [{ n: String(n) }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("pending_admin")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("COUNT(*) FILTER") && s.includes("trade_points")) {
        return { rows: [{ active_tps: "0", trashed_tps: "0" }] };
      }
      void params;
      return { rows: [] };
    },
  };
}

// 1–2,5: mixed states — active only in client list; trash only own; admin queue only pending; purged nowhere
{
  const pool = createScopePool(MIXED_DEALERS);
  const scope = await computeDbScopeForUser(pool, MANAGER_ID, "manager");
  assert.equal(scope.totals.active_dealers, 1);
  assert.deepEqual(scope.active_dealer_external_keys, ["client-a"]);
  assert.equal(scope.totals.trashed_dealers, 1);
  assert.deepEqual(scope.trashed_dealer_external_keys, ["client-b"]);
  assert.equal(scope.active_dealer_external_keys.includes("client-d"), false);
  assert.equal(scope.trashed_dealer_external_keys.includes("client-c"), false);
}

// 3: admin purge queue
{
  const pool = createScopePool(MIXED_DEALERS);
  const queue = await computeAdminPurgeQueue(pool);
  assert.equal(queue.dealers.length, 1);
  assert.equal(queue.dealers[0]?.external_key, "client-c");
}

// 4: manager with 56 active dealers in scope
{
  const manyActive: DealerSeed[] = Array.from({ length: 56 }, (_, i) => ({
    id: `d-${i}`,
    external_key: `client-ma-${String(i).padStart(6, "0")}`,
    release_code: "C100",
    status: "active" as const,
    trashed_by: null,
  }));
  const pool = createScopePool(manyActive);
  const scope = await computeDbScopeForUser(pool, MANAGER_ID, "manager");
  assert.equal(scope.totals.active_dealers, 56);
  assert.equal(scope.totals.trashed_dealers, 0);
}

// SQL predicates are single source of truth
{
  assert.equal(dealerStatusActive("d_ov"), "d_ov.status = 'active'");
  assert.equal(dealerStatusTrash("d_ov"), "d_ov.status = 'in_trash'");
  assert.equal(dealerStatusPendingAdmin("d_ov"), "d_ov.status = 'pending_admin'");
  assert.ok(dealerJoinStatusActive("d_ov").includes("d_ov.status = 'active'"));
}

// director full catalog: purged excluded from active and trash
{
  const pool: PoolLike = {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        return {
          rows: MIXED_DEALERS.map((d) => ({
            id: d.id,
            external_key: d.external_key,
            status: d.status,
            trashed_by: d.trashed_by,
          })),
        };
      }
      if (s.includes("pending_admin")) return { rows: [{ n: "1" }] };
      if (s.includes("COUNT(*) FILTER")) return { rows: [{ active_tps: "0", trashed_tps: "1" }] };
      return { rows: [] };
    },
  };
  const scope = await computeDbScopeForUser(pool, ADMIN_ID, "director");
  assert.equal(scope.totals.active_dealers, 1);
  assert.equal(scope.totals.trashed_dealers, 1);
  assert.equal(scope.totals.admin_purge_queue_dealers, 1);
}

console.log("record-status.test.ts: ok");
