/**
 * Клиентские запросы к `/api/admin/profile-*` (собственный профиль).
 */

import type { UserRole, UserStatus } from "@shared/auth";

export type ProfileSelfDTO = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
};

export type ChangePasswordFailureCode =
  | "VALIDATION_ERROR"
  | "INVALID_PASSWORD"
  | "WEAK_PASSWORD"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseProfileUser(raw: unknown): ProfileSelfDTO | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const email = typeof r.email === "string" ? r.email : null;
  const fullName = r.fullName === null ? null : typeof r.fullName === "string" ? r.fullName : null;
  const phone = r.phone === null || r.phone === undefined ? null : typeof r.phone === "string" ? r.phone : null;
  const role = r.role as UserRole;
  const status = r.status as UserStatus;
  const mustChangePassword = typeof r.mustChangePassword === "boolean" ? r.mustChangePassword : null;
  const lastLoginAt = r.lastLoginAt === null ? null : typeof r.lastLoginAt === "string" ? r.lastLoginAt : null;
  const createdAt = r.createdAt === null || r.createdAt === undefined ? null : typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !email || mustChangePassword === null) return null;
  if (status !== "invited" && status !== "active" && status !== "disabled") return null;
  return {
    id,
    email,
    fullName,
    phone,
    role,
    status,
    mustChangePassword,
    lastLoginAt,
    createdAt,
  };
}

export async function getSelf(): Promise<ProfileSelfDTO> {
  const res = await fetch("/api/admin/profile-get-self", { method: "GET", credentials: "same-origin" });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось загрузить профиль.";
    throw new Error(message);
  }
  const u = parseProfileUser(j.user);
  if (!u) throw new Error("Некорректный ответ сервера.");
  return u;
}

export async function updateSelf(input: { fullName?: string; phone?: string | null }): Promise<ProfileSelfDTO> {
  const res = await fetch("/api/admin/profile-update-self", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось сохранить профиль.";
    throw new Error(message);
  }
  const u = parseProfileUser(j.user);
  if (!u) throw new Error("Некорректный ответ сервера.");
  return u;
}

export async function changePasswordSelf(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true; otherSessionsRevoked: number } | { ok: false; code: ChangePasswordFailureCode; message: string }> {
  try {
    const res = await fetch("/api/admin/profile-change-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = await readJson(res);
    if (res.ok && j.success === true && typeof j.otherSessionsRevoked === "number") {
      return { ok: true, otherSessionsRevoked: j.otherSessionsRevoked };
    }
    const codeRaw = j.code;
    const message = typeof j.message === "string" ? j.message : "Не удалось сменить пароль.";
    const code: ChangePasswordFailureCode =
      codeRaw === "VALIDATION_ERROR" ||
      codeRaw === "INVALID_PASSWORD" ||
      codeRaw === "WEAK_PASSWORD" ||
      codeRaw === "UNAUTHENTICATED" ||
      codeRaw === "FORBIDDEN" ||
      codeRaw === "INTERNAL_ERROR"
        ? (codeRaw as ChangePasswordFailureCode)
        : res.status >= 500
          ? "INTERNAL_ERROR"
          : "VALIDATION_ERROR";
    return { ok: false, code, message };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна. Повторите попытку." };
  }
}
