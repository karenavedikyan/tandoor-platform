/**
 * API контактов клиента (Postgres) — Промт 66.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { assertClientReadAccess, assertClientWriteAccess } from "./legal-entities-handlers.js";
import {
  mapClientContactEventRow,
  mapClientContactRow,
  parseScopeKey,
  scopeKeyFromParts,
  type ClientContactScope,
} from "./client-contacts-types.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;
const SCOPES = new Set<ClientContactScope>(["dealer", "legal_entity", "trade_point"]);

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

function parseScope(raw: unknown): ClientContactScope | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as ClientContactScope;
  return SCOPES.has(s) ? s : null;
}

function actorUserId(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

async function insertEvent(
  pool: PoolLike,
  clientId: string,
  body: string,
  actor: SessionUser,
  scope: ClientContactScope | null,
  scopeRef: string | null,
  at?: string,
  actorDisplayName?: string,
): Promise<void> {
  const actorName = actorDisplayName?.trim() || null;
  await pool.query(
    `INSERT INTO client_contact_events (client_id, scope, scope_ref, body, actor_user_id, actor_name, at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))`,
    [clientId, scope, scopeRef, body, actorUserId(actor.id), actorName, at ?? null],
  );
}

async function countContacts(pool: PoolLike, clientId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM client_contacts WHERE client_id = $1`, [clientId]);
  return Number(r.rows[0]?.n ?? 0);
}

async function fetchListPayload(pool: PoolLike, clientId: string) {
  const contacts = await pool.query<Record<string, unknown>>(
    `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, created_at DESC`,
    [clientId],
  );
  const events = await pool.query<Record<string, unknown>>(
    `SELECT * FROM client_contact_events WHERE client_id = $1 ORDER BY at DESC LIMIT 500`,
    [clientId],
  );
  const items = contacts.rows.map(mapClientContactRow);
  const evRows = events.rows.map(mapClientContactEventRow);
  const dealerTimeline = evRows.filter((e) => e.scope == null);
  const scopeTimelines: Record<string, typeof evRows> = {};
  for (const e of evRows) {
    if (e.scope == null) continue;
    const key = scopeKeyFromParts(clientId, e.scope as ClientContactScope, e.scopeRef);
    if (!scopeTimelines[key]) scopeTimelines[key] = [];
    scopeTimelines[key].push(e);
  }
  return { items, dealerTimeline, scopeTimelines };
}

async function clearPrimaryInScope(
  pool: PoolLike,
  clientId: string,
  scope: ClientContactScope,
  scopeRef: string | null,
  exceptId?: string,
): Promise<void> {
  if (scopeRef) {
    await pool.query(
      `UPDATE client_contacts SET is_primary = false, updated_at = NOW()
       WHERE client_id = $1 AND scope = $2 AND scope_ref = $3 AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [clientId, scope, scopeRef, exceptId ?? null],
    );
  } else {
    await pool.query(
      `UPDATE client_contacts SET is_primary = false, updated_at = NOW()
       WHERE client_id = $1 AND scope = $2 AND scope_ref IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [clientId, scope, exceptId ?? null],
    );
  }
}

async function activeCountInScope(
  pool: PoolLike,
  clientId: string,
  scope: ClientContactScope,
  scopeRef: string | null,
): Promise<number> {
  const r = scopeRef
    ? await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM client_contacts
         WHERE client_id = $1 AND scope = $2 AND scope_ref = $3
           AND is_actual = true AND delete_requested_at IS NULL`,
        [clientId, scope, scopeRef],
      )
    : await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM client_contacts
         WHERE client_id = $1 AND scope = $2 AND scope_ref IS NULL
           AND is_actual = true AND delete_requested_at IS NULL`,
        [clientId, scope],
      );
  return Number(r.rows[0]?.n ?? 0);
}

export async function handleClientContactsList(
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
  const payload = await fetchListPayload(pool, clientId);
  sendJson(res, 200, { success: true, clientId, ...payload });
}

export async function handleClientContactsCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const clientId = sanitizeClientId(String(body.clientId ?? ""));
  const scope = parseScope(body.scope) ?? "dealer";
  const scopeRef = typeof body.scopeRef === "string" && body.scopeRef.trim() ? body.scopeRef.trim() : null;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!clientId || !fullName) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "clientId и fullName обязательны." });
    return;
  }
  if ((scope === "legal_entity" || scope === "trade_point") && !scopeRef) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите scopeRef." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  let isPrimary = body.isPrimary === true;
  const activeN = await activeCountInScope(pool, clientId, scope, scopeRef);
  if (activeN === 0) isPrimary = true;
  if (isPrimary) await clearPrimaryInScope(pool, clientId, scope, scopeRef);

  const actorName = typeof body.actorName === "string" ? body.actorName.trim() : me.id;
  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO client_contacts (
       client_id, scope, scope_ref, full_name, role, phone, whatsapp, telegram, email, comment,
       is_primary, is_actual, source, created_by_user_id, created_by_name, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
     RETURNING *`,
    [
      clientId,
      scope,
      scopeRef,
      fullName,
      typeof body.role === "string" ? body.role.trim() || null : null,
      typeof body.phone === "string" ? body.phone.trim() || null : null,
      typeof body.whatsapp === "string" ? body.whatsapp.trim() || null : null,
      typeof body.telegram === "string" ? body.telegram.trim() || null : null,
      typeof body.email === "string" ? body.email.trim() || null : null,
      typeof body.comment === "string" ? body.comment.trim() || null : null,
      isPrimary,
      body.isActual !== false,
      "manual",
      actorUserId(typeof body.actorUserId === "string" ? body.actorUserId : me.id),
      actorName || null,
    ],
  );
  const item = mapClientContactRow(r.rows[0]!);
  const roleSuffix = item.role ? ` (${item.role})` : "";
  await insertEvent(pool, clientId, `Добавлен контакт: ${item.fullName}${roleSuffix}`, me, null, null, undefined, actorName);
  await insertEvent(
    pool,
    clientId,
    `Добавлен контакт: ${item.fullName}${roleSuffix}`,
    me,
    scope,
    scopeRef,
    undefined,
    actorName,
  );
  sendJson(res, 201, { success: true, item });
}

async function getContactRow(pool: PoolLike, id: string): Promise<ReturnType<typeof mapClientContactRow> | null> {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query<Record<string, unknown>>(`SELECT * FROM client_contacts WHERE id = $1::uuid LIMIT 1`, [id]);
  return r.rows[0] ? mapClientContactRow(r.rows[0]) : null;
}

export async function handleClientContactsPatch(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const cur = await getContactRow(pool, id);
  if (!cur) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Контакт не найден." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, cur.clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const nextPrimary = body.isPrimary === true ? true : body.isPrimary === false ? false : cur.isPrimary;
  if (nextPrimary) await clearPrimaryInScope(pool, cur.clientId, cur.scope, cur.scopeRef, id);

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : cur.fullName;
  const role = body.role !== undefined ? (typeof body.role === "string" ? body.role.trim() || null : null) : cur.role;
  const phone = body.phone !== undefined ? (typeof body.phone === "string" ? body.phone.trim() || null : null) : cur.phone;
  const whatsapp =
    body.whatsapp !== undefined ? (typeof body.whatsapp === "string" ? body.whatsapp.trim() || null : null) : cur.whatsapp;
  const telegram =
    body.telegram !== undefined ? (typeof body.telegram === "string" ? body.telegram.trim() || null : null) : cur.telegram;
  const email = body.email !== undefined ? (typeof body.email === "string" ? body.email.trim() || null : null) : cur.email;
  const comment =
    body.comment !== undefined ? (typeof body.comment === "string" ? body.comment.trim() || null : null) : cur.comment;
  const isActual = typeof body.isActual === "boolean" ? body.isActual : cur.isActual;

  const r = await pool.query<Record<string, unknown>>(
    `UPDATE client_contacts SET
       full_name = $2, role = $3, phone = $4, whatsapp = $5, telegram = $6, email = $7, comment = $8,
       is_primary = $9, is_actual = $10, updated_at = NOW()
     WHERE id = $1::uuid RETURNING *`,
    [id, fullName, role, phone, whatsapp, telegram, email, comment, nextPrimary, isActual],
  );
  const item = mapClientContactRow(r.rows[0]!);
  await insertEvent(pool, cur.clientId, `Обновлён контакт: ${item.fullName}`, me, null, null);
  await insertEvent(pool, cur.clientId, `Обновлён контакт: ${item.fullName}`, me, cur.scope, cur.scopeRef);
  sendJson(res, 200, { success: true, item });
}

export async function handleClientContactsSetPrimary(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const cur = await getContactRow(pool, id);
  if (!cur) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Контакт не найден." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, cur.clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  await clearPrimaryInScope(pool, cur.clientId, cur.scope, cur.scopeRef);
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE client_contacts SET is_primary = true, updated_at = NOW() WHERE id = $1::uuid RETURNING *`,
    [id],
  );
  const item = mapClientContactRow(r.rows[0]!);
  await insertEvent(pool, cur.clientId, `Назначен основной контакт: ${item.fullName}`, me, null, null);
  await insertEvent(pool, cur.clientId, `Назначен основной контакт: ${item.fullName}`, me, cur.scope, cur.scopeRef);
  sendJson(res, 200, { success: true, item });
}

export async function handleClientContactsRequestDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as { id?: unknown; reason?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const cur = await getContactRow(pool, id);
  if (!cur) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Контакт не найден." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, cur.clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE client_contacts SET delete_requested_at = NOW(), delete_request_reason = $2, updated_at = NOW()
     WHERE id = $1::uuid RETURNING *`,
    [id, reason || null],
  );
  const item = mapClientContactRow(r.rows[0]!);
  const reasonSuffix = reason ? `: ${reason}` : "";
  await insertEvent(pool, cur.clientId, `Запрошено снятие контакта «${item.fullName}»${reasonSuffix}`, me, null, null);
  await insertEvent(pool, cur.clientId, `Запрошено снятие контакта: ${item.fullName}`, me, cur.scope, cur.scopeRef);
  sendJson(res, 200, { success: true, item });
}

export async function handleClientContactsBulkImport(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const clientId = sanitizeClientId(String(body.clientId ?? ""));
  if (!clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientId." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const existing = await countContacts(pool, clientId);
  if (existing > 0) {
    sendJson(res, 409, { success: false, code: "ALREADY_EXISTS", message: "Контакты уже есть в БД." });
    return;
  }

  type LsContact = {
    id?: string;
    fullName: string;
    role?: string;
    phone?: string;
    whatsapp?: string;
    telegram?: string;
    email?: string;
    comment?: string;
    isPrimary?: boolean;
    isActual?: boolean;
    source?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    createdByName?: string;
    deleteRequestedAt?: string;
    deleteRequestReason?: string;
  };

  const insertLs = async (scope: ClientContactScope, scopeRef: string | null, list: LsContact[]) => {
    for (const c of list) {
      if (!c.fullName?.trim()) continue;
      await pool.query(
        `INSERT INTO client_contacts (
           client_id, scope, scope_ref, full_name, role, phone, whatsapp, telegram, email, comment,
           is_primary, is_actual, source, delete_requested_at, delete_request_reason,
           created_by_user_id, created_by_name, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,COALESCE($18::timestamptz,NOW()),COALESCE($19::timestamptz,NOW()))`,
        [
          clientId,
          scope,
          scopeRef,
          c.fullName.trim(),
          c.role?.trim() || null,
          c.phone?.trim() || null,
          c.whatsapp?.trim() || null,
          c.telegram?.trim() || null,
          c.email?.trim() || null,
          c.comment?.trim() || null,
          Boolean(c.isPrimary),
          c.isActual !== false,
          c.source?.trim() || "migration",
          c.deleteRequestedAt ?? null,
          c.deleteRequestReason?.trim() || null,
          actorUserId(c.createdBy),
          c.createdByName?.trim() || null,
          c.createdAt ?? null,
          c.updatedAt ?? null,
        ],
      );
    }
  };

  const dealerContacts = Array.isArray(body.dealerContacts) ? (body.dealerContacts as LsContact[]) : [];
  await insertLs("dealer", null, dealerContacts);

  const leMap = body.legalEntityContacts;
  if (leMap && typeof leMap === "object") {
    for (const [leId, arr] of Object.entries(leMap as Record<string, LsContact[]>)) {
      if (Array.isArray(arr)) await insertLs("legal_entity", leId, arr);
    }
  }

  const tpMap = body.tradePointContacts;
  if (tpMap && typeof tpMap === "object") {
    for (const [tpId, arr] of Object.entries(tpMap as Record<string, LsContact[]>)) {
      if (Array.isArray(arr)) await insertLs("trade_point", tpId, arr);
    }
  }

  const dealerEvents = Array.isArray(body.dealerEvents) ? (body.dealerEvents as { at?: string; body?: string; meta?: string }[]) : [];
  for (const ev of dealerEvents) {
    if (!ev.body?.trim()) continue;
    const name = ev.meta?.split("·").pop()?.trim() || "—";
    await insertEvent(pool, clientId, ev.body.trim(), me, null, null, ev.at, name);
  }

  const scopeEvents = body.scopeEvents;
  if (scopeEvents && typeof scopeEvents === "object") {
    for (const [scopeKey, arr] of Object.entries(scopeEvents as Record<string, { at?: string; body?: string; meta?: string }[]>)) {
      if (!Array.isArray(arr)) continue;
      const { scope, scopeRef } = parseScopeKey(scopeKey);
      for (const ev of arr) {
        if (!ev.body?.trim()) continue;
        await insertEvent(pool, clientId, ev.body.trim(), me, scope, scopeRef, ev.at);
      }
    }
  }

  const payload = await fetchListPayload(pool, clientId);
  sendJson(res, 201, { success: true, clientId, ...payload });
}

type CopyDest = {
  toDealer: boolean;
  toAllLegalEntities: boolean;
  toAllTradePoints: boolean;
  manualLegalEntityIds: string[];
  manualTradePointIds: string[];
};

async function insertCopyContact(
  pool: PoolLike,
  clientId: string,
  scope: ClientContactScope,
  scopeRef: string | null,
  src: ReturnType<typeof mapClientContactRow>,
  me: SessionUser,
  actorName: string,
): Promise<void> {
  const activeN = await activeCountInScope(pool, clientId, scope, scopeRef);
  let isPrimary = activeN === 0;
  if (isPrimary) await clearPrimaryInScope(pool, clientId, scope, scopeRef);
  await pool.query(
    `INSERT INTO client_contacts (
       client_id, scope, scope_ref, full_name, role, phone, whatsapp, telegram, email, comment,
       is_primary, is_actual, source, created_by_user_id, created_by_name, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
    [
      clientId,
      scope,
      scopeRef,
      src.fullName,
      src.role,
      src.phone,
      src.whatsapp,
      src.telegram,
      src.email,
      src.comment,
      isPrimary,
      true,
      "copy",
      actorUserId(me.id),
      actorName,
    ],
  );
}

export async function handleClientContactsCopyToScopes(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as {
    clientId?: unknown;
    sourceContactId?: unknown;
    destinations?: CopyDest;
    legalEntityIds?: unknown;
    tradePointIds?: unknown;
    actorName?: unknown;
  };
  const clientId = sanitizeClientId(String(body.clientId ?? ""));
  const sourceId = typeof body.sourceContactId === "string" ? body.sourceContactId.trim() : "";
  const src = await getContactRow(pool, sourceId);
  if (!clientId || !src || src.clientId !== clientId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный источник." });
    return;
  }
  if (!(await assertClientWriteAccess(pool, me, clientId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const dest = body.destinations ?? {
    toDealer: false,
    toAllLegalEntities: false,
    toAllTradePoints: false,
    manualLegalEntityIds: [],
    manualTradePointIds: [],
  };
  const actorName = typeof body.actorName === "string" ? body.actorName.trim() : "Пользователь";
  const leIds = Array.isArray(body.legalEntityIds)
    ? body.legalEntityIds.filter((x): x is string => typeof x === "string")
    : dest.manualLegalEntityIds;
  const tpIds = Array.isArray(body.tradePointIds)
    ? body.tradePointIds.filter((x): x is string => typeof x === "string")
    : dest.manualTradePointIds;

  const targets: { scope: ClientContactScope; scopeRef: string | null }[] = [];

  if (dest.toDealer && src.scope !== "dealer") {
    targets.push({ scope: "dealer", scopeRef: null });
  }
  if (dest.toAllLegalEntities) {
    const les = await pool.query<{ id: string }>(
      `SELECT id FROM legal_entities WHERE client_id = $1 AND status <> 'archived'`,
      [clientId],
    );
    for (const row of les.rows) {
      if (src.scope === "legal_entity" && src.scopeRef === row.id) continue;
      targets.push({ scope: "legal_entity", scopeRef: row.id });
    }
  }
  if (dest.toAllTradePoints) {
    const tpIdList = Array.isArray(body.tradePointIds)
      ? body.tradePointIds.filter((x): x is string => typeof x === "string")
      : [];
    for (const tpId of tpIdList) {
      if (src.scope === "trade_point" && src.scopeRef === tpId) continue;
      targets.push({ scope: "trade_point", scopeRef: tpId });
    }
  }
  for (const leId of leIds) {
    if (!dest.toAllLegalEntities) {
      if (src.scope === "legal_entity" && src.scopeRef === leId) continue;
      targets.push({ scope: "legal_entity", scopeRef: leId });
    }
  }
  for (const tpId of tpIds) {
    if (!dest.toAllTradePoints) {
      if (src.scope === "trade_point" && src.scopeRef === tpId) continue;
      targets.push({ scope: "trade_point", scopeRef: tpId });
    }
  }

  if (targets.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Выберите назначение." });
    return;
  }

  for (const t of targets) {
    await insertCopyContact(pool, clientId, t.scope, t.scopeRef, src, me, actorName);
    await insertEvent(
      pool,
      clientId,
      `Добавлен контакт из другого раздела: ${src.fullName}`,
      me,
      t.scope,
      t.scopeRef,
      undefined,
      actorName,
    );
  }
  await insertEvent(pool, clientId, `Контакт скопирован (${src.fullName})`, me, null, null, undefined, actorName);

  const payload = await fetchListPayload(pool, clientId);
  sendJson(res, 200, { success: true, clientId, ...payload });
}
