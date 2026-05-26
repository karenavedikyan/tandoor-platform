/**
 * Лёгкие admin-эндпоинты для client_assignments / user_team (без client seed).
 * Импортируется только из `api/admin/[action].ts`.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin-auth.js";

export type SessionUser = {
  id: string;
  role: string;
  status: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const f = body.filter as { fromUserId?: unknown; fromTeamId?: unknown };
    const fromUserId = typeof f.fromUserId === "string" && UUID_RE.test(f.fromUserId) ? f.fromUserId : null;
    const fromTeamId = typeof f.fromTeamId === "string" && UUID_RE.test(f.fromTeamId) ? f.fromTeamId : null;
    if (!fromUserId && !fromTeamId) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите clientCodes или filter.fromUserId / fromTeamId." });
      return;
    }
    let q = `SELECT client_code FROM client_assignments WHERE 1=1`;
    const pr: unknown[] = [];
    if (fromUserId) {
      pr.push(fromUserId);
      q += ` AND responsible_user_id = $${pr.length}::uuid`;
    }
    if (fromTeamId) {
      pr.push(fromTeamId);
      q += ` AND team_id = $${pr.length}::uuid`;
    }
    if (me.role === "rop") {
      const myTeam = await resolveRopTeamId(pool, me.id);
      if (!myTeam) {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Не найдена команда РОПа." });
        return;
      }
      pr.push(myTeam);
      q += ` AND team_id = $${pr.length}::uuid`;
    }
    q += ` LIMIT 1000`;
    const sel = await pool.query<{ client_code: string }>(q, pr);
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
  const moveClients = body.moveClients === true;

  const cur = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid LIMIT 1`,
    [userId],
  );
  const fromTeamId = cur.rows[0]?.team_id ?? null;

  const ur = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1::uuid`, [userId]);
  const platformRole = String(ur.rows[0]?.role ?? "manager");

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
      [userId, toTeamId, platformRole],
    );
  }
  await pool.query(
    `INSERT INTO user_team_history (user_id, from_team_id, to_team_id, role_in_team, actor_user_id, reason)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6)`,
    [userId, fromTeamId, toTeamId, platformRole, me.id, reason || null],
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
  const qs = (v: unknown): string | undefined => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
    return undefined;
  };
  const responsibleUserId = qs(q.responsibleUserId);
  const teamId = qs(q.teamId);
  const limitRaw = qs(q.limit);
  const offsetRaw = qs(q.offset);
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
  if (responsibleUserId && UUID_RE.test(responsibleUserId)) {
    params.push(responsibleUserId);
    cond.push(`ca.responsible_user_id = $${params.length}::uuid`);
  }
  if (teamId && UUID_RE.test(teamId)) {
    params.push(teamId);
    cond.push(`ca.team_id = $${params.length}::uuid`);
  }
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
    `SELECT COUNT(*)::bigint AS n FROM client_assignments ca WHERE ${whereSql}`,
    params.slice(0, -2),
  );
  const total = Number(cnt.rows[0]?.n ?? 0);

  const rows = await pool.query<{
    client_code: string;
    responsible_user_id: string;
    responsible_full_name: string;
    team_id: string | null;
    since: string;
    updated_at: string;
  }>(
    `SELECT ca.client_code, ca.responsible_user_id, u.full_name AS responsible_full_name, ca.team_id, ca.since, ca.updated_at
     FROM client_assignments ca
     JOIN users u ON u.id = ca.responsible_user_id
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
      since: r.since,
      updatedAt: r.updated_at,
    })),
    total,
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
  const rows = await pool.query(
    `SELECT id, client_code, from_user_id, to_user_id, from_team_id, to_team_id, actor_user_id, reason, created_at
     FROM client_assignment_history WHERE client_code = $1 ORDER BY created_at DESC LIMIT 200`,
    [code],
  );
  sendJson(res, 200, { success: true, items: rows.rows });
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
  const rows = await pool.query(
    `SELECT id, user_id, from_team_id, to_team_id, role_in_team, actor_user_id, reason, created_at
     FROM user_team_history WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  sendJson(res, 200, { success: true, items: rows.rows });
}
