/**
 * Публичные шаги «Забыли пароль?» (`/api/auth/reset-request-*`).
 */

import type { UserRole } from "@shared/auth";

export type ResetApproverOption = {
  id: string;
  fullName: string;
  role: UserRole;
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

export async function fetchResetRequestApprovers(
  email: string,
): Promise<{ ok: true; approvers: ResetApproverOption[] } | { ok: false; message: string; rateLimited?: boolean }> {
  const res = await fetch("/api/auth/reset-request-approvers", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const body = await readJson(res);
  if (res.status === 429) {
    return { ok: false, message: "Слишком много запросов. Повторите позже.", rateLimited: true };
  }
  if (!res.ok || body.success !== true) {
    const message = typeof body.message === "string" ? body.message : "Не удалось выполнить запрос.";
    return { ok: false, message };
  }
  const list = body.approvers;
  const approvers: ResetApproverOption[] = [];
  if (Array.isArray(list)) {
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const fullName = typeof o.fullName === "string" ? o.fullName : "";
      const role = typeof o.role === "string" ? (o.role as UserRole) : ("manager" as UserRole);
      if (id) approvers.push({ id, fullName, role });
    }
  }
  return { ok: true, approvers };
}

export async function createResetRequest(
  email: string,
  approverId: string,
): Promise<{ ok: true } | { ok: false; message: string; rateLimited?: boolean }> {
  const res = await fetch("/api/auth/reset-request-create", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), approverId }),
  });
  const body = await readJson(res);
  if (res.status === 429) {
    return { ok: false, message: "Слишком много запросов. Повторите позже.", rateLimited: true };
  }
  if (!res.ok || body.success !== true) {
    const message = typeof body.message === "string" ? body.message : "Не удалось отправить запрос.";
    return { ok: false, message };
  }
  return { ok: true };
}
