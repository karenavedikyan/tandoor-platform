import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Home,
  LayoutGrid,
  ListTodo,
  MessageCircle,
  LogOut,
  Map,
  MapPinned,
  Megaphone,
  Menu,
  Monitor,
  Moon,
  PieChart,
  Search,
  Store,
  Sun,
  Users,
} from "lucide-react";
import { Fragment, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { TandoorLogo } from "@/components/tandoor-logo";
import { ThemeToggleDesktop, themeChoiceLabel } from "@/components/theme-toggle";
import { useTheme } from "@/context/theme-provider";
import { cn } from "@/lib/utils";
import { flattenGroupedPilotNavigation, type PilotNavGroup, type PilotNavItem, type PilotNavigationModel } from "@/lib/auth-access";

const MAIN_HREF = "/main";
const TERRITORY_CARD_HREF = "/territory-card";
const DEALER_BASE_HREF = "/dealer-base";
const TRADE_POINTS_HREF = "/trade-points";
const CLIENT_MAP_HREF = "/client-map";
const CATALOG_HREF = "/catalog";
const TASKS_HREF = "/tasks";
const ANALYTICS_HREF = "/analytics";
const TRAINING_HREF = "/training";
const SALES_CONTROL_HREF = "/sales-control";
const ANALYTICS_WORKSPACE_HREF = "/analytics-workspace";
const MARKETING_BRIEFS_HREF = "/marketing-briefs";
const SALES_MANAGER_HREF = "/sales-manager";
const COMMUNICATIONS_HREF = "/communications";
const CLIENT_BASE_ACTIVITY_HREF = "/client-base-activity";
const FEATURE_IN_DEVELOPMENT_HREF = "/feature-in-development";

/** Tandoor nav: единая строка пункта (desktop sidebar + mobile drawer). */
const NAV_ROW_BASE =
  "flex h-11 min-h-[44px] w-full max-w-full shrink-0 items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium no-underline transition-colors";

function navRowClass(active: boolean, opts?: { dimmed?: boolean }) {
  return cn(
    NAV_ROW_BASE,
    active
      ? "border-l-[3px] border-[#9ACA3C] bg-white font-semibold text-[#222631] shadow-sm"
      : "border-l-[3px] border-transparent bg-transparent text-[#8F96B0] hover:bg-[#EEEFF6] hover:text-[#222631] active:bg-[#EEEFF6]/80",
    opts?.dimmed && "opacity-90",
  );
}

/** Заголовок раскрываемой группы (не выглядит как активный nav item). */
function navGroupHeaderButtonClass(groupHasActiveChild: boolean) {
  return cn(
    "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left transition-colors",
    "hover:bg-[#EEEFF6]/80",
    groupHasActiveChild ? "text-[#222631]" : "text-[#8F96B0]",
  );
}

function navCountBadgeClass() {
  return "h-6 min-w-6 shrink-0 rounded-md border border-[#E3E6F3] bg-[#EEEFF6] px-1.5 text-xs font-medium tabular-nums leading-none text-[#222631]";
}

function navWipBadgeClass() {
  return "max-w-[min(7rem,36vw)] shrink-0 truncate rounded-md border border-[#E3E6F3] bg-[#EEEFF6] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-[#8F96B0]";
}

function navSkeletonPulseClass() {
  return "h-6 min-w-7 shrink-0 animate-pulse rounded-md bg-[#EEEFF6]";
}

const ICON_BY_TESTID: Partial<Record<string, LucideIcon>> = {
  "nav-item-home": Home,
  "nav-item-territory-card": MapPinned,
  "nav-item-clients": Users,
  "nav-item-trade-points": Store,
  "nav-item-client-map": Map,
  "nav-item-client-base-activity": BarChart3,
  "nav-item-sales-plan-fact": ClipboardList,
  "nav-item-team-analytics": PieChart,
  "nav-item-showcase-tasks": ListTodo,
  "nav-item-catalog": LayoutGrid,
  "nav-item-training": BookOpen,
  "nav-item-communications": MessageCircle,
  "nav-item-marketing-briefs": Megaphone,
  "nav-client-base-activity": BarChart3,
  "nav-main": Home,
  "nav-client-map": Map,
  "nav-territory-card": MapPinned,
  "nav-dealer-base": Users,
  "nav-trade-points": Store,
  "nav-catalog": LayoutGrid,
  "nav-tasks": ListTodo,
  "nav-communications": MessageCircle,
  "nav-training": BookOpen,
  "nav-sales-control": ClipboardList,
  "nav-analytics-workspace": PieChart,
  "nav-marketing-briefs": Megaphone,
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
  return path === DEALER_BASE_HREF;
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

function isCommunicationsPath(path: string) {
  return path === COMMUNICATIONS_HREF;
}

function isAnalyticsPath(path: string) {
  return path === ANALYTICS_HREF;
}

function isTerritoryCardPath(path: string) {
  return path === TERRITORY_CARD_HREF;
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

function isAnalyticsWorkspacePath(path: string) {
  return path === ANALYTICS_WORKSPACE_HREF || path.startsWith(`${ANALYTICS_WORKSPACE_HREF}/`);
}

function isClientBaseActivityPath(path: string) {
  const p = path.split("?")[0] ?? path;
  return p === CLIENT_BASE_ACTIVITY_HREF;
}

function isMarketingBriefsPath(path: string) {
  return path === MARKETING_BRIEFS_HREF || path.startsWith(`${MARKETING_BRIEFS_HREF}/`);
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
  if (bid === "nav-dealer-base") return isClientsSectionPath(location);
  if (bid === "nav-trade-points") return isTradePointsPath(location);
  if (bid === "nav-catalog") return isCatalogPath(location);
  if (bid === "nav-tasks") return isTasksPath(location);
  if (bid === "nav-communications") return isCommunicationsPath(location);
  if (bid === "nav-territory-card") return isTerritoryCardPath(location);
  if (bid === "nav-analytics") return isAnalyticsPath(location);
  if (bid === "nav-training") return isTrainingPath(location);
  if (bid === "nav-sales-control") return isSalesControlPath(location);
  if (bid === "nav-analytics-workspace") return isAnalyticsWorkspacePath(location);
  if (bid === "nav-client-map") return isClientMapPath(location);
  if (bid === "nav-marketing-briefs") return isMarketingBriefsPath(location);
  if (bid === "nav-client-base-activity") return isClientBaseActivityPath(location);
  return pathMatchesNavHref(location, item.href);
}

function isIconRailActive(href: string, location: string) {
  if (href === MAIN_HREF) return isMainPath(location);
  return pathMatchesNavHref(location, href);
}

function navLinkClass(
  item: PilotNavItem,
  location: string,
  _variant: "sidebar" | "drawer",
  _linkStyle: "legacy" | "pilot",
  isActiveFromLink?: boolean,
) {
  const active = isNavItemActive(item, location, isActiveFromLink);
  return navRowClass(active, { dimmed: Boolean(item.comingSoon && !active) });
}

function headerContextLabel(location: string) {
  const pathOnly = location.split("?")[0] ?? location;
  if (pathOnly === "/bitrix24" || pathOnly === "/embedded/bitrix24") return "Bitrix24";
  if (isFeatureInDevelopmentPath(pathOnly)) return "В разработке";
  if (isCommunicationsPath(pathOnly)) return "Коммуникации";
  if (isClientBaseActivityPath(location)) return "Статистика обновления базы";
  if (isSalesControlPlanFactPath(location)) return "План-факт и KPI";
  if (isMainPath(location)) return "Главная";
  if (isTradePointsPath(pathOnly)) return "Торговые точки";
  if (location.startsWith("/dealers/")) return "Карточка клиента";
  if (isDealerBasePath(location)) return "Клиенты";
  if (isClientMapPath(location)) return "Карта клиентов";
  if (isTasksPath(location)) return "Задачи по витрине";
  if (isCatalogPath(location)) return "Каталог";
  if (isTerritoryCardPath(location)) return "Карточка территории";
  if (isAnalyticsPath(location)) return "Аналитика";
  if (isTrainingPath(location)) return "Обучение";
  if (isSalesControlPath(location)) return "План-факт продаж";
  if (isAnalyticsWorkspacePath(location)) return "Аналитика команды";
  if (isMarketingBriefsPath(location)) return "Маркетинговые брифы";
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
  "client-base": "button-nav-group-client-base-toggle",
  "in-development": "button-nav-group-in-development-toggle",
};

const NAV_GROUP_CONTENT_TESTID: Record<string, string> = {
  "client-base": "nav-group-client-base-content",
  "in-development": "nav-group-in-development-content",
};

const NAV_GROUP_SUMMARY_TESTID: Record<string, string> = {
  "client-base": "text-nav-group-client-base-summary",
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
  if (groupKey === "client-base") return true;
  if (groupKey === "in-development") return false;
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

function pilotNavClientBaseCounts(group: PilotNavGroup): {
  clients: number | null;
  tradePoints: number | null;
  clientsLoading: boolean;
  tradePointsLoading: boolean;
} {
  let clients: number | null = null;
  let tradePoints: number | null = null;
  let clientsLoading = false;
  let tradePointsLoading = false;
  for (const item of group.items) {
    const bid = behaviorId(item);
    if (bid === "nav-dealer-base") {
      clientsLoading = Boolean(item.badgeLoading);
      if (item.badge != null) clients = item.badge;
    }
    if (bid === "nav-trade-points") {
      tradePointsLoading = Boolean(item.badgeLoading);
      if (item.badge != null) tradePoints = item.badge;
    }
  }
  return { clients, tradePoints, clientsLoading, tradePointsLoading };
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
  const pulse = (bid === "nav-dealer-base" || bid === "nav-trade-points") && item.badgeLoading;
  const countTestId =
    bid === "nav-trade-points"
      ? variant === "sidebar"
        ? "text-sidebar-trade-points-count"
        : "text-mobile-sidebar-trade-points-count"
      : variant === "sidebar"
        ? "text-sidebar-clients-count"
        : "text-mobile-sidebar-clients-count";
  const badgeClass = navCountBadgeClass();

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
        <span className={navWipBadgeClass()} aria-label="Раздел в разработке">
          в разработке
        </span>
      ) : pulse ? (
        <span
          className={navSkeletonPulseClass()}
          aria-busy
          aria-label={bid === "nav-trade-points" ? "Загрузка количества точек" : "Загрузка количества клиентов"}
          data-testid={countTestId}
        />
      ) : item.badge != null ? (
        <span className={badgeClass} data-testid={countTestId}>
          {item.badge}
        </span>
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
    <nav className="flex min-w-0 flex-col gap-0.5" data-testid={navTestId}>
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
  standaloneItems = [],
  location,
  variant,
  onNavigate,
  openGroups,
  onToggleGroup,
  "data-testid": navTestId,
}: {
  groups: PilotNavGroup[];
  standaloneItems?: PilotNavItem[];
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  openGroups: PilotOpenGroupsMap;
  onToggleGroup: (groupKey: string) => void;
  "data-testid": string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden" data-testid={navTestId}>
      {groups.map((g, groupIndex) => {
        const isOpen = Boolean(openGroups[g.key]);
        const groupActive = groupHasActiveItem(g, location);
        const counts = g.key === "client-base" ? pilotNavClientBaseCounts(g) : null;

        let summaryLine: string | null = null;

        if (g.key === "client-base") {
          if (counts?.clientsLoading || counts?.tradePointsLoading) {
            summaryLine = "Загрузка счётчиков…";
          } else if (counts && counts.clients != null && counts.tradePoints != null) {
            summaryLine = `${counts.clients} клиентов · ${counts.tradePoints} ТТ`;
          } else if (counts && (counts.clients != null || counts.tradePoints != null)) {
            const c = counts.clients != null ? String(counts.clients) : "—";
            const t = counts.tradePoints != null ? String(counts.tradePoints) : "—";
            summaryLine = `${c} клиентов · ${t} ТТ`;
          } else {
            summaryLine = "Клиенты и торговые точки";
          }
        }

        const toggleTestId = NAV_GROUP_TOGGLE_TESTID[g.key] ?? `button-nav-group-${g.key}-toggle`;
        const contentTestId = NAV_GROUP_CONTENT_TESTID[g.key] ?? `nav-group-${g.key}-content`;
        const summaryTestId = NAV_GROUP_SUMMARY_TESTID[g.key] ?? `text-nav-group-${g.key}-summary`;

        const standaloneBlock =
          groupIndex === 0 && standaloneItems.length > 0 ? (
            <div key={`${g.key}-standalone`} className="mt-1 flex min-w-0 flex-col gap-0.5">
              {standaloneItems.map((item) => (
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
          ) : null;

        return (
          <Fragment key={g.key}>
            <div data-testid={g.testId} className="flex min-w-0 flex-col gap-0.5">
              <button
                type="button"
                data-testid={toggleTestId}
                aria-expanded={isOpen}
                onClick={() => onToggleGroup(g.key)}
                className={navGroupHeaderButtonClass(groupActive)}
              >
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide">{g.label}</span>
                  {summaryLine != null && summaryLine !== "" ? (
                    <span data-testid={summaryTestId} className="text-[10px] font-normal leading-snug text-[#8F96B0]">
                      {summaryLine}
                    </span>
                  ) : g.key === "in-development" ? (
                    <span data-testid={summaryTestId} className="sr-only">
                      Разделы доступны и помечены как в разработке
                    </span>
                  ) : null}
                </div>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-[#8F96B0] transition-transform", isOpen && "rotate-180")}
                  aria-hidden
                />
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
            {standaloneBlock}
          </Fragment>
        );
      })}
    </div>
  );
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

function MobileDrawerFooter({
  userName,
  userSubtitle,
  onLogout,
}: {
  userName: string;
  userSubtitle?: string;
  onLogout: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const themeRowClass = (choice: "light" | "dark" | "system") =>
    cn(
      "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors",
      theme === choice
        ? "bg-[#EEEFF6] font-medium text-[#222631]"
        : "text-[#8F96B0] hover:bg-[#EEEFF6]/60 hover:text-[#222631]",
    );

  return (
    <div className="shrink-0 border-t border-[#E3E6F3] bg-card" data-testid="nav-settings-section">
      <div className="px-4 pb-1 pt-3">
        <p className="truncate text-sm font-medium text-[#222631]">{userName}</p>
        {userSubtitle ? <p className="mt-0.5 truncate text-xs text-[#8F96B0]">{userSubtitle}</p> : null}
      </div>
      <button
        type="button"
        data-testid="button-nav-settings-toggle"
        aria-expanded={settingsOpen}
        className="flex w-full items-center justify-between gap-2 border-t border-[#E3E6F3]/80 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#8F96B0] transition-colors hover:bg-[#EEEFF6]/60"
        onClick={() => setSettingsOpen((o) => !o)}
      >
        Настройки
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", settingsOpen && "rotate-180")} aria-hidden />
      </button>
      {settingsOpen ? (
        <div className="border-t border-[#E3E6F3]/80 px-2 pb-3 pt-2" data-testid="menu-theme-options">
          <p className="px-2 pb-1.5 text-[11px] text-[#8F96B0]" data-testid="nav-theme-current">
            Тема: <span className="text-[#222631]">{themeChoiceLabel(theme)}</span>
          </p>
          <button type="button" data-testid="button-nav-theme-light" className={themeRowClass("light")} onClick={() => setTheme("light")}>
            <Sun className="h-3.5 w-3.5 shrink-0 text-[#8F96B0]" aria-hidden />
            Светлая
          </button>
          <button type="button" data-testid="button-nav-theme-dark" className={themeRowClass("dark")} onClick={() => setTheme("dark")}>
            <Moon className="h-3.5 w-3.5 shrink-0 text-[#8F96B0]" aria-hidden />
            Тёмная
          </button>
          <button type="button" data-testid="button-nav-theme-system" className={themeRowClass("system")} onClick={() => setTheme("system")}>
            <Monitor className="h-3.5 w-3.5 shrink-0 text-[#8F96B0]" aria-hidden />
            Как в системе
          </button>
          <button
            type="button"
            data-testid="button-nav-logout"
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[#222631] transition-colors hover:bg-[#EEEFF6]/80"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}

function buildIconRail(navItems: PilotNavItem[]): { href: string; label: string; icon: LucideIcon; key: string }[] {
  const out: { href: string; label: string; icon: LucideIcon; key: string }[] = [];
  for (const item of navItems) {
    const Icon = ICON_BY_TESTID[item.testId] ?? ICON_BY_TESTID[item.navBehaviorId ?? ""];
    if (!Icon) continue;
    const short = item.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
    out.push({ href: item.href, label: short || item.label, icon: Icon, key: item.testId });
  }
  return out;
}

export type AppShellProps = {
  children: ReactNode;
  navigation: PilotNavigationModel;
  homeHref: string;
  userName: string;
  /** Подпись под именем в sidebar (например роль). */
  userSubtitle?: string;
  cityLabel?: string;
  onLogout: () => void;
  /** POC Bitrix24: без боковых панелей и с компактной шапкой. */
  embeddedBitrix24?: boolean;
};

export function AppShell({
  children,
  navigation,
  homeHref,
  userName,
  userSubtitle,
  cityLabel = "—",
  onLogout,
  embeddedBitrix24 = false,
}: AppShellProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctx = headerContextLabel(location);
  const flatNav = useMemo(() => flattenNavModel(navigation), [navigation]);
  const iconRail = useMemo(() => buildIconRail(flatNav), [flatNav]);
  const { openGroups: pilotGroupedOpen, toggleGroup: pilotGroupedToggle } = usePilotGroupedNavOpenState(navigation, location);

  if (embeddedBitrix24) {
    return (
      <div
        className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground"
        data-testid="app-shell-embedded-bitrix24"
      >
        <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 px-3 py-2 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <BrandBlock homeHref={homeHref} className="max-w-[132px]" />
            <div className="flex shrink-0 items-center gap-2">
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-5">{children}</main>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen overflow-x-hidden bg-background text-foreground"
      data-testid="app-shell-desktop"
    >
      <aside
        className="sticky top-0 z-30 hidden h-screen w-14 shrink-0 flex-col border-r border-border/70 bg-[hsl(var(--muted))] py-4 lg:flex"
        data-testid="app-shell-icon-rail"
        aria-label="Быстрые разделы"
      >
        <div className="flex flex-1 flex-col items-center gap-2 px-1">
          {iconRail.map(({ href, label, icon: Icon, key }) => {
            const active = isIconRailActive(href, location);
            return (
              <Link
                key={key}
                href={href}
                title={label}
                aria-label={label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg no-underline transition-colors",
                  active ? "bg-[#EEEFF6] text-[#86B832]" : "text-[#8F96B0] hover:bg-[#EEEFF6]/80 hover:text-[#222631]",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </Link>
            );
          })}
        </div>
      </aside>

      <aside
        className="sticky top-0 z-30 hidden h-screen w-[256px] shrink-0 flex-col border-r border-border/70 bg-card shadow-sm lg:flex"
        data-testid="app-shell-sidebar"
        aria-label="Основная навигация"
      >
        <div className="border-b border-[#E3E6F3]/80 px-4 pb-3 pt-4">
          <BrandBlock homeHref={homeHref} />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3">
          <NavigationPanel
            model={navigation}
            location={location}
            variant="sidebar"
            navTestId="nav-preview-desktop"
            groupedOpen={pilotGroupedOpen}
            onGroupedToggle={pilotGroupedToggle}
          />
        </div>
        <div className="mt-auto border-t border-[#E3E6F3] px-4 py-3">
          <p className="truncate text-xs font-medium text-[#222631]">{userName}</p>
          {userSubtitle ? <p className="mt-0.5 truncate text-[10px] text-[#8F96B0]">{userSubtitle}</p> : null}
          <p className="mt-2 text-[10px] leading-tight text-[#8F96B0]">Рабочий кабинет Tandoor</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-40 hidden min-h-[56px] w-full items-center gap-4 border-b border-border/70 bg-card px-4 py-2 shadow-xs lg:flex"
          data-testid="app-shell-topbar"
        >
          <form
            className="flex min-w-0 max-w-xl flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
            }}
            role="search"
          >
            <Input
              type="search"
              placeholder="Поиск..."
              className="h-11 min-h-[44px] border-border/80 bg-card"
              data-testid="input-global-search"
              aria-label="Поиск по платформе"
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0" data-testid="button-global-search" aria-label="Искать">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeToggleDesktop />
            <Button type="button" variant="outline" size="sm" className="max-w-[10rem] truncate border-border/80" data-testid="button-current-city">
              <span data-testid="text-current-city">{cityLabel}</span>
            </Button>
            <Button type="button" variant="outline" size="sm" className="max-w-[12rem] truncate border-border/80" data-testid="button-manager-profile">
              {userName}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 border-border/80"
              data-testid="button-auth-logout"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Выход
            </Button>
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
                  className="flex w-[min(100vw-2rem,300px)] flex-col gap-0 overflow-hidden border-r border-[#E3E6F3] bg-card p-0"
                >
                  <div className="shrink-0 border-b border-[#E3E6F3]/80 px-4 pb-3 pt-4">
                    <BrandBlock homeHref={homeHref} />
                  </div>
                  <SheetHeader className="sr-only shrink-0 px-4 pt-2">
                    <SheetTitle>Разделы меню</SheetTitle>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-2 pt-2">
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
                  <MobileDrawerFooter
                    userName={userName}
                    userSubtitle={userSubtitle}
                    onLogout={() => {
                      setMobileOpen(false);
                      onLogout();
                    }}
                  />
                </SheetContent>
              </Sheet>
              {ctx ? (
                <p className="min-w-0 truncate text-sm font-medium text-muted-foreground" data-testid="text-mobile-header-context">
                  {ctx}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
