/**
 * Промт 405: взаимное исключение архива и корзины.
 * Запуск: `npm run test:archive-trash-mutual-exclusion` из apps/platform.
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  removeDealerFromArchiveEverywhere,
  stripArchivedKeysAlreadyInActiveTrash,
} from "../archive-trash-invariant.js";
import { handleBulkRestoreDealers } from "../trash-bulk-actions-handlers.js";

const MGR_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MGR_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ACTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEALER_ID = "client-test-1";

type BlobRow = {
  scope_key: string;
  user_id: string;
  state: Record<string, unknown>;
  version: number;
};

type OverrideRow = {
  dealer_id: string;
  status: "active" | "in_trash" | "pending_admin" | "purged";
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purged_at: string | null;
};

function archivedEntry(): Record<string, unknown> {
  return { dealerId: DEALER_ID, archivedAt: new Date().toISOString(), archivedBy: MGR_A, archivedByName: "A" };
}

function mockRes(): { res: VercelResponse; getStatus: () => number } {
  let status = 200;
  const res = {
    setHeader: () => undefined,
    status: (s: number) => {
      status = s;
      return res;
    },
    json: () => res,
  } as unknown as VercelResponse;
  return { res, getStatus: () => status };
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return { body, method: "POST" } as VercelRequest;
}

function createPool(seed: { blobs?: BlobRow[]; overrides?: OverrideRow[] }): {
  pool: PoolLike;
  blobs: Map<string, BlobRow>;
  overrides: Map<string, OverrideRow>;
} {
  const blobs = new Map<string, BlobRow>();
  const overrides = new Map<string, OverrideRow>();
  for (const b of seed.blobs ?? []) blobs.set(b.scope_key, { ...b, state: structuredClone(b.state) });
  for (const o of seed.overrides ?? []) overrides.set(o.dealer_id, { ...o });

  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      if (s.includes("UPDATE client_base_actualization_state") && s.includes("archivedDealersById")) {
        const ids = params?.[0] as string[];
        for (const blob of blobs.values()) {
          const arch = { ...((blob.state.archivedDealersById ?? {}) as Record<string, unknown>) };
          let changed = false;
          for (const id of ids) {
            if (arch[id]) {
              delete arch[id];
              changed = true;
            }
          }
          if (changed) {
            blob.state = { ...blob.state, archivedDealersById: arch };
            blob.version += 1;
          }
        }
        return { rows: [] };
      }

      if (s.includes("FROM dealer_overrides") && s.includes("status = 'in_trash'")) {
        const ids = params?.[0] as string[];
        const rows = ids
          .map((id) => overrides.get(id))
          .filter((ov): ov is OverrideRow => ov?.status === "in_trash")
          .map((ov) => ({ dealer_id: ov.dealer_id, trashed_by: ov.trashed_by }));
        return { rows };
      }

      if (s.includes("SELECT dealer_id FROM dealer_overrides") && s.includes("status = 'in_trash'")) {
        const ids = params?.[0] as string[];
        const rows = ids
          .map((id) => overrides.get(id))
          .filter((ov): ov is OverrideRow => ov?.status === "in_trash")
          .map((ov) => ({ dealer_id: ov.dealer_id }));
        return { rows };
      }

      if (s.includes("FROM dealer_overrides") && s.includes("status = 'in_trash'") && s.includes("ANY")) {
        const ids = params?.[0] as string[];
        const rows = ids
          .map((id) => overrides.get(id))
          .filter((ov): ov is OverrideRow => ov?.status === "in_trash")
          .map((ov) => ({ dealer_id: ov.dealer_id }));
        return { rows };
      }

      if (s.includes("UPDATE dealer_overrides") && s.includes("status = 'active'")) {
        const ids = params?.[0] as string[];
        for (const id of ids) {
          const ov = overrides.get(id);
          if (!ov) continue;
          ov.status = "active";
          ov.trashed_at = null;
          ov.trashed_by = null;
          ov.purge_requested_at = null;
        }
        return { rows: [] };
      }

      if (s.includes("INSERT INTO dealer_override_events") || s.includes("INSERT INTO audit_log")) {
        return { rows: [] };
      }

      if (s.includes("UPDATE client_base_actualization_state") && s.includes("trashedDealersById")) {
        return { rows: [] };
      }

      if (s.includes("user_team_memberships") || s.includes("FROM teams")) return { rows: [] };

      void params;
      return { rows: [] };
    },
  };

  return { pool, blobs, overrides };
}

const seedBlobs: BlobRow[] = [
  {
    scope_key: `user:${MGR_A}`,
    user_id: MGR_A,
    version: 1,
    state: { archivedDealersById: { [DEALER_ID]: archivedEntry() } },
  },
  {
    scope_key: `user:${MGR_B}`,
    user_id: MGR_B,
    version: 1,
    state: { archivedDealersById: { [DEALER_ID]: archivedEntry() } },
  },
];

// case 1: trash path removes dealer from all archivedDealersById
{
  const { pool, blobs } = createPool({
    blobs: seedBlobs.map((b) => ({ ...b, state: structuredClone(b.state) })),
  });
  await removeDealerFromArchiveEverywhere(pool, DEALER_ID);
  for (const blob of blobs.values()) {
    const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
    assert.equal(arch[DEALER_ID], undefined);
  }
}

// case 2: POST state strip drops archived key when dealer is in DB trash
{
  const { pool } = createPool({
    overrides: [
      {
        dealer_id: DEALER_ID,
        status: "in_trash",
        trashed_at: new Date().toISOString(),
        trashed_by: ACTOR,
        purge_requested_at: null,
        purged_at: null,
      },
    ],
  });
  const input = {
    archivedDealersById: { [DEALER_ID]: archivedEntry(), "client-ok": archivedEntry() },
    archivedTradePointsById: {},
  };
  const result = await stripArchivedKeysAlreadyInActiveTrash(pool, input);
  const arch = result.state.archivedDealersById as Record<string, unknown>;
  assert.equal(arch[DEALER_ID], undefined);
  assert.ok(arch["client-ok"]);
  assert.equal(result.droppedDealers, 1);
}

// case 3: bulk-restore clears archive everywhere (insurance)
{
  const { pool, blobs, overrides } = createPool({
    blobs: seedBlobs.map((b) => ({ ...b, state: structuredClone(b.state) })),
    overrides: [
      {
        dealer_id: DEALER_ID,
        status: "in_trash",
        trashed_at: new Date().toISOString(),
        trashed_by: MGR_A,
        purge_requested_at: null,
        purged_at: null,
      },
    ],
  });
  const r = mockRes();
  await handleBulkRestoreDealers(mockReq({ dealer_ids: [DEALER_ID] }), r.res, pool, {
    id: ACTOR,
    role: "admin",
    status: "active",
  });
  assert.equal(r.getStatus(), 200);
  assert.equal(overrides.get(DEALER_ID)?.trashed_at, null);
  for (const blob of blobs.values()) {
    const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
    assert.equal(arch[DEALER_ID], undefined);
  }
}

console.log("archive-trash-mutual-exclusion: ok");
