/**
 * Лёгкие admin-эндпоинты для client_assignments / user_team (без client seed).
 * Импортируется только из `api/admin/[action].ts`.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin-auth.js";
import { logDealerAuditEvent, logTradePointAuditEvent } from "../override-audit-events.js";

export type SessionUser = {
  id: string;
  role: string;
  status: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLIENT_CATEGORIES = new Set(["top150", "top350", "top500", "top500plus", "new_client"]);

const DEALER_OVERRIDE_JOIN =
  "LEFT JOIN dealer_overrides dov ON upper(regexp_replace(dov.dealer_id, '^client-', '')) = ca.client_code";

function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

function qsParam(q: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = q[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
  }
  return undefined;
}

function qsParamArray(q: Record<string, unknown>, ...keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const v = q[key];
    if (typeof v === "string") {
      for (const part of v.split(",")) {
        const t = part.trim();
        if (t) out.push(t);
      }
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item !== "string") continue;
        for (const part of item.split(",")) {
          const t = part.trim();
          if (t) out.push(t);
        }
      }
    }
  }
  return Array.from(new Set(out));
}

function normalizeStringArray(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? [t] : undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function normalizeUuidArray(raw: unknown): string[] | undefined {
  const arr = normalizeStringArray(raw);
  if (!arr) return undefined;
  const uuids = arr.filter((s) => UUID_RE.test(s));
  return uuids.length ? uuids : undefined;
}

function normalizeCategoryArray(raw: unknown): string[] | undefined {
  const arr = normalizeStringArray(raw);
  if (!arr) return undefined;
  const cats = arr.map((s) => parseClientCategory(s)).filter((c): c is string => Boolean(c));
  return cats.length ? cats : undefined;
}

function normalizeClientCodeArray(raw: unknown): string[] | undefined {
  const arr = normalizeStringArray(raw);
  if (!arr) return undefined;
  const codes = arr.map((s) => s.toUpperCase());
  return codes.length ? codes : undefined;
}

function normalizeTradePointIdArray(raw: unknown): string[] | undefined {
  const arr = normalizeStringArray(raw);
  return arr?.length ? arr : undefined;
}

function parseClientCategory(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return CLIENT_CATEGORIES.has(raw) ? raw : undefined;
}

type DealerOverrideFilters = {
  city?: string[];
  category?: string[];
  regionalManager?: string[];
  rop?: string[];
  searchFrag?: string;
};

function appendDealerOverrideFilters(cond: string[], params: unknown[], filters: DealerOverrideFilters): void {
  if (filters.searchFrag) {
    params.push(`%${filters.searchFrag}%`);
    cond.push(`(ca.client_code ILIKE $${params.length} OR dov.name ILIKE $${params.length})`);
  }
  if (filters.city?.length) {
    params.push(filters.city.map((s) => s.toLowerCase()));
    cond.push(`lower(dov.city) = ANY($${params.length})`);
  }
  if (filters.category?.length) {
    params.push(filters.category);
    cond.push(`dov.client_category = ANY($${params.length})`);
  }
  if (filters.regionalManager?.length) {
    params.push(filters.regionalManager.map((s) => s.toLowerCase()));
    cond.push(`lower(dov.regional_manager_name) = ANY($${params.length})`);
  }
  if (filters.rop?.length) {
    params.push(filters.rop.map((s) => s.toLowerCase()));
    cond.push(`lower(dov.rop_name) = ANY($${params.length})`);
  }
}

function hasAnyReassignFilter(filter: {
  fromUserId?: string | null;
  fromTeamId?: string[] | null;
  responsibleUserId?: string[] | null;
  city?: string[];
  category?: string[];
  regionalManager?: string[];
  rop?: string[];
  searchFrag?: string;
  clientCodes?: string[];
  tradePointIds?: string[];
}): boolean {
  return Boolean(
    filter.fromUserId ||
      (filter.fromTeamId?.length ?? 0) > 0 ||
      (filter.responsibleUserId?.length ?? 0) > 0 ||
      (filter.city?.length ?? 0) > 0 ||
      (filter.category?.length ?? 0) > 0 ||
      (filter.regionalManager?.length ?? 0) > 0 ||
      (filter.rop?.length ?? 0) > 0 ||
      (filter.clientCodes?.length ?? 0) > 0 ||
      (filter.tradePointIds?.length ?? 0) > 0 ||
      filter.searchFrag,
  );
}

type ParsedReassignFilter = {
  fromUserId?: string;
  responsibleUserId?: string[];
  fromTeamId?: string[];
  city?: string[];
  category?: string[];
  regionalManager?: string[];
  rop?: string[];
  searchFrag?: string;
  clientCodes?: string[];
  tradePointIds?: string[];
};

function parseReassignFilterBody(f: {
  fromUserId?: unknown;
  fromTeamId?: unknown;
  responsibleUserId?: unknown;
  managerUserId?: unknown;
  city?: unknown;
  category?: unknown;
  regionalManager?: unknown;
  rop?: unknown;
  search?: unknown;
  clientCodes?: unknown;
  tradePointIds?: unknown;
}): ParsedReassignFilter {
  let responsibleUserId = normalizeUuidArray(f.responsibleUserId);
  const managerUserId = normalizeUuidArray(f.managerUserId);
  if (managerUserId?.length) {
    responsibleUserId = [...new Set([...(responsibleUserId ?? []), ...managerUserId])];
  }
  const fromUserIdRaw = typeof f.fromUserId === "string" && UUID_RE.test(f.fromUserId.trim()) ? f.fromUserId.trim() : undefined;
  if (!responsibleUserId?.length) {
    responsibleUserId = normalizeUuidArray(f.fromUserId);
  }
  const fromTeamId = normalizeUuidArray(f.fromTeamId);
  const city = normalizeStringArray(f.city);
  const category = normalizeCategoryArray(f.category);
  const regionalManager = normalizeStringArray(f.regionalManager);
  const rop = normalizeStringArray(f.rop);
  const clientCodes = normalizeClientCodeArray(f.clientCodes);
  const tradePointIds = normalizeTradePointIdArray(f.tradePointIds);
  const searchRaw = typeof f.search === "string" ? f.search.trim() : "";
  const searchFrag = searchRaw ? sanitizeLikeFragment(searchRaw) : undefined;
  return {
    fromUserId: fromUserIdRaw,
    responsibleUserId,
    fromTeamId,
    city,
    category,
    regionalManager,
    rop,
    clientCodes,
    tradePointIds,
    searchFrag,
  };
}

function appendReassignAssignmentFilters(cond: string[], pr: unknown[], parsed: ParsedReassignFilter): void {
  if (parsed.clientCodes?.length) {
    pr.push(parsed.clientCodes);
    cond.push(`ca.client_code = ANY($${pr.length}::text[])`);
  }
  if (parsed.tradePointIds?.length) {
    pr.push(parsed.tradePointIds);
    cond.push(
      `EXISTS (
         SELECT 1 FROM trade_points tp
         JOIN dealers d ON d.id = tp.dealer_id
         WHERE upper(replace(d.external_key, 'client-', '')) = ca.client_code
           AND tp.id::text = ANY($${pr.length}::text[])
       )`,
    );
  }
  if (parsed.responsibleUserId?.length) {
    pr.push(parsed.responsibleUserId);
    cond.push(`ca.responsible_user_id = ANY($${pr.length}::uuid[])`);
  } else if (parsed.fromUserId) {
    pr.push(parsed.fromUserId);
    cond.push(`ca.responsible_user_id = $${pr.length}::uuid`);
  }
  if (parsed.fromTeamId?.length) {
    pr.push(parsed.fromTeamId);
    cond.push(`ca.team_id = ANY($${pr.length}::uuid[])`);
  }
  appendDealerOverrideFilters(cond, pr, {
    city: parsed.city,
    category: parsed.category,
    regionalManager: parsed.regionalManager,
    rop: parsed.rop,
    searchFrag: parsed.searchFrag,
  });
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

async function tryAudit(
  pool: PoolLike,
  input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.actorUserId, input.action, input.entityType, input.entityId, JSON.stringify(input.metadata)],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[audit-fail]", input.action, m.slice(0, 300));
  }
}

async function resolveRopTeamId(pool: PoolLike, ropUserId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`SELECT id FROM teams WHERE rop_user_id = $1::uuid LIMIT 1`, [ropUserId]);
  return r.rows[0]?.id ?? null;
}

async function resolveTargetUserTeamId(pool: PoolLike, userId: string): Promise<string | null> {
  const r = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.team_id ?? null;
}

export async function handleClientsReassign(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as {
    toUserId?: unknown;
    reason?: unknown;
    clientCodes?: unknown;
    filter?: unknown;
  };
  const toUserId = typeof body.toUserId === "string" ? body.toUserId.trim() : "";
  if (!UUID_RE.test(toUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный toUserId." });
    return;
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const newTeamId = await resolveTargetUserTeamId(pool, toUserId);
  if (!newTeamId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Целевой пользователь не состоит в команде." });
    return;
  }

  let codes: string[] = [];
  if (Array.isArray(body.clientCodes) && body.clientCodes.length > 0) {
    codes = body.clientCodes.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim());
  } else if (body.filter && typeof body.filter === "object" && body.filter !== null) {
    const parsed = parseReassignFilterBody(body.filter as Record<string, unknown>);
    if (!hasAnyReassignFilter(parsed)) {
      sendJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Укажите clientCodes или хотя бы одно поле filter.",
      });
      return;
    }
    const cond: string[] = ["1=1"];
    const pr: unknown[] = [];
    appendReassignAssignmentFilters(cond, pr, parsed);
    if (me.role === "rop") {
      const myTeam = await resolveRopTeamId(pool, me.id);
      if (!myTeam) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
        return;
      }
      pr.push(myTeam);
      cond.push(`ca.team_id = $${pr.length}::uuid`);
    }
    const whereSql = cond.join(" AND ");
    const sel = await pool.query<{ client_code: string }>(
      `SELECT ca.client_code
       FROM client_assignments ca
       ${DEALER_OVERRIDE_JOIN}
       WHERE ${whereSql}
       LIMIT 1000`,
      pr,
    );
    codes = sel.rows.map((r) => r.client_code);
  } else {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientCodes или filter." });
    return;
  }

  if (codes.length === 0) {
    sendJson(res, 200, { success: true, reassigned: 0, history: [] });
    return;
  }
  if (codes.length > 1000) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не более 1000 client_code за запрос." });
    return;
  }

  if (me.role === "rop") {
    const myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam || newTeamId !== myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "РОП может переносить только внутри своей команды." });
      return;
    }
    const ok = await pool.query(
      `SELECT 1 FROM user_team_memberships WHERE user_id = $1::uuid AND team_id = $2::uuid LIMIT 1`,
      [toUserId, myTeam],
    );
    if (ok.rows.length === 0) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Целевой пользователь не в вашей команде." });
      return;
    }
    if (Array.isArray(body.clientCodes) && body.clientCodes.length > 0) {
      const chk = await pool.query(
        `SELECT COUNT(*)::int AS n FROM client_assignments WHERE client_code = ANY($1::text[]) AND team_id <> $2::uuid`,
        [codes, myTeam],
      );
      const n = Number((chk.rows[0] as { n: number }).n ?? 0);
      if (n > 0) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Есть клиенты вне вашей команды." });
        return;
      }
    }
  } else if (me.role !== "admin" && me.role !== "director") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  let whereExtra = "";
  const upParams: unknown[] = [codes, toUserId, newTeamId];
  if (me.role === "rop") {
    const myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
      return;
    }
    upParams.push(myTeam);
    whereExtra = `AND ca.team_id = $${upParams.length}::uuid`;
  }
  const upd = await pool.query<{
    client_code: string;
    from_uid: string;
    from_tid: string | null;
    to_uid: string;
    to_tid: string | null;
  }>(
    `UPDATE client_assignments AS ca
     SET responsible_user_id = $2::uuid, team_id = $3::uuid, updated_at = now()
     FROM client_assignments AS old
     WHERE old.client_code = ca.client_code AND ca.client_code = ANY($1::text[]) ${whereExtra}
     RETURNING ca.client_code, old.responsible_user_id AS from_uid, old.team_id AS from_tid, ca.responsible_user_id AS to_uid, ca.team_id AS to_tid`,
    upParams,
  );
  for (const row of upd.rows) {
    await pool.query(
      `INSERT INTO client_assignment_history (client_code, from_user_id, to_user_id, from_team_id, to_team_id, actor_user_id, reason)
       VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7)`,
      [row.client_code, row.from_uid, toUserId, row.from_tid, row.to_tid, me.id, reason || null],
    );
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "client.reassign",
    entityType: "client_assignments",
    entityId: "batch",
    metadata: { count: upd.rows.length, toUserId, filter: body.filter ?? null },
  });

  const history = upd.rows.map((row) => ({
    client_code: row.client_code,
    fromUserId: row.from_uid,
    toUserId,
  }));

  sendJson(res, 200, { success: true, reassigned: upd.rows.length, history });
}

async function isRegionalManagerUser(pool: PoolLike, userId: string): Promise<boolean> {
  const r = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM users u
     LEFT JOIN user_team_memberships m ON m.user_id = u.id
     WHERE u.id = $1::uuid AND u.status = 'active'
       AND (u.role = 'regional_manager' OR m.role_in_team = 'regional_manager')
     LIMIT 1`,
    [userId],
  );
  return r.rows.length > 0;
}

async function resolveRegionalManagerDisplayName(pool: PoolLike, userId: string): Promise<string | null> {
  const r = await pool.query<{ display_name: string | null }>(
    `SELECT COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(email), '')) AS display_name
     FROM users WHERE id = $1::uuid AND status = 'active'`,
    [userId],
  );
  const name = r.rows[0]?.display_name?.trim();
  return name || null;
}

export async function handleRegionalManagerReassign(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (me.role !== "admin" && me.role !== "director" && me.role !== "rop") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = (req.body ?? {}) as {
    toUserId?: unknown;
    reason?: unknown;
    clientCodes?: unknown;
    tradePointIds?: unknown;
    filter?: unknown;
    cascadeTradePoints?: unknown;
  };

  const toUserIdRaw = body.toUserId === null ? null : typeof body.toUserId === "string" ? body.toUserId.trim() : undefined;
  if (toUserIdRaw !== null && toUserIdRaw !== undefined && !UUID_RE.test(toUserIdRaw)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный toUserId." });
    return;
  }
  const toUserId = toUserIdRaw ?? null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const cascadeTradePoints = body.cascadeTradePoints !== false;
  const explicitTradePointIds = normalizeTradePointIdArray(body.tradePointIds) ?? [];

  let rmDisplayName: string | null = null;
  if (toUserId) {
    if (!(await isRegionalManagerUser(pool, toUserId))) {
      sendJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Целевой пользователь не является региональным менеджером.",
      });
      return;
    }
    rmDisplayName = await resolveRegionalManagerDisplayName(pool, toUserId);
    if (!rmDisplayName) {
      sendJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Не удалось определить имя регионального менеджера.",
      });
      return;
    }
  }

  let myTeam: string | null = null;
  if (me.role === "rop") {
    myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
      return;
    }
    if (toUserId) {
      const okRm = await pool.query(
        `SELECT 1 FROM user_team_memberships
         WHERE user_id = $1::uuid AND team_id = $2::uuid AND role_in_team = 'regional_manager'
         LIMIT 1`,
        [toUserId, myTeam],
      );
      if (okRm.rows.length === 0) {
        sendJson(res, 403, {
          success: false,
          code: "FORBIDDEN",
          message: "РОП может назначать только регионалов своей команды.",
        });
        return;
      }
    }
  }

  let codes: string[] = [];
  if (Array.isArray(body.clientCodes) && body.clientCodes.length > 0) {
    codes = body.clientCodes
      .filter((c): c is string => typeof c === "string" && c.trim() !== "")
      .map((c) => c.trim().toUpperCase());
  } else if (body.filter && typeof body.filter === "object" && body.filter !== null) {
    const parsed = parseReassignFilterBody(body.filter as Record<string, unknown>);
    if (!hasAnyReassignFilter(parsed)) {
      sendJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Укажите clientCodes или хотя бы одно поле filter.",
      });
      return;
    }
    const cond: string[] = ["1=1"];
    const pr: unknown[] = [];
    appendReassignAssignmentFilters(cond, pr, parsed);
    if (myTeam) {
      pr.push(myTeam);
      cond.push(`ca.team_id = $${pr.length}::uuid`);
    }
    const whereSql = cond.join(" AND ");
    const sel = await pool.query<{ client_code: string }>(
      `SELECT ca.client_code
       FROM client_assignments ca
       ${DEALER_OVERRIDE_JOIN}
       WHERE ${whereSql}
       LIMIT 1000`,
      pr,
    );
    codes = sel.rows.map((r) => r.client_code);
  }

  const updateDealers = codes.length > 0;
  const updateTradePoints = explicitTradePointIds.length > 0 || (cascadeTradePoints && codes.length > 0);

  if (!updateDealers && !updateTradePoints) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Укажите clientCodes, filter или tradePointIds.",
    });
    return;
  }

  if (codes.length > 1000 || explicitTradePointIds.length > 1000) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не более 1000 записей за запрос." });
    return;
  }

  if (me.role === "rop" && myTeam) {
    if (codes.length > 0) {
      const chk = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM client_assignments WHERE client_code = ANY($1::text[]) AND team_id <> $2::uuid`,
        [codes, myTeam],
      );
      if (Number(chk.rows[0]?.n ?? 0) > 0) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Есть клиенты вне вашей команды." });
        return;
      }
    }
    if (explicitTradePointIds.length > 0) {
      const chkTp = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n
         FROM trade_points tp
         JOIN dealers d ON d.id = tp.dealer_id
         LEFT JOIN client_assignments ca ON upper(replace(d.external_key, 'client-', '')) = ca.client_code
         WHERE tp.id::text = ANY($1::text[])
           AND (ca.team_id IS NULL OR ca.team_id <> $2::uuid)`,
        [explicitTradePointIds, myTeam],
      );
      if (Number(chkTp.rows[0]?.n ?? 0) > 0) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Есть торговые точки вне вашей команды." });
        return;
      }
    }
  }

  const history: { dealer_id: string; fromUserId: string | null; toUserId: string | null }[] = [];
  let dealersAffected = 0;

  if (updateDealers) {
    const before = await pool.query<{ dealer_id: string; from_user_id: string | null }>(
      `SELECT 'client-' || lower(code) AS dealer_id, dov.regional_manager_id AS from_user_id
       FROM unnest($1::text[]) AS code
       LEFT JOIN dealer_overrides dov ON dov.dealer_id = 'client-' || lower(code)`,
      [codes],
    );

    const upsert = await pool.query<{ dealer_id: string }>(
      `INSERT INTO dealer_overrides (dealer_id, regional_manager_id, regional_manager_name, updated_at, updated_by)
       SELECT 'client-' || lower(code), $2::uuid, $3, now(), $4::uuid
       FROM unnest($1::text[]) AS code
       ON CONFLICT (dealer_id) DO UPDATE SET
         regional_manager_id = EXCLUDED.regional_manager_id,
         regional_manager_name = EXCLUDED.regional_manager_name,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by
       RETURNING dealer_id`,
      [codes, toUserId, rmDisplayName, me.id],
    );
    dealersAffected = upsert.rows.length;

    for (const row of before.rows) {
      history.push({
        dealer_id: row.dealer_id,
        fromUserId: row.from_user_id,
        toUserId,
      });
      await pool.query(
        `INSERT INTO dealer_responsibility_history (dealer_id, responsible_role, from_user_id, to_user_id, actor_user_id, reason)
         VALUES ($1, 'regional_manager', $2::uuid, $3::uuid, $4::uuid, $5)`,
        [row.dealer_id, row.from_user_id, toUserId, me.id, reason || null],
      );
      await logDealerAuditEvent(pool, {
        dealerId: row.dealer_id,
        eventKind: "regional_manager_changed",
        userId: me.id,
        payload: { fromUserId: row.from_user_id, toUserId, reason: reason || null },
      });
    }
  }

  let tradePointsAffected = 0;
  if (updateTradePoints) {
    let tpIds: string[] = [];
    if (explicitTradePointIds.length > 0) {
      tpIds = explicitTradePointIds;
    } else if (codes.length > 0) {
      const tpSel = await pool.query<{ tp_id: string }>(
        `SELECT tp.id::text AS tp_id
         FROM trade_points tp
         JOIN dealers d ON d.id = tp.dealer_id
         WHERE upper(replace(d.external_key, 'client-', '')) = ANY($1::text[])`,
        [codes],
      );
      tpIds = tpSel.rows.map((r) => r.tp_id);
    }

    if (tpIds.length > 1000) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не более 1000 торговых точек за запрос." });
      return;
    }

    if (tpIds.length > 0) {
      const tpUpd = await pool.query<{ tp_id: string }>(
        `INSERT INTO trade_point_overrides (tp_id, regional_manager_id, regional_manager_name, updated_at, updated_by)
         SELECT unnest($1::text[]), $2::uuid, $3, now(), $4::uuid
         ON CONFLICT (tp_id) DO UPDATE SET
           regional_manager_id = EXCLUDED.regional_manager_id,
           regional_manager_name = EXCLUDED.regional_manager_name,
           updated_at = now(),
           updated_by = EXCLUDED.updated_by
         RETURNING tp_id`,
        [tpIds, toUserId, rmDisplayName, me.id],
      );
      tradePointsAffected = tpUpd.rows.length;

      for (const row of tpUpd.rows) {
        await logTradePointAuditEvent(pool, {
          tpId: row.tp_id,
          eventKind: "regional_manager_changed",
          userId: me.id,
          payload: { toUserId, reason: reason || null },
        });
      }
    }
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "dealer.regional_manager.reassign",
    entityType: "dealer_overrides",
    entityId: "batch",
    metadata: { dealersAffected, tradePointsAffected, toUserId, filter: body.filter ?? null },
  });

  sendJson(res, 200, {
    success: true,
    dealersAffected,
    tradePointsAffected,
    history: history.map((h) => ({
      dealer_id: h.dealer_id,
      fromUserId: h.fromUserId,
      toUserId: h.toUserId,
    })),
  });
}

export async function handleUserTeamReassign(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор или директор." });
    return;
  }
  const body = (req.body ?? {}) as {
    userId?: unknown;
    toTeamId?: unknown;
    reason?: unknown;
    moveClients?: unknown;
    roleInTeam?: unknown;
  };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const toTeamIdRaw = body.toTeamId === null ? null : typeof body.toTeamId === "string" ? body.toTeamId.trim() : undefined;
  if (!UUID_RE.test(userId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный userId." });
    return;
  }
  if (toTeamIdRaw !== null && toTeamIdRaw !== undefined && !UUID_RE.test(toTeamIdRaw)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный toTeamId." });
    return;
  }
  const toTeamId = toTeamIdRaw ?? null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  /** По умолчанию переносим клиентов вместе с менеджером; `moveClients: false` отключает. */
  const moveClients = body.moveClients !== false;

  const cur = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid LIMIT 1`,
    [userId],
  );
  const fromTeamId = cur.rows[0]?.team_id ?? null;

  const ur = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1::uuid`, [userId]);
  const platformRole = String(ur.rows[0]?.role ?? "manager");
  const roleInTeamOverride = typeof body.roleInTeam === "string" ? body.roleInTeam.trim().slice(0, 64) : "";
  const roleInTeam = roleInTeamOverride || platformRole;

  let clientsTouched = 0;

  const prevClients =
    moveClients && toTeamId
      ? await pool.query<{ client_code: string; team_id: string | null }>(
          `SELECT client_code, team_id FROM client_assignments WHERE responsible_user_id = $1::uuid`,
          [userId],
        )
      : { rows: [] as { client_code: string; team_id: string | null }[] };

  await pool.query(`DELETE FROM user_team_memberships WHERE user_id = $1::uuid`, [userId]);
  if (toTeamId) {
    await pool.query(
      `INSERT INTO user_team_memberships (user_id, team_id, role_in_team) VALUES ($1::uuid, $2::uuid, $3)`,
      [userId, toTeamId, roleInTeam],
    );
  }
  await pool.query(
    `INSERT INTO user_team_history (user_id, from_team_id, to_team_id, role_in_team, actor_user_id, reason)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6)`,
    [userId, fromTeamId, toTeamId, roleInTeam, me.id, reason || null],
  );

  if (moveClients && toTeamId) {
    await pool.query(`UPDATE client_assignments SET team_id = $1::uuid, updated_at = now() WHERE responsible_user_id = $2::uuid`, [
      toTeamId,
      userId,
    ]);
    clientsTouched = prevClients.rows.length;
    for (const row of prevClients.rows) {
      await pool.query(
        `INSERT INTO client_assignment_history (client_code, from_user_id, to_user_id, from_team_id, to_team_id, actor_user_id, reason)
         VALUES ($1, $2::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6)`,
        [row.client_code, userId, row.team_id, toTeamId, me.id, "team-change"],
      );
    }
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "user.team_reassign",
    entityType: "user",
    entityId: userId,
    metadata: { fromTeamId, toTeamId, moveClients, clientsTouched },
  });

  sendJson(res, 200, { success: true, fromTeamId, toTeamId, clientsTouched });
}

export async function handleClientsAssignmentsList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director" && me.role !== "rop")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const q = req.query ?? {};
  const userIdFilters = normalizeUuidArray(qsParamArray(q, "userId", "responsibleUserId"));
  const teamIds = normalizeUuidArray(qsParamArray(q, "teamId"));
  const searchRaw = qsParam(q, "search", "q");
  const searchFrag = searchRaw ? sanitizeLikeFragment(searchRaw) : "";
  const city = normalizeStringArray(qsParamArray(q, "city"));
  const category = normalizeCategoryArray(qsParamArray(q, "category"));
  const regionalManager = normalizeStringArray(qsParamArray(q, "regionalManager"));
  const rop = normalizeStringArray(qsParamArray(q, "rop"));
  const clientCodes = normalizeClientCodeArray(qsParamArray(q, "clientCode", "clientCodes"));
  const tradePointIds = normalizeTradePointIdArray(qsParamArray(q, "tradePointId", "tradePointIds"));
  const limitRaw = qsParam(q, "limit");
  const offsetRaw = qsParam(q, "offset");
  let limit = 50;
  if (limitRaw) {
    const n = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 200) limit = n;
  }
  let offset = 0;
  if (offsetRaw) {
    const n = Number.parseInt(offsetRaw, 10);
    if (Number.isFinite(n) && n >= 0) offset = n;
  }

  const cond: string[] = ["1=1"];
  const params: unknown[] = [];
  if (userIdFilters?.length) {
    params.push(userIdFilters);
    cond.push(`ca.responsible_user_id = ANY($${params.length}::uuid[])`);
  }
  if (teamIds?.length) {
    params.push(teamIds);
    cond.push(`ca.team_id = ANY($${params.length}::uuid[])`);
  }
  if (clientCodes?.length) {
    params.push(clientCodes);
    cond.push(`ca.client_code = ANY($${params.length}::text[])`);
  }
  if (tradePointIds?.length) {
    params.push(tradePointIds);
    cond.push(
      `EXISTS (
         SELECT 1 FROM trade_points tp
         JOIN dealers d ON d.id = tp.dealer_id
         WHERE upper(replace(d.external_key, 'client-', '')) = ca.client_code
           AND tp.id::text = ANY($${params.length}::text[])
       )`,
    );
  }
  appendDealerOverrideFilters(cond, params, {
    searchFrag: searchFrag || undefined,
    city,
    category,
    regionalManager,
    rop,
  });
  if (me.role === "rop") {
    const myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
      return;
    }
    params.push(myTeam);
    cond.push(`ca.team_id = $${params.length}::uuid`);
  }

  params.push(limit);
  const limPos = params.length;
  params.push(offset);
  const offPos = params.length;

  const whereSql = cond.join(" AND ");
  const cnt = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::bigint AS n
     FROM client_assignments ca
     ${DEALER_OVERRIDE_JOIN}
     WHERE ${whereSql}`,
    params.slice(0, -2),
  );
  const total = Number(cnt.rows[0]?.n ?? 0);

  const rows = await pool.query<{
    client_code: string;
    responsible_user_id: string;
    responsible_full_name: string;
    team_id: string | null;
    team_name: string | null;
    since: string;
    updated_at: string;
    client_name: string | null;
    client_city: string | null;
    client_category: string | null;
    regional_manager_name: string | null;
    regional_manager_id: string | null;
    rop_name: string | null;
  }>(
    `SELECT ca.client_code,
            ca.responsible_user_id,
            u.full_name AS responsible_full_name,
            ca.team_id,
            t.name AS team_name,
            ca.since,
            ca.updated_at,
            dov.name AS client_name,
            dov.city AS client_city,
            dov.client_category AS client_category,
            dov.regional_manager_name AS regional_manager_name,
            dov.regional_manager_id AS regional_manager_id,
            dov.rop_name AS rop_name
     FROM client_assignments ca
     JOIN users u ON u.id = ca.responsible_user_id
     LEFT JOIN teams t ON t.id = ca.team_id
     ${DEALER_OVERRIDE_JOIN}
     WHERE ${whereSql}
     ORDER BY ca.client_code ASC
     LIMIT $${limPos} OFFSET $${offPos}`,
    params,
  );

  sendJson(res, 200, {
    success: true,
    items: rows.rows.map((r) => ({
      clientCode: r.client_code,
      responsibleUserId: r.responsible_user_id,
      responsibleFullName: r.responsible_full_name,
      teamId: r.team_id,
      teamName: r.team_name ?? null,
      since: r.since,
      updatedAt: r.updated_at,
      clientName: r.client_name ?? null,
      city: r.client_city ?? null,
      clientCategory: r.client_category ?? null,
      regionalManagerName: r.regional_manager_name ?? null,
      regionalManagerId: r.regional_manager_id ?? null,
      ropName: r.rop_name ?? null,
    })),
    total,
  });
}

export async function handleClientAssignmentFilterOptions(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director" && me.role !== "rop")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const q = req.query ?? {};
  const type = qsParam(q, "type");
  const searchRaw = qsParam(q, "q");
  const searchFrag = searchRaw ? sanitizeLikeFragment(searchRaw) : "";
  const limitRaw = qsParam(q, "limit");
  let limit = 100;
  if (limitRaw) {
    const n = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(n) && n >= 1) limit = Math.min(n, 500);
  }

  let myTeam: string | null = null;
  let ropTeamCond = "";
  const baseParams: unknown[] = [];
  if (me.role === "rop") {
    myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
      return;
    }
    baseParams.push(myTeam);
    ropTeamCond = `AND ca.team_id = $${baseParams.length}::uuid`;
  }

  if (type === "regionalManagers") {
    const params = [...baseParams];
    let teamCond = "";
    if (myTeam) {
      teamCond = `AND m.team_id = $1::uuid`;
    }
    const rows = await pool.query<{ id: string; full_name: string; role: string }>(
      `SELECT DISTINCT u.id, u.full_name, u.role
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       WHERE u.status = 'active'
         AND (u.role = 'regional_manager' OR m.role_in_team = 'regional_manager')
         ${teamCond}
       ORDER BY u.full_name ASC
       LIMIT ${limit}`,
      params,
    );
    sendJson(res, 200, {
      success: true,
      managers: rows.rows.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role })),
    });
    return;
  }

  if (type === "managers") {
    const params = [...baseParams];
    let teamCond = "";
    if (myTeam) {
      teamCond = `AND m.team_id = $1::uuid`;
    }
    const rows = await pool.query<{ id: string; full_name: string; role: string }>(
      `SELECT DISTINCT u.id, u.full_name, u.role
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       WHERE u.status = 'active'
         AND (u.role = 'manager' OR m.role_in_team = 'manager')
         ${teamCond}
       ORDER BY u.full_name ASC
       LIMIT ${limit}`,
      params,
    );
    sendJson(res, 200, {
      success: true,
      managers: rows.rows.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role })),
    });
    return;
  }

  if (type === "tradePoints") {
    const params = [...baseParams];
    const cond: string[] = ["1=1"];
    if (searchFrag) {
      params.push(`%${searchFrag}%`);
      cond.push(
        `(COALESCE(tpo.name, tp.name, '') ILIKE $${params.length} OR COALESCE(tpo.city, tp.city, '') ILIKE $${params.length} OR upper(replace(d.external_key, 'client-', '')) ILIKE $${params.length})`,
      );
    }
    const whereSql = cond.join(" AND ");
    const rows = await pool.query<{ id: string; name: string | null; dealer_code: string | null; city: string | null }>(
      `SELECT tp.id::text AS id,
              COALESCE(tpo.name, tp.name) AS name,
              upper(replace(d.external_key, 'client-', '')) AS dealer_code,
              COALESCE(tpo.city, tp.city) AS city
       FROM trade_points tp
       JOIN dealers d ON d.id = tp.dealer_id
       LEFT JOIN trade_point_overrides tpo ON tpo.tp_id = tp.id::text
       JOIN client_assignments ca ON upper(replace(d.external_key, 'client-', '')) = ca.client_code
       WHERE ${whereSql} ${ropTeamCond}
       ORDER BY name ASC NULLS LAST
       LIMIT ${limit}`,
      params,
    );
    sendJson(res, 200, {
      success: true,
      tradePoints: rows.rows.map((r) => ({
        id: r.id,
        name: r.name ?? "",
        dealerCode: r.dealer_code ?? "",
        city: r.city ?? "",
      })),
    });
    return;
  }

  if (type === "clientCodes") {
    const params = [...baseParams];
    const cond: string[] = ["1=1"];
    if (searchFrag) {
      params.push(`%${searchFrag}%`);
      cond.push(`(ca.client_code ILIKE $${params.length} OR dov.name ILIKE $${params.length})`);
    }
    const whereSql = cond.join(" AND ");
    const rows = await pool.query<{ code: string; name: string | null; city: string | null }>(
      `SELECT ca.client_code AS code, dov.name, dov.city
       FROM client_assignments ca
       LEFT JOIN dealer_overrides dov ON upper(regexp_replace(dov.dealer_id, '^client-', '')) = ca.client_code
       WHERE ${whereSql} ${ropTeamCond}
       ORDER BY ca.client_code ASC
       LIMIT ${limit}`,
      params,
    );
    sendJson(res, 200, {
      success: true,
      clientCodes: rows.rows.map((r) => ({
        code: r.code,
        name: r.name ?? "",
        city: r.city ?? "",
      })),
    });
    return;
  }

  async function distinctField(column: string): Promise<string[]> {
    const r = await pool.query<{ value: string }>(
      `SELECT DISTINCT btrim(${column}) AS value
       FROM client_assignments ca
       JOIN dealer_overrides dov ON upper(regexp_replace(dov.dealer_id, '^client-', '')) = ca.client_code
       WHERE ${column} IS NOT NULL AND btrim(${column}) <> '' ${ropTeamCond}
       ORDER BY value ASC`,
      baseParams,
    );
    return r.rows.map((row) => row.value).filter(Boolean);
  }

  const [cities, categories, regionalManagers, rops] = await Promise.all([
    distinctField("dov.city"),
    distinctField("dov.client_category"),
    distinctField("dov.regional_manager_name"),
    distinctField("dov.rop_name"),
  ]);

  sendJson(res, 200, {
    success: true,
    cities,
    categories,
    regionalManagers,
    rops,
  });
}

export async function handleClientAssignmentHistory(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director" && me.role !== "rop")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const q = req.query ?? {};
  const code = typeof q.clientCode === "string" ? q.clientCode.trim() : Array.isArray(q.clientCode) ? String(q.clientCode[0] ?? "").trim() : "";
  if (!code) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientCode." });
    return;
  }
  if (me.role === "rop") {
    const chk = await pool.query(
      `SELECT 1 FROM client_assignments ca JOIN teams t ON t.id = ca.team_id WHERE ca.client_code = $1 AND t.rop_user_id = $2::uuid LIMIT 1`,
      [code, me.id],
    );
    if (chk.rows.length === 0) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Клиент вне вашей команды." });
      return;
    }
  }
  const rows = await pool.query<{
    id: string;
    client_code: string;
    from_user_id: string | null;
    to_user_id: string | null;
    from_team_id: string | null;
    to_team_id: string | null;
    actor_user_id: string | null;
    actor_full_name: string | null;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT h.id, h.client_code, h.from_user_id, h.to_user_id, h.from_team_id, h.to_team_id, h.actor_user_id, h.reason, h.created_at,
            au.full_name AS actor_full_name
     FROM client_assignment_history h
     LEFT JOIN users au ON au.id = h.actor_user_id
     WHERE h.client_code = $1
     ORDER BY h.created_at DESC
     LIMIT 200`,
    [code],
  );
  sendJson(res, 200, {
    success: true,
    items: rows.rows.map((r) => ({
      id: r.id,
      clientCode: r.client_code,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromTeamId: r.from_team_id,
      toTeamId: r.to_team_id,
      actorUserId: r.actor_user_id,
      actorFullName: r.actor_full_name,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  });
}

export async function handleUserTeamHistory(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director" && me.role !== "rop")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const q = req.query ?? {};
  const userId = typeof q.userId === "string" ? q.userId.trim() : Array.isArray(q.userId) ? String(q.userId[0] ?? "").trim() : "";
  if (!UUID_RE.test(userId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите userId." });
    return;
  }
  if (me.role === "rop") {
    const myTeam = await resolveRopTeamId(pool, me.id);
    if (!myTeam) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
      return;
    }
    const ok = await pool.query(
      `SELECT 1 FROM user_team_memberships WHERE user_id = $1::uuid AND team_id = $2::uuid LIMIT 1`,
      [userId, myTeam],
    );
    if (ok.rows.length === 0) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Пользователь вне вашей команды." });
      return;
    }
  }
  const rows = await pool.query<{
    id: string;
    user_id: string;
    from_team_id: string | null;
    to_team_id: string | null;
    role_in_team: string | null;
    actor_user_id: string | null;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT id, user_id, from_team_id, to_team_id, role_in_team, actor_user_id, reason, created_at
     FROM user_team_history WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  sendJson(res, 200, {
    success: true,
    items: rows.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      fromTeamId: r.from_team_id,
      toTeamId: r.to_team_id,
      roleInTeam: r.role_in_team,
      actorUserId: r.actor_user_id,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  });
}

export async function handleTeamsList(
  _req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director" && me.role !== "rop")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (me.role === "rop") {
    const rows = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM teams WHERE rop_user_id = $1::uuid ORDER BY name ASC`,
      [me.id],
    );
    sendJson(res, 200, { success: true, teams: rows.rows });
    return;
  }
  const rows = await pool.query<{ id: string; name: string }>(`SELECT id, name FROM teams ORDER BY name ASC`);
  sendJson(res, 200, { success: true, teams: rows.rows });
}

function assertDirectorOrAdmin(me: SessionUser, res: VercelResponse): boolean {
  if (me.status !== "active" || (me.role !== "admin" && me.role !== "director")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

export async function handleRopGrantsList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertDirectorOrAdmin(me, res)) return;
  const ropUserId = qsParam(req.query as Record<string, unknown>, "ropUserId");
  if (!ropUserId || !UUID_RE.test(ropUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный ropUserId." });
    return;
  }
  const rows = await pool.query<{
    id: string;
    rop_user_id: string;
    client_code: string | null;
    trade_point_id: string | null;
    granted_by: string | null;
    created_at: string;
    reason: string | null;
    client_name: string | null;
    trade_point_name: string | null;
  }>(
    `SELECT g.id, g.rop_user_id, g.client_code, g.trade_point_id, g.granted_by, g.created_at, g.reason,
            dov.name AS client_name,
            tpo.name AS trade_point_name
     FROM rop_client_grants g
     LEFT JOIN dealer_overrides dov
       ON g.client_code IS NOT NULL
      AND upper(regexp_replace(dov.dealer_id, '^client-', '')) = upper(g.client_code)
     LEFT JOIN trade_point_overrides tpo ON tpo.tp_id = g.trade_point_id
     WHERE g.rop_user_id = $1::uuid
     ORDER BY g.created_at DESC`,
    [ropUserId],
  );
  sendJson(res, 200, {
    success: true,
    grants: rows.rows.map((r) => ({
      id: r.id,
      ropUserId: r.rop_user_id,
      clientCode: r.client_code,
      tradePointId: r.trade_point_id,
      grantedBy: r.granted_by,
      createdAt: r.created_at,
      reason: r.reason,
      clientName: r.client_name,
      tradePointName: r.trade_point_name,
    })),
  });
}

export async function handleRopGrantsAdd(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertDirectorOrAdmin(me, res)) return;
  const body = (req.body ?? {}) as {
    ropUserId?: unknown;
    clientCodes?: unknown;
    tradePointIds?: unknown;
    reason?: unknown;
  };
  const ropUserId = typeof body.ropUserId === "string" ? body.ropUserId.trim() : "";
  if (!UUID_RE.test(ropUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный ropUserId." });
    return;
  }
  const clientCodes = Array.isArray(body.clientCodes)
    ? body.clientCodes
        .filter((c): c is string => typeof c === "string" && c.trim() !== "")
        .map((c) => c.trim().toUpperCase())
    : [];
  const tradePointIds = Array.isArray(body.tradePointIds)
    ? body.tradePointIds.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim())
    : [];
  const total = clientCodes.length + tradePointIds.length;
  if (total === 0) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Укажите clientCodes или tradePointIds.",
    });
    return;
  }
  if (total > 1000) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Не более 1000 грантов за один запрос.",
    });
    return;
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  let added = 0;
  for (const code of clientCodes) {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO rop_client_grants (rop_user_id, client_code, granted_by, reason)
       VALUES ($1::uuid, $2, $3::uuid, $4)
       ON CONFLICT (rop_user_id, client_code) WHERE client_code IS NOT NULL DO NOTHING
       RETURNING id`,
      [ropUserId, code, me.id, reason],
    );
    if (ins.rows.length > 0) added += 1;
  }
  for (const tpId of tradePointIds) {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO rop_client_grants (rop_user_id, trade_point_id, granted_by, reason)
       VALUES ($1::uuid, $2, $3::uuid, $4)
       ON CONFLICT (rop_user_id, trade_point_id) WHERE trade_point_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [ropUserId, tpId, me.id, reason],
    );
    if (ins.rows.length > 0) added += 1;
  }
  await tryAudit(pool, {
    actorUserId: me.id,
    action: "rop_client_grants.add",
    entityType: "rop_client_grants",
    entityId: ropUserId,
    metadata: { clientCodes, tradePointIds, added, reason },
  });
  sendJson(res, 200, { success: true, added });
}

export async function handleRopGrantsRemove(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertDirectorOrAdmin(me, res)) return;
  const body = (req.body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id.trim())).map((id) => id.trim())
    : [];
  if (ids.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ids грантов." });
    return;
  }
  const del = await pool.query(`DELETE FROM rop_client_grants WHERE id = ANY($1::uuid[])`, [ids]);
  await tryAudit(pool, {
    actorUserId: me.id,
    action: "rop_client_grants.remove",
    entityType: "rop_client_grants",
    entityId: ids.join(","),
    metadata: { ids, removed: del.rowCount ?? 0 },
  });
  sendJson(res, 200, { success: true, removed: del.rowCount ?? 0 });
}
