/**
 * Клиентская иерархия /admin/users по справочнику SALES_USERS (без изменения API).
 */

import type { AdminUser } from "./admin-users-api.js";
import {
  SALES_DIRECTOR_USER_ID,
  SALES_TEAMS,
  SALES_USERS,
  getSalesUserById,
  getTeamManagers,
  type SalesRole,
  type SalesUser,
} from "./sales-control-data.js";

export type HierarchyRoot = {
  key: string;
  user: AdminUser;
  /** Роль в mock-справочнике продаж, если строка сопоставлена с SALES_USERS */
  salesRole?: SalesRole;
  /** Только для РОПов — менеджеры команды по teamId */
  children: AdminUser[];
};

export type UserHierarchyResult = {
  roots: HierarchyRoot[];
  /** Пользователи, не попавшие в дерево (в т.ч. admin), по ФИО */
  others: AdminUser[];
};

function normFullName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function findAdminBySalesUser(allUsers: AdminUser[], su: SalesUser): AdminUser | undefined {
  const n = normFullName(su.name);
  return allUsers.find((u) => normFullName(u.fullName) === n);
}

/**
 * Собирает дерево: директор → РОПы по SALES_TEAMS → аналитик → маркетологи; остальные — в others.
 */
export function buildUserHierarchy(allUsers: AdminUser[]): UserHierarchyResult {
  const tracked = new Set<string>();
  const roots: HierarchyRoot[] = [];

  const track = (u: AdminUser | undefined) => {
    if (u) tracked.add(u.id);
  };

  const addRoot = (user: AdminUser | undefined, salesRole: SalesRole | undefined, children: AdminUser[]) => {
    if (!user) return;
    track(user);
    for (const c of children) track(c);
    roots.push({ key: user.id, user, salesRole, children });
  };

  const directorSu = getSalesUserById(SALES_DIRECTOR_USER_ID);
  if (directorSu) {
    const directorAdmin = findAdminBySalesUser(allUsers, directorSu);
    addRoot(directorAdmin, "sales_director", []);
  }

  for (const team of SALES_TEAMS) {
    const leadSu = getSalesUserById(team.leadId);
    if (!leadSu) continue;
    const leadAdmin = findAdminBySalesUser(allUsers, leadSu);
    const childAdmins = getTeamManagers(team.id)
      .map((m) => findAdminBySalesUser(allUsers, m))
      .filter((u): u is AdminUser => Boolean(u));
    addRoot(leadAdmin, "team_lead", childAdmins);
  }

  const analystSu = SALES_USERS.find((u) => u.role === "analyst");
  if (analystSu) {
    addRoot(findAdminBySalesUser(allUsers, analystSu), "analyst", []);
  }

  for (const m of SALES_USERS.filter((u) => u.role === "marketer")) {
    addRoot(findAdminBySalesUser(allUsers, m), "marketer", []);
  }

  const others = allUsers
    .filter((u) => !tracked.has(u.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  return { roots, others };
}
