import type { UserRole } from "@shared/auth";
import { canAccessPathForUser } from "./auth-access.js";
import { multiWordSearchMatches } from "./search/search-query-utils.js";

export type GlobalSearchQuickLink = {
  id: string;
  label: string;
  href: string;
  keywords?: string;
};

const QUICK_LINKS: GlobalSearchQuickLink[] = [
  { id: "home", label: "Главная", href: "/", keywords: "main sales manager workspace" },
  { id: "dealer-base", label: "Клиентская база", href: "/dealer-base", keywords: "клиенты дилеры база" },
  { id: "trade-points", label: "Торговые точки", href: "/trade-points", keywords: "тт точки витрина" },
  { id: "distribution", label: "Дистрибуция", href: "/distribution", keywords: "матрица отгрузка" },
  { id: "catalog", label: "Каталог", href: "/catalog", keywords: "модели двери товары" },
  { id: "assignments", label: "Задачи", href: "/assignments", keywords: "задания inbox" },
  { id: "analytics", label: "Аналитика", href: "/analytics", keywords: "отчёты метрики" },
  { id: "profile", label: "Профиль", href: "/profile", keywords: "аккаунт настройки" },
  { id: "admin-users", label: "Администрирование — пользователи", href: "/admin/users", keywords: "admin users" },
  {
    id: "admin-invitations",
    label: "Администрирование — приглашения",
    href: "/admin/invitations",
    keywords: "admin invitations",
  },
  {
    id: "admin-client-assignments",
    label: "Администрирование — закрепления клиентов",
    href: "/admin/client-assignments",
    keywords: "assignments clients",
  },
];

export function filterQuickLinks(role: UserRole | null | undefined, query: string): GlobalSearchQuickLink[] {
  const q = query.trim();
  return QUICK_LINKS.filter((link) => {
    if (role && !canAccessPathForUser(role, link.href)) return false;
    if (!q) return true;
    const haystack = normalizeQuickLinkHaystack(link);
    return multiWordSearchMatches(haystack, q);
  });
}

function normalizeQuickLinkHaystack(link: GlobalSearchQuickLink): string {
  return [link.label, link.keywords ?? "", link.href].join(" ").toLowerCase();
}
