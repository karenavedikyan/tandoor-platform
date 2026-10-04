/**
 * Real PostgreSQL: preview start rollback on audit failure preserves prior session.
 * Run: DATABASE_URL=... npx tsx shared/__tests__/wholesale-preview-transaction.integration.test.ts
 */

import assert from "node:assert/strict";
import pg from "pg";
import { neon } from "../../server/timeweb-pg.js";
import { makePoolFromNeon } from "../admin/admin-auth.js";
import { startEmployeePreview, stopEmployeePreview } from "../wholesale-preview-handlers.js";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("SKIP wholesale-preview-transaction.integration.test.ts: DATABASE_URL unset");
  process.exit(0);
}

const ADMIN_ID = "10000000-0000-4000-8000-000000000090";
const EMP_A = "10000000-0000-4000-8000-000000000010";
const EMP_B = "10000000-0000-4000-8000-000000000011";
const HASH = "integration-preview-txn-hash";

const pool = makePoolFromNeon(neon(url));
const raw = new pg.Pool({ connectionString: url, ssl: false });

async function ensureSession(previewGuid: string | null) {
  await raw.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, expires_at, status, employee_preview_guid, employee_preview_assignment)
     VALUES ($1::uuid, $2, NOW() + INTERVAL '1 hour', 'active', $3::uuid, CASE WHEN $3 IS NULL THEN NULL ELSE 'responsible_manager' END)
     ON CONFLICT (refresh_token_hash) DO UPDATE
       SET employee_preview_guid = EXCLUDED.employee_preview_guid,
           employee_preview_assignment = EXCLUDED.employee_preview_assignment,
           revoked_at = NULL,
           expires_at = EXCLUDED.expires_at`,
    [ADMIN_ID, HASH, previewGuid],
  );
}

async function readPreviewGuid(): Promise<string | null> {
  const r = await raw.query<{ g: string | null }>(
    `SELECT employee_preview_guid::text AS g FROM sessions WHERE refresh_token_hash = $1`,
    [HASH],
  );
  return r.rows[0]?.g ?? null;
}

try {
  await ensureSession(EMP_A);
  await raw.query(`DROP TRIGGER IF EXISTS synthetic_audit_fail ON audit_log`);
  await raw.query(`
    CREATE OR REPLACE FUNCTION synthetic_audit_fail_fn() RETURNS trigger AS $$
    BEGIN
      IF NEW.action LIKE 'admin.employee_preview.%' THEN
        RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`);
  await raw.query(`
    CREATE TRIGGER synthetic_audit_fail
    BEFORE INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION synthetic_audit_fail_fn()`);

  const fail = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_B,
    assignmentType: "responsible_manager",
  });
  assert.equal(fail.ok, false);
  if (!fail.ok) assert.equal(fail.code, "AUDIT_FAILED");
  assert.equal(await readPreviewGuid(), EMP_A, "prior preview preserved after audit failure");

  await raw.query(`DROP TRIGGER IF EXISTS synthetic_audit_fail ON audit_log`);
  const ok = await startEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
    employeeGuid: EMP_B,
    assignmentType: "responsible_manager",
  });
  assert.equal(ok.ok, true);
  assert.equal(await readPreviewGuid(), EMP_B);

  await stopEmployeePreview(pool, {
    actorRole: "admin",
    actorStatus: "active",
    actorUserId: ADMIN_ID,
    refreshTokenHash: HASH,
  });
  assert.equal(await readPreviewGuid(), null);

  console.log("wholesale-preview-transaction.integration.test.ts: ok");
} finally {
  await raw.query(`DROP TRIGGER IF EXISTS synthetic_audit_fail ON audit_log`).catch(() => undefined);
  await raw.end();
}
