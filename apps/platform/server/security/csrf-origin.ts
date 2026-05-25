import type { Request } from "express";

/**
 * Проверка Origin/Referer для защиты от CSRF на state-changing POST.
 * Совпадает с логикой `enforceCsrfOrigin` в `api/admin/[action].ts` и `api/auth/[action].ts`.
 */
export function enforceCsrfOrigin(req: Request): boolean {
  const allowed = new Set<string>(["https://tandoor-platform.vercel.app"]);
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:5173");
    allowed.add("http://localhost:3000");
  }
  const originRaw =
    (typeof req.headers.origin === "string" ? req.headers.origin : undefined) ??
    (typeof req.headers.referer === "string" ? req.headers.referer : undefined);
  if (!originRaw) return true;
  try {
    const u = new URL(originRaw);
    return allowed.has(u.origin);
  } catch {
    return false;
  }
}
