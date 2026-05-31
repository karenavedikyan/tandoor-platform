/**
 * API маршрутов отгрузки (Postgres) — Промт 114.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { parseAuthRefreshToken, sha256Hex, timingSafeEqualHex } from "./admin/admin-auth.js";
import { logOverridesApiAccess } from "./overrides-api-access-log.js";
import {
  mapDealerShipmentRouteRow,
  parseShipmentRouteDayId,
  type DealerShipmentRouteDayId,
  type DealerShipmentRouteRow,
} from "./dealer-shipment-routes-types.js";

export type SessionUser = { id: string; role: string; status: string };
export type SessionContext = { me: SessionUser; impersonatorUserId: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTE_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;
const ROUTES_PER_DAY_LIMIT = 2;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sanitizeUserId(raw: string): string | null {
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function sanitizeRouteId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t && ROUTE_ID_RE.test(t) ? t : null;
}

function sanitizeCities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    ),
  );
}

export async function resolveSessionContext(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<SessionContext | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<{
    id: string;
    role: string;
    status: string;
    refresh_token_hash: string;
    impersonator_user_id: string | null;
  }>(
    `SELECT u.id, u.role, u.status, s.refresh_token_hash, s.impersonator_user_id
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  return {
    me: { id: row.id, role: row.role, status: row.status },
    impersonatorUserId: row.impersonator_user_id,
  };
}

async function resolveRopTeamId(pool: PoolLike, ropUserId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`SELECT id FROM teams WHERE rop_user_id = $1::uuid LIMIT 1`, [ropUserId]);
  return r.rows[0]?.id ?? null;
}

export async function assertShipmentRoutesReadAccess(
  pool: PoolLike,
  me: SessionUser,
  targetUserId: string,
): Promise<boolean> {
  if (me.status !== "active") return false;
  if (targetUserId === me.id) return true;
  if (me.role === "admin" || me.role === "director") return true;
  if (me.role === "rop") {
    const teamId = await resolveRopTeamId(pool, me.id);
    if (!teamId) return false;
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM user_team_memberships WHERE user_id = $1::uuid AND team_id = $2::uuid`,
      [targetUserId, teamId],
    );
    return Number(r.rows[0]?.n ?? 0) > 0;
  }
  return false;
}

function assertShipmentRoutesWriteAccess(ctx: SessionContext, targetUserId: string): boolean {
  const { me, impersonatorUserId } = ctx;
  if (me.status !== "active") return false;
  if (targetUserId !== me.id) return me.role === "admin" || me.role === "director";
  if (impersonatorUserId) {
    return me.role !== "marketer" && me.role !== "analyst";
  }
  return true;
}

async function countActiveRoutesForDay(
  pool: PoolLike,
  userId: string,
  dayId: DealerShipmentRouteDayId,
  excludeId?: string,
): Promise<number> {
  const r = await pool.query<{ n: string }>(
    excludeId
      ? `SELECT COUNT(*)::text AS n FROM dealer_shipment_routes
         WHERE user_id = $1 AND day_id = $2 AND trashed_at IS NULL AND id <> $3`
      : `SELECT COUNT(*)::text AS n FROM dealer_shipment_routes
         WHERE user_id = $1 AND day_id = $2 AND trashed_at IS NULL`,
    excludeId ? [userId, dayId, excludeId] : [userId, dayId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function logAccess(
  pool: PoolLike,
  entry: {
    route: string;
    method: string;
    actorUserId: string;
    responseStatus: number;
    responseCode: string;
    durationMs: number;
    bodySummary?: Record<string, unknown>;
  },
): Promise<void> {
  await logOverridesApiAccess(pool, {
    route: entry.route,
    method: entry.method,
    actorUserId: entry.actorUserId,
    bodySummary: entry.bodySummary ?? null,
    responseStatus: entry.responseStatus,
    responseCode: entry.responseCode,
    durationMs: entry.durationMs,
  });
}

export async function handleDealerShipmentRoutesList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  const startedAt = Date.now();
  const rawUserId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const targetUserId = rawUserId ? sanitizeUserId(rawUserId) : ctx.me.id;
  if (!targetUserId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный userId." });
    await logAccess(pool, {
      route: "shipment_routes/list",
      method: "GET",
      actorUserId: ctx.me.id,
      responseStatus: 400,
      responseCode: "VALIDATION_ERROR",
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  if (!(await assertShipmentRoutesReadAccess(pool, ctx.me, targetUserId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    await logAccess(pool, {
      route: "shipment_routes/list",
      method: "GET",
      actorUserId: ctx.me.id,
      responseStatus: 403,
      responseCode: "FORBIDDEN",
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_shipment_routes
     WHERE user_id = $1 AND trashed_at IS NULL
     ORDER BY day_id, updated_at DESC`,
    [targetUserId],
  );
  const items = r.rows.map(mapDealerShipmentRouteRow);
  sendJson(res, 200, { success: true, userId: targetUserId, items });
  await logAccess(pool, {
    route: "shipment_routes/list",
    method: "GET",
    actorUserId: ctx.me.id,
    responseStatus: 200,
    responseCode: "OK",
    durationMs: Date.now() - startedAt,
    bodySummary: { userId: targetUserId, count: items.length },
  });
}

export async function handleDealerShipmentRoutesUpsert(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  const startedAt = Date.now();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const userId = sanitizeUserId(String(body.userId ?? ctx.me.id));
  const dayId = parseShipmentRouteDayId(body.dayId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const cities = sanitizeCities(body.cities);
  const id = sanitizeRouteId(body.id) ?? `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!userId || !dayId || !name) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "userId, dayId и name обязательны." });
    await logAccess(pool, {
      route: "shipment_routes/upsert",
      method: "POST",
      actorUserId: ctx.me.id,
      responseStatus: 400,
      responseCode: "VALIDATION_ERROR",
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  if (!assertShipmentRoutesWriteAccess(ctx, userId)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    await logAccess(pool, {
      route: "shipment_routes/upsert",
      method: "POST",
      actorUserId: ctx.me.id,
      responseStatus: 403,
      responseCode: "FORBIDDEN",
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  const existing = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_shipment_routes WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId],
  );
  const isUpdate = Boolean(existing.rows[0] && existing.rows[0].trashed_at == null);
  if (!isUpdate) {
    const n = await countActiveRoutesForDay(pool, userId, dayId);
    if (n >= ROUTES_PER_DAY_LIMIT) {
      sendJson(res, 409, {
        success: false,
        code: "LIMIT_REACHED",
        message: `Не более ${ROUTES_PER_DAY_LIMIT} маршрутов на день.`,
      });
      await logAccess(pool, {
        route: "shipment_routes/upsert",
        method: "POST",
        actorUserId: ctx.me.id,
        responseStatus: 409,
        responseCode: "LIMIT_REACHED",
        durationMs: Date.now() - startedAt,
        bodySummary: { userId, dayId },
      });
      return;
    }
  }

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO dealer_shipment_routes (
       id, user_id, day_id, name, cities, trashed_at, trashed_by, updated_at, updated_by
     ) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, NULL, NOW(), $6)
     ON CONFLICT (id) DO UPDATE SET
       day_id = EXCLUDED.day_id,
       name = EXCLUDED.name,
       cities = EXCLUDED.cities,
       trashed_at = NULL,
       trashed_by = NULL,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [id, userId, dayId, name, JSON.stringify(cities), ctx.me.id],
  );
  const item = mapDealerShipmentRouteRow(r.rows[0]!);
  sendJson(res, 200, { success: true, item });
  await logAccess(pool, {
    route: "shipment_routes/upsert",
    method: "POST",
    actorUserId: ctx.me.id,
    responseStatus: 200,
    responseCode: "OK",
    durationMs: Date.now() - startedAt,
    bodySummary: { userId, dayId, routeId: id },
  });
}

export async function handleDealerShipmentRoutesDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  const startedAt = Date.now();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = sanitizeRouteId(body.id);
  const userId = sanitizeUserId(String(body.userId ?? ctx.me.id));
  const deletedBy = typeof body.deletedBy === "string" ? body.deletedBy.trim() : ctx.me.id;

  if (!id || !userId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "id и userId обязательны." });
    return;
  }
  if (!assertShipmentRoutesWriteAccess(ctx, userId)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const r = await pool.query<Record<string, unknown>>(
    `UPDATE dealer_shipment_routes
     SET trashed_at = NOW(), trashed_by = $3, updated_at = NOW(), updated_by = $3
     WHERE id = $1 AND user_id = $2 AND trashed_at IS NULL
     RETURNING *`,
    [id, userId, deletedBy],
  );
  if (!r.rows[0]) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Маршрут не найден." });
    await logAccess(pool, {
      route: "shipment_routes/delete",
      method: "POST",
      actorUserId: ctx.me.id,
      responseStatus: 404,
      responseCode: "NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  sendJson(res, 200, { success: true, item: mapDealerShipmentRouteRow(r.rows[0]!) });
  await logAccess(pool, {
    route: "shipment_routes/delete",
    method: "POST",
    actorUserId: ctx.me.id,
    responseStatus: 200,
    responseCode: "OK",
    durationMs: Date.now() - startedAt,
    bodySummary: { userId, routeId: id },
  });
}

export async function handleDealerShipmentRoutesBulkImport(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  const startedAt = Date.now();
  const body = (req.body ?? {}) as { userId?: unknown; items?: unknown };
  const userId = sanitizeUserId(String(body.userId ?? ctx.me.id));
  if (!userId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "userId обязателен." });
    return;
  }
  if (!assertShipmentRoutesWriteAccess(ctx, userId)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const items = Array.isArray(body.items) ? body.items : [];
  let imported = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = sanitizeRouteId(o.id);
    const dayId = parseShipmentRouteDayId(o.dayId);
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!id || !dayId || !name) continue;
    const cities = sanitizeCities(o.cities);
    const updatedBy = typeof o.updatedBy === "string" ? o.updatedBy.trim() : ctx.me.id;
    await pool.query(
      `INSERT INTO dealer_shipment_routes (
         id, user_id, day_id, name, cities, trashed_at, trashed_by, created_at, updated_at, updated_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, NULL, COALESCE($6::timestamptz, NOW()), COALESCE($6::timestamptz, NOW()), $7)
       ON CONFLICT (id) DO UPDATE SET
         day_id = EXCLUDED.day_id,
         name = EXCLUDED.name,
         cities = EXCLUDED.cities,
         trashed_at = NULL,
         updated_by = EXCLUDED.updated_by,
         updated_at = COALESCE(EXCLUDED.updated_at, NOW())`,
      [
        id,
        userId,
        dayId,
        name,
        JSON.stringify(cities),
        typeof o.updatedAt === "string" ? o.updatedAt : null,
        updatedBy,
      ],
    );
    imported += 1;
  }

  const list = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_shipment_routes WHERE user_id = $1 AND trashed_at IS NULL ORDER BY day_id, updated_at DESC`,
    [userId],
  );
  sendJson(res, 201, {
    success: true,
    userId,
    imported,
    items: list.rows.map(mapDealerShipmentRouteRow),
  });
  await logAccess(pool, {
    route: "shipment_routes/bulk-import",
    method: "POST",
    actorUserId: ctx.me.id,
    responseStatus: 201,
    responseCode: "OK",
    durationMs: Date.now() - startedAt,
    bodySummary: { userId, imported },
  });
}

export type { DealerShipmentRouteRow };
