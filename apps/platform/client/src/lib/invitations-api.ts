/**
 * Клиентские запросы к `/api/invitations/*` (приглашения пользователей).
 */

import type { UserRole } from "@shared/auth";
import type { AuthUserDTO } from "@/lib/auth-api";

export type InvitationRoleSlot = UserRole;

export type Invitation = {
  id: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: "pending" | "accepted" | "expired";
};

/** Ответ `POST /api/invitations/create` (без createdAt/status в теле сервера). */
export type CreatedInvitation = {
  id: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  expiresAt: string;
  acceptUrl: string;
};

export type InvitationPreview = {
  email: string;
  role: UserRole;
  teamId: string | null;
  fullName: string | null;
  expiresAt: string;
};

export type CreateInvitationInput = { email: string; role: UserRole; teamId?: string | null; fullName?: string | null };

export type AcceptInvitationInput = { token: string; fullName: string; password: string };

export { userCanManageInvitations, allowedInviteTargetsFor } from "@/lib/auth-rbac";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseInvitationRow(raw: unknown): Invitation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const email = typeof r.email === "string" ? r.email : null;
  const role = r.role as UserRole;
  const expiresAt = typeof r.expiresAt === "string" ? r.expiresAt : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !email || !expiresAt || !createdAt) return null;
  const status = r.status;
  if (status !== "pending" && status !== "accepted" && status !== "expired") return null;
  return {
    id,
    email,
    role,
    teamId: (r.teamId as string | null) ?? null,
    createdAt,
    expiresAt,
    acceptedAt: (r.acceptedAt as string | null) ?? null,
    status,
  };
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<{ ok: true; invitation: CreatedInvitation } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch("/api/invitations/create", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        role: input.role,
        teamId: input.teamId ?? null,
        fullName: input.fullName ?? null,
      }),
    });
    const j = await readJson(res);
    if (res.ok && j.success === true && j.invitation && typeof j.invitation === "object") {
      const inv = j.invitation as Record<string, unknown>;
      const acceptUrl = typeof inv.acceptUrl === "string" ? inv.acceptUrl : "";
      const id = typeof inv.id === "string" ? inv.id : "";
      const email = typeof inv.email === "string" ? inv.email : "";
      const expiresAt = typeof inv.expiresAt === "string" ? inv.expiresAt : "";
      if (!id || !email || !expiresAt || !acceptUrl) {
        return { ok: false, code: "INTERNAL_ERROR", message: "Некорректный ответ сервера." };
      }
      const invitation: CreatedInvitation = {
        id,
        email,
        role: inv.role as UserRole,
        teamId: (inv.teamId as string | null) ?? null,
        expiresAt,
        acceptUrl,
      };
      return { ok: true, invitation };
    }
    const code = typeof j.code === "string" ? j.code : "INTERNAL_ERROR";
    const message = typeof j.message === "string" ? j.message : "Ошибка создания приглашения.";
    return { ok: false, code, message };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна. Повторите попытку." };
  }
}

export async function listInvitations(): Promise<Invitation[]> {
  const res = await fetch("/api/invitations/list", { method: "GET", credentials: "same-origin" });
  const j = await readJson(res);
  if (!res.ok || j.success !== true || !Array.isArray(j.invitations)) {
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось загрузить приглашения.");
  }
  const out: Invitation[] = [];
  for (const row of j.invitations) {
    const p = parseInvitationRow(row);
    if (p) out.push(p);
  }
  return out;
}

export async function revokeInvitation(id: string): Promise<{ ok: boolean; code?: string; message?: string }> {
  try {
    const res = await fetch("/api/invitations/revoke", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await readJson(res);
    if (res.ok && j.success === true) return { ok: true };
    return {
      ok: false,
      code: typeof j.code === "string" ? j.code : undefined,
      message: typeof j.message === "string" ? j.message : undefined,
    };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна." };
  }
}

export async function previewInvitation(
  token: string,
): Promise<{ ok: true; preview: InvitationPreview } | { ok: false; code: string; message: string }> {
  try {
    const q = encodeURIComponent(token);
    const res = await fetch(`/api/invitations/preview?token=${q}`, { method: "GET", credentials: "same-origin" });
    const j = await readJson(res);
    if (res.ok && j.success === true) {
      return {
        ok: true,
        preview: {
          email: String(j.email ?? ""),
          role: j.role as UserRole,
          teamId: (j.teamId as string | null) ?? null,
          fullName: (j.fullName as string | null) ?? null,
          expiresAt: String(j.expiresAt ?? ""),
        },
      };
    }
    const code = typeof j.code === "string" ? j.code : "INVALID_TOKEN";
    const message = typeof j.message === "string" ? j.message : "Приглашение недоступно.";
    return { ok: false, code, message };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна. Повторите попытку." };
  }
}

export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<{ ok: true; user: AuthUserDTO } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: input.token, fullName: input.fullName, password: input.password }),
    });
    const j = await readJson(res);
    if (res.ok && j.success === true && j.user && typeof j.user === "object") {
      return { ok: true, user: j.user as AuthUserDTO };
    }
    const code = typeof j.code === "string" ? j.code : "INTERNAL_ERROR";
    const message = typeof j.message === "string" ? j.message : "Не удалось принять приглашение.";
    return { ok: false, code, message };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна. Повторите попытку." };
  }
}
