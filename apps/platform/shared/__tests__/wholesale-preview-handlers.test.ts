/**
 * Security regressions for employee preview.
 * Run: npx tsx shared/__tests__/wholesale-preview-handlers.test.ts
 */

import assert from "node:assert/strict";
import {
  startEmployeePreview,
  stopEmployeePreview,
  isEmployeePreviewWriteBlocked,
} from "../wholesale-preview-handlers.js";
import type { PoolLike } from "../admin/admin-auth.js";

const ADMIN_ID = "10000000-0000-4000-8000-000000000090";
const EMP_ID = "10000000-0000-4000-8000-000000000010";
const OUT_ROSTER = "10000000-0000-4000-8000-000000000099";
const HASH = "abc123";

const EMP_B = "10000000-0000-4000-8000-000000000011";

function mockPool(opts?: {
  impersonating?: boolean;
  auditFails?: boolean;
  auditFailsOnSwitch?: boolean;
}): PoolLike {
  let previewGuid: string | null = null;
  let txnSnapshot: string | null = null;
  let auditCalls = 0;

  const queryImpl = async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s === "BEGIN") {
        txnSnapshot = previewGuid;
        return { rows: [] };
      }
      if (s === "COMMIT") {
        txnSnapshot = null;
        return { rows: [] };
      }
      if (s === "ROLLBACK") {
        previewGuid = txnSnapshot;
        txnSnapshot = null;
        return { rows: [] };
      }
      if (s.includes("FROM wholesale_source_snapshots")) {
        return {
          rows: [
            {
              raw: {
                employeeRoster: [
                  { guid_manager: EMP_ID, name_manager: "Тест", post: "Менеджер" },
                  { guid_manager: EMP_B, name_manager: "Тест B", post: "Менеджер" },
                ],
              },
              imported_at: "2026-10-04T00:00:00.000Z",
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_client_metadata")) {
        return {
          rows: [
            {
              guid_client: "20000000-0000-4000-8000-000000000001",
              external_key: "client-20000000-0000-4000-8000-000000000001",
              name: "Клиент",
              city: null,
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_manager: EMP_ID,
                name_manager: "Тест",
                guid_head_of_the_sales_department: null,
              },
            },
            {
              guid_client: "20000000-0000-4000-8000-000000000002",
              external_key: "client-20000000-0000-4000-8000-000000000002",
              name: "Клиент B",
              city: null,
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_manager: EMP_B,
                name_manager: "Тест B",
              },
            },
            {
              guid_client: "20000000-0000-4000-8000-000000000003",
              external_key: "client-20000000-0000-4000-8000-000000000003",
              name: "Вне roster",
              city: null,
              region: null,
              holding: null,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: "outside_wholesale_roster",
              raw: {
                guid_manager: OUT_ROSTER,
                name_manager: "Вне roster",
              },
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_outlet_metadata")) return { rows: [] };
      if (s.includes("employee_account_links")) return { rows: [] };
      if (s.includes("SELECT user_id::text, impersonator_user_id")) {
        return {
          rows: [
            {
              user_id: ADMIN_ID,
              impersonator_user_id: opts?.impersonating ? "other" : null,
            },
          ],
        };
      }
      if (s.includes("FROM sessions") && s.includes("FOR UPDATE")) {
        if (opts?.impersonating) return { rows: [] };
        return { rows: [{ id: "session-1", prev_guid: previewGuid, prev_assignment: "responsible_manager" }] };
      }
      if (s.includes("UPDATE sessions") && s.includes("employee_preview_guid = $3")) {
        if (opts?.impersonating) return { rows: [] };
        previewGuid = String(params?.[2] ?? "");
        return { rows: [{ employee_preview_guid: previewGuid }] };
      }
      if (s.includes("UPDATE sessions") && s.includes("employee_preview_guid = NULL")) {
        previewGuid = null;
        return { rows: [{ n: 1 }] };
      }
      if (s.includes("employee_preview_guid") && s.includes("FROM sessions") && !s.includes("FOR UPDATE")) {
        return {
          rows: previewGuid
            ? [
                {
                  employee_preview_guid: previewGuid,
                  employee_preview_assignment: "responsible_manager",
                  employee_preview_started_at: "2026-10-04T00:00:00.000Z",
                },
              ]
            : [],
        };
      }
      if (s.includes("INSERT INTO audit_log")) {
        auditCalls += 1;
        if (opts?.auditFails) throw new Error("audit down");
        if (opts?.auditFailsOnSwitch && auditCalls > 1) throw new Error("audit down");
        return { rows: [] };
      }
      return { rows: [] };
  };

  const pool: PoolLike & { withTransaction?: <T>(fn: (c: PoolLike) => Promise<T>) => Promise<T> } = {
    query: queryImpl,
    withTransaction: async (fn) => {
      const snap = previewGuid;
      try {
        const result = await fn({ query: queryImpl });
        return result;
      } catch (e) {
        previewGuid = snap;
        throw e;
      }
    },
  };
  return pool;
}

assert.equal(isEmployeePreviewWriteBlocked(true), true);
assert.equal(isEmployeePreviewWriteBlocked(false), false);

// Non-admin cannot start preview
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "manager",
    actorStatus: "active",
    actorUserId: "x",
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FORBIDDEN");
}

// Inactive admin rejected
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "admin",
    actorStatus: "invited",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "INACTIVE_ADMIN");
}

// Admin can start preview for roster employee with confirmed scope
{
  const pool = mockPool();
  const r = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, true);
}

// Outside roster employee rejected
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: OUT_ROSTER,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "UNCONFIRMED_SCOPE");
}

// Impersonation blocks preview start
{
  const r = await startEmployeePreview(mockPool({ impersonating: true }), {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "IMPERSONATION_ACTIVE");
}

// Audit failure rolls back preview — session stays cleared only if txn committed
{
  const pool = mockPool({ auditFails: true });
  const r = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "AUDIT_FAILED");
}

// Prior preview preserved when audit fails on switch
{
  const pool = mockPool({ auditFailsOnSwitch: true });
  const first = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(first.ok, true);
  const second = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_B,
    assignmentType: "responsible_manager",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "AUDIT_FAILED");
  const session = await pool.query(
    "SELECT employee_preview_guid FROM sessions WHERE refresh_token_hash = $1",
    [HASH],
  );
  assert.equal(session.rows[0]?.employee_preview_guid, EMP_ID);
}

// Invalid GUID rejected
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: "not-a-uuid",
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "INVALID_GUID");
}

// Stop clears preview
{
  const pool = mockPool();
  await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  const stop = await stopEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
  });
  assert.equal(stop.ok, true);
}

console.log("wholesale-preview-handlers.test.ts: ok");
