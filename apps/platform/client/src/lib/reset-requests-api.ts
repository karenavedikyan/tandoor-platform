/**
 * Запросы на сброс пароля (одобрение): `/api/admin/reset-requests-list` и связанные.
 */

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type PasswordResetRequestItem = {
  id: string;
  requesterId: string;
  requesterFullName: string;
  requesterEmail: string;
  requesterRole: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export async function listPasswordResetRequests(params?: {
  status?: string;
  limit?: number;
}): Promise<{ ok: true; items: PasswordResetRequestItem[] } | { ok: false; code: string; message: string }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  const res = await fetch(`/api/admin/reset-requests-list${q ? `?${q}` : ""}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    const code = typeof body.code === "string" ? body.code : "UNKNOWN";
    const message = typeof body.message === "string" ? body.message : "Не удалось загрузить список.";
    return { ok: false, code, message };
  }
  const itemsRaw = body.items;
  if (!Array.isArray(itemsRaw)) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  const items: PasswordResetRequestItem[] = [];
  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const requesterId = typeof o.requesterId === "string" ? o.requesterId : "";
    const requesterFullName = typeof o.requesterFullName === "string" ? o.requesterFullName : "";
    const requesterEmail = typeof o.requesterEmail === "string" ? o.requesterEmail : "";
    const requesterRole = typeof o.requesterRole === "string" ? o.requesterRole : "";
    const status = typeof o.status === "string" ? o.status : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt : "";
    if (!id) continue;
    items.push({
      id,
      requesterId,
      requesterFullName,
      requesterEmail,
      requesterRole,
      status,
      createdAt,
      expiresAt,
    });
  }
  return { ok: true, items };
}

export async function approvePasswordResetRequest(
  id: string,
): Promise<{ ok: true; url: string; expiresAt: string } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/reset-request-approve", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, mode: "link" }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    const code = typeof body.code === "string" ? body.code : "UNKNOWN";
    const message = typeof body.message === "string" ? body.message : "Не удалось выдать ссылку.";
    return { ok: false, code, message };
  }
  const url = typeof body.url === "string" ? body.url : "";
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
  if (!url || !expiresAt) return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  return { ok: true, url, expiresAt };
}

export async function declinePasswordResetRequest(
  id: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/reset-request-decline", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason: reason?.trim() || undefined }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    const code = typeof body.code === "string" ? body.code : "UNKNOWN";
    const message = typeof body.message === "string" ? body.message : "Не удалось отклонить запрос.";
    return { ok: false, code, message };
  }
  return { ok: true };
}
