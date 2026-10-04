/**
 * Admin employee preview — read-only scope view without creating LK accounts.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { UserRole } from "./auth.js";
import { resolveWholesalePreviewScope } from "./wholesale-org-handlers.js";
import type { WholesaleAssignmentType } from "./wholesale-org-types.js";

const PREVIEW_ROLES = new Set<UserRole>(["admin"]);
const VALID_ASSIGNMENTS = new Set<WholesaleAssignmentType>([
  "head_of_sales",
  "responsible_manager",
  "regional_manager",
  "hardware_manager",
]);

export type EmployeePreviewSession = {
  employeeGuid: string;
  assignmentType: WholesaleAssignmentType;
  startedAt: string;
};

export type EmployeePreviewState = {
  active: boolean;
  preview: EmployeePreviewSession | null;
  scope: Awaited<ReturnType<typeof resolveWholesalePreviewScope>> | null;
  basis: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAssignmentType(raw: unknown): WholesaleAssignmentType | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return VALID_ASSIGNMENTS.has(v as WholesaleAssignmentType) ? (v as WholesaleAssignmentType) : null;
}

export async function readEmployeePreviewFromSession(
  pool: PoolLike,
  refreshTokenHash: string,
): Promise<EmployeePreviewSession | null> {
  const r = await pool.query<{
    employee_preview_guid: string | null;
    employee_preview_assignment: string | null;
    employee_preview_started_at: string | null;
  }>(
    `SELECT employee_preview_guid::text,
            employee_preview_assignment,
            employee_preview_started_at
       FROM sessions
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
    [refreshTokenHash],
  );
  const row = r.rows[0];
  if (!row?.employee_preview_guid) return null;
  const assignmentType = parseAssignmentType(row.employee_preview_assignment);
  if (!assignmentType) return null;
  return {
    employeeGuid: row.employee_preview_guid,
    assignmentType,
    startedAt: row.employee_preview_started_at ?? new Date().toISOString(),
  };
}

export async function buildEmployeePreviewState(
  pool: PoolLike,
  refreshTokenHash: string,
): Promise<EmployeePreviewState> {
  const session = await readEmployeePreviewFromSession(pool, refreshTokenHash);
  if (!session) {
    return { active: false, preview: null, scope: null, basis: null };
  }
  const scope = await resolveWholesalePreviewScope(
    pool,
    session.employeeGuid,
    session.assignmentType,
  );
  const basis = previewBasisLabel(session.assignmentType, scope.confirmed, scope.reason);
  return { active: true, preview: session, scope, basis };
}

function previewBasisLabel(
  assignmentType: WholesaleAssignmentType,
  confirmed: boolean,
  reason: string | null,
): string {
  const typeLabel: Record<WholesaleAssignmentType, string> = {
    head_of_sales: "назначения РОП в данных 1С",
    responsible_manager: "назначения ответственного менеджера в данных 1С",
    regional_manager: "назначения регионального менеджера в данных 1С",
    hardware_manager: "назначения менеджера по фурнитуре в данных 1С",
    store_manager: "назначения менеджера ТТ в данных 1С",
  };
  const base = `Область сформирована по ${typeLabel[assignmentType]}.`;
  if (!confirmed && reason) return `${base} Область не подтверждена: ${reason}.`;
  return base;
}

export async function startEmployeePreview(
  pool: PoolLike,
  input: {
    actorRole: UserRole;
    actorUserId: string;
    refreshTokenHash: string;
    employeeGuid: string;
    assignmentType: WholesaleAssignmentType;
  },
): Promise<{ ok: true; state: EmployeePreviewState } | { ok: false; code: string; message: string }> {
  if (!PREVIEW_ROLES.has(input.actorRole)) {
    return { ok: false, code: "FORBIDDEN", message: "Предпросмотр доступен только администратору." };
  }
  if (!UUID_RE.test(input.employeeGuid)) {
    return { ok: false, code: "INVALID_GUID", message: "Некорректный GUID сотрудника." };
  }
  if (!VALID_ASSIGNMENTS.has(input.assignmentType)) {
    return { ok: false, code: "INVALID_ASSIGNMENT", message: "Некорректный тип назначения." };
  }

  const scope = await resolveWholesalePreviewScope(pool, input.employeeGuid, input.assignmentType);
  if (scope.reason === "EMPLOYEE_NOT_IN_ROSTER") {
    return { ok: false, code: "NOT_IN_ROSTER", message: "Сотрудник отсутствует в актуальном roster ОПТ." };
  }

  await pool.query(
    `UPDATE sessions
        SET employee_preview_guid = $2::uuid,
            employee_preview_assignment = $3,
            employee_preview_started_at = NOW()
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL`,
    [input.refreshTokenHash, input.employeeGuid, input.assignmentType],
  );

  await pool.query(
    `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1::uuid, 'admin.employee_preview.start', 'employee_1c', $2, $3::jsonb)`,
    [
      input.actorUserId,
      input.employeeGuid,
      JSON.stringify({ assignmentType: input.assignmentType, confirmed: scope.confirmed }),
    ],
  ).catch(() => undefined);

  const state = await buildEmployeePreviewState(pool, input.refreshTokenHash);
  return { ok: true, state };
}

export async function stopEmployeePreview(
  pool: PoolLike,
  input: { actorRole: UserRole; actorUserId: string; refreshTokenHash: string },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!PREVIEW_ROLES.has(input.actorRole)) {
    return { ok: false, code: "FORBIDDEN", message: "Предпросмотр доступен только администратору." };
  }

  const prev = await readEmployeePreviewFromSession(pool, input.refreshTokenHash);

  await pool.query(
    `UPDATE sessions
        SET employee_preview_guid = NULL,
            employee_preview_assignment = NULL,
            employee_preview_started_at = NULL
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL`,
    [input.refreshTokenHash],
  );

  if (prev) {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1::uuid, 'admin.employee_preview.stop', 'employee_1c', $2, $3::jsonb)`,
      [input.actorUserId, prev.employeeGuid, JSON.stringify({ assignmentType: prev.assignmentType })],
    ).catch(() => undefined);
  }

  return { ok: true };
}
