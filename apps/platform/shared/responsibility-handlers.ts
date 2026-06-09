/**
 * Матрица ответственных — API-хендлеры (Промт 233).
 */

import { isUuidString } from "./persona-uuid-mapping.js";
import {
  cityScopeKey,
  clientCodeToDealerId,
  dealerIdToClientCode,
  resolveClientResponsibility,
  resolveResponsiblesForTradePoint,
  type PoolLike,
  type ResolvedResponsibles,
  type ResponsibleRole,
  type ScopeKind,
} from "./responsibility-resolver.js";

export type ResponsibilitySessionUser = {
  id: string;
  role: string;
  status: string;
};

const SCOPE_KINDS = new Set<ScopeKind>(["trade_point", "client", "city"]);
const ROLES = new Set<ResponsibleRole>(["manager", "regional_manager", "rop"]);

export class ResponsibilityValidationError extends Error {
  readonly code: string;
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.code = code;
  }
}

function isElevated(role: string): boolean {
  return role === "admin" || role === "director";
}

function parseScopeKind(raw: unknown): ScopeKind {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!SCOPE_KINDS.has(v as ScopeKind)) {
    throw new ResponsibilityValidationError("Недопустимый scopeKind.", "VALIDATION_ERROR");
  }
  return v as ScopeKind;
}

function parseRole(raw: unknown): ResponsibleRole {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!ROLES.has(v as ResponsibleRole)) {
    throw new ResponsibilityValidationError("Недопустимый role.", "VALIDATION_ERROR");
  }
  return v as ResponsibleRole;
}

function parseScopeKey(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw new ResponsibilityValidationError("scopeKey обязателен.", "VALIDATION_ERROR");
  return v;
}

function parseUserId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const v = String(raw).trim();
  if (!isUuidString(v)) {
    throw new ResponsibilityValidationError("userId должен быть UUID или null.", "VALIDATION_ERROR");
  }
  return v;
}

async function isRopForClient(pool: PoolLike, ropUserId: string, dealerId: string): Promise<boolean> {
  const dealerR = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM dealer_overrides WHERE dealer_id = $1 AND rop_id = $2::uuid LIMIT 1`,
    [dealerId, ropUserId],
  );
  if (dealerR.rows.length > 0) return true;

  const clientCode = dealerIdToClientCode(dealerId);
  const teamR = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM client_assignments ca
     INNER JOIN teams t ON t.id = ca.team_id
     WHERE ca.client_code = $1 AND t.rop_user_id = $2::uuid
     LIMIT 1`,
    [clientCode, ropUserId],
  );
  if (teamR.rows.length > 0) return true;

  const tps = await pool.query<{ tp_id: string }>(
    `SELECT tp_id FROM trade_point_overrides WHERE dealer_id = $1`,
    [dealerId],
  );
  for (const row of tps.rows) {
    const resolved = await resolveResponsiblesForTradePoint(pool, String(row.tp_id));
    if (resolved.rop.userId === ropUserId) return true;
  }
  return false;
}

async function isRopForCity(pool: PoolLike, ropUserId: string, cityKey: string): Promise<boolean> {
  const r = await pool.query<{ tp_id: string; city: string | null; address: string | null }>(
    `SELECT tp_id, city, address FROM trade_point_overrides`,
  );
  for (const row of r.rows) {
    const key = cityScopeKey(row.city, row.address);
    if (key !== cityKey) continue;
    const resolved = await resolveResponsiblesForTradePoint(pool, String(row.tp_id));
    if (resolved.rop.userId === ropUserId) return true;
  }
  return false;
}

async function assertCanAssign(
  pool: PoolLike,
  me: ResponsibilitySessionUser,
  scopeKind: ScopeKind,
  scopeKey: string,
  role: ResponsibleRole,
): Promise<void> {
  if (isElevated(me.role)) return;

  if (role === "rop") {
    throw new ResponsibilityValidationError("Назначать роль роп может только admin/director.", "FORBIDDEN");
  }

  if (me.role !== "rop") {
    throw new ResponsibilityValidationError("Недостаточно прав для назначения.", "FORBIDDEN");
  }

  if (scopeKind === "trade_point") {
    const resolved = await resolveResponsiblesForTradePoint(pool, scopeKey);
    if (resolved.rop.userId !== me.id) {
      throw new ResponsibilityValidationError("Роп может назначать только на своих объектах.", "FORBIDDEN");
    }
    return;
  }

  if (scopeKind === "client") {
    const ok = await isRopForClient(pool, me.id, scopeKey);
    if (!ok) {
      throw new ResponsibilityValidationError("Роп может назначать только на своих объектах.", "FORBIDDEN");
    }
    return;
  }

  if (scopeKind === "city") {
    const ok = await isRopForCity(pool, me.id, scopeKey);
    if (!ok) {
      throw new ResponsibilityValidationError("Роп может назначать в городе только под своим ропством.", "FORBIDDEN");
    }
  }
}

export async function handleResolve(
  pool: PoolLike,
  tradePointId: string,
): Promise<{ success: true; resolved: ResolvedResponsibles }> {
  const tpId = tradePointId.trim();
  if (!tpId) {
    throw new ResponsibilityValidationError("tradePointId обязателен.", "VALIDATION_ERROR");
  }
  const resolved = await resolveResponsiblesForTradePoint(pool, tpId);
  return { success: true, resolved };
}

export async function handleClient(
  pool: PoolLike,
  dealerId: string,
): Promise<{
  success: true;
  tradePoints: Array<{ tpId: string; name: string | null; city: string | null; resolved: ResolvedResponsibles }>;
  sharedByRole: { manager?: boolean; regional_manager?: boolean; rop?: boolean };
}> {
  const id = dealerId.trim();
  if (!id) {
    throw new ResponsibilityValidationError("dealerId обязателен.", "VALIDATION_ERROR");
  }
  const { tradePoints, sharedByRole } = await resolveClientResponsibility(pool, id);
  return { success: true, tradePoints, sharedByRole };
}

export type AssignBody = {
  scopeKind: unknown;
  scopeKey: unknown;
  role: unknown;
  userId: unknown;
  reason?: unknown;
};

export async function handleAssign(
  pool: PoolLike,
  me: ResponsibilitySessionUser,
  body: AssignBody,
): Promise<{ success: true }> {
  const scopeKind = parseScopeKind(body.scopeKind);
  const scopeKey = parseScopeKey(body.scopeKey);
  const role = parseRole(body.role);
  const userId = parseUserId(body.userId);
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  await assertCanAssign(pool, me, scopeKind, scopeKey, role);

  const prevR = await pool.query<{ user_id: string | null }>(
    `SELECT user_id::text AS user_id
     FROM responsibility_assignments
     WHERE scope_kind = $1 AND scope_key = $2 AND responsible_role = $3
     LIMIT 1`,
    [scopeKind, scopeKey, role],
  );
  const fromUserId = prevR.rows[0]?.user_id ?? null;

  if (userId) {
    const userR = await pool.query<{ full_name: string | null }>(
      `SELECT full_name FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId],
    );
    const userName = userR.rows[0]?.full_name?.trim() ?? null;
    if (!userR.rows[0]) {
      throw new ResponsibilityValidationError("Пользователь не найден.", "NOT_FOUND");
    }

    await pool.query(
      `INSERT INTO responsibility_assignments
         (scope_kind, scope_key, responsible_role, user_id, user_name, updated_by)
       VALUES ($1, $2, $3, $4::uuid, $5, $6::uuid)
       ON CONFLICT (scope_kind, scope_key, responsible_role)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         user_name = EXCLUDED.user_name,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [scopeKind, scopeKey, role, userId, userName, me.id],
    );
  } else {
    await pool.query(
      `DELETE FROM responsibility_assignments
       WHERE scope_kind = $1 AND scope_key = $2 AND responsible_role = $3`,
      [scopeKind, scopeKey, role],
    );
  }

  await pool.query(
    `INSERT INTO responsibility_assignment_events
       (scope_kind, scope_key, responsible_role, from_user_id, to_user_id, actor_user_id, reason)
     VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7)`,
    [scopeKind, scopeKey, role, fromUserId, userId, me.id, reason],
  );

  return { success: true };
}

export async function handleMy(
  pool: PoolLike,
  me: ResponsibilitySessionUser,
): Promise<{
  success: true;
  tradePoints: string[];
  dealerIds: string[];
  cities: string[];
  meta: { role: string };
}> {
  const tradePoints = new Set<string>();
  const dealerIds = new Set<string>();
  const cities = new Set<string>();

  const assignR = await pool.query<{ scope_kind: string; scope_key: string }>(
    `SELECT scope_kind, scope_key FROM responsibility_assignments WHERE user_id = $1::uuid`,
    [me.id],
  );
  for (const row of assignR.rows) {
    if (row.scope_kind === "trade_point") tradePoints.add(String(row.scope_key));
    else if (row.scope_kind === "client") dealerIds.add(String(row.scope_key));
    else if (row.scope_kind === "city") cities.add(String(row.scope_key));
  }

  if (me.role === "manager") {
    const r = await pool.query<{ client_code: string }>(
      `SELECT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid`,
      [me.id],
    );
    for (const row of r.rows) {
      if (row.client_code) dealerIds.add(clientCodeToDealerId(row.client_code));
    }
  } else if (me.role === "regional_manager") {
    const d = await pool.query<{ dealer_id: string }>(
      `SELECT dealer_id FROM dealer_overrides WHERE regional_manager_id = $1::uuid`,
      [me.id],
    );
    for (const row of d.rows) {
      if (row.dealer_id) dealerIds.add(String(row.dealer_id));
    }
    const t = await pool.query<{ tp_id: string }>(
      `SELECT tp_id FROM trade_point_overrides WHERE regional_manager_id = $1::uuid`,
      [me.id],
    );
    for (const row of t.rows) {
      if (row.tp_id) tradePoints.add(String(row.tp_id));
    }
  } else if (me.role === "rop") {
    const t = await pool.query<{ tp_id: string }>(
      `SELECT tp_id FROM trade_point_overrides WHERE rop_id = $1::uuid`,
      [me.id],
    );
    for (const row of t.rows) {
      if (row.tp_id) tradePoints.add(String(row.tp_id));
    }
    const d = await pool.query<{ dealer_id: string }>(
      `SELECT dealer_id FROM dealer_overrides WHERE rop_id = $1::uuid`,
      [me.id],
    );
    for (const row of d.rows) {
      if (row.dealer_id) dealerIds.add(String(row.dealer_id));
    }
    const team = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT ca.client_code
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid`,
      [me.id],
    );
    for (const row of team.rows) {
      if (row.client_code) dealerIds.add(clientCodeToDealerId(row.client_code));
    }
  }

  return {
    success: true,
    tradePoints: Array.from(tradePoints).sort(),
    dealerIds: Array.from(dealerIds).sort(),
    cities: Array.from(cities).sort(),
    meta: { role: me.role },
  };
}
