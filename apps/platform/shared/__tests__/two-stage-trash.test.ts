/**
 * Запуск: `npm run test:two-stage-trash` из каталога apps/platform.
 *
 * Промт 386: двухуровневая корзина с аудитом.
 */
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeDbScopeForUser } from "../db-scope-formula.js";
import {
  handleDealerOverridesAdminRestore,
  handleDealerOverridesPurge,
  handleDealerOverridesRequestPurge,
  handleDealerOverridesRestore,
} from "../dealer-purge-handlers.js";

const DIRECTOR_ID = "11111111-1111-1111-1111-111111111111";
const MANAGER_ID = "44444444-4444-4444-4444-444444444444";
const DEALER_ID = "d-trash-1";
const MANAGER_SCOPE_KEY = `user:${MANAGER_ID}`;

type ActualizationBlobRow = {
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
  purge_requested_by: string | null;
  purged_at: string | null;
  purged_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

type AuditEvent = { dealer_id: string; event_kind: string; changed_by: string };

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
  return {
    res,
    getBody: () => body,
    getStatus: () => status,
  };
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return { body, method: "POST" } as VercelRequest;
}

function createTrashPool(initial: Partial<OverrideRow> = {}): {
  pool: PoolLike;
  overrides: Map<string, OverrideRow>;
  events: AuditEvent[];
  actualizationBlobs: Map<string, ActualizationBlobRow>;
} {
  const overrides = new Map<string, OverrideRow>();
  const events: AuditEvent[] = [];
  const actualizationBlobs = new Map<string, ActualizationBlobRow>();
  actualizationBlobs.set(MANAGER_SCOPE_KEY, {
    scope_key: MANAGER_SCOPE_KEY,
    user_id: MANAGER_ID,
    state: {
      trashedDealersById: {
        [DEALER_ID]: { dealerId: DEALER_ID, trashedBy: MANAGER_ID },
      },
    },
    version: 1,
  });
  const row: OverrideRow = {
    dealer_id: DEALER_ID,
    status: "in_trash",
    trashed_at: new Date().toISOString(),
    trashed_by: MANAGER_ID,
    purge_requested_at: null,
    purge_requested_by: null,
    purged_at: null,
    purged_by: null,
    updated_at: new Date().toISOString(),
    updated_by: MANAGER_ID,
    ...initial,
  };
  if (initial.status) row.status = initial.status;
  else if (initial.purged_at || row.purged_at) row.status = "purged";
  else if (initial.purge_requested_at || row.purge_requested_at) row.status = "pending_admin";
  else if (initial.trashed_at || row.trashed_at) row.status = "in_trash";
  else row.status = "active";
  overrides.set(DEALER_ID, row);

  const pool: PoolLike = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.startsWith("SELECT * FROM dealer_overrides WHERE dealer_id")) {
        const id = params?.[0] as string;
        const ov = overrides.get(id);
        if (!ov) return { rows: [] };
        return { rows: [{ ...ov }] };
      }
      if (s.startsWith("UPDATE dealer_overrides")) {
        const id = params?.[0] as string;
        const ov = overrides.get(id);
        if (!ov) return { rows: [] };
        if (s.includes("SET status = 'pending_admin'") && s.includes("purge_requested_at = NOW()")) {
          ov.status = "pending_admin";
          ov.purge_requested_at = new Date().toISOString();
          ov.purge_requested_by = params?.[1] as string;
        } else if (s.includes("SET status = 'purged'")) {
          ov.status = "purged";
          ov.purged_at = new Date().toISOString();
          ov.purged_by = params?.[1] as string;
        } else if (s.includes("SET status = 'pending_admin'") && s.includes("purged_at = NULL")) {
          ov.status = "pending_admin";
          ov.purged_at = null;
          ov.purged_by = null;
        } else if (s.includes("SET status = 'active'")) {
          ov.status = "active";
          ov.trashed_at = null;
          ov.trashed_by = null;
          ov.purge_requested_at = null;
          ov.purge_requested_by = null;
        } else if (s.includes("SET status = 'in_trash'") && s.includes("purge_requested_at = NULL")) {
          ov.status = "in_trash";
          ov.purge_requested_at = null;
          ov.purge_requested_by = null;
        }
        ov.updated_at = new Date().toISOString();
        ov.updated_by = params?.[1] as string;
        return { rows: [] };
      }
      if (s.includes("INSERT INTO dealer_override_events")) {
        events.push({
          dealer_id: params?.[0] as string,
          event_kind: params?.[3] as string,
          changed_by: params?.[2] as string,
        });
        return { rows: [] };
      }
      if (s.includes("INSERT INTO overrides_write_errors")) {
        return { rows: [] };
      }
      if (s.includes("UPDATE client_base_actualization_state") && s.includes("trashedDealersById")) {
        const scopeKey = params?.[0] as string;
        const dealerId = params?.[1] as string;
        const userId = params?.[2] as string;
        for (const [key, row] of actualizationBlobs) {
          if (key !== scopeKey && row.user_id !== userId) continue;
          const trash = (row.state.trashedDealersById ?? {}) as Record<string, unknown>;
          const nextTrash = { ...trash };
          delete nextTrash[dealerId];
          row.state = { ...row.state, trashedDealersById: nextTrash };
          row.version += 1;
          actualizationBlobs.set(key, row);
        }
        return { rows: [] };
      }
      if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
        const uid = params?.[0] as string;
        return { rows: uid === MANAGER_ID ? [{ c: "1" }] : [{ c: "0" }] };
      }
      if (s.includes("FROM dealers d") && s.includes("dealer_overrides")) {
        const ov = overrides.get(DEALER_ID)!;
        return {
          rows:
            ov.status === "purged"
              ? []
              : [
                  {
                    id: DEALER_ID,
                    external_key: "client-x",
                    status: ov.status,
                    trashed_by: ov.trashed_by,
                  },
                ],
        };
      }
      if (s.includes("FROM dealer_overrides d_ov") && s.includes("status = 'pending_admin'")) {
        const ov = overrides.get(DEALER_ID)!;
        const n = ov.status === "pending_admin" ? "1" : "0";
        return { rows: [{ n }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("COUNT(*) FILTER") && s.includes("trade_points")) {
        return { rows: [{ active_tps: "0", trashed_tps: "0" }] };
      }
      if (s.includes("FROM teams t")) return { rows: [] };
      if (s.includes("user_team_memberships")) return { rows: [] };
      if (s.includes("client_assignments ca") && s.includes("team_id")) return { rows: [] };
      if (s.includes("rop_client_grants")) return { rows: [] };
      if (s.includes("client_assignments WHERE responsible_user_id")) {
        return { rows: [{ client_code: "C001" }] };
      }
      void params;
      return { rows: [] };
    },
  };

  return { pool, overrides, events, actualizationBlobs };
}

const manager = { id: MANAGER_ID, role: "manager", status: "active" };
const director = { id: DIRECTOR_ID, role: "director", status: "active" };

// request-purge removes dealer from actualization blob trash map
{
  const { pool, overrides, actualizationBlobs } = createTrashPool();
  const r = mockRes();
  await handleDealerOverridesRequestPurge(mockReq({ dealer_id: DEALER_ID }), r.res, pool, manager);
  assert.equal(r.getStatus(), 200);
  assert.ok(overrides.get(DEALER_ID)?.purge_requested_at);
  const blob = actualizationBlobs.get(MANAGER_SCOPE_KEY);
  assert.ok(blob);
  const trash = (blob!.state.trashedDealersById ?? {}) as Record<string, unknown>;
  assert.equal(trash[DEALER_ID], undefined);
}

// happy path: request-purge → purge → admin-restore → restore to active
{
  const { pool, overrides, events } = createTrashPool();
  let r = mockRes();
  await handleDealerOverridesRequestPurge(mockReq({ dealer_id: DEALER_ID }), r.res, pool, manager);
  assert.equal(r.getStatus(), 200);
  assert.ok(overrides.get(DEALER_ID)?.purge_requested_at);
  assert.equal(events.at(-1)?.event_kind, "dealer_purge_requested");

  r = mockRes();
  await handleDealerOverridesPurge(mockReq({ dealer_id: DEALER_ID }), r.res, pool, director);
  assert.equal(r.getStatus(), 200);
  assert.ok(overrides.get(DEALER_ID)?.purged_at);
  assert.equal(events.at(-1)?.event_kind, "dealer_purged");

  r = mockRes();
  await handleDealerOverridesAdminRestore(mockReq({ dealer_id: DEALER_ID }), r.res, pool, director);
  assert.equal(r.getStatus(), 200);
  assert.equal(overrides.get(DEALER_ID)?.purged_at, null);
  assert.equal(events.at(-1)?.event_kind, "dealer_admin_restored");

  r = mockRes();
  await handleDealerOverridesRestore(
    mockReq({ dealer_id: DEALER_ID, target: "active" }),
    r.res,
    pool,
    director,
  );
  assert.equal(r.getStatus(), 200);
  assert.equal(overrides.get(DEALER_ID)?.trashed_at, null);
  assert.equal(events.at(-1)?.event_kind, "dealer_restored_to_active");
}

// access control: manager cannot purge
{
  const { pool } = createTrashPool({
    purge_requested_at: new Date().toISOString(),
    purge_requested_by: MANAGER_ID,
  });
  const r = mockRes();
  await handleDealerOverridesPurge(mockReq({ dealer_id: DEALER_ID }), r.res, pool, manager);
  assert.equal(r.getStatus(), 403);
}

// access control: manager cannot request-purge out of scope
{
  const { pool } = createTrashPool();
  const r = mockRes();
  const scopedPool: PoolLike = {
    query: async (sql, params) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM client_assignments") && s.includes("responsible_user_id")) {
        return { rows: [{ c: "0" }] };
      }
      return pool.query(sql, params);
    },
  };
  await handleDealerOverridesRequestPurge(mockReq({ dealer_id: DEALER_ID }), r.res, scopedPool, manager);
  assert.equal(r.getStatus(), 403);
}

// scope: after purge dealer invisible for director
{
  const { pool, overrides } = createTrashPool({
    purge_requested_at: new Date().toISOString(),
    purge_requested_by: MANAGER_ID,
  });
  overrides.get(DEALER_ID)!.status = "purged";
  overrides.get(DEALER_ID)!.purged_at = new Date().toISOString();
  overrides.get(DEALER_ID)!.purged_by = DIRECTOR_ID;
  const scope = await computeDbScopeForUser(pool, DIRECTOR_ID, "director");
  assert.equal(scope.totals.active_dealers, 0);
  assert.equal(scope.totals.trashed_dealers, 0);
}

// scope: after admin-restore dealer back in admin queue (employee trash with purge_requested)
{
  const { pool, overrides } = createTrashPool({
    purge_requested_at: new Date().toISOString(),
    purge_requested_by: MANAGER_ID,
    purged_at: new Date().toISOString(),
    purged_by: DIRECTOR_ID,
  });
  overrides.get(DEALER_ID)!.status = "pending_admin";
  overrides.get(DEALER_ID)!.purged_at = null;
  overrides.get(DEALER_ID)!.purged_by = null;
  const scope = await computeDbScopeForUser(pool, DIRECTOR_ID, "director");
  assert.equal(scope.totals.trashed_dealers, 0);
  assert.equal(scope.totals.admin_purge_queue_dealers, 1);
}

// restore from admin queue to employee trash
{
  const { pool, overrides, events } = createTrashPool({
    purge_requested_at: new Date().toISOString(),
    purge_requested_by: MANAGER_ID,
  });
  const r = mockRes();
  await handleDealerOverridesRestore(
    mockReq({ dealer_id: DEALER_ID, target: "employee_trash" }),
    r.res,
    pool,
    director,
  );
  assert.equal(r.getStatus(), 200);
  assert.equal(overrides.get(DEALER_ID)?.purge_requested_at, null);
  assert.ok(overrides.get(DEALER_ID)?.trashed_at);
  assert.equal(events.at(-1)?.event_kind, "dealer_restored_to_employee_trash");
}

console.log("two-stage-trash.test.ts: ok");
