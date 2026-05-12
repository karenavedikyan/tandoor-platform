/**
 * Первый релиз: mock-авторизация без backend (логин/пароль в открытом виде).
 */

import { getSalesUserById, type SalesUser } from "@/lib/sales-control-data";

export const TANDOOR_AUTH_USER_KEY = "tandoor-auth-user-v1";
export const MOCK_AUTH_CHANGED_EVENT = "tandoor-mock-auth-changed";

export type MockAuthSession = {
  userId: string;
  username: string;
};

type CredentialRow = {
  username: string;
  password: string;
  userId: string;
};

/** Пилотные учётки (временные пароли, не для реальной безопасности). */
export const MOCK_AUTH_CREDENTIALS: CredentialRow[] = [
  { username: "boyko", password: "demo123", userId: "mgr-boyko-em" },
  { username: "kupiansky", password: "demo123", userId: "user-tl-kupiansky" },
  { username: "goncharenko", password: "demo123", userId: "user-dir-goncharenko" },
  { username: "morozova", password: "demo123", userId: "user-mkt-morozova" },
  { username: "ivanets", password: "demo123", userId: "user-anl-ivanets" },
];

export function isDemoAuthBypassEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_TANDOOR_DEMO_AUTH === "1") return true;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

export function loadMockAuthSession(): MockAuthSession | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(TANDOOR_AUTH_USER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MockAuthSession>;
    if (!p.userId || !p.username) return null;
    return { userId: p.userId, username: p.username };
  } catch {
    return null;
  }
}

export function saveMockAuthSession(session: MockAuthSession): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TANDOOR_AUTH_USER_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(MOCK_AUTH_CHANGED_EVENT));
}

export function clearMockAuthSession(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(TANDOOR_AUTH_USER_KEY);
  window.dispatchEvent(new Event(MOCK_AUTH_CHANGED_EVENT));
}

export type LoginResult = { ok: true; user: SalesUser } | { ok: false; error: string };

export function loginWithCredentials(usernameRaw: string, passwordRaw: string): LoginResult {
  const username = usernameRaw.trim().toLowerCase();
  const password = passwordRaw;
  if (!username || !password) {
    return { ok: false, error: "Введите логин и пароль." };
  }
  const row = MOCK_AUTH_CREDENTIALS.find((c) => c.username.toLowerCase() === username);
  if (!row || row.password !== password) {
    return { ok: false, error: "Неверный логин или пароль." };
  }
  const user = getSalesUserById(row.userId);
  if (!user) {
    return { ok: false, error: "Пользователь не найден в справочнике." };
  }
  saveMockAuthSession({ userId: user.id, username: row.username });
  return { ok: true, user };
}

export function logoutMockAuth(): void {
  clearMockAuthSession();
}

export const login = loginWithCredentials;
export { logoutMockAuth as logout };
