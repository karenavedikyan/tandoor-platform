/**
 * Доступ к маршрутам и пунктам навигации по роли (mock auth, без backend).
 */

import type { SalesRole } from "@/lib/sales-control-data";

const NAV_BADGE_CLIENTS = 28;

export type PilotNavItem = {
  href: string;
  label: string;
  testId: string;
  badge?: number;
};

function normPath(path: string): string {
  const p = path.split("?")[0] || "/";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p || "/";
}

function isUnder(path: string, base: string): boolean {
  const p = normPath(path);
  const b = normPath(base);
  return p === b || p.startsWith(`${b}/`);
}

export function defaultHomePathForRole(role: SalesRole): string {
  switch (role) {
    case "sales_manager":
    case "team_lead":
      return "/dealer-base";
    case "sales_director":
      return "/territory-card";
    case "marketer":
      return "/marketing-briefs";
    case "analyst":
      return "/analytics-workspace";
    default:
      return "/dealer-base";
  }
}

/** План-факт: целевой раздел по роли. */
export function salesControlHomeHref(role: SalesRole): string {
  if (role === "sales_director") return "/sales-control/director";
  if (role === "team_lead") return "/sales-control/team-lead";
  if (role === "sales_manager") return "/sales-control/manager";
  return "/sales-control";
}

export function canAccessPath(role: SalesRole, path: string): boolean {
  const p = normPath(path);
  if (p === "/login") return true;
  if (p === "/bitrix24" || p === "/embedded/bitrix24") return true;

  const any = (preds: ((x: string) => boolean)[]) => preds.some((f) => f(p));

  if (role === "sales_manager") {
    return any([
      (x) => x === "/" || isUnder(x, "/main") || isUnder(x, "/sales-manager"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) =>
        x === "/sales-control" ||
        isUnder(x, "/sales-control/manager") ||
        isUnder(x, "/sales-control/plans") ||
        isUnder(x, "/sales-control/performance"),
    ]);
  }

  if (role === "team_lead") {
    return any([
      (x) => x === "/main" || isUnder(x, "/main"),
      (x) => isUnder(x, "/analytics-workspace"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) =>
        x === "/sales-control" ||
        isUnder(x, "/sales-control/team-lead") ||
        isUnder(x, "/sales-control/plans") ||
        isUnder(x, "/sales-control/performance"),
    ]);
  }

  if (role === "sales_director") {
    return any([
      (x) => x === "/" || isUnder(x, "/main") || isUnder(x, "/sales-manager"),
      (x) => isUnder(x, "/territory-card"),
      (x) => isUnder(x, "/analytics-workspace"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => isUnder(x, "/sales-control"),
    ]);
  }

  if (role === "marketer") {
    return any([
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/client-map"),
    ]);
  }

  if (role === "analyst") {
    return any([
      (x) => isUnder(x, "/analytics-workspace"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/marketing-briefs"),
    ]);
  }

  return false;
}

/** Создание, редактирование, публикация и выгрузка маркетинговых брифов (без backend). */
export function canManageMarketingBriefs(role: SalesRole): boolean {
  return role === "sales_director" || role === "team_lead" || role === "marketer";
}

export function userHasRole(role: SalesRole, allowed: SalesRole[]): boolean {
  return allowed.includes(role);
}

export const canAccessRoute = canAccessPath;

export { userHasRole as requireRole };

export function getPilotNavItems(role: SalesRole): PilotNavItem[] {
  const sch = salesControlHomeHref(role);
  const items: PilotNavItem[] = [];

  const push = (x: PilotNavItem) => items.push(x);

  if (role === "sales_manager") {
    push({ href: "/main", label: "Главная", testId: "nav-main" });
    push({ href: "/dealer-base", label: "Клиенты", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS });
    push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
    push({ href: "/tasks", label: "Задачи по витрине", testId: "nav-tasks" });
    push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
    push({ href: "/training", label: "Обучение", testId: "nav-training" });
    push({ href: sch, label: "План-факт продаж", testId: "nav-sales-control" });
    push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
    return items;
  }

  if (role === "team_lead") {
    push({ href: "/main", label: "Главная", testId: "nav-main" });
    push({ href: "/dealer-base", label: "Клиенты команды", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS });
    push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
    push({ href: "/tasks", label: "Задачи по витрине", testId: "nav-tasks" });
    push({ href: "/analytics-workspace", label: "Аналитика команды", testId: "nav-analytics-workspace" });
    push({ href: sch, label: "План-факт продаж", testId: "nav-sales-control" });
    push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
    push({ href: "/training", label: "Обучение", testId: "nav-training" });
    push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
    return items;
  }

  if (role === "sales_director") {
    push({ href: "/main", label: "Главная", testId: "nav-main" });
    push({ href: "/territory-card", label: "Карточка территории", testId: "nav-territory-card" });
    push({ href: "/dealer-base", label: "Клиенты", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS });
    push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
    push({ href: "/tasks", label: "Задачи по витрине", testId: "nav-tasks" });
    push({ href: "/analytics-workspace", label: "Аналитика команды", testId: "nav-analytics-workspace" });
    push({ href: sch, label: "План-факт продаж", testId: "nav-sales-control" });
    push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
    push({ href: "/training", label: "Обучение", testId: "nav-training" });
    push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
    return items;
  }

  if (role === "marketer") {
    push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
    push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
    push({ href: "/training", label: "Обучение", testId: "nav-training" });
    push({ href: "/dealer-base", label: "Клиенты (просмотр)", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS });
    push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
    return items;
  }

  if (role === "analyst") {
    push({ href: "/analytics-workspace", label: "Аналитика команды", testId: "nav-analytics-workspace" });
    push({ href: "/dealer-base", label: "Клиенты", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS });
    push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
    push({ href: "/tasks", label: "Задачи по витрине", testId: "nav-tasks" });
    push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
    push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
    return items;
  }

  return items;
}
