/**
 * Первый релиз: mock-авторизация без backend (логин/пароль в открытом виде).
 */

import { getSalesUserById, SALES_USERS, type SalesRole, type SalesUser } from "@/lib/sales-control-data";

export const TANDOOR_AUTH_USER_KEY = "tandoor-auth-user-v1";
export const MOCK_AUTH_CHANGED_EVENT = "tandoor-mock-auth-changed";

export type MockAuthSession = {
  userId: string;
  username: string;
};

export type CredentialRow = {
  username: string;
  password: string;
  userId: string;
};

/** Пароль по роли для пилотной авторизации продаж. */
const SALES_ROLE_PASSWORDS: Partial<Record<SalesRole, string>> = {
  sales_director: "1",
  team_lead: "22",
  sales_manager: "333",
};

/** Логин для не-продажных ролей (маркетолог/аналитик), чтобы не ломать существующие записи. */
const SUPPORT_ROLE_PASSWORD = "demo123";

/** Явное соответствие userId → username. Для пользователей не в карте логин выводится из id. */
const EXPLICIT_USERNAMES: Record<string, string> = {
  "user-dir-goncharenko": "goncharenko",
  "user-tl-kupiansky": "kupiansky",
  "user-tl-skalaban": "skalaban",
  "user-tl-sapozhkov": "sapozhkov",
  "mgr-boyko-em": "boyko",
  "user-mkt-morozova": "morozova",
  "user-mkt-kotlyarov": "kotlyarov",
  "user-anl-ivanets": "ivanets",
};

function deriveUsernameFromId(userId: string): string {
  // mgr-fedorov-dv → fedorov; user-tl-skalaban → skalaban; user-mkt-kotlyarov → kotlyarov
  const parts = userId.split("-").filter(Boolean);
  if (parts.length === 0) return userId;
  // Skip leading category tokens (mgr/user) and sub-category (tl/dir/mkt/anl) tokens.
  const skip = new Set(["mgr", "user", "tl", "dir", "mkt", "anl"]);
  const surname = parts.find((p) => !skip.has(p));
  return (surname ?? parts[parts.length - 1]).toLowerCase();
}

function passwordForRole(role: SalesRole): string {
  return SALES_ROLE_PASSWORDS[role] ?? SUPPORT_ROLE_PASSWORD;
}

function buildCredentials(): CredentialRow[] {
  const seen = new Set<string>();
  const rows: CredentialRow[] = [];
  for (const u of SALES_USERS) {
    const username = EXPLICIT_USERNAMES[u.id] ?? deriveUsernameFromId(u.id);
    if (seen.has(username)) continue;
    seen.add(username);
    rows.push({ username, password: passwordForRole(u.role), userId: u.id });
  }
  return rows;
}

/** Пилотные учётки (временные пароли, не для реальной безопасности). */
export const MOCK_AUTH_CREDENTIALS: CredentialRow[] = buildCredentials();

/** Список ролей, входящих в пилотную «продажную» панель логина. */
const SALES_LOGIN_ROLES: SalesRole[] = ["sales_director", "team_lead", "sales_manager"];

export type SalesCredentialEntry = CredentialRow & { user: SalesUser };

export function getSalesLoginCredentials(): SalesCredentialEntry[] {
  const rows: SalesCredentialEntry[] = [];
  for (const c of MOCK_AUTH_CREDENTIALS) {
    const user = getSalesUserById(c.userId);
    if (!user) continue;
    if (!SALES_LOGIN_ROLES.includes(user.role)) continue;
    rows.push({ ...c, user });
  }
  const order: Record<SalesRole, number> = {
    sales_director: 0,
    team_lead: 1,
    sales_manager: 2,
    marketer: 3,
    analyst: 4,
  };
  rows.sort((a, b) => {
    const dr = order[a.user.role] - order[b.user.role];
    if (dr !== 0) return dr;
    return a.user.name.localeCompare(b.user.name, "ru");
  });
  return rows;
}

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
