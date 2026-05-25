/**
 * Клиентские запросы к `/api/auth/*` (реальные HttpOnly-cookie сессии).
 */

import type { UserRole, UserStatus } from "@shared/auth";

export type AuthUserDTO = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export function displayUserName(u: AuthUserDTO | undefined): string {
  if (!u) return "";
  const n = u.fullName?.trim();
  if (n) return n;
  const e = u.email?.trim();
  if (e) return e;
  return "—";
}

export type LoginFailureCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export type LoginResult =
  | { ok: true; user: AuthUserDTO }
  | { ok: false; code: LoginFailureCode; message: string; retryAfterSec?: number };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await readJson(res);
    if (res.ok && j.success === true && j.user && typeof j.user === "object") {
      return { ok: true, user: j.user as AuthUserDTO };
    }
    const ra = res.headers.get("Retry-After");
    const retryAfterSec = ra ? Number.parseInt(ra, 10) : undefined;
    const retry = Number.isFinite(retryAfterSec) ? retryAfterSec : undefined;
    if (res.status === 429) {
      const message =
        typeof j.message === "string" ? j.message : "Слишком много попыток входа. Повторите позже.";
      return { ok: false, code: "RATE_LIMITED", message, retryAfterSec: retry };
    }
    const codeRaw = j.code;
    const code: LoginFailureCode =
      codeRaw === "VALIDATION_ERROR" ||
      codeRaw === "INVALID_CREDENTIALS" ||
      codeRaw === "RATE_LIMITED" ||
      codeRaw === "INTERNAL_ERROR"
        ? (codeRaw as LoginFailureCode)
        : res.status >= 500
          ? "INTERNAL_ERROR"
          : "INVALID_CREDENTIALS";
    const message = typeof j.message === "string" ? j.message : "Ошибка входа.";
    return {
      ok: false,
      code,
      message,
      retryAfterSec: code === "RATE_LIMITED" ? retry : undefined,
    };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", message: "Сеть недоступна. Повторите попытку." };
  }
}

export async function me(): Promise<AuthUserDTO | null> {
  const res = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "same-origin",
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`GET /api/auth/me failed: ${res.status}`);
  }
  const j = await readJson(res);
  if (j.success !== true || !j.user || typeof j.user !== "object") {
    throw new Error("GET /api/auth/me: unexpected response");
  }
  return j.user as AuthUserDTO;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* ignore */
  }
}

export async function logoutAll(): Promise<void> {
  try {
    await fetch("/api/auth/logout-all", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* ignore */
  }
}
