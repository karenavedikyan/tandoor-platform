/**
 * Промт 403: bulk move archive → trash.
 * Запуск: `npm run test:bulk-archive-to-trash` из apps/platform.
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import { handleBulkMoveArchiveToTrash } from "../dealer-bulk-archive-handlers.js";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROP_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MGR_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MGR_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const TEAM_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const OTHER_TEAM_MGR = "ffffffff-ffff-ffff-ffff-ffffffffffff";

type BlobRow = {
  scope_key: string;
  user_id: string;
  role: string;
  state: Record<string, unknown>;
  version: number;
};

type OverrideRow = {
  dealer_id: string;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purged_at: string | null;
};

type AuditRow = { actor_user_id: string; action: string; entity_id: string };
type EventRow = { dealer_id: string; event_kind: string; changed_by: string };

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

function archivedDealer(id: string): Record<string, unknown> {
  return { dealerId: id, archivedAt: new Date().toISOString(), archivedBy: MGR_A, archivedByName: "Mgr A" };
}

function createPool(seed: { blobs?: BlobRow[]; overrides?: OverrideRow[] } = {}): {
  pool: PoolLike;
  blobs: Map<string, BlobRow>;
  overrides: Map<string, OverrideRow>;
  events: EventRow[];
  audit: AuditRow[];
} {
  const blobs = new Map<string, BlobRow>();
  const overrides = new Map<string, OverrideRow>();
  const events: EventRow[] = [];
  const audit: AuditRow[] = [];

  for (const b of seed.blobs ?? []) blobs.set(b.scope_key, { ...b, state: structuredClone(b.state) });
  for (const o of seed.overrides ?? []) overrides.set(o.dealer_id, { ...o });

  const teamMembers = new Set([ROP_ID, MGR_A, MGR_B]);

  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      if (s.includes("SELECT full_name, email FROM users")) {
        return { rows: [{ full_name: "Actor", email: "a@test.local" }] };
      }

      if (s.includes("SELECT DISTINCT team_id FROM user_team_memberships WHERE user_id")) {
        const uid = params?.[0] as string;
        if (uid === ROP_ID || uid === MGR_A || uid === MGR_B) return { rows: [{ team_id: TEAM_ID }] };
        return { rows: [] };
      }

      if (s.includes("SELECT id FROM teams WHERE rop_user_id")) {
        const uid = params?.[0] as string;
        return uid === ROP_ID ? { rows: [{ id: TEAM_ID }] } : { rows: [] };
      }

      if (s.includes("SELECT DISTINCT user_id::text AS user_id FROM user_team_memberships WHERE team_id")) {
        return { rows: [...teamMembers].map((user_id) => ({ user_id })) };
      }

      if (s.includes("jsonb_object_keys(state->'archivedDealersById')") && s.includes("WHERE user_id::text = $1")) {
        const uid = params?.[0] as string;
        const ids = params?.[1] as string[];
        const blob = [...blobs.values()].find((b) => b.user_id === uid);
        const arch = (blob?.state.archivedDealersById ?? {}) as Record<string, unknown>;
        const rows = ids.filter((id) => arch[id]).map((entity_id) => ({ entity_id }));
        return { rows };
      }

      if (s.includes("LATERAL jsonb_object_keys(s.state->'archivedDealersById')") && s.includes("ANY($1::text[])")) {
        const scope = params?.[0] as string[];
        const ids = params?.[1] as string[];
        const found = new Set<string>();
        for (const blob of blobs.values()) {
          if (!scope.includes(blob.user_id)) continue;
          const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
          for (const id of ids) if (arch[id]) found.add(id);
        }
        return { rows: [...found].map((entity_id) => ({ entity_id })) };
      }

      if (s.includes("SELECT dealer_id FROM dealer_overrides") && s.includes("purge_requested_at IS NOT NULL")) {
        const ids = params?.[0] as string[];
        const rows = ids
          .filter((id) => {
            const ov = overrides.get(id);
            return ov?.purge_requested_at && !ov.purged_at;
          })
          .map((dealer_id) => ({ dealer_id }));
        return { rows };
      }

      if (s.includes("INSERT INTO dealer_overrides") && s.includes("unnest")) {
        const ids = params?.[0] as string[];
        const by = params?.[1] as string;
        for (const dealer_id of ids) {
          const prev = overrides.get(dealer_id);
          overrides.set(dealer_id, {
            dealer_id,
            trashed_at: new Date().toISOString(),
            trashed_by: by,
            purge_requested_at: prev?.purge_requested_at ?? null,
            purged_at: prev?.purged_at ?? null,
          });
        }
        return { rows: [] };
      }

      if (s.includes("UPDATE client_base_actualization_state") && s.includes("archivedDealersById")) {
        const ids = params?.[0] as string[];
        const scope = params?.[1] as string[] | null;
        for (const blob of blobs.values()) {
          if (scope && !scope.includes(blob.user_id)) continue;
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

      if (s.includes("DISTINCT ON (dealer_id)") && s.includes("archivedDealersById")) {
        const ids = params?.[0] as string[];
        const rows: Array<{ dealer_id: string; archived_entry: Record<string, unknown>; full_state: Record<string, unknown> }> =
          [];
        for (const id of ids) {
          for (const blob of blobs.values()) {
            const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
            if (arch[id]) {
              rows.push({
                dealer_id: id,
                archived_entry: arch[id] as Record<string, unknown>,
                full_state: blob.state,
              });
              break;
            }
          }
        }
        return { rows };
      }

      if (s.includes("INSERT INTO client_base_actualization_state") && s.includes("trashedDealersById")) {
        const scopeKey = params?.[0] as string;
        const userId = params?.[1] as string;
        const role = params?.[2] as string;
        const entries = JSON.parse(params?.[3] as string) as Record<string, unknown>;
        const existing = blobs.get(scopeKey);
        if (existing) {
          const trash = {
            ...((existing.state.trashedDealersById ?? {}) as Record<string, unknown>),
            ...entries,
          };
          existing.state = { ...existing.state, trashedDealersById: trash };
          existing.version += 1;
        } else {
          blobs.set(scopeKey, {
            scope_key: scopeKey,
            user_id: userId,
            role,
            state: { trashedDealersById: entries },
            version: 1,
          });
        }
        return { rows: [] };
      }

      if (s.includes("GROUP BY s.user_id") && s.includes("archivedDealersById")) {
        const ids = params?.[0] as string[];
        const counts = new Map<string, number>();
        for (const blob of blobs.values()) {
          const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
          let n = 0;
          for (const id of ids) if (arch[id]) n += 1;
          if (n > 0) counts.set(blob.user_id, n);
        }
        return { rows: [...counts.entries()].map(([user_id, cnt]) => ({ user_id, cnt: String(cnt) })) };
      }

      if (s.includes("INSERT INTO dealer_override_events")) {
        events.push({
          dealer_id: params?.[0] as string,
          event_kind: params?.[3] as string,
          changed_by: params?.[2] as string,
        });
        return { rows: [] };
      }

      if (s.includes("INSERT INTO audit_log")) {
        audit.push({
          actor_user_id: params?.[0] as string,
          action: params?.[1] as string,
          entity_id: params?.[3] as string,
        });
        return { rows: [] };
      }

      if (s.includes("FROM teams WHERE rop_user_id") || s.includes("fetchTeamContext")) {
        return { rows: [] };
      }

      if (s.includes("FROM user_team_memberships") && s.includes("team_id = $1")) {
        return { rows: [...teamMembers].map((id) => ({ id })) };
      }

      if (s.includes("client_assignments") || s.includes("rop_client_grants")) {
        return { rows: [] };
      }

      void params;
      return { rows: [] };
    },
  };

  return { pool, blobs, overrides, events, audit };
}

function seedTeamArchive(): BlobRow[] {
  const dealers: Record<string, unknown> = {};
  for (let i = 0; i < 5; i++) dealers[`client-ma-${i}`] = archivedDealer(`client-ma-${i}`);
  return [
    {
      scope_key: `user:${MGR_A}`,
      user_id: MGR_A,
      role: "manager",
      version: 1,
      state: { archivedDealersById: { ...dealers } },
    },
    {
      scope_key: `user:${MGR_B}`,
      user_id: MGR_B,
      role: "manager",
      version: 1,
      state: { archivedDealersById: { ...dealers } },
    },
    {
      scope_key: `user:${OTHER_TEAM_MGR}`,
      user_id: OTHER_TEAM_MGR,
      role: "manager",
      version: 1,
      state: { archivedDealersById: { "client-foreign": archivedDealer("client-foreign") } },
    },
  ];
}

// 1. Admin moves all archived dealers
{
  const ids = ["client-ma-0", "client-ma-1", "client-ma-2"];
  const { pool, blobs, overrides, events, audit } = createPool({ blobs: seedTeamArchive() });
  const r = mockRes();
  await handleBulkMoveArchiveToTrash(mockReq({ dealer_ids: ids }), r.res, pool, {
    id: ADMIN_ID,
    role: "admin",
    status: "active",
  });
  assert.equal(r.getStatus(), 200);
  const body = r.getBody();
  assert.equal(body.success, true);
  assert.equal((body.data as { moved: number }).moved, 3);
  for (const blob of blobs.values()) {
    const arch = (blob.state.archivedDealersById ?? {}) as Record<string, unknown>;
    for (const id of ids) assert.equal(arch[id], undefined);
  }
  const ropBlob = blobs.get(`user:${ADMIN_ID}`);
  assert.ok(ropBlob?.state.trashedDealersById);
  for (const id of ids) {
    assert.ok(overrides.get(id)?.trashed_at);
    assert.equal(events.filter((e) => e.dealer_id === id && e.event_kind === "dealer_archive_to_trash_bulk").length, 1);
    assert.equal(audit.filter((a) => a.entity_id === id && a.action === "dealer_archive_to_trash_bulk").length, 1);
  }
}

// 2. ROP moves team archive; other team blob untouched
{
  const ids = ["client-ma-0", "client-ma-1"];
  const seed = seedTeamArchive();
  const { pool, blobs } = createPool({ blobs: seed });
  const r = mockRes();
  await handleBulkMoveArchiveToTrash(mockReq({ dealer_ids: ids }), r.res, pool, {
    id: ROP_ID,
    role: "rop",
    status: "active",
  });
  assert.equal(r.getStatus(), 200);
  assert.equal((r.getBody().data as { moved: number }).moved, 2);
  const foreign = blobs.get(`user:${OTHER_TEAM_MGR}`)!;
  assert.ok((foreign.state.archivedDealersById as Record<string, unknown>)["client-foreign"]);
  const ropTrash = blobs.get(`user:${ROP_ID}`);
  assert.ok(ropTrash?.state.trashedDealersById);
}

// 3. ROP with foreign IDs → skipped
{
  const ids = ["client-ma-0", "client-ma-1", "client-foreign"];
  const { pool } = createPool({ blobs: seedTeamArchive() });
  const r = mockRes();
  await handleBulkMoveArchiveToTrash(mockReq({ dealer_ids: ids }), r.res, pool, {
    id: ROP_ID,
    role: "rop",
    status: "active",
  });
  const data = r.getBody().data as { moved: number; skipped: number; skippedIds: string[] };
  assert.equal(data.moved, 2);
  assert.equal(data.skipped, 1);
  assert.deepEqual(data.skippedIds, ["client-foreign"]);
}

// 4. Manager partial move (only own archive)
{
  const ids = ["client-ma-0", "client-ma-1", "client-ma-2"];
  const seed = seedTeamArchive();
  const { pool, blobs } = createPool({ blobs: seed });
  const r = mockRes();
  await handleBulkMoveArchiveToTrash(mockReq({ dealer_ids: ids }), r.res, pool, {
    id: MGR_A,
    role: "manager",
    status: "active",
  });
  const data = r.getBody().data as { moved: number; skipped: number };
  assert.equal(data.moved, 3);
  assert.equal(data.skipped, 0);
  const mgrB = blobs.get(`user:${MGR_B}`)!;
  assert.ok((mgrB.state.archivedDealersById as Record<string, unknown>)["client-ma-0"]);
}

// 5. Skip purge_requested_at
{
  const id = "client-ma-0";
  const { pool } = createPool({
    blobs: seedTeamArchive(),
    overrides: [
      {
        dealer_id: id,
        trashed_at: null,
        trashed_by: null,
        purge_requested_at: new Date().toISOString(),
        purged_at: null,
      },
    ],
  });
  const r = mockRes();
  await handleBulkMoveArchiveToTrash(mockReq({ dealer_ids: [id] }), r.res, pool, {
    id: ADMIN_ID,
    role: "admin",
    status: "active",
  });
  const data = r.getBody().data as { moved: number; skipped: number };
  assert.equal(data.moved, 0);
  assert.equal(data.skipped, 1);
}

console.log("bulk-archive-to-trash: ok");
