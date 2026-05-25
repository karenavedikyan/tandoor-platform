/**
 * RBAC: единая матрица «роль × permission» для платформы.
 * Используется на сервере (Express dev и self-contained Vercel-функции через дублирование)
 * и на клиенте для UI-гейтов. См. apps/platform/docs/auth-access-foundation.md (раздел PR 06).
 *
 * Канонический источник правды. Self-contained Vercel-функции (api/auth/[action].ts,
 * api/admin/auth-bootstrap.ts, api/invitations/[action].ts) дублируют relevant части
 * inline ради соблюдения self-contained-правила (см. PR #224 / revert #226).
 */

import type { UserRole } from "./auth";

/**
 * Идентификаторы прав. Дотс-нотация: `<domain>.<action>`.
 * НЕ переименовывать существующие — они используются в audit_log.metadata в будущих PR.
 */
export type Permission =
  // Invitations (Prompt 05)
  | "invitations.create"
  | "invitations.list_own"
  | "invitations.revoke_own"
  | "invitations.revoke_any"
  // Users admin (Prompt 07 — заготовка, эндпоинты появятся позже)
  | "users.list"
  | "users.read_any"
  | "users.update_role"
  | "users.update_status"
  | "users.reset_password"
  // Profile (Prompt 08)
  | "profile.read_self"
  | "profile.update_self"
  // Hardening (Prompt 09)
  | "audit.read"
  | "sessions.read_self"
  | "sessions.revoke_self";

/**
 * Какие роли могут пригласить какую целевую роль.
 * Перенесено из `INVITER_CAN_INVITE` (apps/platform/client/src/lib/invitations-api.ts).
 * Канонический источник для всех мест проверки.
 */
export const INVITER_CAN_INVITE: Record<UserRole, UserRole[]> = {
  director: ["rop", "regional_manager", "manager", "marketer", "analyst"],
  rop: ["regional_manager", "manager"],
  regional_manager: ["manager"],
  manager: [],
  marketer: [],
  analyst: [],
  admin: ["director", "rop", "regional_manager", "manager", "marketer", "analyst"],
};

/**
 * Матрица «роль → набор permissions».
 * Принцип: minimal grant, явные расширения для admin.
 * Параметрические проверки (например: «может ли X пригласить роль Y») делаются отдельной функцией.
 */
const PERMISSIONS_BY_ROLE: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "invitations.revoke_any",
    "users.list",
    "users.read_any",
    "users.update_role",
    "users.update_status",
    "users.reset_password",
    "profile.read_self",
    "profile.update_self",
    "audit.read",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  director: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "users.list",
    "users.read_any",
    "profile.read_self",
    "profile.update_self",
    "audit.read",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  rop: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "users.list",
    "profile.read_self",
    "profile.update_self",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  regional_manager: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "profile.read_self",
    "profile.update_self",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  manager: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
  marketer: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
  analyst: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
};

/** Базовая проверка: есть ли у роли заданный permission. */
export function roleHasPermission(role: UserRole, perm: Permission): boolean {
  const set = PERMISSIONS_BY_ROLE[role];
  return !!set && set.has(perm);
}

/** Возвращает массив permissions роли (для отладки, экспорта в UI). */
export function permissionsForRole(role: UserRole): Permission[] {
  return Array.from(PERMISSIONS_BY_ROLE[role] ?? []);
}

/**
 * Параметрическая проверка: может ли `inviter` пригласить пользователя на роль `target`.
 * Сначала проверяет общий permission `invitations.create`, затем матрицу `INVITER_CAN_INVITE`.
 */
export function canInviteRole(inviter: UserRole, target: UserRole): boolean {
  if (!roleHasPermission(inviter, "invitations.create")) return false;
  return (INVITER_CAN_INVITE[inviter] ?? []).includes(target);
}

/** Список целевых ролей, на которые `inviter` может пригласить (для UI-селектора). */
export function allowedInviteTargetsFor(inviter: UserRole): UserRole[] {
  if (!roleHasPermission(inviter, "invitations.create")) return [];
  return [...(INVITER_CAN_INVITE[inviter] ?? [])];
}

/** Совместимость с прежним хелпером (используется в `auth-access.ts`). */
export function userCanManageInvitations(role: UserRole): boolean {
  return roleHasPermission(role, "invitations.create");
}
