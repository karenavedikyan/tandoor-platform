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
  clientName?: string | null;
  city?: string | null;
  clientCategory?: string | null;
  regionalManagerName?: string | null;
  regionalManagerId?: string | null;
  ropName?: string | null;
};

export type ManagerOption = { id: string; fullName: string; role: string };
export type TradePointOption = { id: string; name: string; dealerCode: string; city: string };
export type ClientCodeOption = { code: string; name: string; city: string };

export type ClientAssignmentFilterOptions = {
  cities: string[];
  categories: string[];
  regionalManagers: string[];
  rops: string[];
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

export type RopClientGrantRow = {
  id: string;
  ropUserId: string;
  clientCode: string | null;
  tradePointId: string | null;
  grantedBy: string | null;
  createdAt: string;
  reason: string | null;
  clientName?: string | null;
  tradePointName?: string | null;
};

export type ListAssignmentsParams = {
  limit?: number;
  offset?: number;
  search?: string;
  userId?: string[];
  teamId?: string[];
  city?: string[];
  category?: string[];
  regionalManager?: string[];
  rop?: string[];
  clientCodes?: string[];
  tradePointIds?: string[];
};

export type ReassignFilter = {
  fromUserId?: string;
  responsibleUserId?: string[];
  managerUserId?: string[];
  fromTeamId?: string[];
  city?: string[];
  category?: string[];
  regionalManager?: string[];
  rop?: string[];
  search?: string;
  clientCodes?: string[];
  tradePointIds?: string[];
};

export type ReassignClientsFilter = ReassignFilter;

function appendQueryArray(sp: URLSearchParams, key: string, values?: string[]): void {
  if (!values?.length) return;
  for (const v of values) {
    const t = v.trim();
    if (t) sp.append(key, t);
  }
}

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
  const clientName = r.clientName === null || r.clientName === undefined ? null : typeof r.clientName === "string" ? r.clientName : null;
  const city = r.city === null || r.city === undefined ? null : typeof r.city === "string" ? r.city : null;
  const clientCategory =
    r.clientCategory === null || r.clientCategory === undefined
      ? null
      : typeof r.clientCategory === "string"
        ? r.clientCategory
        : null;
  const regionalManagerName =
    r.regionalManagerName === null || r.regionalManagerName === undefined
      ? null
      : typeof r.regionalManagerName === "string"
        ? r.regionalManagerName
        : null;
  const regionalManagerId =
    r.regionalManagerId === null || r.regionalManagerId === undefined
      ? null
      : typeof r.regionalManagerId === "string"
        ? r.regionalManagerId
        : null;
  const ropName = r.ropName === null || r.ropName === undefined ? null : typeof r.ropName === "string" ? r.ropName : null;
  return {
    clientCode,
    responsibleUserId,
    responsibleFullName,
    teamId,
    teamName,
    since,
    updatedAt,
    clientName,
    city,
    clientCategory,
    regionalManagerName,
    regionalManagerId,
    ropName,
  };
}

function parseStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
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
  appendQueryArray(sp, "userId", params.userId);
  appendQueryArray(sp, "teamId", params.teamId);
  appendQueryArray(sp, "city", params.city);
  appendQueryArray(sp, "category", params.category);
  appendQueryArray(sp, "regionalManager", params.regionalManager);
  appendQueryArray(sp, "rop", params.rop);
  appendQueryArray(sp, "clientCodes", params.clientCodes);
  appendQueryArray(sp, "tradePointIds", params.tradePointIds);
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

export async function listAssignmentFilterOptions(): Promise<
  { ok: true; options: ClientAssignmentFilterOptions } | { ok: false; code: string; message: string }
> {
  const res = await fetch(`${ASSIGNMENTS_BASE}/client-assignment-filter-options`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить опции фильтров.") };
  }
  const cities = parseStringArray(body.cities);
  const categories = parseStringArray(body.categories);
  const regionalManagers = parseStringArray(body.regionalManagers);
  const rops = parseStringArray(body.rops);
  if (!cities || !categories || !regionalManagers || !rops) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  return { ok: true, options: { cities, categories, regionalManagers, rops } };
}

export async function fetchFilterOptions(
  type: "managers" | "regionalManagers" | "tradePoints" | "clientCodes",
  q?: string,
  limit?: number,
): Promise<
  | {
      ok: true;
      managers?: ManagerOption[];
      tradePoints?: TradePointOption[];
      clientCodes?: ClientCodeOption[];
    }
  | { ok: false; code: string; message: string }
> {
  const sp = new URLSearchParams({ type });
  if (q?.trim()) sp.set("q", q.trim());
  if (limit != null) sp.set("limit", String(limit));
  const res = await fetch(`${ASSIGNMENTS_BASE}/client-assignment-filter-options?${sp.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить опции фильтров.") };
  }
  if (type === "managers" || type === "regionalManagers") {
    const raw = body.managers;
    if (!Array.isArray(raw)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    const managers: ManagerOption[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      const fullName = typeof o.fullName === "string" ? o.fullName : null;
      const role = typeof o.role === "string" ? o.role : null;
      if (!id || !fullName || !role) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
      managers.push({ id, fullName, role });
    }
    return { ok: true, managers };
  }
  if (type === "tradePoints") {
    const raw = body.tradePoints;
    if (!Array.isArray(raw)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    const tradePoints: TradePointOption[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      const name = typeof o.name === "string" ? o.name : "";
      const dealerCode = typeof o.dealerCode === "string" ? o.dealerCode : "";
      const city = typeof o.city === "string" ? o.city : "";
      if (!id) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
      tradePoints.push({ id, name, dealerCode, city });
    }
    return { ok: true, tradePoints };
  }
  const raw = body.clientCodes;
  if (!Array.isArray(raw)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  const clientCodes: ClientCodeOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    const o = item as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code : null;
    const name = typeof o.name === "string" ? o.name : "";
    const city = typeof o.city === "string" ? o.city : "";
    if (!code) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    clientCodes.push({ code, name, city });
  }
  return { ok: true, clientCodes };
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
  clientCodes?: string[];
  filter?: ReassignClientsFilter;
  toUserId: string;
  reason?: string;
}): Promise<{ ok: true; reassigned: number } | { ok: false; code: string; message: string }> {
  const payload: Record<string, unknown> = {
    toUserId: input.toUserId,
    reason: input.reason,
  };
  if (input.filter) {
    const f = input.filter;
    const filter: Record<string, unknown> = {};
    if (f.fromUserId) filter.fromUserId = f.fromUserId;
    if (f.responsibleUserId?.length) filter.responsibleUserId = f.responsibleUserId;
    if (f.fromTeamId?.length) filter.fromTeamId = f.fromTeamId;
    if (f.city?.length) filter.city = f.city;
    if (f.category?.length) filter.category = f.category;
    if (f.regionalManager?.length) filter.regionalManager = f.regionalManager;
    if (f.rop?.length) filter.rop = f.rop;
    if (f.search?.trim()) filter.search = f.search.trim();
    if (f.clientCodes?.length) filter.clientCodes = f.clientCodes;
    if (f.tradePointIds?.length) filter.tradePointIds = f.tradePointIds;
    payload.filter = filter;
  } else if (input.clientCodes) {
    payload.clientCodes = input.clientCodes;
  }
  const res = await fetch(`${ASSIGNMENTS_BASE}/clients-reassign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось переназначить клиентов.") };
  }
  const reassigned = typeof body.reassigned === "number" ? body.reassigned : Number(body.reassigned);
  if (!Number.isFinite(reassigned)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, reassigned };
}

export async function reassignRegionalManager(params: {
  toUserId: string | null;
  reason?: string;
  clientCodes?: string[];
  tradePointIds?: string[];
  filter?: ReassignFilter;
  cascadeTradePoints?: boolean;
}): Promise<
  | { ok: true; dealersAffected: number; tradePointsAffected: number; message?: string }
  | { ok: false; code: string; message: string }
> {
  const payload: Record<string, unknown> = {
    toUserId: params.toUserId,
    reason: params.reason,
    cascadeTradePoints: params.cascadeTradePoints,
  };
  if (params.filter) {
    const f = params.filter;
    const filter: Record<string, unknown> = {};
    if (f.fromUserId) filter.fromUserId = f.fromUserId;
    if (f.responsibleUserId?.length) filter.responsibleUserId = f.responsibleUserId;
    if (f.managerUserId?.length) filter.managerUserId = f.managerUserId;
    if (f.fromTeamId?.length) filter.fromTeamId = f.fromTeamId;
    if (f.city?.length) filter.city = f.city;
    if (f.category?.length) filter.category = f.category;
    if (f.regionalManager?.length) filter.regionalManager = f.regionalManager;
    if (f.rop?.length) filter.rop = f.rop;
    if (f.search?.trim()) filter.search = f.search.trim();
    if (f.clientCodes?.length) filter.clientCodes = f.clientCodes;
    if (f.tradePointIds?.length) filter.tradePointIds = f.tradePointIds;
    payload.filter = filter;
  } else if (params.clientCodes?.length) {
    payload.clientCodes = params.clientCodes;
  }
  if (params.tradePointIds?.length) payload.tradePointIds = params.tradePointIds;
  const res = await fetch(`${ASSIGNMENTS_BASE}/regional-manager-reassign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось переназначить регионала.") };
  }
  const dealersAffected = typeof body.dealersAffected === "number" ? body.dealersAffected : Number(body.dealersAffected);
  const tradePointsAffected =
    typeof body.tradePointsAffected === "number" ? body.tradePointsAffected : Number(body.tradePointsAffected);
  if (!Number.isFinite(dealersAffected) || !Number.isFinite(tradePointsAffected)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  return { ok: true, dealersAffected, tradePointsAffected };
}

function parseRopGrantRow(raw: unknown): RopClientGrantRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const ropUserId = typeof r.ropUserId === "string" ? r.ropUserId : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !ropUserId || !createdAt) return null;
  return {
    id,
    ropUserId,
    clientCode: r.clientCode === null ? null : typeof r.clientCode === "string" ? r.clientCode : null,
    tradePointId: r.tradePointId === null ? null : typeof r.tradePointId === "string" ? r.tradePointId : null,
    grantedBy: r.grantedBy === null ? null : typeof r.grantedBy === "string" ? r.grantedBy : null,
    createdAt,
    reason: r.reason === null ? null : typeof r.reason === "string" ? r.reason : null,
    clientName:
      r.clientName === null || r.clientName === undefined
        ? null
        : typeof r.clientName === "string"
          ? r.clientName
          : null,
    tradePointName:
      r.tradePointName === null || r.tradePointName === undefined
        ? null
        : typeof r.tradePointName === "string"
          ? r.tradePointName
          : null,
  };
}

export async function listRopGrants(
  ropUserId: string,
): Promise<{ ok: true; grants: RopClientGrantRow[] } | { ok: false; code: string; message: string }> {
  const q = new URLSearchParams({ ropUserId: ropUserId.trim() });
  const res = await fetch(`${ASSIGNMENTS_BASE}/rop-grants?${q.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить гранты РОПа.") };
  }
  const rawGrants = body.grants;
  if (!Array.isArray(rawGrants)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  const grants: RopClientGrantRow[] = [];
  for (const row of rawGrants) {
    const p = parseRopGrantRow(row);
    if (!p) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    grants.push(p);
  }
  return { ok: true, grants };
}

export async function addRopGrants(input: {
  ropUserId: string;
  clientCodes?: string[];
  tradePointIds?: string[];
  reason?: string;
}): Promise<{ ok: true; added: number } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${ASSIGNMENTS_BASE}/rop-grants-add`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ropUserId: input.ropUserId,
      clientCodes: input.clientCodes,
      tradePointIds: input.tradePointIds,
      reason: input.reason,
    }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось выдать доступ РОПу.") };
  }
  const added = typeof body.added === "number" ? body.added : Number(body.added);
  if (!Number.isFinite(added)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  return { ok: true, added };
}

export async function removeRopGrants(
  ids: string[],
): Promise<{ ok: true; removed: number } | { ok: false; code: string; message: string }> {
  const res = await fetch(`${ASSIGNMENTS_BASE}/rop-grants-remove`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось снять доступ РОПа.") };
  }
  const removed = typeof body.removed === "number" ? body.removed : Number(body.removed);
  if (!Number.isFinite(removed)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  return { ok: true, removed };
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
