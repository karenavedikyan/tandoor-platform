/**
 * Доступ к маршрутам и пунктам навигации (пилот).
 * До PR #06/#07: `UserRole` с сервера сопоставляется с `SalesRole` через `role-mapping`.
 */

import type { UserRole } from "@shared/auth";
import type { SalesRole } from "./sales-control-data.js";
import { canCreatePasswordResetLink } from "@shared/auth-rbac";
import { userRoleToSalesRole } from "./role-mapping.js";
import { userCanManageInvitations, userHas } from "./auth-rbac.js";

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

export type PilotNavBadge = number | string;

export type PilotNavItem = {
  href: string;
  label: string;
  testId: string;
  badge?: PilotNavBadge;
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
      return "/dealer-base";
    case "marketer":
      return "/marketing-briefs";
    case "analyst":
      return "/dealer-base";
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
      return "/dealer-base";
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

/** Промт 378: страница «Активность команды». */
export function canAccessTeamActivityForUser(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return role === "admin" || role === "director" || role === "rop" || role === "regional_manager";
}

/** Read-only витрина shadow-таблиц 1С (/1c/*). */
export function canAccessOneCShowroomForUser(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return (
    role === "admin" ||
    role === "director" ||
    role === "rop" ||
    role === "regional_manager" ||
    role === "manager"
  );
}

export function canAccessPathForUser(role: UserRole, path: string): boolean {
  const p = normPath(path);
  if (p === "/1c" || isUnder(p, "/1c")) {
    return canAccessOneCShowroomForUser(role);
  }
  if (p === "/team-activity") return canAccessTeamActivityForUser(role);
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
    return role === "admin" || role === "director";
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
    p === "/admin/exchange-explorer" ||
    p === "/admin/exchange-stores" ||
    p === "/admin/migrate"
  ) {
    return role === "admin";
  }
  if (p === "/admin/sync-health") {
    return role === "admin" || role === "director" || role === "analyst";
  }
  if (p === "/admin/performance") {
    return role === "admin" || role === "director";
  }
  if (p === "/admin/tp-count-diag" || p === "/admin/counts-diag") {
    return role === "admin" || role === "director" || role === "rop" || role === "analyst";
  }
  if (p === "/admin/purge-queue") {
    return userHas(role, "admin.purge_dealer");
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


function buildAdministrationNavGroup(
  platformUserRole: UserRole | null | undefined,
  adminPurgeQueueCount?: number | null,
): PilotNavGroup | null {
  if (!platformUserRole) return null;

  const hasTeam =
    platformUserRole === "admin" ||
    platformUserRole === "director" ||
    platformUserRole === "rop" ||
    platformUserRole === "regional_manager";
  if (!hasTeam) return null;

  const isAdmin = platformUserRole === "admin";
  const items: PilotNavItem[] = [];

  if (canAccessTeamActivityForUser(platformUserRole)) {
    items.push({
      href: "/team-activity",
      label: "Команда",
      testId: "nav-item-team-activity",
      navBehaviorId: "nav-team-activity",
    });
  }

  if (userHas(platformUserRole, "users.list") || !isAdmin) {
    items.push({
      href: "/admin/users",
      label: "Пользователи",
      testId: "nav-item-admin-users",
      navBehaviorId: "nav-admin-users",
    });
  }

  if (canManageClientAssignments(platformUserRole) || platformUserRole === "regional_manager") {
    items.push({
      href: "/admin/client-assignments",
      label: "Назначения клиентов",
      testId: "nav-item-admin-client-assignments",
      navBehaviorId: "nav-admin-client-assignments",
    });
  }

  if (isAdmin) {
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
      href: "/admin/exchange-stores",
      label: "ТТ из 1С",
      testId: "nav-item-admin-exchange-stores",
      navBehaviorId: "nav-admin-exchange-stores",
    });
    items.push({
      href: "/admin/sync-health",
      label: "Sync health overrides",
      testId: "nav-item-admin-sync-health",
      navBehaviorId: "nav-admin-sync-health",
    });
    items.push({
      href: "/admin/performance",
      label: "Производительность",
      testId: "nav-item-admin-performance",
      navBehaviorId: "nav-admin-performance",
    });
    if (userHas(platformUserRole, "admin.purge_dealer")) {
      const purgeExtras = (): Pick<PilotNavItem, "badge" | "badgeLoading"> => {
        if (adminPurgeQueueCount === undefined) return {};
        if (adminPurgeQueueCount === null) return { badgeLoading: true };
        if (adminPurgeQueueCount <= 0) return {};
        return { badge: adminPurgeQueueCount };
      };
      items.push({
        href: "/admin/purge-queue",
        label: "Корзина админа",
        testId: "nav-item-admin-purge-queue",
        navBehaviorId: "nav-admin-purge-queue",
        ...purgeExtras(),
      });
    }
    items.push({
      href: "/admin/actualization/dedupe",
      label: "Дедуп актуализации",
      testId: "nav-item-admin-actualization-dedupe",
      navBehaviorId: "nav-admin-actualization-dedupe",
    });
    items.push({
      href: "/admin/audit",
      label: "Аудит",
      testId: "nav-item-admin-audit",
      navBehaviorId: "nav-admin-audit",
    });
  }

  if (userCanManageInvitations(platformUserRole) || platformUserRole === "regional_manager") {
    items.push({
      href: "/admin/invitations",
      label: "Приглашения",
      testId: "nav-item-admin-invitations",
      navBehaviorId: "nav-admin-invitations",
    });
  }

  items.push({
    href: "/reset-requests",
    label: "Запросы на сброс",
    testId: "nav-item-reset-requests",
    navBehaviorId: "nav-reset-requests",
  });

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

const ONE_C_SHOWROOM_NAV_ITEM: PilotNavItem = {
  href: "/1c",
  label: "1С витрина",
  testId: "nav-item-one-c-showroom",
  navBehaviorId: "nav-one-c-showroom",
};

const ONE_C_ORDERS_NAV_ITEM: PilotNavItem = {
  href: "/1c/orders",
  label: "Заказы 1С",
  testId: "nav-item-one-c-orders",
  navBehaviorId: "nav-one-c-orders",
};

function withOneCShowroomNavItem(
  platformUserRole: UserRole | null | undefined,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  if (!canAccessOneCShowroomForUser(platformUserRole)) return model;
  const leading = model.leadingItems ?? [];
  const next = [...leading];
  if (!next.some((item) => item.testId === ONE_C_SHOWROOM_NAV_ITEM.testId)) {
    next.push(ONE_C_SHOWROOM_NAV_ITEM);
  }
  if (!next.some((item) => item.testId === ONE_C_ORDERS_NAV_ITEM.testId)) {
    next.push(ONE_C_ORDERS_NAV_ITEM);
  }
  if (next.length === leading.length) return model;
  return { ...model, leadingItems: next };
}

function withOptionalAdminGroup(
  platformUserRole: UserRole | null | undefined,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
  adminPurgeQueueCount?: number | null,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  const g = buildAdministrationNavGroup(platformUserRole, adminPurgeQueueCount);
  if (!g) return model;
  return { ...model, groups: [g, ...model.groups] };
}

function finalizeGroupedPilotNavigation(
  platformUserRole: UserRole | null | undefined,
  role: SalesRole,
  model: Extract<PilotNavigationModel, { layout: "grouped" }>,
  adminPurgeQueueCount?: number | null,
): Extract<PilotNavigationModel, { layout: "grouped" }> {
  return withOneCShowroomNavItem(
    platformUserRole,
    withOptionalAdminGroup(
      platformUserRole,
      withAdminBriefMigrateTopShortcut(platformUserRole, role, model),
      adminPurgeQueueCount,
    ),
  );
}

/** Формат бейджа корзины: `12/10` если оба > 0, одно число если только один > 0. */
export function buildTrashNavBadge(
  trashDealersCount?: number | null,
  trashTradePointsCount?: number | null,
): Pick<PilotNavItem, "badge" | "badgeLoading"> {
  if (trashDealersCount === undefined && trashTradePointsCount === undefined) return {};
  if (trashDealersCount === null || trashTradePointsCount === null) return { badgeLoading: true };
  const d = trashDealersCount ?? 0;
  const tp = trashTradePointsCount ?? 0;
  if (d <= 0 && tp <= 0) return {};
  if (d > 0 && tp > 0) return { badge: `${d}/${tp}` };
  return { badge: d > 0 ? d : tp };
}

export function getPilotNavigation(
  role: SalesRole,
  dealerBaseClientCount?: number | null,
  tradePointCount?: number | null,
  platformUserRole?: UserRole | null,
  trashDealersCount?: number | null,
  trashTradePointsCount?: number | null,
  adminPurgeQueueCount?: number | null,
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

  const trashNavExtras = (): Pick<PilotNavItem, "badge" | "badgeLoading"> =>
    buildTrashNavBadge(trashDealersCount, trashTradePointsCount);

  const buildInDevelopmentNavGroup = (options: {
    includeMarketingBriefsInDev: boolean;
  }): PilotNavGroup => {
    const items: PilotNavItem[] = [
      { href: "/training", label: "Обучение", testId: "nav-item-training", navBehaviorId: "nav-training" },
      { href: "/client-map", label: "Карта клиентов", testId: "nav-item-client-map", navBehaviorId: "nav-client-map" },
      { href: "/communications", label: "Коммуникации", testId: "nav-item-communications", navBehaviorId: "nav-communications" },
      {
        href: "/sales-control/plan-fact",
        label: "План-факт и KPI",
        testId: "nav-item-sales-plan-fact",
        navBehaviorId: "nav-sales-control",
      },
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
        label: "Клиенты / ТТ",
        testId: "nav-item-clients-tps",
        navBehaviorId: "nav-dealer-base",
        ...dealerNavExtras(),
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
    return finalizeGroupedPilotNavigation(platformUserRole, role, unifiedSalesNavigation("/dealer-base"), adminPurgeQueueCount);
  }

  if (role === "sales_manager") {
    return finalizeGroupedPilotNavigation(platformUserRole, role, unifiedSalesNavigation("/dealer-base"), adminPurgeQueueCount);
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
      adminPurgeQueueCount,
    );
  }

  const flat = ((): PilotNavItem[] => {
    const items: PilotNavItem[] = [];
    const push = (x: PilotNavItem) => items.push(x);
    if (role === "analyst") {
      push({
        href: "/dealer-base",
        label: "Клиенты / ТТ",
        testId: "nav-clients-tps",
        navBehaviorId: "nav-dealer-base",
        ...dealerNavExtras(),
      });
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
