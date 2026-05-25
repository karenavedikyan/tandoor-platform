/**
 * Express middleware: проверяет permission на основе `req.auth.role`.
 * Требует, чтобы перед ней в цепочке уже отработал `requireAuth()`.
 * Self-contained Vercel-функции используют inline-дубликат матрицы и hand-written проверки.
 */

import type { RequestHandler } from "express";
import type { Permission } from "@shared/auth-rbac";
import { roleHasPermission } from "@shared/auth-rbac";

export function requirePermission(perm: Permission): RequestHandler {
  return (req, res, next) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (auth.status !== "active") {
      res.status(403).json({ success: false, code: "FORBIDDEN", message: "Учётная запись неактивна." });
      return;
    }
    if (!roleHasPermission(auth.role, perm)) {
      res.status(403).json({ success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    next();
  };
}

/**
 * Утилита для хендлеров, где middleware применять неудобно (например, чтобы дать
 * специфичный код ошибки). Бросает `Response` через побочный эффект — НЕ использовать;
 * предпочитайте `requirePermission`. Оставлено как fallback, если в будущем появится
 * необходимость возвращать кастомный JSON.
 */
export function assertPermissionOrSend(
  perm: Permission,
  role: import("@shared/auth").UserRole,
  status: import("@shared/auth").UserStatus,
): { ok: true } | { ok: false; status: number; body: { success: false; code: string; message: string } } {
  if (status !== "active") {
    return { ok: false, status: 403, body: { success: false, code: "FORBIDDEN", message: "Учётная запись неактивна." } };
  }
  if (!roleHasPermission(role, perm)) {
    return { ok: false, status: 403, body: { success: false, code: "FORBIDDEN", message: "Недостаточно прав." } };
  }
  return { ok: true };
}
