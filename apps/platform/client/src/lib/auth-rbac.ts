/**
 * Клиентский фасад над `@shared/auth-rbac`: переэкспорт + помощник для частых UI-проверок.
 * UI-гейты должны использовать только хелперы отсюда; не импортировать `@shared/auth-rbac` напрямую,
 * чтобы при будущей замене источника правды (например, server-side feature flags) точку правки
 * было одно место.
 */

import type { UserRole } from "@shared/auth";
import {
  type Permission,
  allowedInviteTargetsFor as _allowedInviteTargetsFor,
  canInviteRole as _canInviteRole,
  roleHasPermission,
  userCanManageInvitations as _userCanManageInvitations,
} from "@shared/auth-rbac";

export type { Permission } from "@shared/auth-rbac";

export function userHas(role: UserRole | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return roleHasPermission(role, perm);
}

export function userHasAny(role: UserRole | null | undefined, perms: Permission[]): boolean {
  if (!role) return false;
  return perms.some((p) => roleHasPermission(role, p));
}

export const canInviteRole = _canInviteRole;
export const allowedInviteTargetsFor = _allowedInviteTargetsFor;
export const userCanManageInvitations = _userCanManageInvitations;
