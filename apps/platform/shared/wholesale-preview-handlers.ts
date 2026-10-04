/**
 * Admin employee preview — read-only scope view without creating LK accounts.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import { poolSupportsTransaction } from "./pool-transaction-support.js";
import type { UserRole } from "./auth.js";
import { resolveWholesalePreviewScope } from "./wholesale-org-handlers.js";
import type { WholesaleAssignmentType } from "./wholesale-org-types.js";

const PREVIEW_ROLES = new Set<UserRole>(["admin"]);
const VALID_ASSIGNMENTS = new Set<WholesaleAssignmentType>([
  "head_of_sales",
  "responsible_manager",
  "regional_manager",
  "hardware_manager",
  "store_manager",
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
  error?: { code: string; message: string } | null;
};

export type EmployeePreviewBootstrapFields = {
  active: boolean;
  employeeGuid: string | null;
  fullName: string | null;
  assignmentType: string | null;
  confirmed: boolean;
  reason: string | null;
  basis: string | null;
  error?: { code: string; message: string } | null;
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

export async function sessionHasActiveEmployeePreview(
  pool: PoolLike,
  refreshTokenHash: string,
): Promise<boolean> {
  const session = await readEmployeePreviewFromSession(pool, refreshTokenHash);
  return session !== null;
}

export function isEmployeePreviewWriteBlocked(activePreview: boolean): boolean {
  return activePreview;
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

export async function buildEmployeePreviewState(
  pool: PoolLike,
  refreshTokenHash: string,
): Promise<EmployeePreviewState> {
  const session = await readEmployeePreviewFromSession(pool, refreshTokenHash);
  if (!session) {
    return { active: false, preview: null, scope: null, basis: null, error: null };
  }
  try {
    const scope = await resolveWholesalePreviewScope(
      pool,
      session.employeeGuid,
      session.assignmentType,
    );
    const basis = previewBasisLabel(session.assignmentType, scope.confirmed, scope.reason);
    return { active: true, preview: session, scope, basis, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      active: true,
      preview: session,
      scope: null,
      basis: null,
      error: { code: "PREVIEW_SCOPE_ERROR", message: msg },
    };
  }
}

export function employeePreviewToBootstrap(state: EmployeePreviewState): EmployeePreviewBootstrapFields {
  if (!state.active || !state.preview) {
    return {
      active: false,
      employeeGuid: null,
      fullName: null,
      assignmentType: null,
      confirmed: false,
      reason: null,
      basis: null,
      error: null,
    };
  }
  if (state.error) {
    return {
      active: true,
      employeeGuid: state.preview.employeeGuid,
      fullName: state.scope?.fullName ?? null,
      assignmentType: state.preview.assignmentType,
      confirmed: false,
      reason: state.error.code,
      basis: null,
      error: state.error,
    };
  }
  if (!state.scope) {
    return {
      active: true,
      employeeGuid: state.preview.employeeGuid,
      fullName: null,
      assignmentType: state.preview.assignmentType,
      confirmed: false,
      reason: "SCOPE_UNAVAILABLE",
      basis: null,
      error: { code: "SCOPE_UNAVAILABLE", message: "Не удалось построить область предпросмотра." },
    };
  }
  return {
    active: true,
    employeeGuid: state.preview.employeeGuid,
    fullName: state.scope.fullName,
    assignmentType: state.preview.assignmentType,
    confirmed: state.scope.confirmed,
    reason: state.scope.reason,
    basis: state.basis,
    error: null,
  };
}

type PreviewMutationInner =
  | { ok: true }
  | { ok: false; code: string; message: string };

async function applyPreviewSessionMutation(
  pool: PoolLike,
  fn: (client: PoolLike) => Promise<PreviewMutationInner>,
): Promise<PreviewMutationInner | { ok: false; error: string }> {
  const run = async (client: PoolLike): Promise<PreviewMutationInner> => fn(client);
  try {
    if (poolSupportsTransaction(pool)) {
      return await pool.withTransaction(run);
    }
    return await runAtomicPreviewMutation(pool, fn);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Single-statement fallback when pool has no pinned connection (Neon HTTP). */
async function runAtomicPreviewMutation(
  pool: PoolLike,
  fn: (client: PoolLike) => Promise<PreviewMutationInner>,
): Promise<PreviewMutationInner> {
  await pool.query("BEGIN");
  try {
    const result = await fn(pool);
    if (!result.ok) {
      await pool.query("ROLLBACK");
      return result;
    }
    await pool.query("COMMIT");
    return result;
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

async function writeAuditLog(
  pool: PoolLike,
  input: {
    actorUserId: string;
    action: string;
    employeeGuid: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1::uuid, $2, 'employee_1c', $3, $4::jsonb)`,
    [input.actorUserId, input.action, input.employeeGuid, JSON.stringify(input.metadata)],
  );
}

async function assertSessionUpdatable(
  pool: PoolLike,
  refreshTokenHash: string,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const r = await pool.query<{ user_id: string; impersonator_user_id: string | null }>(
    `SELECT user_id::text, impersonator_user_id::text
       FROM sessions
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
    [refreshTokenHash],
  );
  const row = r.rows[0];
  if (!row) {
    return { ok: false, code: "SESSION_INVALID", message: "Сессия недействительна или истекла." };
  }
  if (row.user_id !== actorUserId) {
    return { ok: false, code: "SESSION_MISMATCH", message: "Сессия не принадлежит текущему пользователю." };
  }
  if (row.impersonator_user_id) {
    return {
      ok: false,
      code: "IMPERSONATION_ACTIVE",
      message: "Предпросмотр недоступен во время наблюдения за другим пользователем.",
    };
  }
  return { ok: true };
}

export async function startEmployeePreview(
  pool: PoolLike,
  input: {
    actorRole: UserRole;
    actorStatus: string;
    actorUserId: string;
    refreshTokenHash: string;
    employeeGuid: string;
    assignmentType: WholesaleAssignmentType;
  },
): Promise<{ ok: true; state: EmployeePreviewState } | { ok: false; code: string; message: string }> {
  if (!PREVIEW_ROLES.has(input.actorRole)) {
    return { ok: false, code: "FORBIDDEN", message: "Предпросмотр доступен только администратору." };
  }
  if (input.actorStatus !== "active") {
    return { ok: false, code: "INACTIVE_ADMIN", message: "Аккаунт администратора не активен." };
  }
  if (!UUID_RE.test(input.employeeGuid)) {
    return { ok: false, code: "INVALID_GUID", message: "Некорректный GUID сотрудника." };
  }
  if (!VALID_ASSIGNMENTS.has(input.assignmentType)) {
    return { ok: false, code: "INVALID_ASSIGNMENT", message: "Некорректный тип назначения." };
  }

  const sessionCheck = await assertSessionUpdatable(pool, input.refreshTokenHash, input.actorUserId);
  if (!sessionCheck.ok) return sessionCheck;

  const scope = await resolveWholesalePreviewScope(pool, input.employeeGuid, input.assignmentType);
  if (scope.reason === "EMPLOYEE_NOT_IN_ROSTER") {
    return { ok: false, code: "NOT_IN_ROSTER", message: "Сотрудник отсутствует в актуальном roster ОПТ." };
  }
  if (scope.reason === "OUTSIDE_ROSTER" || !scope.confirmed) {
    return {
      ok: false,
      code: "UNCONFIRMED_SCOPE",
      message: `Область не подтверждена: ${scope.reason ?? "UNKNOWN"}.`,
    };
  }

  const txnResult = await applyPreviewSessionMutation(pool, async (client) => {
    const locked = await client.query<{ id: string }>(
      `SELECT id::text
         FROM sessions
        WHERE refresh_token_hash = $1
          AND user_id = $2::uuid
          AND revoked_at IS NULL
          AND expires_at > NOW()
          AND impersonator_user_id IS NULL
        FOR UPDATE`,
      [input.refreshTokenHash, input.actorUserId],
    );
    if (!locked.rows[0]) {
      return { ok: false as const, code: "SESSION_UPDATE_FAILED", message: "Не удалось сохранить предпросмотр в сессии." };
    }

    const upd = await client.query<{ employee_preview_guid: string | null }>(
      `UPDATE sessions
          SET employee_preview_guid = $3::uuid,
              employee_preview_assignment = $4,
              employee_preview_started_at = NOW()
        WHERE refresh_token_hash = $1
          AND user_id = $2::uuid
          AND revoked_at IS NULL
          AND expires_at > NOW()
          AND impersonator_user_id IS NULL
        RETURNING employee_preview_guid::text`,
      [input.refreshTokenHash, input.actorUserId, input.employeeGuid, input.assignmentType],
    );
    if (!upd.rows[0]?.employee_preview_guid) {
      return { ok: false as const, code: "SESSION_UPDATE_FAILED", message: "Не удалось сохранить предпросмотр в сессии." };
    }

    await writeAuditLog(client, {
      actorUserId: input.actorUserId,
      action: "admin.employee_preview.start",
      employeeGuid: input.employeeGuid,
      metadata: { assignmentType: input.assignmentType, confirmed: scope.confirmed },
    });
    return { ok: true as const };
  });
  if (!txnResult.ok) {
    if ("code" in txnResult) return txnResult;
    const msg = txnResult.error;
    return { ok: false, code: "AUDIT_FAILED", message: `Журналирование не выполнено: ${msg}` };
  }

  const state = await buildEmployeePreviewState(pool, input.refreshTokenHash);
  return { ok: true, state };
}

export async function stopEmployeePreview(
  pool: PoolLike,
  input: {
    actorRole: UserRole;
    actorStatus: string;
    actorUserId: string;
    refreshTokenHash: string;
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!PREVIEW_ROLES.has(input.actorRole)) {
    return { ok: false, code: "FORBIDDEN", message: "Предпросмотр доступен только администратору." };
  }
  if (input.actorStatus !== "active") {
    return { ok: false, code: "INACTIVE_ADMIN", message: "Аккаунт администратора не активен." };
  }

  const sessionCheck = await assertSessionUpdatable(pool, input.refreshTokenHash, input.actorUserId);
  if (!sessionCheck.ok) return sessionCheck;

  const txnResult = await applyPreviewSessionMutation(pool, async (client) => {
    const locked = await client.query<{
      prev_guid: string | null;
      prev_assignment: string | null;
    }>(
      `SELECT employee_preview_guid::text AS prev_guid,
              employee_preview_assignment AS prev_assignment
         FROM sessions
        WHERE refresh_token_hash = $1
          AND user_id = $2::uuid
          AND revoked_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE`,
      [input.refreshTokenHash, input.actorUserId],
    );
    const prevRow = locked.rows[0];
    if (!prevRow) {
      return { ok: false as const, code: "SESSION_UPDATE_FAILED", message: "Не удалось завершить предпросмотр." };
    }

    const upd = await client.query<{ n: number }>(
      `UPDATE sessions
          SET employee_preview_guid = NULL,
              employee_preview_assignment = NULL,
              employee_preview_started_at = NULL
        WHERE refresh_token_hash = $1
          AND user_id = $2::uuid
          AND revoked_at IS NULL
          AND expires_at > NOW()
        RETURNING 1 AS n`,
      [input.refreshTokenHash, input.actorUserId],
    );
    if ((upd.rows[0]?.n ?? 0) === 0) {
      return { ok: false as const, code: "SESSION_UPDATE_FAILED", message: "Не удалось завершить предпросмотр." };
    }

    if (prevRow.prev_guid) {
      const assignmentType = parseAssignmentType(prevRow.prev_assignment);
      await writeAuditLog(client, {
        actorUserId: input.actorUserId,
        action: "admin.employee_preview.stop",
        employeeGuid: prevRow.prev_guid,
        metadata: { assignmentType: assignmentType ?? prevRow.prev_assignment },
      });
    }
    return { ok: true as const };
  });
  if (!txnResult.ok) {
    if ("code" in txnResult) return txnResult;
    const msg = txnResult.error;
    return { ok: false, code: "AUDIT_FAILED", message: `Журналирование не выполнено: ${msg}` };
  }

  return { ok: true };
}
