import type { UserRole } from "@shared/auth";
import { userHas } from "@/lib/auth-rbac";
import type { ImpersonationTarget } from "@/lib/use-impersonation-targets";

export const IMPERSONATION_ROLE_LABELS_RU: Record<UserRole, string> = {
  director: "Директор",
  rop: "РОП",
  regional_manager: "Региональный менеджер",
  manager: "Менеджер",
  marketer: "Маркетолог",
  analyst: "Аналитик",
  admin: "Администратор",
};

export type ImpersonationRoleGroupKey = "director" | "rop" | "managers" | "marketers" | "other";

export const IMPERSONATION_ROLE_GROUPS: { key: ImpersonationRoleGroupKey; label: string; roles: UserRole[] }[] = [
  { key: "director", label: "Директор", roles: ["director"] },
  { key: "rop", label: "РОП", roles: ["rop"] },
  { key: "managers", label: "Менеджеры", roles: ["manager", "regional_manager"] },
  { key: "marketers", label: "Маркетологи", roles: ["marketer"] },
  { key: "other", label: "Прочие", roles: ["analyst", "admin"] },
];

export function canShowImpersonationQuickSwitch(role: UserRole | null | undefined): boolean {
  return userHas(role, "users.impersonate");
}

export function filterImpersonationTargets(targets: ImpersonationTarget[], query: string): ImpersonationTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return targets;
  return targets.filter((t) => {
    const name = t.fullName.toLowerCase();
    const email = t.email.toLowerCase();
    const roleLabel = IMPERSONATION_ROLE_LABELS_RU[t.role].toLowerCase();
    return name.includes(q) || email.includes(q) || roleLabel.includes(q) || t.role.includes(q);
  });
}

export function groupImpersonationTargets(
  targets: ImpersonationTarget[],
): { key: ImpersonationRoleGroupKey; label: string; users: ImpersonationTarget[] }[] {
  const buckets = new Map<ImpersonationRoleGroupKey, ImpersonationTarget[]>();
  for (const g of IMPERSONATION_ROLE_GROUPS) {
    buckets.set(g.key, []);
  }
  for (const t of targets) {
    const group = IMPERSONATION_ROLE_GROUPS.find((g) => g.roles.includes(t.role));
    const key = group?.key ?? "other";
    buckets.get(key)!.push(t);
  }
  return IMPERSONATION_ROLE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    users: buckets.get(g.key) ?? [],
  })).filter((g) => g.users.length > 0);
}

export function truncateEmail(email: string, maxLocal = 12): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= maxLocal) return email;
  return `${local.slice(0, maxLocal)}…${domain}`;
}
