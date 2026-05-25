/**
 * Одноразовые ссылки смены пароля: `/api/admin/password-reset-link-create`, `/api/auth/password-reset-link-redeem`.
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

function errFromBody(body: Record<string, unknown>, fallback: string): { code: string; message: string } {
  const code = typeof body.code === "string" ? body.code : "UNKNOWN";
  const message = typeof body.message === "string" ? body.message : fallback;
  return { code, message };
}

export type CreatePasswordResetLinkResult = {
  token: string;
  link: string;
  expiresAt: string;
};

export async function createPasswordResetLink(
  userId: string,
): Promise<{ ok: true; result: CreatePasswordResetLinkResult } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/admin/password-reset-link-create", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось создать ссылку.") };
  }
  const token = typeof body.token === "string" ? body.token : null;
  const link = typeof body.link === "string" ? body.link : null;
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : null;
  if (!token || !link || !expiresAt) {
    return { ok: false, code: "INVALID_RESPONSE", message: "Некорректный ответ сервера." };
  }
  return { ok: true, result: { token, link, expiresAt } };
}

export async function redeemPasswordResetLink(
  token: string,
  newPassword: string,
): Promise<{ ok: true; message: string } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/auth/password-reset-link-redeem", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  const body = await readJson(res);
  if (!res.ok || body.success !== true) {
    return { ok: false, ...errFromBody(body, "Не удалось сохранить пароль.") };
  }
  const message = typeof body.message === "string" ? body.message : "Пароль обновлён.";
  return { ok: true, message };
}
