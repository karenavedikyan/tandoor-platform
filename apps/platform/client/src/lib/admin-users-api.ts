/**
 * Клиентские запросы к `/api/admin/users-*` (управление пользователями).
 */

import type { UserRole, UserStatus } from "@shared/auth";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  telegramUserId: number | null;
};

export type ListUsersParams = {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  limit?: number;
  offset?: number;
};

export type ListUsersResult = { users: AdminUser[]; total: number };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseAdminUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const email = typeof r.email === "string" ? r.email : null;
  const fullName = typeof r.fullName === "string" ? r.fullName : null;
  const role = r.role as UserRole;
  const status = r.status as UserStatus;
  const mustChangePassword = typeof r.mustChangePassword === "boolean" ? r.mustChangePassword : null;
  const lastLoginAt = r.lastLoginAt === null ? null : typeof r.lastLoginAt === "string" ? r.lastLoginAt : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !email || !fullName || !createdAt) return null;
  if (status !== "invited" && status !== "active" && status !== "disabled") return null;
  const tgRaw = r.telegramUserId;
  let telegramUserId: number | null = null;
  if (tgRaw === null) telegramUserId = null;
  else if (typeof tgRaw === "number" && Number.isFinite(tgRaw)) telegramUserId = tgRaw;
  else if (typeof tgRaw === "string" && tgRaw.trim()) {
    const n = Number(tgRaw.trim());
    telegramUserId = Number.isFinite(n) ? n : null;
  }

  if (mustChangePassword === null) return null;
  return {
    id,
    email,
    fullName,
    role,
    status,
    mustChangePassword,
    lastLoginAt,
    createdAt,
    telegramUserId,
  };
}

function errFromBody(body: Record<string, unknown>, fallback: string): { code: string; message: string } {
  const code = typeof body.code === "string" ? body.code : "UNKNOWN";
  const message = typeof body.message === "string" ? body.message : fallback;
  return { code, message };
}

export async function listUsers(
  params: ListUsersParams,
): Promise<{ ok: true; result: ListUsersResult } | { ok: false; code: string; message: string }> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.role) sp.set("role", params.role);
  if (params.status) sp.set("status", params.status);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  const url = qs ? `/api/admin/users-list?${qs}` : "/api/admin/users-list";
  const res = await fetch(url, { method: "GET", credentials: "same-origin" });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить пользователей.") };
  }
  const total = typeof body.total === "number" ? body.total : Number(body.total);
  const rawUsers = body.users;
  if (!Array.isArray(rawUsers) || !Number.isFinite(total)) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  const users: AdminUser[] = [];
  for (const row of rawUsers) {
    const u = parseAdminUser(row);
    if (!u) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
    users.push(u);
  }
  return { ok: true, result: { users, total } };
}

export async function getUser(
  id: string,
): Promise<{ ok: true; user: AdminUser } | { ok: false; code: string; message: string }> {
  const res = await fetch(`/api/admin/users-get?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось загрузить пользователя.") };
  }
  const user = parseAdminUser(body.user);
  if (!user) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, user };
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<{ ok: true; user: AdminUser } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/users-update-role", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, role }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось обновить роль.") };
  }
  const user = parseAdminUser(body.user);
  if (!user) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, user };
}

export async function updateUserStatus(
  id: string,
  status: "active" | "disabled",
): Promise<{ ok: true; user: AdminUser } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/users-update-status", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось обновить статус.") };
  }
  const user = parseAdminUser(body.user);
  if (!user) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, user };
}

export async function resetUserPassword(
  id: string,
): Promise<{ ok: true; tempPassword: string; user: AdminUser } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/users-reset-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось сбросить пароль.") };
  }
  const tempPassword = typeof body.tempPassword === "string" ? body.tempPassword : null;
  const user = parseAdminUser(body.user);
  if (!tempPassword || !user) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, tempPassword, user };
}

export async function updateUserTelegram(
  id: string,
  telegramUserId: number | null,
): Promise<{ ok: true; user: AdminUser } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/users-update", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, telegramUserId }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось сохранить Telegram user-id.") };
  }
  const user = parseAdminUser(body.user);
  if (!user) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, user };
}
