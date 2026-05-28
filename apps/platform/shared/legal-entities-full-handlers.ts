/**
 * Юрлица дилера — полный CRUD + bulk-import (Промт 67).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import {
  assertClientReadAccess,
  assertClientWriteAccess,
} from "./legal-entities-handlers.js";
import {
  mapLegalEntityFullRow,
  mapLegalEntityHistoryRow,
  type LegalEntityFullRow,
} from "./legal-entities-types.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;
const ENTITY_STATUSES = new Set(["main", "additional", "archived"]);

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

function actorUserId(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function normInn(inn: string | null | undefined): string | null {
  if (inn == null) return null;
  const t = inn.trim();
  return t || null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function mergeStr(existing: string | null, incoming: string | null | undefined): string | null {
  if (existing != null && existing.trim() !== "") return existing;
  return strOrNull(incoming);
}

function parseStatus(raw: unknown): string {
  if (typeof raw !== "string") return "additional";
  const s = raw.trim();
  return ENTITY_STATUSES.has(s) ? s : "additional";
}

async function countActiveLegalEntities(pool: PoolLike, clientId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM legal_entities
     WHERE client_id = $1 AND is_archived = false AND COALESCE(status, 'additional') <> 'archived'`,
    [clientId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function findByInn(
  pool: PoolLike,
  clientId: string,
  inn: string,
): Promise<Record<string, unknown> | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM legal_entities WHERE client_id = $1 AND inn IS NOT NULL AND TRIM(inn) = $2 LIMIT 1`,
    [clientId, inn],
  );
  return r.rows[0] ?? null;
}

async function clearMainStatus(pool: PoolLike, clientId: string, exceptId?: string): Promise<void> {
  await pool.query(
    `UPDATE legal_entities SET status = 'additional', updated_at = NOW()
     WHERE client_id = $1 AND status = 'main' AND is_archived = false
       AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [clientId, exceptId ?? null],
  );
}

async function insertHistory(
  pool: PoolLike,
  clientId: string,
  body: string,
  actorName: string | null,
  actorUserId: string | null,
  legalEntityId?: string | null,
  at?: string,
  meta?: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO legal_entity_events (client_id, legal_entity_id, body, actor_user_id, actor_name, at, meta)
     VALUES ($1, $2::uuid, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7)`,
    [clientId, legalEntityId ?? null, body, actorUserId, actorName, at ?? null, meta ?? null],
  );
}

async function fetchListFullPayload(pool: PoolLike, clientId: string) {
  const entities = await pool.query<Record<string, unknown>>(
    `SELECT * FROM legal_entities WHERE client_id = $1 ORDER BY
       CASE WHEN status = 'main' AND is_archived = false THEN 0 ELSE 1 END,
       created_at ASC`,
    [clientId],
  );
  const events = await pool.query<Record<string, unknown>>(
    `SELECT * FROM legal_entity_events WHERE client_id = $1 ORDER BY at DESC LIMIT 500`,
    [clientId],
  );
  return {
    entities: entities.rows.map(mapLegalEntityFullRow),
    history: events.rows.map(mapLegalEntityHistoryRow),
  };
}

type FullFieldsInput = {
  name?: unknown;
  inn?: unknown;
  kpp?: unknown;
  ogrn?: unknown;
  legalAddress?: unknown;
  actualAddress?: unknown;
  entityType?: unknown;
  primaryContact?: unknown;
  phone?: unknown;
  email?: unknown;
  internalCode?: unknown;
  status?: unknown;
  comment?: unknown;
  updatedByUserId?: unknown;
  updatedByName?: unknown;
};

function pickFullFields(body: FullFieldsInput): Record<string, unknown> {
  return {
    name: strOrNull(body.name),
    inn: strOrNull(body.inn),
    kpp: strOrNull(body.kpp),
    ogrn: strOrNull(body.ogrn),
    legal_address: strOrNull(body.legalAddress),
    actual_address: strOrNull(body.actualAddress),
    entity_type: strOrNull(body.entityType),
    primary_contact: strOrNull(body.primaryContact),
    phone: strOrNull(body.phone),
    email: strOrNull(body.email),
    internal_code: strOrNull(body.internalCode),
    status: parseStatus(body.status),
    comment: strOrNull(body.comment),
    updated_by_user_id: actorUserId(typeof body.updatedByUserId === "string" ? body.updatedByUserId : undefined),
    updated_by_name: strOrNull(body.updatedByName),
  };
}

async function updateRowFromFields(
  pool: PoolLike,
  rowId: string,
  fields: Record<string, unknown>,
  mergeEmptyOnly: boolean,
): Promise<LegalEntityFullRow> {
  const cur = await pool.query<Record<string, unknown>>(`SELECT * FROM legal_entities WHERE id = $1::uuid`, [rowId]);
  const existing = cur.rows[0];
  if (!existing) throw new Error("NOT_FOUND");

  const next: Record<string, unknown> = { ...existing };
  const set = (col: string, val: string | null) => {
    if (mergeEmptyOnly) {
      const curVal = existing[col];
      next[col] = mergeStr(curVal != null ? String(curVal) : null, val);
    } else if (val !== undefined) {
      next[col] = val;
    }
  };

  set("name", fields.name as string | null);
  set("inn", fields.inn as string | null);
  set("kpp", fields.kpp as string | null);
  set("ogrn", fields.ogrn as string | null);
  set("legal_address", fields.legal_address as string | null);
  set("actual_address", fields.actual_address as string | null);
  set("entity_type", fields.entity_type as string | null);
  set("primary_contact", fields.primary_contact as string | null);
  set("phone", fields.phone as string | null);
  set("email", fields.email as string | null);
  set("internal_code", fields.internal_code as string | null);
  set("comment", fields.comment as string | null);
  if (!mergeEmptyOnly && fields.status != null) next.status = fields.status;
  if (!mergeEmptyOnly && fields.updated_by_user_id !== undefined) next.updated_by_user_id = fields.updated_by_user_id;
  if (!mergeEmptyOnly && fields.updated_by_name !== undefined) next.updated_by_name = fields.updated_by_name;

  const r = await pool.query<Record<string, unknown>>(
    `UPDATE legal_entities SET
       name = $2, inn = $3, kpp = $4, ogrn = $5, legal_address = $6, actual_address = $7,
       entity_type = $8, primary_contact = $9, phone = $10, email = $11, internal_code = $12,
       status = $13, comment = $14, updated_by_user_id = $15, updated_by_name = $16, updated_at = NOW()
     WHERE id = $1::uuid RETURNING *`,
    [
      rowId,
      next.name,
      next.inn,
      next.kpp,
      next.ogrn,
      next.legal_address,
      next.actual_address,
      next.entity_type,
      next.primary_contact,
      next.phone,
      next.email,
      next.internal_code,
      next.status,
      next.comment,
      next.updated_by_user_id,
      next.updated_by_name,
    ],
  );
  return mapLegalEntityFullRow(r.rows[0]!);
}

export async function handleLegalEntitiesListFull(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const clientId = sanitizeClientId(typeof req.query.clientId === "string" ? req.query.clientId : "");
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientReadAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const payload = await fetchListFullPayload(pool, clientId);
  sendJson(res, 200, { success: true, clientId, ...payload });
}

export async function handleLegalEntitiesHistory(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const clientId = sanitizeClientId(typeof req.query.clientId === "string" ? req.query.clientId : "");
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientReadAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const events = await pool.query<Record<string, unknown>>(
    `SELECT * FROM legal_entity_events WHERE client_id = $1 ORDER BY at DESC LIMIT 500`,
    [clientId],
  );
  sendJson(res, 200, { success: true, clientId, history: events.rows.map(mapLegalEntityHistoryRow) });
}

export async function handleLegalEntitiesCreateFull(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as { clientId?: unknown } & FullFieldsInput;
  const clientId = typeof body.clientId === "string" ? sanitizeClientId(body.clientId) : null;
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const fields = pickFullFields(body);
  const name = fields.name as string | null;
  if (!name) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите name." });
    return;
  }

  const inn = normInn(fields.inn as string | null);
  if (inn) {
    const existing = await findByInn(pool, clientId, inn);
    if (existing) {
      const item = await updateRowFromFields(pool, String(existing.id), fields, true);
      sendJson(res, 200, { success: true, item, deduplicated: true });
      return;
    }
  }

  const status = fields.status as string;
  if (status === "main") await clearMainStatus(pool, clientId);

  const actorName = strOrNull(body.updatedByName) ?? me.id;
  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO legal_entities (
       client_id, name, inn, kpp, ogrn, legal_address, actual_address, entity_type,
       primary_contact, phone, email, internal_code, status, comment,
       updated_by_user_id, updated_by_name, source, is_archived, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'manual',false,NOW())
     RETURNING *`,
    [
      clientId,
      name,
      fields.inn,
      fields.kpp,
      fields.ogrn,
      fields.legal_address,
      fields.actual_address,
      fields.entity_type,
      fields.primary_contact,
      fields.phone,
      fields.email,
      fields.internal_code,
      status,
      fields.comment,
      fields.updated_by_user_id ?? actorUserId(me.id),
      actorName,
    ],
  );
  const item = mapLegalEntityFullRow(r.rows[0]!);
  await insertHistory(pool, clientId, `Добавлено юрлицо: ${name}`, actorName, actorUserId(me.id), item.id);
  sendJson(res, 201, { success: true, item });
}

export async function handleLegalEntitiesPatchFull(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
): Promise<void> {
  if (!UUID_RE.test(legalEntityId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }
  const curR = await pool.query<Record<string, unknown>>(`SELECT * FROM legal_entities WHERE id = $1::uuid`, [
    legalEntityId,
  ]);
  const existing = curR.rows[0];
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Юрлицо не найдено." });
    return;
  }
  const clientId = String(existing.client_id);
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as FullFieldsInput;
  if (body.status === "main" || (body.status === undefined && String(existing.status) === "main")) {
    /* no-op until we know new status */
  }
  const nextStatus = body.status !== undefined ? parseStatus(body.status) : String(existing.status ?? "additional");
  if (nextStatus === "main") await clearMainStatus(pool, clientId, legalEntityId);

  const next = {
    name: body.name !== undefined ? strOrNull(body.name) : existing.name != null ? String(existing.name) : null,
    inn: body.inn !== undefined ? strOrNull(body.inn) : existing.inn != null ? String(existing.inn) : null,
    kpp: body.kpp !== undefined ? strOrNull(body.kpp) : existing.kpp != null ? String(existing.kpp) : null,
    ogrn: body.ogrn !== undefined ? strOrNull(body.ogrn) : existing.ogrn != null ? String(existing.ogrn) : null,
    legal_address:
      body.legalAddress !== undefined
        ? strOrNull(body.legalAddress)
        : existing.legal_address != null
          ? String(existing.legal_address)
          : null,
    actual_address:
      body.actualAddress !== undefined
        ? strOrNull(body.actualAddress)
        : existing.actual_address != null
          ? String(existing.actual_address)
          : null,
    entity_type:
      body.entityType !== undefined
        ? strOrNull(body.entityType)
        : existing.entity_type != null
          ? String(existing.entity_type)
          : null,
    primary_contact:
      body.primaryContact !== undefined
        ? strOrNull(body.primaryContact)
        : existing.primary_contact != null
          ? String(existing.primary_contact)
          : null,
    phone: body.phone !== undefined ? strOrNull(body.phone) : existing.phone != null ? String(existing.phone) : null,
    email: body.email !== undefined ? strOrNull(body.email) : existing.email != null ? String(existing.email) : null,
    internal_code:
      body.internalCode !== undefined
        ? strOrNull(body.internalCode)
        : existing.internal_code != null
          ? String(existing.internal_code)
          : null,
    status: nextStatus,
    comment:
      body.comment !== undefined ? strOrNull(body.comment) : existing.comment != null ? String(existing.comment) : null,
    updated_by_user_id:
      body.updatedByUserId !== undefined
        ? actorUserId(typeof body.updatedByUserId === "string" ? body.updatedByUserId : undefined)
        : existing.updated_by_user_id,
    updated_by_name:
      body.updatedByName !== undefined
        ? strOrNull(body.updatedByName)
        : existing.updated_by_name != null
          ? String(existing.updated_by_name)
          : null,
    is_archived: nextStatus === "archived",
  };

  const r = await pool.query<Record<string, unknown>>(
    `UPDATE legal_entities SET
       name = $2, inn = $3, kpp = $4, ogrn = $5, legal_address = $6, actual_address = $7,
       entity_type = $8, primary_contact = $9, phone = $10, email = $11, internal_code = $12,
       status = $13, comment = $14, updated_by_user_id = $15, updated_by_name = $16,
       is_archived = $17, updated_at = NOW()
     WHERE id = $1::uuid RETURNING *`,
    [
      legalEntityId,
      next.name,
      next.inn,
      next.kpp,
      next.ogrn,
      next.legal_address,
      next.actual_address,
      next.entity_type,
      next.primary_contact,
      next.phone,
      next.email,
      next.internal_code,
      next.status,
      next.comment,
      next.updated_by_user_id,
      next.updated_by_name,
      next.is_archived,
    ],
  );
  const item = mapLegalEntityFullRow(r.rows[0]!);
  const actorName = strOrNull(body.updatedByName) ?? me.id;
  await insertHistory(pool, clientId, `Обновлено юрлицо: ${item.name ?? ""}`, actorName, actorUserId(me.id), item.id);
  sendJson(res, 200, { success: true, item });
}

export async function handleLegalEntitiesArchive(
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
  body: { updatedByName?: unknown; updatedByUserId?: unknown },
): Promise<void> {
  if (!UUID_RE.test(legalEntityId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }
  const curR = await pool.query<Record<string, unknown>>(`SELECT * FROM legal_entities WHERE id = $1::uuid`, [
    legalEntityId,
  ]);
  const row = curR.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Юрлицо не найдено." });
    return;
  }
  const clientId = String(row.client_id);
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const actorName = strOrNull(body.updatedByName) ?? me.id;
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE legal_entities SET is_archived = true, status = 'archived', updated_at = NOW(),
       updated_by_user_id = $2, updated_by_name = $3
     WHERE id = $1::uuid RETURNING *`,
    [legalEntityId, actorUserId(typeof body.updatedByUserId === "string" ? body.updatedByUserId : me.id), actorName],
  );
  const item = mapLegalEntityFullRow(r.rows[0]!);
  await insertHistory(
    pool,
    clientId,
    `Юрлицо архивировано: ${item.name ?? ""}`,
    actorName,
    actorUserId(me.id),
    item.id,
  );
  sendJson(res, 200, { success: true, item });
}

export async function handleLegalEntitiesSetMain(
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
  legalEntityId: string,
): Promise<void> {
  if (!UUID_RE.test(legalEntityId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }
  const curR = await pool.query<{ client_id: string }>(
    `SELECT client_id FROM legal_entities WHERE id = $1::uuid LIMIT 1`,
    [legalEntityId],
  );
  const clientId = curR.rows[0]?.client_id;
  if (!clientId || !(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  await clearMainStatus(pool, clientId, legalEntityId);
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE legal_entities SET status = 'main', is_archived = false, updated_at = NOW() WHERE id = $1::uuid RETURNING *`,
    [legalEntityId],
  );
  const row = r.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Юрлицо не найдено." });
    return;
  }
  sendJson(res, 200, { success: true, item: mapLegalEntityFullRow(row) });
}

type LsEntity = {
  id?: string;
  internalCode?: string;
  entityType?: string;
  name: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  actualAddress?: string;
  primaryContact?: string;
  phone?: string;
  email?: string;
  status?: string;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
};

async function upsertLsEntity(
  pool: PoolLike,
  clientId: string,
  e: LsEntity,
): Promise<void> {
  const inn = normInn(e.inn);
  const fields = pickFullFields({
    name: e.name,
    inn: e.inn,
    kpp: e.kpp,
    ogrn: e.ogrn,
    legalAddress: e.legalAddress,
    actualAddress: e.actualAddress,
    entityType: e.entityType,
    primaryContact: e.primaryContact,
    phone: e.phone,
    email: e.email,
    internalCode: e.internalCode,
    status: e.status,
    comment: e.comment,
    updatedByUserId: e.updatedBy,
    updatedByName: e.updatedByName,
  });

  if (inn) {
    const existing = await findByInn(pool, clientId, inn);
    if (existing) {
      await updateRowFromFields(pool, String(existing.id), fields, true);
      return;
    }
  }

  const status = parseStatus(e.status);
  if (status === "main") await clearMainStatus(pool, clientId);

  const isArchived = status === "archived";
  await pool.query(
    `INSERT INTO legal_entities (
       client_id, name, inn, kpp, ogrn, legal_address, actual_address, entity_type,
       primary_contact, phone, email, internal_code, status, comment,
       updated_by_user_id, updated_by_name, source, is_archived,
       created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'migration',$17,
       COALESCE($18::timestamptz,NOW()), COALESCE($19::timestamptz,NOW()))`,
    [
      clientId,
      fields.name,
      fields.inn,
      fields.kpp,
      fields.ogrn,
      fields.legal_address,
      fields.actual_address,
      fields.entity_type,
      fields.primary_contact,
      fields.phone,
      fields.email,
      fields.internal_code,
      status,
      fields.comment,
      actorUserId(e.updatedBy),
      strOrNull(e.updatedByName),
      isArchived,
      e.createdAt ?? null,
      e.updatedAt ?? null,
    ],
  );
}

export async function handleLegalEntitiesBulkImport(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as {
    clientId?: unknown;
    entities?: unknown;
    history?: unknown;
  };
  const clientId = typeof body.clientId === "string" ? sanitizeClientId(body.clientId) : null;
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const active = await countActiveLegalEntities(pool, clientId);
  if (active > 0) {
    sendJson(res, 409, { success: false, code: "ALREADY_EXISTS", message: "Юрлица уже есть в БД." });
    return;
  }

  const entities = Array.isArray(body.entities) ? (body.entities as LsEntity[]) : [];
  for (const e of entities) {
    if (!e.name?.trim()) continue;
    await upsertLsEntity(pool, clientId, e);
  }

  const history = Array.isArray(body.history) ? (body.history as { at?: string; meta?: string; body?: string }[]) : [];
  for (const ev of history) {
    if (!ev.body?.trim()) continue;
    const name = ev.meta?.split("·").pop()?.trim() || null;
    await insertHistory(pool, clientId, ev.body.trim(), name, null, null, ev.at, ev.meta ?? null);
  }

  const payload = await fetchListFullPayload(pool, clientId);
  sendJson(res, 201, { success: true, clientId, ...payload });
}
