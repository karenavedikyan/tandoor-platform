/**
 * Доступ к маршрутам и пунктам навигации (пилот).
 * До PR #06/#07: `UserRole` с сервера сопоставляется с `SalesRole` через `role-mapping`.
 */

import type { UserRole } from "@shared/auth";
import type { SalesRole } from "@/lib/sales-control-data";
import { canCreatePasswordResetLink } from "@shared/auth-rbac";
import { userRoleToSalesRole } from "@/lib/role-mapping";
import { userCanManageInvitations, userHas } from "@/lib/auth-rbac";

/**
 * Кнопка «Ссылка для смены пароля»: матрица ролей как на сервере, плюс запрет для собственной строки.
 */
export function canCreateResetLink(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): boolean {
  if (actor.id === target.id) return false;
  return canCreatePasswordResetLink(actor.role, target.role);
}

export type PilotNavItem = {
  href: string;
  label: string;
  testId: string;
  badge?: number;
  /** Плейсхолдер бейджа (например пока грузится актуализация клиентской базы). */
  badgeLoading?: boolean;
  /**
   * Стабильный id для активного состояния и счётчиков (иконки rail), если `testId` — новый (`nav-item-*`).
   * По умолчанию равен `testId`.
   */
  navBehaviorId?: string;
  /** Пункт ведёт на заглушку «в разработке»; в меню — muted + бейдж «скоро». */
  comingSoon?: boolean;
  /** Совпадение с query `feature=` на `/feature-in-development`. */
  developmentFeature?: string;
};

export type PilotNavGroup = {
  key: string;
  label: string;
  testId: string;
  items: PilotNavItem[];
};

export type PilotNavigationModel =
  | { layout: "flat"; items: PilotNavItem[] }
  | {
      layout: "grouped";
      groups: PilotNavGroup[];
      leadingItems?: PilotNavItem[];
      standaloneItems?: PilotNavItem[];
    };

/** Плоский порядок для grouped: `leadingItems` → `standaloneItems` → все группы. */
export function flattenGroupedPilotNavigation(model: Extract<PilotNavigationModel, { layout: "grouped" }>): PilotNavItem[] {
  const leading = model.leadingItems ?? [];
  const standalone = model.standaloneItems ?? [];
  return [...leading, ...standalone, ...model.groups.flatMap((g) => g.items)];
}

export function pilotFeatureDevelopmentHref(feature: string): string {
  return `/feature-in-development?feature=${encodeURIComponent(feature)}`;
}

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

/** Домашняя страница после входа по `UserRole` (сервер, PR 04). */
export function defaultHomePathForUserRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin/users";
    case "director":
      return "/dealer-base";
    case "rop":
    case "regional_manager":
      return "/dealer-base";
    case "manager":
      return "/dealer-base";
    case "marketer":
      return "/marketing-briefs";
    case "analyst":
      return "/analytics-workspace";
    case "category_manager":
      return "/dealer-base";
    default:
      return "/";
  }
}

export function canManageClientAssignments(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return role === "admin" || role === "director" || role === "rop";
}

export function canAccessPathForUser(role: UserRole, path: string): boolean {
  const p = normPath(path);
  if (p === "/forgot") return true;
  if (p === "/reset-requests") {
    return role === "admin" || role === "director" || role === "rop";
  }
  if (p === "/admin/users") {
    return userHas(role, "users.list");
  }
  if (p === "/admin/invitations") {
    return userCanManageInvitations(role);
  }
  if (p === "/admin/audit") {
    return userHas(role, "audit.read");
  }
  if (p === "/admin/client-assignments") {
    return canManageClientAssignments(role);
  }
  if (
    p === "/admin/actualization/dedupe" ||
    p === "/admin/migration" ||
    p === "/admin/migrate-marketing-briefs" ||
    p === "/admin/migrate-dealer-tp" ||
    p === "/admin/migrate-catalog-1c" ||
    p === "/admin/migrate"
  ) {
    return role === "admin";
  }
  if (p === "/admin/sync-health") {
    return role === "admin" || role === "director" || role === "analyst";
  }
  if (p === "/admin/tp-count-diag" || p === "/admin/counts-diag") {
    return role === "admin" || role === "director" || role === "rop" || role === "analyst";
  }
  if (p === "/profile" || isUnder(p, "/profile")) {
    return userHas(role, "profile.read_self");
  }
  return canAccessPath(userRoleToSalesRole(role), path);
}

/** План-факт: целевой раздел по роли. */
export function salesControlHomeHref(role: SalesRole): string {
  if (role === "sales_director" || role === "team_lead" || role === "sales_manager") {
    return "/sales-control/plan-fact";
  }
  return "/sales-control";
}

/** Раздел «Коммуникации» (Bitrix24): доступен всем основным ролям; личные чаты только после персонального OAuth (см. страницу /communications). */
export function canAccessCommunications(role: SalesRole): boolean {
  return (
    role === "sales_manager" ||
    role === "team_lead" ||
    role === "sales_director" ||
    role === "marketer" ||
    role === "analyst"
  );
}

export function canAccessPath(role: SalesRole, path: string): boolean {
  const p = normPath(path);
  if (p === "/login") return true;
  if (p === "/bitrix24" || p === "/embedded/bitrix24") return true;
  if (p === "/communications") return canAccessCommunications(role);

  const any = (preds: ((x: string) => boolean)[]) => preds.some((f) => f(p));

  if (role === "sales_manager") {
    return any([
      (x) => x === "/" || isUnder(x, "/main") || isUnder(x, "/sales-manager"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/trade-points") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/distribution") || isUnder(x, "/model"),
      (x) => isUnder(x, "/assignment"),
      (x) => isUnder(x, "/assignments"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => x === "/trash",
      (x) => x === "/client-base-activity",
      (x) =>
        x === "/sales-control" ||
        isUnder(x, "/sales-control/manager") ||
        isUnder(x, "/sales-control/plan-fact") ||
        isUnder(x, "/sales-control/plans") ||
        isUnder(x, "/sales-control/performance"),
    ]);
  }

  if (role === "team_lead") {
    return any([
      (x) => x === "/main" || isUnder(x, "/main"),
      (x) => isUnder(x, "/territory-card"),
      (x) => isUnder(x, "/analytics-workspace"),
      (x) =>
        isUnder(x, "/dealer-base") ||
        isUnder(x, "/dealers") ||
        isUnder(x, "/trade-points") ||
        isUnder(x, "/client-map") ||
        x === "/client-base-activity",
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/distribution") || isUnder(x, "/model"),
      (x) => isUnder(x, "/assignment"),
      (x) => isUnder(x, "/assignments"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => isUnder(x, "/communications"),
      (x) => x === "/trash",
      (x) => x === "/feature-in-development" || isUnder(x, "/feature-in-development"),
      (x) =>
        x === "/sales-control" ||
        isUnder(x, "/sales-control/team-lead") ||
        isUnder(x, "/sales-control/plan-fact") ||
        isUnder(x, "/sales-control/plans") ||
        isUnder(x, "/sales-control/performance"),
    ]);
  }

  if (role === "sales_director") {
    return any([
      (x) => x === "/" || isUnder(x, "/main") || isUnder(x, "/sales-manager"),
      (x) => isUnder(x, "/territory-card"),
      (x) => isUnder(x, "/analytics-workspace"),
      (x) =>
        isUnder(x, "/dealer-base") ||
        isUnder(x, "/dealers") ||
        isUnder(x, "/trade-points") ||
        isUnder(x, "/client-map") ||
        x === "/client-base-activity",
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/distribution") || isUnder(x, "/model"),
      (x) => isUnder(x, "/assignment"),
      (x) => isUnder(x, "/assignments"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => isUnder(x, "/communications"),
      (x) => x === "/trash",
      (x) => x === "/feature-in-development" || isUnder(x, "/feature-in-development"),
      (x) =>
        x === "/sales-control" ||
        isUnder(x, "/sales-control/director") ||
        isUnder(x, "/sales-control/plan-fact") ||
        isUnder(x, "/sales-control/plans") ||
        isUnder(x, "/sales-control/performance"),
    ]);
  }

  if (role === "marketer") {
    return any([
      (x) => x === "/",
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers"),
      (x) => isUnder(x, "/trade-points"),
      (x) => isUnder(x, "/client-map"),
      (x) => isUnder(x, "/sales-control"),
      (x) => isUnder(x, "/analytics-workspace"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/distribution") || isUnder(x, "/model"),
      (x) => isUnder(x, "/assignment"),
      (x) => isUnder(x, "/assignments"),
      (x) => isUnder(x, "/catalog"),
      (x) => isUnder(x, "/training"),
      (x) => isUnder(x, "/communications"),
      (x) => isUnder(x, "/marketing-briefs"),
      (x) => isUnder(x, "/listings"),
      (x) => x === "/trash" || isUnder(x, "/trash"),
      (x) => x === "/feature-in-development" || isUnder(x, "/feature-in-development"),
    ]);
  }

  if (role === "analyst") {
    return any([
      (x) => isUnder(x, "/analytics-workspace"),
      (x) => isUnder(x, "/dealer-base") || isUnder(x, "/dealers") || isUnder(x, "/trade-points") || isUnder(x, "/client-map"),
      (x) => isUnder(x, "/tasks"),
      (x) => isUnder(x, "/distribution") || isUnder(x, "/model"),
      (x) => isUnder(x, "/assignment"),
      (x) => isUnder(x, "/assignments"),
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

/**
 * Управление справочником матриц моделей на витрину (Дистрибуция).
 * Этап 2: admin, sales_director, team_lead, marketer, analyst, category_manager.
 * Дальше — персональный grant из БД (`personalGrant`) и опциональный scope-RBAC
 * (РОП редактирует только матрицы своего региона) — отдельным промтом.
 */
export function canManageShowcaseMatrixCatalog(
  platformUserRole: UserRole | null | undefined,
  role: SalesRole,
  _personalGrant?: boolean,
): boolean {
  if (platformUserRole === "admin") return true;
  if ((role as string) === "admin") return true;
  return (
    role === "marketer" ||
    role === "analyst" ||
    (role as string) === "category_manager" ||
    role === "sales_director" ||
    role === "team_lead"
  );
}

export function userHasRole(role: SalesRole, allowed: SalesRole[]): boolean {
  return allowed.includes(role);
}

export const canAccessRoute = canAccessPath;

export { userHasRole as requireRole };

export function canAccessClientBaseActivityDashboard(role: SalesRole): boolean {
  return role === "sales_director" || role === "team_lead";
}


function buildAdministrationNavGroup(platformUserRole: UserRole | null | undefined): PilotNavGroup | null {
  if (!platformUserRole) return null;
  if (platformUserRole === "analyst") {
    return {
      key: "administration",
      label: "АДМИНИСТРИРОВАНИЕ",
      testId: "nav-group-administration",
      items: [
        {
          href: "/admin/sync-health",
          label: "Sync health overrides",
          testId: "nav-item-admin-sync-health",
          navBehaviorId: "nav-admin-sync-health",
        },
        {
          href: "/admin/audit",
          label: "Журнал событий",
          testId: "nav-item-admin-audit",
          navBehaviorId: "nav-admin-audit",
        },
        {
          href: "/admin/counts-diag",
          label: "Счётчики",
          testId: "nav-item-admin-counts-diag",
          navBehaviorId: "nav-admin-counts-diag",
        },
        {
          href: "/admin/tp-count-diag",
          label: "ТТ-счётчики",
          testId: "nav-item-admin-tp-count-diag",
          navBehaviorId: "nav-admin-tp-count-diag",
        },
      ],
    };
  }
  const items: PilotNavItem[] = [];
  if (userHas(platformUserRole, "users.list")) {
    items.push({
      href: "/admin/users",
      label: "Пользователи",
      testId: "nav-item-admin-users",
      navBehaviorId: "nav-admin-users",
    });
  }
  if (canManageClientAssignments(platformUserRole)) {
    items.push({
      href: "/admin/client-assignments",
      label: "Назначения клиентов",
      testId: "nav-item-admin-client-assignments",
      navBehaviorId: "nav-admin-client-assignments",
    });
  }
  if (platformUserRole === "admin") {
    items.push({
      href: "/admin/migrate-marketing-briefs",
      label: "Миграции брифов",
      testId: "nav-item-admin-brief-migrate",
      navBehaviorId: "nav-admin-brief-migrate",
    });
    items.push({
      href: "/admin/migrate-dealer-tp",
      label: "Миграции дилер/ТТ",
      testId: "nav-item-admin-dealer-tp-migrate",
      navBehaviorId: "nav-admin-dealer-tp-migrate",
    });
    items.push({
      href: "/admin/migrate",
      label: "Миграция каталог 1С",
      testId: "nav-item-admin-catalog-1c-migrate",
      navBehaviorId: "nav-admin-catalog-1c-migrate",
    });
    items.push({
      href: "/admin/sync-health",
      label: "Sync health overrides",
      testId: "nav-item-admin-sync-health",
      navBehaviorId: "nav-admin-sync-health",
    });
    items.push({
      href: "/admin/actualization/dedupe",
      label: "Дедуп актуализации",
      testId: "nav-item-admin-actualization-dedupe",
      navBehaviorId: "nav-admin-actualization-dedupe",
    });
  }
  if (userCanManageInvitations(platformUserRole)) {
    items.push({
      href: "/admin/invitations",
      label: "Приглашения",
      testId: "nav-item-admin-invitations",
      navBehaviorId: "nav-admin-invitations",
    });
  }
  if (userHas(platformUserRole, "audit.read")) {
    items.push({
      href: "/admin/audit",
      label: "Журнал событий",
      testId: "nav-item-admin-audit",
      navBehaviorId: "nav-admin-audit",
    });
  }
  if (platformUserRole === "admin" || platformUserRole === "director" || platformUserRole === "rop") {
    items.push({
      href: "/reset-requests",
      label: "Запросы на сброс",
      testId: "nav-item-reset-requests",
      navBehaviorId: "nav-reset-requests",
    });
  }
  if (items.length === 0) return null;
  return {
    key: "administration",
    label: "АДМИНИСТРИРОВАНИЕ",
    testId: "nav-group-administration",
    items,
  };
}

const ADMIN_BRIEF_MIGRATE_TOP_NAV_ITEM: PilotNavItem = {
  href: "/admin/migrate-marketing-briefs",
  label: "Миграции брифов",
  testId: "nav-item-admin-brief-migrate-top",
  navBehaviorId: "nav-admin-brief-migrate",
};

function isAdminForBriefMigrateShortcut(
  platformUserRole: UserRole | null | undefined,
  role: SalesRole,
): boolean {
  // `SalesRole` has no `admin`; keep string check for forward-compatible demo mappings.
  return platformUserRole === "admin" || (role as string) === "admin";
}

function withAdminBriefMigrateTopShortcut(
  platformUserRole: UserRole | null | undefined,
  role: SalesRole,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  if (!isAdminForBriefMigrateShortcut(platformUserRole, role)) return model;
  const leading = model.leadingItems ?? [];
  if (leading.some((item) => item.testId === ADMIN_BRIEF_MIGRATE_TOP_NAV_ITEM.testId)) {
    return model;
  }
  return {
    ...model,
    leadingItems: [ADMIN_BRIEF_MIGRATE_TOP_NAV_ITEM, ...leading],
  };
}

function withOptionalAdminGroup(
  platformUserRole: UserRole | null | undefined,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  const g = buildAdministrationNavGroup(platformUserRole);
  if (!g) return model;
  return { ...model, groups: [g, ...model.groups] };
}

function finalizeGroupedPilotNavigation(
  platformUserRole: UserRole | null | undefined,
  role: SalesRole,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  return withOptionalAdminGroup(platformUserRole, withAdminBriefMigrateTopShortcut(platformUserRole, role, model));
}

export function getPilotNavigation(
  role: SalesRole,
  dealerBaseClientCount?: number | null,
  tradePointCount?: number | null,
  platformUserRole?: UserRole | null,
  trashCount?: number | null,
): PilotNavigationModel {
  const sch = salesControlHomeHref(role);

  const dealerNavExtras = (): Pick<PilotNavItem, "badge" | "badgeLoading"> => {
    if (dealerBaseClientCount === undefined) return {};
    if (dealerBaseClientCount === null) return { badgeLoading: true };
    return { badge: dealerBaseClientCount };
  };

  const tradePointNavExtras = (): Pick<PilotNavItem, "badge" | "badgeLoading"> => {
    if (tradePointCount === undefined) return {};
    if (tradePointCount === null) return { badgeLoading: true };
    if (tradePointCount <= 0) return {};
    return { badge: tradePointCount };
  };

  const trashNavExtras = (): Pick<PilotNavItem, "badge" | "badgeLoading"> => {
    if (trashCount === undefined) return {};
    if (trashCount === null) return { badgeLoading: true };
    if (trashCount <= 0) return {};
    return { badge: trashCount };
  };

  const buildInDevelopmentNavGroup = (options: {
    includeMarketingBriefsInDev: boolean;
  }): PilotNavGroup => {
    const items: PilotNavItem[] = [
      { href: "/training", label: "Обучение", testId: "nav-item-training", navBehaviorId: "nav-training" },
      { href: "/client-map", label: "Карта клиентов", testId: "nav-item-client-map", navBehaviorId: "nav-client-map" },
      {
        href: "/analytics-workspace",
        label: "Аналитика команды",
        testId: "nav-item-team-analytics",
        navBehaviorId: "nav-analytics-workspace",
      },
      { href: "/communications", label: "Коммуникации", testId: "nav-item-communications", navBehaviorId: "nav-communications" },
    ];
    if (options.includeMarketingBriefsInDev) {
      items.push({
        href: "/marketing-briefs",
        label: "Маркетинговые брифы",
        testId: "nav-item-marketing-briefs",
        navBehaviorId: "nav-marketing-briefs",
      });
    }
    return {
      key: "in-development",
      label: "В разработке",
      testId: "nav-group-in-development",
      items,
    };
  };

  /** Промт 55: плоский список рабочих разделов + аккордеон «В разработке». */
  const unifiedSalesNavigation = (
    homeHref: string,
    options?: { includeMarketingBriefsInDev?: boolean; extraLeadingItems?: PilotNavItem[] },
  ): Extract<PilotNavigationModel, { layout: "grouped" }> => ({
    layout: "grouped",
    leadingItems: [
      {
        href: homeHref,
        label: "Клиенты-дилеры",
        testId: "nav-item-clients",
        navBehaviorId: "nav-dealer-base",
        ...dealerNavExtras(),
      },
      {
        href: "/trade-points",
        label: "Торговые точки",
        testId: "nav-item-trade-points",
        navBehaviorId: "nav-trade-points",
        ...tradePointNavExtras(),
      },
      {
        href: "/distribution",
        label: "Дистрибуция",
        testId: "nav-item-distribution",
        navBehaviorId: "nav-distribution",
      },
      {
        href: "/assignments",
        label: "Задачи",
        testId: "nav-item-tasks-inbox",
        navBehaviorId: "nav-tasks-inbox",
      },
      {
        href: "/catalog",
        label: "Каталог",
        testId: "nav-item-catalog",
        navBehaviorId: "nav-catalog",
      },
      {
        href: "/sales-control/plan-fact",
        label: "План-факт и KPI",
        testId: "nav-item-sales-plan-fact",
        navBehaviorId: "nav-sales-control",
      },
      {
        href: "/trash",
        label: "Корзина",
        testId: "nav-item-trash",
        navBehaviorId: "nav-trash",
        ...trashNavExtras(),
      },
      {
        href: "/marketing-briefs",
        label: "Маркетинговые брифы",
        testId: "nav-item-marketing-briefs",
        navBehaviorId: "nav-marketing-briefs",
      },
      ...(options?.extraLeadingItems ?? []),
    ],
    groups: [buildInDevelopmentNavGroup({ includeMarketingBriefsInDev: options?.includeMarketingBriefsInDev ?? false })],
  });

  if (role === "sales_director" || role === "team_lead") {
    return finalizeGroupedPilotNavigation(platformUserRole, role, unifiedSalesNavigation("/dealer-base"));
  }

  if (role === "sales_manager") {
    return finalizeGroupedPilotNavigation(platformUserRole, role, unifiedSalesNavigation("/dealer-base"));
  }

  if (role === "marketer") {
    return finalizeGroupedPilotNavigation(
      platformUserRole,
      role,
      unifiedSalesNavigation("/dealer-base", {
        includeMarketingBriefsInDev: false,
        extraLeadingItems: [
          {
            href: "/listings",
            label: "Листовки",
            testId: "nav-item-listings",
            navBehaviorId: "nav-listings",
          },
        ],
      }),
    );
  }

  const flat = ((): PilotNavItem[] => {
    const items: PilotNavItem[] = [];
    const push = (x: PilotNavItem) => items.push(x);
    if (role === "analyst") {
      push({ href: "/analytics-workspace", label: "Аналитика команды", testId: "nav-analytics-workspace" });
      push({ href: "/dealer-base", label: "Клиенты", testId: "nav-dealer-base", ...dealerNavExtras() });
      push({ href: "/trade-points", label: "Торговые точки", testId: "nav-trade-points", ...tradePointNavExtras() });
      push({ href: "/distribution", label: "Дистрибуция", testId: "nav-item-distribution" });
      push({ href: "/assignments", label: "Задачи", testId: "nav-item-tasks-inbox", navBehaviorId: "nav-tasks-inbox" });
      push({ href: "/client-map", label: "Карта клиентов", testId: "nav-client-map" });
      push({ href: "/communications", label: "Коммуникации", testId: "nav-communications" });
      push({ href: "/catalog", label: "Каталог", testId: "nav-catalog" });
      push({ href: "/marketing-briefs", label: "Маркетинговые брифы", testId: "nav-marketing-briefs" });
      return items;
    }
    return items;
  })();

  return { layout: "flat", items: flat };
}

/** Плоский список для обратной совместимости (иконки rail, тесты). */
export function getPilotNavItems(
  role: SalesRole,
  dealerBaseClientCount?: number | null,
  tradePointCount?: number | null,
  platformUserRole?: UserRole | null,
): PilotNavItem[] {
  const m = getPilotNavigation(role, dealerBaseClientCount, tradePointCount, platformUserRole);
  if (m.layout === "flat") return m.items;
  return flattenGroupedPilotNavigation(m);
}
