/**
 * Security regressions for employee preview.
 * Run: npx tsx shared/__tests__/wholesale-preview-handlers.test.ts
 */

import assert from "node:assert/strict";
import { startEmployeePreview, stopEmployeePreview } from "../wholesale-preview-handlers.js";
import type { PoolLike } from "../admin/admin-auth.js";

const ADMIN_ID = "10000000-0000-4000-8000-000000000090";
const EMP_ID = "10000000-0000-4000-8000-000000000010";
const HASH = "abc123";

function mockPool(): PoolLike {
  let previewGuid: string | null = null;
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM wholesale_source_snapshots")) {
        return {
          rows: [
            {
              raw: { employeeRoster: [{ guid_manager: EMP_ID, name_manager: "Тест" }] },
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
              holding: false,
              holding_link_state: null,
              pending_holding_guid: null,
              manager_roster_state: null,
              raw: {
                guid_manager: EMP_ID,
                name_manager: "Тест",
                guid_head_of_the_sales_department: null,
              },
            },
          ],
        };
      }
      if (s.includes("FROM wholesale_outlet_metadata")) return { rows: [] };
      if (s.includes("FROM users")) return { rows: [] };
      if (s.includes("UPDATE sessions") && s.includes("employee_preview_guid = $2")) {
        previewGuid = String(params?.[1] ?? "");
        return { rows: [] };
      }
      if (s.includes("UPDATE sessions") && s.includes("employee_preview_guid = NULL")) {
        previewGuid = null;
        return { rows: [] };
      }
      if (s.includes("employee_preview_guid") && s.includes("FROM sessions")) {
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
      if (s.includes("INSERT INTO audit_log")) return { rows: [] };
      return { rows: [] };
    },
  };
}

// Non-admin cannot start preview
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "manager",
    actorUserId: "x",
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "FORBIDDEN");
}

// Admin can start preview for roster employee
{
  const pool = mockPool();
  const r = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  assert.equal(r.ok, true);
}

// Invalid GUID rejected
{
  const r = await startEmployeePreview(mockPool(), {
    actorRole: "admin",
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
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_ID,
    assignmentType: "responsible_manager",
  });
  const stop = await stopEmployeePreview(pool, {
    actorRole: "admin",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
  });
  assert.equal(stop.ok, true);
}

console.log("wholesale-preview-handlers.test.ts: ok");
