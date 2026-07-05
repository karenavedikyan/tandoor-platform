import type { ReactElement, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Circle,
  ClipboardList,
  Database,
  Home,
  LayoutGrid,
  ListTodo,
  MessageCircle,
  LogOut,
  Map,
  Megaphone,
  FileText,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { UserRole } from "@shared/auth";
import type { SalesRole } from "@/lib/sales-control-data";
import { Button } from "@/components/ui/button";
import { GlobalSearchDialog } from "@/components/search/global-search-dialog";
import { GlobalSearchTrigger } from "@/components/search/global-search-trigger";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import triangleMarkUrl from "@/assets/brand/tandoor-triangle-mark.svg";
import { TandoorLogo } from "@/components/tandoor-logo";
import { ThemeToggleDesktop, ThemeToggleSidebarCompact } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { SaveStatusBadge } from "@/components/client-base-actualization-save-status-badge";
import { cn } from "@/lib/utils";
import { flattenGroupedPilotNavigation, type PilotNavGroup, type PilotNavItem, type PilotNavigationModel } from "@/lib/auth-access";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { DealerTpOverridesSyncStatus } from "@/components/dealer-tp-overrides-sync-status";
import { SidebarNavFooter } from "@/components/layout/sidebar-nav-footer";
import { MarketingTopCarousel } from "@/components/marketing/MarketingTopCarousel";
import {
  ImpersonationQuickSwitch,
  type ImpersonationQuickSwitchUser,
} from "@/components/layout/impersonation-quick-switch";

const SIDEBAR_COLLAPSED_LS_KEY = "tandoor-shell-sidebar-collapsed-v1";

const MAIN_HREF = "/main";
const DEALER_BASE_HREF = "/dealer-base";
const TRADE_POINTS_HREF = "/trade-points";
const CLIENT_MAP_HREF = "/client-map";
const CATALOG_HREF = "/catalog";
const TASKS_HREF = "/tasks";
const TASKS_INBOX_HREF = "/assignments";
const ANALYTICS_HREF = "/analytics";
const TRAINING_HREF = "/training";
const SALES_CONTROL_HREF = "/sales-control";
const MARKETING_BRIEFS_HREF = "/marketing-briefs";
const LISTINGS_HREF = "/listings";
const SALES_MANAGER_HREF = "/sales-manager";
const COMMUNICATIONS_HREF = "/communications";
const CLIENT_BASE_ACTIVITY_HREF = "/client-base-activity";
const FEATURE_IN_DEVELOPMENT_HREF = "/feature-in-development";
const ACTUALIZATION_SAVE_STATUS_ROUTES = [
  "/dealers",
  "/client-base",
  "/dealer-base",
  "/actualization",
  "/manager-workspace",
  "/sales-manager",
  "/tasks",
  "/trade-points",
  "/client-map",
];

const ICON_BY_TESTID: Partial<Record<string, LucideIcon>> = {
  "nav-item-home": Home,
  "nav-item-clients": Users,
  "nav-item-clients-tps": Users,
  "nav-clients-tps": Users,
  "nav-item-client-map": Map,
  "nav-item-client-base-activity": BarChart3,
  "nav-item-team-activity": Users,
  "nav-team-activity": Users,
  "nav-item-showcase-tasks": ListTodo,
  "nav-item-tasks-inbox": ClipboardList,
  "nav-item-catalog": LayoutGrid,
  "nav-item-training": BookOpen,
  "nav-item-communications": MessageCircle,
  "nav-item-marketing-briefs": Megaphone,
  "nav-item-listings": FileText,
  "nav-client-base-activity": BarChart3,
  "nav-main": Home,
  "nav-client-map": Map,
  "nav-dealer-base": Users,
  "nav-catalog": LayoutGrid,
  "nav-tasks": ListTodo,
  "nav-communications": MessageCircle,
  "nav-training": BookOpen,
  "nav-sales-control": ClipboardList,
  "nav-marketing-briefs": Megaphone,
  "nav-listings": FileText,
  "nav-item-admin-brief-migrate": Database,
  "nav-item-admin-brief-migrate-top": Database,
  "nav-admin-brief-migrate": Database,
  "nav-item-admin-audit": Shield,
  "nav-admin-audit": Shield,
};

function pathMatchesNavHref(location: string, href: string): boolean {
  if (location === href) return true;
  if (href !== "/" && location.startsWith(`${href}/`)) return true;
  return false;
}

function isMainPath(path: string) {
  return path === "/" || path === MAIN_HREF || path === SALES_MANAGER_HREF;
}

function isDealerBasePath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === DEALER_BASE_HREF;
}

function isTradePointsPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === TRADE_POINTS_HREF;
}

function isClientMapPath(path: string) {
  return path === CLIENT_MAP_HREF || path.startsWith(`${CLIENT_MAP_HREF}/`);
}

function isClientsSectionPath(path: string) {
  return isDealerBasePath(path) || path.startsWith("/dealers/");
}

function isCatalogPath(path: string) {
  return path === CATALOG_HREF || path.startsWith(`${CATALOG_HREF}/`);
}

function isTasksPath(path: string) {
  return path === TASKS_HREF || path.startsWith(`${TASKS_HREF}/`);
}

function isTasksInboxPath(path: string) {
  return path === TASKS_INBOX_HREF || path.startsWith(`${TASKS_INBOX_HREF}/`);
}

function isCommunicationsPath(path: string) {
  return path === COMMUNICATIONS_HREF;
}

function isAnalyticsPath(path: string) {
  return path === ANALYTICS_HREF;
}

function isTrainingPath(path: string) {
  return path === TRAINING_HREF || path.startsWith(`${TRAINING_HREF}/`);
}

function isSalesControlPath(path: string) {
  return path === SALES_CONTROL_HREF || path.startsWith(`${SALES_CONTROL_HREF}/`);
}

function isSalesControlPlanFactPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === "/sales-control/plan-fact" || p.startsWith("/sales-control/plan-fact/");
}

function isClientBaseActivityPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === CLIENT_BASE_ACTIVITY_HREF;
}

function isMarketingBriefsPath(path: string) {
  return path === MARKETING_BRIEFS_HREF || path.startsWith(`${MARKETING_BRIEFS_HREF}/`);
}

function isListingsPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === LISTINGS_HREF || p.startsWith(`${LISTINGS_HREF}/`);
}

function isFeatureInDevelopmentPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === FEATURE_IN_DEVELOPMENT_HREF;
}

function behaviorId(item: PilotNavItem): string {
  return item.navBehaviorId ?? item.testId;
}

function isNavItemActive(item: PilotNavItem, location: string, isActiveFromLink?: boolean): boolean {
  if (isActiveFromLink !== undefined) return isActiveFromLink;
  if (item.developmentFeature) {
    const pathOnly = location.split("?")[0] ?? location;
    if (pathOnly !== FEATURE_IN_DEVELOPMENT_HREF) return false;
    const q = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    return new URLSearchParams(q).get("feature") === item.developmentFeature;
  }
  const bid = behaviorId(item);
  if (bid === "nav-main") return isMainPath(location);
  if (bid === "nav-dealer-base") return isClientsSectionPath(location) || isTradePointsPath(location);
  if (bid === "nav-catalog") return isCatalogPath(location);
  if (bid === "nav-tasks") return isTasksPath(location);
  if (bid === "nav-tasks-inbox") return isTasksInboxPath(location);
  if (bid === "nav-communications") return isCommunicationsPath(location);
  if (bid === "nav-analytics") return isAnalyticsPath(location);
  if (bid === "nav-training") return isTrainingPath(location);
  if (bid === "nav-sales-control") return isSalesControlPath(location);
  if (bid === "nav-client-map") return isClientMapPath(location);
  if (bid === "nav-marketing-briefs") return isMarketingBriefsPath(location);
  if (bid === "nav-listings") return isListingsPath(location);
  if (bid === "nav-client-base-activity") return isClientBaseActivityPath(location);
  return pathMatchesNavHref(location, item.href);
}

function navLinkClass(
  item: PilotNavItem,
  location: string,
  variant: "sidebar" | "drawer",
  linkStyle: "legacy" | "pilot",
  isActiveFromLink?: boolean,
) {
  const active = isNavItemActive(item, location, isActiveFromLink);
  const base =
    variant === "sidebar"
      ? "flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors"
      : "flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors";
  if (linkStyle === "pilot") {
    return cn(
      base,
      active
        ? "border-l-[3px] border-[#9ACA3C] bg-white font-semibold text-[#222631] shadow-[0_1px_2px_rgba(154,202,60,0.15)] dark:bg-card dark:text-foreground"
        : "border-l-[3px] border-transparent text-[#8F96B0] hover:bg-[#EEEFF6]/80 hover:text-[#222631]",
      item.comingSoon && !active && "opacity-95",
    );
  }
  return cn(
    base,
    active
      ? "border-l-[3px] border-primary bg-primary/12 font-semibold text-foreground shadow-sm"
      : "border-l-[3px] border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function headerContextLabel(location: string) {
  const pathOnly = location.split("?")[0] ?? location;
  if (pathOnly === "/bitrix24" || pathOnly === "/embedded/bitrix24") return "Bitrix24";
  if (isFeatureInDevelopmentPath(pathOnly)) return "В разработке";
  if (isCommunicationsPath(pathOnly)) return "Коммуникации";
  if (isClientBaseActivityPath(location)) return "Статистика обновления базы";
  if (isSalesControlPlanFactPath(location)) return "План-факт и KPI";
  if (isMainPath(location)) return "Главная";
  if (isTradePointsPath(pathOnly)) return "Клиенты / ТТ";
  if (location.startsWith("/dealers/")) return "Карточка клиента";
  if (isDealerBasePath(location)) return "Клиенты / ТТ";
  if (isClientMapPath(location)) return "Карта клиентов";
  if (isTasksInboxPath(location)) return "Задачи";
  if (isTasksPath(location)) return "Задачи по витрине";
  if (isCatalogPath(location)) return "Каталог";
  if (isAnalyticsPath(location)) return "Аналитика";
  if (isTrainingPath(location)) return "Обучение";
  if (isSalesControlPath(location)) return "План-факт продаж";
  if (isMarketingBriefsPath(location)) return "Маркетинговые брифы";
  if (isListingsPath(location)) return "Листовки";
  return "";
}

function BrandBlock({ className, homeHref }: { className?: string; homeHref: string }) {
  return (
    <div className={cn("flex flex-col items-start px-0.5", className)}>
      <Link href={homeHref} className="block w-full max-w-[168px] leading-none no-underline">
        <TandoorLogo className="max-h-[52px] w-full max-w-[168px] object-contain object-left" data-testid="brand-logo-tandoor" />
      </Link>
    </div>
  );
}

function flattenNavModel(model: PilotNavigationModel): PilotNavItem[] {
  if (model.layout === "flat") return model.items;
  return flattenGroupedPilotNavigation(model);
}

const PILOT_SIDEBAR_OPEN_GROUPS_LS_KEY = "tandoor-pilot-sidebar-open-groups-v1";

const NAV_GROUP_TOGGLE_TESTID: Record<string, string> = {
  "in-development": "button-nav-group-in-development-toggle",
};

const NAV_GROUP_CONTENT_TESTID: Record<string, string> = {
  "in-development": "nav-group-in-development-content",
};

const NAV_GROUP_SUMMARY_TESTID: Record<string, string> = {
  "in-development": "text-nav-group-in-development-summary",
};

type PilotOpenGroupsMap = Record<string, boolean>;

function readPilotSidebarOpenGroupsFromStorage(): Partial<PilotOpenGroupsMap> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PILOT_SIDEBAR_OPEN_GROUPS_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<PilotOpenGroupsMap>;
  } catch {
    return null;
  }
}

function writePilotSidebarOpenGroupsToStorage(state: PilotOpenGroupsMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PILOT_SIDEBAR_OPEN_GROUPS_LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

function groupHasActiveItem(group: PilotNavGroup, location: string): boolean {
  return group.items.some((item) => isNavItemActive(item, location));
}

function defaultGroupOpenWithoutStorage(groupKey: string, location: string, groups: PilotNavGroup[]): boolean {
  const g = groups.find((x) => x.key === groupKey);
  if (!g) return false;
  const active = groupHasActiveItem(g, location);
  // Промт 55: «В разработке» свёрнут по умолчанию.
  if (groupKey === "in-development") return active;
  return active;
}

function computePilotOpenGroupsMerged(
  groups: PilotNavGroup[],
  location: string,
  saved: Partial<PilotOpenGroupsMap> | null,
): PilotOpenGroupsMap {
  const out: PilotOpenGroupsMap = {};
  for (const g of groups) {
    if (groupHasActiveItem(g, location)) {
      out[g.key] = true;
      continue;
    }
    const persisted = saved?.[g.key];
    if (typeof persisted === "boolean") {
      out[g.key] = persisted;
    } else {
      out[g.key] = defaultGroupOpenWithoutStorage(g.key, location, groups);
    }
  }
  return out;
}

function usePilotGroupedNavOpenState(model: PilotNavigationModel, location: string) {
  const groups = model.layout === "grouped" ? model.groups : null;
  const [openGroups, setOpenGroups] = useState<PilotOpenGroupsMap | null>(() => {
    if (model.layout !== "grouped") return null;
    return computePilotOpenGroupsMerged(model.groups, location, null);
  });

  useLayoutEffect(() => {
    if (model.layout !== "grouped") {
      setOpenGroups(null);
      return;
    }
    const saved = readPilotSidebarOpenGroupsFromStorage();
    setOpenGroups(computePilotOpenGroupsMerged(model.groups, location, saved));
  }, [model, location]);

  const toggleGroup = useCallback(
    (key: string) => {
      setOpenGroups((prev) => {
        if (!prev || model.layout !== "grouped") return prev;
        const groupKeys = model.groups.map((g) => g.key);
        const nextFull = { ...prev, [key]: !prev[key] };
        const pruned: PilotOpenGroupsMap = {};
        for (const k of groupKeys) {
          pruned[k] = Boolean(nextFull[k]);
        }
        writePilotSidebarOpenGroupsToStorage(pruned);
        return pruned;
      });
    },
    [model],
  );

  return { openGroups, toggleGroup };
}

function NavRowLink({
  item,
  location,
  variant,
  onNavigate,
  linkStyle,
  pilotWipTag,
}: {
  item: PilotNavItem;
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  linkStyle: "legacy" | "pilot";
  /** Muted «в разработке» справа (меню директора/РОПа). */
  pilotWipTag?: boolean;
}) {
  const bid = behaviorId(item);
  const pulse = bid === "nav-dealer-base" && item.badgeLoading;
  const countTestId =
    variant === "sidebar" ? "text-sidebar-clients-count" : "text-mobile-sidebar-clients-count";
  const badgeClass =
    linkStyle === "pilot"
      ? "h-6 min-w-6 shrink-0 rounded-md border border-[#E3E6F3] bg-[#EEEFF6] px-1.5 text-xs tabular-nums text-[#222631]"
      : "h-6 min-w-6 shrink-0 rounded-md border border-border/60 bg-muted px-1.5 text-xs tabular-nums text-foreground";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={(active) => navLinkClass(item, location, variant, linkStyle, active)}
      data-testid={item.testId}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
        <span className="truncate">{item.label}</span>
        {item.comingSoon && !pilotWipTag ? (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-[#E3E6F3] bg-[#EEEFF6] px-1.5 text-[10px] font-semibold uppercase text-[#8F96B0]"
          >
            скоро
          </Badge>
        ) : null}
      </span>
      {pilotWipTag ? (
        <Badge
          variant="outline"
          className="h-5 max-w-[min(7.5rem,42vw)] shrink-0 truncate border-[#E3E6F3] bg-[#EEEFF6] px-1.5 text-[10px] font-medium normal-case text-[#8F96B0]"
        >
          в разработке
        </Badge>
      ) : pulse ? (
        <span
          className="h-6 min-w-7 shrink-0 animate-pulse rounded-md bg-muted"
          aria-busy
          aria-label="Загрузка количества клиентов"
          data-testid={countTestId}
        />
      ) : item.badge != null ? (
        <Badge variant="secondary" className={badgeClass} data-testid={countTestId}>
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );
}

function NavLinksList({
  items,
  location,
  variant,
  onNavigate,
  "data-testid": navTestId,
}: {
  items: PilotNavItem[];
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  "data-testid": string;
}) {
  return (
    <nav className="flex flex-col gap-0.5" data-testid={navTestId}>
      {items.map((item) => (
        <NavRowLink
          key={item.testId}
          item={item}
          location={location}
          variant={variant}
          onNavigate={onNavigate}
          linkStyle="legacy"
        />
      ))}
    </nav>
  );
}

function PilotNavGroupedList({
  groups,
  leadingItems = [],
  standaloneItems = [],
  location,
  variant,
  onNavigate,
  openGroups,
  onToggleGroup,
  "data-testid": navTestId,
}: {
  groups: PilotNavGroup[];
  leadingItems?: PilotNavItem[];
  standaloneItems?: PilotNavItem[];
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  openGroups: PilotOpenGroupsMap;
  onToggleGroup: (groupKey: string) => void;
  "data-testid": string;
}) {
  const flatLeading = [...leadingItems, ...standaloneItems];

  return (
    <div className="flex min-w-0 flex-col gap-2 overflow-x-hidden" data-testid={navTestId}>
      {flatLeading.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-0.5" data-testid="nav-leading-items">
          {flatLeading.map((item) => (
            <NavRowLink
              key={item.testId}
              item={item}
              location={location}
              variant={variant}
              onNavigate={onNavigate}
              linkStyle="pilot"
            />
          ))}
        </div>
      ) : null}

      {groups.map((g) => {
        const isOpen = Boolean(openGroups[g.key]);
        const groupActive = groupHasActiveItem(g, location);
        const titleColor = groupActive ? "text-[#222631]" : "text-[#8F96B0]";
        const summaryLine = g.key === "in-development" ? `${g.items.length} разделов` : null;

        const toggleTestId = NAV_GROUP_TOGGLE_TESTID[g.key] ?? `button-nav-group-${g.key}-toggle`;
        const contentTestId = NAV_GROUP_CONTENT_TESTID[g.key] ?? `nav-group-${g.key}-content`;
        const summaryTestId = NAV_GROUP_SUMMARY_TESTID[g.key] ?? `text-nav-group-${g.key}-summary`;

        return (
          <div key={g.key} data-testid={g.testId} className="flex min-w-0 flex-col gap-0.5">
            <button
              type="button"
              data-testid={toggleTestId}
              aria-expanded={isOpen}
              onClick={() => onToggleGroup(g.key)}
              className="w-full min-w-0 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[#EEEFF6]/60"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[10px] font-semibold uppercase leading-tight tracking-wide", titleColor)}>{g.label}</p>
                  {summaryLine != null && summaryLine !== "" ? (
                    <p data-testid={summaryTestId} className="mt-0.5 text-[10px] leading-snug text-[#8F96B0]/90">
                      {summaryLine}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-[#8F96B0] transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </div>
              </div>
            </button>
            {isOpen ? (
              <div data-testid={contentTestId} className="flex min-w-0 flex-col gap-0.5">
                {g.items.map((item) => (
                  <NavRowLink
                    key={item.testId}
                    item={item}
                    location={location}
                    variant={variant}
                    onNavigate={onNavigate}
                    linkStyle="pilot"
                    pilotWipTag={g.key === "in-development"}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CollapsedNavList({ items, location }: { items: PilotNavItem[]; location: string }) {
  return (
    <nav className="flex flex-col items-center gap-1" data-testid="nav-preview-desktop-collapsed">
      {items.map((item) => {
        const Icon = ICON_BY_TESTID[item.testId] ?? ICON_BY_TESTID[item.navBehaviorId ?? ""] ?? Circle;
        const active = isNavItemActive(item, location);
        const hasBadge = item.badge != null || item.badgeLoading;
        const shortLabel = item.label.replace(/\s*\([^)]*\)\s*$/, "").trim() || item.label;
        return (
          <Link
            key={item.testId}
            href={item.href}
            title={shortLabel}
            aria-label={shortLabel}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg no-underline transition-colors",
              active
                ? "bg-white text-[#222631] shadow-[0_1px_2px_rgba(154,202,60,0.15)] ring-1 ring-[#9ACA3C]/25 dark:bg-card dark:text-foreground"
                : "text-[#8F96B0] hover:bg-[#EEEFF6]/80 hover:text-[#222631]",
            )}
            data-testid={item.testId}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {hasBadge ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#9ACA3C]" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function useShellSidebarCollapsedState() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapseAllowed, setCollapseAllowed] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const syncFromStorage = () => {
      const isXl = mq.matches;
      setCollapseAllowed(isXl);
      if (!isXl) {
        setSidebarCollapsed(false);
        return;
      }
      try {
        const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_LS_KEY);
        setSidebarCollapsed(raw === "1");
      } catch {
        setSidebarCollapsed(false);
      }
    };
    syncFromStorage();
    mq.addEventListener("change", syncFromStorage);
    return () => mq.removeEventListener("change", syncFromStorage);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (!collapseAllowed) return;
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [collapseAllowed]);

  const effectiveCollapsed = collapseAllowed && sidebarCollapsed;
  return { effectiveCollapsed, toggleSidebar, collapseAllowed };
}

function NavigationPanel({
  model,
  location,
  variant,
  onNavigate,
  navTestId,
  groupedOpen,
  onGroupedToggle,
}: {
  model: PilotNavigationModel;
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  navTestId: string;
  groupedOpen: PilotOpenGroupsMap | null;
  onGroupedToggle: (groupKey: string) => void;
}) {
  if (model.layout === "flat") {
    return (
      <NavLinksList items={model.items} location={location} variant={variant} onNavigate={onNavigate} data-testid={navTestId} />
    );
  }
  return (
    <PilotNavGroupedList
      groups={model.groups}
      leadingItems={model.leadingItems}
      standaloneItems={model.standaloneItems}
      location={location}
      variant={variant}
      onNavigate={onNavigate}
      openGroups={groupedOpen ?? computePilotOpenGroupsMerged(model.groups, location, null)}
      onToggleGroup={onGroupedToggle}
      data-testid={navTestId}
    />
  );
}

function shellPathWithoutQuery(location: string): string {
  const raw = location.split("?")[0] ?? "/";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "/";
}

/** Компактный статус актуализации: только на рабочих маршрутах актуализации (не /admin, не профиль). */
function isClientBaseActualizationShellBadgeRoute(location: string): boolean {
  const p = shellPathWithoutQuery(location);
  if (p.startsWith("/admin")) return false;
  if (p === "/profile" || p.startsWith("/profile/")) return false;
  if (p === "/users" || p.startsWith("/users/")) return false;
  if (p.startsWith("/reset-requests")) return false;
  const starts = (prefix: string) => p === prefix || p.startsWith(`${prefix}/`);
  if (p.startsWith("/dealers")) return true;
  if (starts("/client-base")) return true;
  if (starts("/dealer-base")) return true;
  if (starts("/actualization")) return true;
  if (starts("/manager-workspace")) return true;
  if (p === "/" || p === "/main" || p === "/sales-manager") return true;
  if (starts("/tasks")) return true;
  if (starts("/trade-points")) return true;
  if (starts("/client-map")) return true;
  if (p === "/client-base-activity") return true;
  if (p === "/dealer-card-foundation") return true;
  return false;
}

function ClientBaseActualizationShellBadge({ location }: { location: string }): ReactElement | null {
  const actx = useClientBaseActualization();
  if (!actx.enabled) return null;
  if (!isClientBaseActualizationShellBadgeRoute(location)) return null;
  const showLegacyActualizationBadge = actx.syncStatus !== "local_fallback";

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-2" data-testid="section-app-shell-client-base-actualization-badge">
      <DealerTpOverridesSyncStatus compact />
      {showLegacyActualizationBadge ? (
        <ClientBaseActualizationSyncStatus
          compact
          scope="actualization-blob"
          isLoading={actx.loading}
          syncStatus={actx.syncStatus}
          meta={actx.meta}
          onRetry={() => void actx.refresh()}
        />
      ) : null}
    </div>
  );
}

export type AppShellProps = {
  children: ReactNode;
  navigation: PilotNavigationModel;
  homeHref: string;
  userName: string;
  cityLabel?: string;
  onLogout: () => void;
  /** Ссылка «Журнал событий» в шапке для ролей с `audit.read`. */
  showAuditLogLink?: boolean;
  /** POC Bitrix24: без боковых панелей и с компактной шапкой. */
  embeddedBitrix24?: boolean;
  /** Жёлтая плашка режима наблюдения (admin impersonation). */
  impersonationBanner?: ReactNode;
  /** Текущий пользователь для быстрого переключения «Войти как…» (только admin). */
  shellUser?: ImpersonationQuickSwitchUser | null;
  isImpersonating?: boolean;
  /** Временная диагностика ролей для сайдбара (промт 104.3). */
  navDebugRoles?: { salesRole: SalesRole; platformUserRole: UserRole };
};

export function AppShell({
  children,
  navigation,
  homeHref,
  userName,
  cityLabel = "—",
  onLogout,
  showAuditLogLink = false,
  embeddedBitrix24 = false,
  impersonationBanner,
  shellUser = null,
  isImpersonating = false,
  navDebugRoles,
}: AppShellProps) {
  useEffect(() => {
    if (navDebugRoles) {
      console.debug("[nav-debug]", navDebugRoles);
    }
  }, [navDebugRoles]);

  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [impersonationAutoOpen, setImpersonationAutoOpen] = useState(false);
  const ctx = headerContextLabel(location);
  const flatNav = useMemo(() => flattenNavModel(navigation), [navigation]);
  const { effectiveCollapsed: sidebarCollapsed, toggleSidebar, collapseAllowed } = useShellSidebarCollapsedState();

  const requestExpandForImpersonation = useCallback(() => {
    if (sidebarCollapsed) {
      toggleSidebar();
      setImpersonationAutoOpen(true);
    }
  }, [sidebarCollapsed, toggleSidebar]);
  const { openGroups: pilotGroupedOpen, toggleGroup: pilotGroupedToggle } = usePilotGroupedNavOpenState(navigation, location);
  const showSaveBadge = ACTUALIZATION_SAVE_STATUS_ROUTES.some((p) => location === p || location.startsWith(`${p}/`));

  const openGlobalSearch = useCallback(() => setGlobalSearchOpen(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable;
        if (isEditable && target.getAttribute("data-testid") !== "global-search-input") return;
      }
      e.preventDefault();
      setGlobalSearchOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (embeddedBitrix24) {
    return (
      <div
        className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground"
        data-testid="app-shell-embedded-bitrix24"
      >
        {impersonationBanner}
        <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 px-3 py-2 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <BrandBlock homeHref={homeHref} className="max-w-[132px]" />
            <div className="flex shrink-0 items-center gap-2">
              <GlobalSearchTrigger variant="mobile" onOpen={openGlobalSearch} />
              {showSaveBadge ? <SaveStatusBadge /> : null}
              <NotificationsBell />
              <ThemeToggleDesktop className="h-9 w-9" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1 border-border/80 px-2.5 text-xs"
                data-testid="button-auth-logout"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Выход</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-5">
          <ClientBaseActualizationShellBadge location={location} />
          {children}
        </main>
        <GlobalSearchDialog
          open={globalSearchOpen}
          onOpenChange={setGlobalSearchOpen}
          role={shellUser?.role ?? null}
        />
      </div>
    );
  }

  return (
    <>
      {impersonationBanner}
      <div
        className="flex min-h-screen overflow-x-hidden bg-background text-foreground"
        data-testid="app-shell-desktop"
      >
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border/70 bg-card shadow-sm transition-[width] duration-200 ease-out lg:flex",
          sidebarCollapsed ? "w-[68px]" : "w-[260px]",
        )}
        data-testid="app-shell-sidebar"
        aria-label="Основная навигация"
        aria-expanded={!sidebarCollapsed}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 pb-4 pt-5">
          {sidebarCollapsed ? (
            <Link
              href={homeHref}
              className="flex shrink-0 items-center justify-center no-underline"
              aria-label="На главную"
              data-testid="brand-logo-tandoor-collapsed"
            >
              <img
                src={triangleMarkUrl}
                alt="Tandoor"
                className="h-8 w-8 object-contain"
                draggable={false}
              />
            </Link>
          ) : (
            <BrandBlock homeHref={homeHref} className="min-w-0 flex-1" />
          )}
          {collapseAllowed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-7 w-7 shrink-0 xl:inline-flex"
              onClick={toggleSidebar}
              data-testid="button-shell-sidebar-toggle"
              aria-label={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              )}
            </Button>
          ) : null}
        </div>
        {shellUser ? (
          <div
            className={cn("px-3", sidebarCollapsed ? "pt-2" : "mt-3")}
            data-testid="sidebar-impersonation-quick-wrap"
          >
            {sidebarCollapsed ? (
              <ImpersonationQuickSwitch
                currentUser={shellUser}
                isImpersonating={isImpersonating}
                layout="collapsed"
                sidebarCollapsed={sidebarCollapsed}
                onRequestExpandSidebar={requestExpandForImpersonation}
              />
            ) : (
              <ImpersonationQuickSwitch
                currentUser={shellUser}
                isImpersonating={isImpersonating}
                layout="sidebar"
                sidebarCollapsed={sidebarCollapsed}
                autoOpenPicker={impersonationAutoOpen}
                onAutoOpenPickerConsumed={() => setImpersonationAutoOpen(false)}
              />
            )}
          </div>
        ) : null}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E3E6F3] [&::-webkit-scrollbar-track]:bg-transparent">
          {sidebarCollapsed ? (
            <CollapsedNavList items={flatNav} location={location} />
          ) : (
            <NavigationPanel
              model={navigation}
              location={location}
              variant="sidebar"
              navTestId="nav-preview-desktop"
              groupedOpen={pilotGroupedOpen}
              onGroupedToggle={pilotGroupedToggle}
            />
          )}
        </div>
        {sidebarCollapsed ? (
          <div className="mt-auto border-t border-border/60 px-2 py-3">
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={onLogout}
                aria-label="Выйти"
                data-testid="button-shell-collapsed-logout"
              >
                <LogOut className="h-4 w-4 text-[#8F96B0]" aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <SidebarNavFooter
            userName={userName}
            userSubtitle={cityLabel !== "—" ? cityLabel : undefined}
            onLogout={onLogout}
            paddingClass="px-3 pb-4"
            showSchemaVersionBadge={navDebugRoles?.platformUserRole === "admin"}
          />
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-40 hidden min-h-[56px] w-full border-b border-border/70 bg-card shadow-xs lg:flex"
          data-testid="app-shell-topbar"
        >
          <div className="mx-auto flex w-full max-w-[1600px] min-w-0 items-center gap-4 px-4 py-2">
          <div className="flex min-w-0 max-w-xl flex-1" role="search">
            <GlobalSearchTrigger variant="desktop" onOpen={openGlobalSearch} />
          </div>
          <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            {showSaveBadge ? <SaveStatusBadge /> : null}
            <NotificationsBell />
            <ThemeToggleDesktop />
            <Button type="button" variant="outline" size="sm" className="max-w-[10rem] truncate border-border/80" data-testid="button-current-city">
              <span data-testid="text-current-city">{cityLabel}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-w-[12rem] truncate border-border/80"
                  data-testid="button-manager-profile"
                >
                  {userName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href="/profile" data-testid="link-app-shell-profile">
                    <UserRound className="mr-2 h-4 w-4" aria-hidden />
                    Профиль
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onLogout();
                  }}
                  data-testid="button-app-shell-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  Выход
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </header>

        <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90 lg:hidden">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-border/80 bg-card"
                    type="button"
                    data-testid="button-mobile-nav-open"
                    aria-label="Открыть меню"
                  >
                    <Menu className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="flex w-[min(100vw-2rem,300px)] flex-col gap-0 overflow-y-auto border-r border-border/70 bg-card p-0"
                >
                  <div className="border-b border-border/60 px-5 pb-3 pt-4">
                    <BrandBlock homeHref={homeHref} />
                  </div>
                  <SheetHeader className="px-5 pt-3 text-left">
                    <SheetTitle className="text-left text-base">Разделы</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 px-5 pb-4 pt-2">
                    <NavigationPanel
                      model={navigation}
                      location={location}
                      variant="drawer"
                      onNavigate={() => setMobileOpen(false)}
                      navTestId="nav-preview-mobile"
                      groupedOpen={pilotGroupedOpen}
                      onGroupedToggle={pilotGroupedToggle}
                    />
                  </div>
                  <ThemeToggleSidebarCompact />
                  <div className="border-t border-border/60 px-5 pb-4 pt-3">
                    {shellUser ? (
                      <div className="mb-3">
                        <ImpersonationQuickSwitch
                          currentUser={shellUser}
                          isImpersonating={isImpersonating}
                          layout="mobile"
                        />
                      </div>
                    ) : null}
                    <p className="mb-2 text-xs text-muted-foreground">{userName}</p>
                    <Button asChild variant="outline" className="mb-2 w-full gap-2">
                      <Link href="/profile" data-testid="link-app-shell-profile-mobile" onClick={() => setMobileOpen(false)}>
                        <UserRound className="h-4 w-4" aria-hidden />
                        Профиль
                      </Link>
                    </Button>
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={onLogout}>
                      <LogOut className="h-4 w-4" aria-hidden />
                      Выйти
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              {ctx ? (
                <p className="min-w-0 truncate text-sm font-medium text-muted-foreground" data-testid="text-mobile-header-context">
                  {ctx}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <GlobalSearchTrigger variant="mobile" onOpen={openGlobalSearch} />
              <NotificationsBell />
              {showSaveBadge ? <SaveStatusBadge /> : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7">
          <ClientBaseActualizationShellBadge location={location} />
          <MarketingTopCarousel />
          {children}
        </main>
      </div>
    </div>
    <GlobalSearchDialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} role={shellUser?.role ?? null} />
    </>
  );
}
