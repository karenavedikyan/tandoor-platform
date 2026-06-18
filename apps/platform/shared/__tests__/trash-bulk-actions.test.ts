/**
 * Промт 404: bulk restore / request-purge в корзине.
 * Запуск: `npm run test:trash-bulk` из apps/platform.
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  filterTrashedDealerIdsForBulk,
  filterTrashedDealerIdsForPurge,
} from "../trash-bulk-actions-core.js";
import {
  handleBulkRequestPurgeDealers,
  handleBulkRestoreDealers,
} from "../trash-bulk-actions-handlers.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MGR_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MGR_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FOREIGN_MGR = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const TEAM_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

type OverrideRow = {
  dealer_id: string;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purged_at: string | null;
};

type BlobRow = {
  scope_key: string;
  user_id: string;
  state: Record<string, unknown>;
  version: number;
};

function mockRes(): { res: VercelResponse; getBody: () => Record<string, unknown>; getStatus: () => number } {
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
  return { res, getBody: () => body, getStatus: () => status };
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return { body, method: "POST" } as VercelRequest;
}

function trashRow(dealerId: string, trashedBy: string, purgePending = false): OverrideRow {
  return {
    dealer_id: dealerId,
    trashed_at: new Date().toISOString(),
    trashed_by: trashedBy,
    purge_requested_at: purgePending ? new Date().toISOString() : null,
    purged_at: null,
  };
}

function createPool(seed: { overrides?: OverrideRow[]; blobs?: BlobRow[] } = {}): {
  pool: PoolLike;
  overrides: Map<string, OverrideRow>;
  blobs: Map<string, BlobRow>;
  audit: Array<{ action: string; metadata: string }>;
} {
  const overrides = new Map<string, OverrideRow>();
  const blobs = new Map<string, BlobRow>();
  const audit: Array<{ action: string; metadata: string }> = [];
  for (const o of seed.overrides ?? []) overrides.set(o.dealer_id, { ...o });
  for (const b of seed.blobs ?? []) blobs.set(b.scope_key, { ...b, state: structuredClone(b.state) });

  const teamMembers = new Set([ROP_ID, MGR_A, MGR_B]);

  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      if (s.includes("SELECT DISTINCT team_id FROM user_team_memberships")) {
        const uid = params?.[0] as string;
        return uid === ROP_ID || uid === MGR_A || uid === MGR_B ? { rows: [{ team_id: TEAM_ID }] } : { rows: [] };
      }
      if (s.includes("SELECT id FROM teams WHERE rop_user_id")) {
        return params?.[0] === ROP_ID ? { rows: [{ id: TEAM_ID }] } : { rows: [] };
      }
      if (s.includes("SELECT DISTINCT user_id::text AS user_id FROM user_team_memberships WHERE team_id")) {
        return { rows: [...teamMembers].map((user_id) => ({ user_id })) };
      }

      if (s.includes("FROM dealer_overrides") && s.includes("trashed_at IS NOT NULL")) {
        const ids = params?.[0] as string[];
        const rows = ids
          .map((id) => overrides.get(id))
          .filter((ov): ov is OverrideRow =>
            Boolean(ov?.trashed_at && !ov.purge_requested_at && !ov.purged_at),
          )
          .map((ov) => ({ dealer_id: ov.dealer_id, trashed_by: ov.trashed_by }));
        return { rows };
      }

      if (s.includes("UPDATE dealer_overrides") && s.includes("trashed_at = NULL")) {
        const ids = params?.[0] as string[];
        for (const id of ids) {
          const ov = overrides.get(id);
          if (!ov) continue;
          ov.trashed_at = null;
          ov.trashed_by = null;
          ov.purge_requested_at = null;
        }
        return { rows: [] };
      }

      if (s.includes("UPDATE dealer_overrides") && s.includes("purge_requested_at = NOW()")) {
        const ids = params?.[0] as string[];
        for (const id of ids) {
          const ov = overrides.get(id);
          if (!ov || !ov.trashed_at || ov.purge_requested_at) continue;
          ov.purge_requested_at = new Date().toISOString();
        }
        return { rows: [] };
      }

      if (s.includes("UPDATE client_base_actualization_state") && s.includes("trashedDealersById")) {
        const ids = params?.[0] as string[];
        const scopeKey = params?.[1] as string;
        const userId = params?.[2] as string;
        for (const blob of blobs.values()) {
          if (blob.scope_key !== scopeKey && blob.user_id !== userId) continue;
          const trash = { ...((blob.state.trashedDealersById ?? {}) as Record<string, unknown>) };
          for (const id of ids) delete trash[id];
          blob.state = { ...blob.state, trashedDealersById: trash };
        }
        return { rows: [] };
      }

      if (s.includes("INSERT INTO dealer_override_events")) return { rows: [] };
      if (s.includes("INSERT INTO audit_log")) {
        audit.push({ action: params?.[1] as string, metadata: params?.[4] as string });
        return { rows: [] };
      }

      void params;
      return { rows: [] };
    },
  };

  return { pool, overrides, blobs, audit };
}

function makeIds(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

// 1. admin bulk-restore 100
{
  const ids = makeIds("client-d", 100);
  const { pool, overrides } = createPool({
    overrides: ids.map((id) => trashRow(id, MGR_A)),
  });
  const r = mockRes();
  await handleBulkRestoreDealers(mockReq({ dealer_ids: ids }), r.res, pool, {
    id: ADMIN_ID,
    role: "admin",
    status: "active",
  });
  assert.equal(r.getStatus(), 200);
  assert.equal((r.getBody().data as { restored: number }).restored, 100);
  for (const id of ids) {
    assert.equal(overrides.get(id)?.trashed_at, null);
  }
}

// 2. rop: 50 ids, 10 foreign team → 40 restored
{
  const teamIds = makeIds("client-team", 40);
  const foreignIds = makeIds("client-foreign", 10);
  const all = [...teamIds, ...foreignIds];
  const { pool } = createPool({
    overrides: [
      ...teamIds.map((id) => trashRow(id, MGR_A)),
      ...foreignIds.map((id) => trashRow(id, FOREIGN_MGR)),
    ],
  });
  const filter = await filterTrashedDealerIdsForBulk(pool, { id: ROP_ID, role: "rop" }, all);
  assert.equal(filter.allowed.length, 40);
  assert.equal(filter.skipped, 10);
}

// 3. manager: 30 ids, 25 foreign → 5 restored
{
  const own = makeIds("client-own", 5);
  const foreign = makeIds("client-x", 25);
  const all = [...own, ...foreign];
  const { pool } = createPool({
    overrides: [
      ...own.map((id) => trashRow(id, MGR_A)),
      ...foreign.map((id) => trashRow(id, MGR_B)),
    ],
  });
  const filter = await filterTrashedDealerIdsForBulk(pool, { id: MGR_A, role: "manager" }, all);
  assert.equal(filter.allowed.length, 5);
  assert.equal(filter.skipped, 25);
}

// 4. purge: purge-pending skipped
{
  const okId = "client-ok";
  const pendingId = "client-pending";
  const { pool } = createPool({
    overrides: [trashRow(okId, MGR_A), trashRow(pendingId, MGR_A, true)],
  });
  const filter = await filterTrashedDealerIdsForPurge(pool, { id: MGR_A, role: "manager" }, [okId, pendingId]);
  assert.deepEqual(filter.allowed, [okId]);
  assert.equal(filter.skipped, 1);

  const r = mockRes();
  await handleBulkRequestPurgeDealers(mockReq({ dealer_ids: [okId, pendingId] }), r.res, pool, {
    id: MGR_A,
    role: "manager",
    status: "active",
  });
  const data = r.getBody().data as { requestedPurge: number; skipped: number };
  assert.equal(data.requestedPurge, 1);
  assert.equal(data.skipped, 1);
}

console.log("trash-bulk-actions: ok");
