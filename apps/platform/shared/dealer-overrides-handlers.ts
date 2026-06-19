/**
 * API оверрайдов дилера (Postgres, prompt 113).
 */

import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import {
  DEALER_OVERRIDE_FIELDS,
  mapDealerOverrideRow,
  mapDealerTrainingRow,
  serializeOverrideValue,
  type DealerOverrideField,
  type DealerOverrideRow,
} from "./dealer-overrides-types.js";
import { logOverridesWriteError, runOverridesHandlerSafe } from "./overrides-write-errors.js";
import { OverridesValidationError, sanitizeDealerOverrideUuidFields } from "./overrides-uuid-validation.js";
import { canUserTrashDealer } from "./dealer-trash-scope-server.js";
import { removeDealerFromArchiveEverywhere } from "./archive-trash-invariant.js";

type SessionUser = { id: string; role: string; status: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseIdList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickFields(body: Record<string, unknown>): Partial<Record<DealerOverrideField, unknown>> {
  const fields = (body.fields ?? {}) as Record<string, unknown>;
  const out: Partial<Record<DealerOverrideField, unknown>> = {};
  for (const key of DEALER_OVERRIDE_FIELDS) {
    if (key in fields) out[key] = fields[key];
  }
  return out;
}

async function fetchOverride(pool: PoolLike, dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_overrides WHERE dealer_id = $1 LIMIT 1`,
    [dealerId],
  );
  return r.rows[0] ? mapDealerOverrideRow(r.rows[0]) : null;
}

export async function upsertDealerOverrideCity(
  pool: PoolLike,
  dealerId: string,
  city: string,
  actorUserId: string,
): Promise<void> {
  const patch: Partial<Record<DealerOverrideField, unknown>> = { city };
  await runOverridesHandlerSafe(
    pool,
    "dealer",
    dealerId,
    { dealer_id: dealerId, fields: patch },
    actorUserId,
    async () => {
      const prev = await fetchOverride(pool, dealerId);
      await logEvents(pool, dealerId, prev, patch, actorUserId);

      if (prev) {
        await pool.query(
          `UPDATE dealer_overrides SET city = $2, updated_at = NOW(), updated_by = $3::uuid WHERE dealer_id = $1`,
          [dealerId, city, actorUserId],
        );
      } else {
        await pool.query(
          `INSERT INTO dealer_overrides (dealer_id, city, updated_by) VALUES ($1, $2, $3::uuid)`,
          [dealerId, city, actorUserId],
        );
      }
    },
  );
}

async function logEvents(
  pool: PoolLike,
  dealerId: string,
  prev: DealerOverrideRow | null,
  patch: Partial<Record<DealerOverrideField, unknown>>,
  userId: string,
): Promise<void> {
  for (const field of Object.keys(patch) as DealerOverrideField[]) {
    const oldVal = prev ? (prev[field] as unknown) : null;
    const newVal = patch[field];
    const oldS = serializeOverrideValue(oldVal);
    const newS = serializeOverrideValue(newVal);
    if (oldS === newS) continue;
    await pool.query(
      `INSERT INTO dealer_override_events (dealer_id, field, old_value, new_value, changed_by)
       VALUES ($1, $2, $3, $4, $5::uuid)`,
      [dealerId, field, oldS, newS, userId],
    );
  }
}

// TODO(prompt-113): scope write access via client_assignments / team memberships for non-trash upserts.
function assertCanWrite(_me: SessionUser, res: VercelResponse): boolean {
  if (_me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

export async function handleDealerOverridesList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  _me: SessionUser,
): Promise<void> {
  const ids = parseIdList(req.query.dealer_ids);
  const statusRaw = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const statusFilter =
    statusRaw === "active" || statusRaw === "in_trash" || statusRaw === "pending_admin" || statusRaw === "purged"
      ? statusRaw
      : null;

  const overridesQ =
    ids.length > 0
      ? pool.query<Record<string, unknown>>(
          statusFilter
            ? `SELECT * FROM dealer_overrides WHERE dealer_id = ANY($1::text[]) AND status = $2::record_status`
            : `SELECT * FROM dealer_overrides WHERE dealer_id = ANY($1::text[])`,
          statusFilter ? [ids, statusFilter] : [ids],
        )
      : pool.query<Record<string, unknown>>(
          statusFilter
            ? `SELECT * FROM dealer_overrides WHERE status = $1::record_status`
            : `SELECT * FROM dealer_overrides`,
          statusFilter ? [statusFilter] : [],
        );
  const trainingQ =
    ids.length > 0
      ? pool.query<Record<string, unknown>>(
          `SELECT * FROM dealer_training_state WHERE dealer_id = ANY($1::text[])`,
          [ids],
        )
      : pool.query<Record<string, unknown>>(`SELECT * FROM dealer_training_state`);
  const manualQ =
    ids.length > 0
      ? pool.query<Record<string, unknown>>(`SELECT * FROM manual_dealers WHERE dealer_id = ANY($1::text[])`, [ids])
      : pool.query<Record<string, unknown>>(`SELECT * FROM manual_dealers`);

  const [overrides, training, manual] = await Promise.all([overridesQ, trainingQ, manualQ]);

  sendJson(res, 200, {
    success: true,
    data: {
      overrides: overrides.rows.map(mapDealerOverrideRow),
      training: training.rows.map(mapDealerTrainingRow),
      manual: manual.rows.map((r) => ({
        dealer_id: String(r.dealer_id),
        payload: r.payload as Record<string, unknown>,
        created_by: r.created_by != null ? String(r.created_by) : null,
        created_at: String(r.created_at),
      })),
    },
  });
}

export async function handleDealerOverridesGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  _me: SessionUser,
): Promise<void> {
  const dealerId = typeof req.query.dealer_id === "string" ? req.query.dealer_id.trim() : "";
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }
  const override = await fetchOverride(pool, dealerId);
  const tr = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_training_state WHERE dealer_id = $1 LIMIT 1`,
    [dealerId],
  );
  sendJson(res, 200, {
    success: true,
    data: {
      override,
      training: tr.rows[0] ? mapDealerTrainingRow(tr.rows[0]) : null,
    },
  });
}

export async function handleDealerOverridesHistory(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  _me: SessionUser,
): Promise<void> {
  const dealerId = typeof req.query.dealer_id === "string" ? req.query.dealer_id.trim() : "";
  const field = typeof req.query.field === "string" ? req.query.field.trim() : "";
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }
  const params: unknown[] = [dealerId];
  let fieldClause = "";
  if (field) {
    params.push(field);
    fieldClause = ` AND field = $${params.length}`;
  }
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_override_events
     WHERE dealer_id = $1${fieldClause}
     ORDER BY changed_at DESC
     LIMIT 120`,
    params,
  );
  sendJson(res, 200, { success: true, data: r.rows });
}

export async function handleDealerOverridesUpsert(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const dealerId = typeof body.dealer_id === "string" ? body.dealer_id.trim() : "";
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }
  let patch = pickFields(body);
  if (Object.keys(patch).length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Нет полей для обновления." });
    return;
  }

  try {
    patch = sanitizeDealerOverrideUuidFields(patch);
  } catch (e) {
    if (e instanceof OverridesValidationError) {
      await logOverridesWriteError(pool, {
        entityKind: "dealer",
        entityId: dealerId,
        payload: body,
        errorMessage: e.message,
        actorUserId: me.id,
        permanent: true,
      });
      sendJson(res, 400, {
        success: false,
        code: e.code,
        field: e.field,
        value: e.value,
        message: `Некорректный UUID в поле ${e.field}.`,
      });
      return;
    }
    throw e;
  }

  if (Object.keys(patch).length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Нет полей для обновления." });
    return;
  }

  await runOverridesHandlerSafe(pool, "dealer", dealerId, { ...body, fields: patch }, me.id, async () => {
    const prev = await fetchOverride(pool, dealerId);
    await logEvents(pool, dealerId, prev, patch, me.id);

    if (prev) {
      const sets: string[] = [];
      const params: unknown[] = [dealerId];
      for (const [key, val] of Object.entries(patch) as [DealerOverrideField, unknown][]) {
        params.push(val === undefined ? null : val);
        sets.push(`${key} = $${params.length}`);
      }
      params.push(me.id);
      sets.push(`updated_at = NOW()`, `updated_by = $${params.length}`);
      await pool.query(`UPDATE dealer_overrides SET ${sets.join(", ")} WHERE dealer_id = $1`, params);
    } else {
      const cols: string[] = ["dealer_id", "updated_by"];
      const vals: unknown[] = [dealerId, me.id];
      for (const [key, val] of Object.entries(patch) as [DealerOverrideField, unknown][]) {
        cols.push(key);
        vals.push(val === undefined ? null : val);
      }
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      await pool.query(
        `INSERT INTO dealer_overrides (${cols.join(", ")}) VALUES (${placeholders})`,
        vals,
      );
    }
  });

  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleDealerOverridesSetTraining(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const dealerId = typeof body.dealer_id === "string" ? body.dealer_id.trim() : "";
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }
  const productDone = body.product_training_done;
  const needsNew = body.needs_new_employees_training;

  await runOverridesHandlerSafe(pool, "dealer_training", dealerId, body, me.id, async () => {
    await pool.query(
      `INSERT INTO dealer_training_state (dealer_id, product_training_done, needs_new_employees_training, updated_by)
       VALUES ($1, COALESCE($2::boolean, FALSE), COALESCE($3::boolean, FALSE), $4::uuid)
       ON CONFLICT (dealer_id) DO UPDATE SET
         product_training_done = COALESCE($2::boolean, dealer_training_state.product_training_done),
         needs_new_employees_training = COALESCE($3::boolean, dealer_training_state.needs_new_employees_training),
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        dealerId,
        productDone === undefined ? null : Boolean(productDone),
        needsNew === undefined ? null : Boolean(needsNew),
        me.id,
      ],
    );
  });

  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_training_state WHERE dealer_id = $1`,
    [dealerId],
  );
  sendJson(res, 200, {
    success: true,
    data: { training: r.rows[0] ? mapDealerTrainingRow(r.rows[0]) : null },
  });
}

import {
  cascadeDealerTradePointsToActive,
  cascadeDealerTradePointsToTrash,
} from "./record-status-cascade.js";

async function setTrash(
  pool: PoolLike,
  me: SessionUser,
  dealerId: string,
  trash: boolean,
  res: VercelResponse,
): Promise<void> {
  const patch: Partial<Record<DealerOverrideField, unknown>> = trash
    ? { trashed_at: new Date().toISOString(), trashed_by: me.id }
    : { trashed_at: null, trashed_by: null };
  await runOverridesHandlerSafe(
    pool,
    trash ? "dealer_trash" : "dealer_untrash",
    dealerId,
    { dealer_id: dealerId, trash },
    me.id,
    async () => {
      const prev = await fetchOverride(pool, dealerId);
      await logEvents(pool, dealerId, prev, patch, me.id);
      if (trash) {
        await pool.query(
          `INSERT INTO dealer_overrides (dealer_id, status, trashed_at, trashed_by, updated_by)
           VALUES ($1, 'in_trash', $2, $3::uuid, $4::uuid)
           ON CONFLICT (dealer_id) DO UPDATE SET
             status = CASE
               WHEN dealer_overrides.status = 'purged' THEN dealer_overrides.status
               ELSE 'in_trash'::record_status
             END,
             trashed_at = EXCLUDED.trashed_at,
             trashed_by = EXCLUDED.trashed_by,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
          [dealerId, new Date().toISOString(), me.id, me.id],
        );
        await cascadeDealerTradePointsToTrash(pool, dealerId, me.id);
      } else {
        await pool.query(
          `UPDATE dealer_overrides
           SET status = 'active',
               trashed_at = NULL,
               trashed_by = NULL,
               purge_requested_at = NULL,
               purge_requested_by = NULL,
               updated_at = NOW(),
               updated_by = $2::uuid
           WHERE dealer_id = $1 AND status IN ('in_trash', 'pending_admin')`,
          [dealerId, me.id],
        );
        await cascadeDealerTradePointsToActive(pool, dealerId, me.id);
      }
    },
  );
  if (trash) {
    await removeDealerFromArchiveEverywhere(pool, dealerId);
  }
  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}

function denyTrashOutOfScope(res: VercelResponse, reason?: string): void {
  sendJson(res, 403, {
    success: false,
    code: "FORBIDDEN_OUT_OF_SCOPE",
    message: "Этот клиент вне вашей зоны ответственности.",
    reason,
  });
}

export async function handleDealerOverridesTrash(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const dealerId = typeof (req.body as Record<string, unknown>)?.dealer_id === "string"
    ? String((req.body as Record<string, unknown>).dealer_id).trim()
    : "";
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }
  const check = await canUserTrashDealer(pool, me.id, me.role, dealerId);
  if (!check.allowed) {
    denyTrashOutOfScope(res, check.reason);
    return;
  }
  await setTrash(pool, me, dealerId, true, res);
}

export async function handleDealerOverridesUntrash(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const { handleDealerOverridesRestore } = await import("./dealer-purge-handlers.js");
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.target === undefined) body.target = "active";
  req.body = body;
  await handleDealerOverridesRestore(req, res, pool, me);
}

export async function handleDealerOverridesCreateManual(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const dealerId =
    typeof body.dealer_id === "string" && body.dealer_id.trim()
      ? body.dealer_id.trim()
      : `manual-${randomUUID()}`;
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  await runOverridesHandlerSafe(pool, "manual_dealer", dealerId, body, me.id, async () => {
    await pool.query(
      `INSERT INTO manual_dealers (dealer_id, payload, created_by)
       VALUES ($1, $2::jsonb, $3::uuid)
       ON CONFLICT (dealer_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [dealerId, JSON.stringify(payload), me.id],
    );
  });

  sendJson(res, 200, {
    success: true,
    data: { dealer_id: dealerId, payload },
  });
}
