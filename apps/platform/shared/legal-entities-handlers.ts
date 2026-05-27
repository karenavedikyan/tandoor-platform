/**
 * CRUD юрлиц (Postgres) — Промт 64.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";

type SessionUser = {
  id: string;
  role: string;
  status: string;
};
import {
  mapLegalEntityRow,
  parsePaymentForm,
  type LegalEntityCreatePayload,
  type LegalEntityPatchPayload,
} from "./legal-entities-types.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

const READ_ROLES = new Set(["admin", "director", "rop", "regional_manager", "manager", "marketer", "analyst"]);
const WRITE_ROLES = new Set(["admin", "director", "rop", "regional_manager", "manager"]);

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sanitizeClientId(raw: string): string | null {
  const t = raw.trim();
  if (!t || !CLIENT_ID_RE.test(t)) return null;
  return t;
}

/** client-ma-ma085529 → MA-MA085529 для client_assignments */
export function dealerIdToAssignmentClientCode(clientId: string): string | null {
  const m = /^client-ma-(.+)$/i.exec(clientId.trim());
  if (!m) return null;
  return `MA-${m[1]!.toUpperCase()}`;
}

async function resolveRopTeamId(pool: PoolLike, ropUserId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`SELECT id FROM teams WHERE rop_user_id = $1::uuid LIMIT 1`, [ropUserId]);
  return r.rows[0]?.id ?? null;
}

async function assertClientReadAccess(pool: PoolLike, me: SessionUser, clientId: string): Promise<boolean> {
  if (!READ_ROLES.has(me.role)) return false;
  if (me.role === "admin" || me.role === "director" || me.role === "marketer" || me.role === "analyst") return true;

  const code = dealerIdToAssignmentClientCode(clientId);
  if (!code) {
    return me.role === "rop" || me.role === "regional_manager" || me.role === "manager";
  }

  const row = await pool.query<{ responsible_user_id: string; team_id: string | null }>(
    `SELECT responsible_user_id, team_id FROM client_assignments WHERE client_code = $1 LIMIT 1`,
    [code],
  );
  const assign = row.rows[0];
  if (!assign) {
    return me.role === "rop" || me.role === "regional_manager" || me.role === "manager";
  }

  if (me.role === "manager" || me.role === "regional_manager") {
    return assign.responsible_user_id === me.id;
  }

  if (me.role === "rop") {
    const teamId = await resolveRopTeamId(pool, me.id);
    return teamId != null && assign.team_id === teamId;
  }

  return false;
}

async function assertClientWriteAccess(pool: PoolLike, me: SessionUser, clientId: string): Promise<boolean> {
  if (!WRITE_ROLES.has(me.role) || me.status !== "active") return false;
  return assertClientReadAccess(pool, me, clientId);
}

async function assertLegalEntityAccess(
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
  write: boolean,
): Promise<{ ok: boolean; clientId?: string }> {
  if (!UUID_RE.test(legalEntityId)) return { ok: false };
  const r = await pool.query<{ client_id: string }>(`SELECT client_id FROM legal_entities WHERE id = $1::uuid LIMIT 1`, [
    legalEntityId,
  ]);
  const clientId = r.rows[0]?.client_id;
  if (!clientId) return { ok: false };
  const allowed = write ? await assertClientWriteAccess(pool, me, clientId) : await assertClientReadAccess(pool, me, clientId);
  return { ok: allowed, clientId };
}

function pickCreateFields(body: LegalEntityCreatePayload): {
  cols: string[];
  vals: unknown[];
} {
  const cols: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, val: unknown) => {
    cols.push(col);
    vals.push(val);
  };
  if (body.name !== undefined) add("name", body.name?.trim() || null);
  if (body.inn !== undefined) add("inn", body.inn?.trim() || null);
  if (body.kpp !== undefined) add("kpp", body.kpp?.trim() || null);
  if (body.ogrn !== undefined) add("ogrn", body.ogrn?.trim() || null);
  if (body.legalAddress !== undefined) add("legal_address", body.legalAddress?.trim() || null);
  if (body.paymentForm !== undefined) add("payment_form", body.paymentForm);
  if (body.paymentDelayDays !== undefined) {
    const n = body.paymentDelayDays;
    add("payment_delay_days", n == null || Number.isNaN(Number(n)) ? null : Math.max(0, Math.floor(Number(n))));
  }
  if (body.creditLimitRub !== undefined) {
    const raw = body.creditLimitRub;
    if (raw == null || raw === "") add("credit_limit_rub", null);
    else add("credit_limit_rub", Number(raw));
  }
  if (body.edoEnabled !== undefined) add("edo_enabled", body.edoEnabled);
  if (body.edoOperator !== undefined) add("edo_operator", body.edoOperator?.trim() || null);
  return { cols, vals };
}

export async function handleLegalEntitiesList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const clientIdRaw = typeof req.query.clientId === "string" ? req.query.clientId : "";
  const clientId = sanitizeClientId(clientIdRaw);
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientReadAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM legal_entities WHERE client_id = $1 ORDER BY created_at ASC`,
    [clientId],
  );
  sendJson(res, 200, { success: true, items: r.rows.map(mapLegalEntityRow) });
}

export async function handleLegalEntitiesCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as { clientId?: unknown } & LegalEntityCreatePayload;
  const clientId = typeof body.clientId === "string" ? sanitizeClientId(body.clientId) : null;
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const { cols, vals } = pickCreateFields(body);
  const allCols = ["client_id", ...cols];
  const placeholders = allCols.map((_, i) => `$${i + 1}`);
  const params: unknown[] = [clientId, ...vals];
  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO legal_entities (${allCols.join(", ")}, updated_at) VALUES (${placeholders.join(", ")}, NOW()) RETURNING *`,
    params,
  );
  const row = r.rows[0];
  if (!row) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Не удалось создать запись." });
    return;
  }
  sendJson(res, 201, { success: true, item: mapLegalEntityRow(row) });
}

export async function handleLegalEntitiesPatch(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
): Promise<void> {
  const access = await assertLegalEntityAccess(pool, me, legalEntityId, true);
  if (!access.ok) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as LegalEntityPatchPayload;
  const { cols, vals } = pickCreateFields(body);
  if (cols.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Нет полей для обновления." });
    return;
  }
  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  sets.push("updated_at = NOW()");
  const params = [...vals, legalEntityId];
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE legal_entities SET ${sets.join(", ")} WHERE id = $${cols.length + 1}::uuid RETURNING *`,
    params,
  );
  const row = r.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Юрлицо не найдено." });
    return;
  }
  sendJson(res, 200, { success: true, item: mapLegalEntityRow(row) });
}

export async function handleLegalEntitiesDelete(
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
): Promise<void> {
  const access = await assertLegalEntityAccess(pool, me, legalEntityId, true);
  if (!access.ok) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  await pool.query(`DELETE FROM legal_entities WHERE id = $1::uuid`, [legalEntityId]);
  sendJson(res, 200, { success: true });
}

export async function handleTradePointLegalEntityLinkGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const tradePointId = typeof req.query.tradePointId === "string" ? req.query.tradePointId.trim() : "";
  if (!tradePointId || tradePointId.length > 128) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tradePointId." });
    return;
  }
  const link = await pool.query<{ legal_entity_id: string | null }>(
    `SELECT legal_entity_id FROM trade_point_legal_entity_links WHERE trade_point_id = $1 LIMIT 1`,
    [tradePointId],
  );
  const leId = link.rows[0]?.legal_entity_id;
  if (!leId) {
    sendJson(res, 200, { success: true, link: null });
    return;
  }
  const le = await pool.query<Record<string, unknown>>(`SELECT * FROM legal_entities WHERE id = $1::uuid LIMIT 1`, [leId]);
  const row = le.rows[0];
  if (!row) {
    sendJson(res, 200, { success: true, link: null });
    return;
  }
  const entity = mapLegalEntityRow(row);
  if (!(await assertClientReadAccess(pool, me, entity.clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  sendJson(res, 200, { success: true, link: { tradePointId, legalEntity: entity } });
}

export function parseLegalEntityBodyPaymentForm(body: Record<string, unknown>): LegalEntityCreatePayload {
  return {
    ...body,
    paymentForm: body.paymentForm !== undefined ? parsePaymentForm(body.paymentForm) : undefined,
  } as LegalEntityCreatePayload;
}
