/**
 * Клиентские запросы к `/api/admin/client-assignments/*` и `GET /api/admin/teams-list`.
 */

const ASSIGNMENTS_BASE = "/api/admin/client-assignments";

export type ClientAssignmentRow = {
  clientCode: string;
  responsibleUserId: string;
  responsibleFullName: string;
  teamId: string | null;
  teamName?: string | null;
  since: string;
  updatedAt: string;
};

export type ClientAssignmentHistoryRow = {
  id: string;
  clientCode: string;
  fromUserId: string | null;
  toUserId: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  actorUserId: string | null;
  actorFullName?: string | null;
  reason: string | null;
  createdAt: string;
};

export type UserTeamHistoryRow = {
  id: string;
  userId: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  roleInTeam: string | null;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminTeamOption = { id: string; name: string };

export type ListAssignmentsParams = {
  limit?: number;
  offset?: number;
  search?: string;
  userId?: string;
  teamId?: string;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errFromBody(body: Record<string, unknown>, fallback: string): { code: string; message: string } {
  const code = typeof body.code === "string" ? body.code : "UNKNOWN";
  const message = typeof body.message === "string" ? body.message : fallback;
  return { code, message };
}

function parseAssignmentRow(raw: unknown): ClientAssignmentRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const clientCode = typeof r.clientCode === "string" ? r.clientCode : null;
  const responsibleUserId = typeof r.responsibleUserId === "string" ? r.responsibleUserId : null;
  const responsibleFullName = typeof r.responsibleFullName === "string" ? r.responsibleFullName : null;
  const since = typeof r.since === "string" ? r.since : null;
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : null;
  if (!clientCode || !responsibleUserId || !responsibleFullName || !since || !updatedAt) return null;
  const teamId = r.teamId === null ? null : typeof r.teamId === "string" ? r.teamId : null;
  const teamName = r.teamName === null || r.teamName === undefined ? null : typeof r.teamName === "string" ? r.teamName : null;
  return { clientCode, responsibleUserId, responsibleFullName, teamId, teamName, since, updatedAt };
}

function parseHistoryRow(raw: unknown): ClientAssignmentHistoryRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const clientCode = typeof r.clientCode === "string" ? r.clientCode : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !clientCode || !createdAt) return null;
  return {
    id,
    clientCode,
    fromUserId: r.fromUserId === null ? null : typeof r.fromUserId === "string" ? r.fromUserId : null,
    toUserId: r.toUserId === null ? null : typeof r.toUserId === "string" ? r.toUserId : null,
    fromTeamId: r.fromTeamId === null ? null : typeof r.fromTeamId === "string" ? r.fromTeamId : null,
    toTeamId: r.toTeamId === null ? null : typeof r.toTeamId === "string" ? r.toTeamId : null,
    actorUserId: r.actorUserId === null ? null : typeof r.actorUserId === "string" ? r.actorUserId : null,
    actorFullName:
      r.actorFullName === null || r.actorFullName === undefined
        ? null
        : typeof r.actorFullName === "string"
          ? r.actorFullName
          : null,
    reason: r.reason === null ? null : typeof r.reason === "string" ? r.reason : null,
    createdAt,
  };
}

function parseUserTeamHistoryRow(raw: unknown): UserTeamHistoryRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const userId = typeof r.userId === "string" ? r.userId : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !userId || !createdAt) return null;
  return {
    id,
    userId,
    fromTeamId: r.fromTeamId === null ? null : typeof r.fromTeamId === "string" ? r.fromTeamId : null,
    toTeamId: r.toTeamId === null ? null : typeof r.toTeamId === "string" ? r.toTeamId : null,
    roleInTeam: r.roleInTeam === null ? null : typeof r.roleInTeam === "string" ? r.roleInTeam : null,
    actorUserId: r.actorUserId === null ? null : typeof r.actorUserId === "string" ? r.actorUserId : null,
    reason: r.reason === null ? null : typeof r.reason === "string" ? r.reason : null,
    createdAt,
  };
}

export async function listAssignments(
  params: ListAssignmentsParams,
): Promise<{ ok: true; items: ClientAssignmentRow[]; total: number } | { ok: false; code: string; message: string }> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  if (params.search?.trim()) sp.set("search", params.search.trim());
  if (params.userId?.trim()) sp.set("userId", params.userId.trim());
  if (params.teamId?.trim()) sp.set("teamId", params.teamId.trim());
  const qs = sp.toString();
  const url = qs ? `${ASSIGNMENTS_BASE}/clients-assignments-list?${qs}` : `${ASSIGNMENTS_BASE}/clients-assignments-list`;
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить назначения.") };
  }
  const total = typeof body.total === "number" ? body.total : Number(body.total);
  const rawItems = body.items;
  if (!Array.isArray(rawItems) || !Number.isFinite(total)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  const items: ClientAssignmentRow[] = [];
  for (const row of rawItems) {
    const p = parseAssignmentRow(row);
    if (!p) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    items.push(p);
  }
  return { ok: true, items, total };
}

export async function listTeams(): Promise<{ ok: true; teams: AdminTeamOption[] } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/teams-list", { method: "GET", credentials: "include" });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить команды.") };
  }
  const raw = body.teams;
  if (!Array.isArray(raw)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  const teams: AdminTeamOption[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    const o = t as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const name = typeof o.name === "string" ? o.name : null;
    if (!id || !name) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    teams.push({ id, name });
  }
  return { ok: true, teams };
}

export async function getClientHistory(
  clientCode: string,
): Promise<{ ok: true; items: ClientAssignmentHistoryRow[] } | { ok: false; code: string; message: string }> {
  const q = new URLSearchParams({ clientCode: clientCode.trim() });
  const res = await fetch(`${ASSIGNMENTS_BASE}/client-assignment-history?${q.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить историю.") };
  }
  const rawItems = body.items;
  if (!Array.isArray(rawItems)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  const items: ClientAssignmentHistoryRow[] = [];
  for (const row of rawItems) {
    const p = parseHistoryRow(row);
    if (!p) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    items.push(p);
  }
  return { ok: true, items };
}

export async function getUserTeamHistory(
  userId: string,
): Promise<{ ok: true; items: UserTeamHistoryRow[] } | { ok: false; code: string; message: string }> {
  const q = new URLSearchParams({ userId: userId.trim() });
  const res = await fetch(`${ASSIGNMENTS_BASE}/user-team-history?${q.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить историю команд.") };
  }
  const rawItems = body.items;
  if (!Array.isArray(rawItems)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  const items: UserTeamHistoryRow[] = [];
  for (const row of rawItems) {
    const p = parseUserTeamHistoryRow(row);
    if (!p) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    items.push(p);
  }
  return { ok: true, items };
}

export async function reassignClients(input: {
  clientCodes: string[];
  toUserId: string;
  reason?: string;
}): Promise<{ ok: true; reassigned: number } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${ASSIGNMENTS_BASE}/clients-reassign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientCodes: input.clientCodes,
      toUserId: input.toUserId,
      reason: input.reason,
    }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось переназначить клиентов.") };
  }
  const reassigned = typeof body.reassigned === "number" ? body.reassigned : Number(body.reassigned);
  if (!Number.isFinite(reassigned)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, reassigned };
}

export async function reassignUserTeam(input: {
  userId: string;
  toTeamId: string;
  roleInTeam?: string;
  reason?: string;
  moveClients?: boolean;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${ASSIGNMENTS_BASE}/user-team-reassign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      toTeamId: input.toTeamId,
      roleInTeam: input.roleInTeam,
      reason: input.reason,
      moveClients: input.moveClients,
    }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось сменить команду.") };
  }
  return { ok: true };
}
