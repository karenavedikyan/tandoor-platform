/**
 * Самоуправление сессиями: `/api/admin/sessions-*-self`.
 */

export type SelfSession = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: string;
  current: boolean;
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

function parseSession(raw: unknown): SelfSession | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const expiresAt = typeof r.expiresAt === "string" ? r.expiresAt : null;
  const current = typeof r.current === "boolean" ? r.current : null;
  if (!id || !expiresAt || current === null) return null;
  const userAgent = r.userAgent === null ? null : typeof r.userAgent === "string" ? r.userAgent : null;
  const ip = r.ip === null ? null : typeof r.ip === "string" ? r.ip : null;
  return { id, userAgent, ip, expiresAt, current };
}

export async function listSelfSessions(): Promise<SelfSession[]> {
  const res = await fetch("/api/admin/sessions-list-self", { method: "GET", credentials: "same-origin" });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось загрузить сессии.";
    throw new Error(message);
  }
  const raw = j.sessions;
  if (!Array.isArray(raw)) throw new Error("Некорректный ответ сервера.");
  const out: SelfSession[] = [];
  for (const el of raw) {
    const s = parseSession(el);
    if (s) out.push(s);
  }
  return out;
}

export async function revokeSelfSession(id: string): Promise<void> {
  const res = await fetch("/api/admin/sessions-revoke-self", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось отозвать сессию.";
    throw new Error(message);
  }
}

export async function revokeOtherSelfSessions(): Promise<{ revoked: number }> {
  const res = await fetch("/api/admin/sessions-revoke-others-self", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось завершить сессии.";
    throw new Error(message);
  }
  const revoked = typeof j.revoked === "number" ? j.revoked : Number(j.revoked);
  if (!Number.isFinite(revoked)) throw new Error("Некорректный ответ сервера.");
  return { revoked };
}
