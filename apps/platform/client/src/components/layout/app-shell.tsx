import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
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
  PieChart,
  Search,
  Store,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { TandoorLogo } from "@/components/tandoor-logo";
import { ThemeToggleDesktop, ThemeToggleMobileBlock } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { PilotNavItem } from "@/lib/auth-access";

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

const ICON_BY_TESTID: Partial<Record<string, LucideIcon>> = {
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

function isNavItemActive(item: PilotNavItem, location: string, isActiveFromLink?: boolean): boolean {
  if (isActiveFromLink !== undefined) return isActiveFromLink;
  if (item.testId === "nav-main") return isMainPath(location);
  if (item.testId === "nav-dealer-base") return isClientsSectionPath(location);
  if (item.testId === "nav-trade-points") return isTradePointsPath(location);
  if (item.testId === "nav-catalog") return isCatalogPath(location);
  if (item.testId === "nav-tasks") return isTasksPath(location);
  if (item.testId === "nav-communications") return isCommunicationsPath(location);
  if (item.testId === "nav-territory-card") return isTerritoryCardPath(location);
  if (item.testId === "nav-analytics") return isAnalyticsPath(location);
  if (item.testId === "nav-training") return isTrainingPath(location);
  if (item.testId === "nav-sales-control") return isSalesControlPath(location);
  if (item.testId === "nav-analytics-workspace") return isAnalyticsWorkspacePath(location);
  if (item.testId === "nav-client-map") return isClientMapPath(location);
  if (item.testId === "nav-marketing-briefs") return isMarketingBriefsPath(location);
  if (item.testId === "nav-client-base-activity") return isClientBaseActivityPath(location);
  return pathMatchesNavHref(location, item.href);
}

function isIconRailActive(href: string, location: string) {
  if (href === MAIN_HREF) return isMainPath(location);
  return pathMatchesNavHref(location, href);
}

function navLinkClass(item: PilotNavItem, location: string, variant: "sidebar" | "drawer", isActiveFromLink?: boolean) {
  const active = isNavItemActive(item, location, isActiveFromLink);
  const base =
    variant === "sidebar"
      ? "flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors"
      : "flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors";
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
  if (isClientBaseActivityPath(pathOnly)) return "Актуализация базы";
  if (isCommunicationsPath(pathOnly)) return "Коммуникации";
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
        <Link
          key={item.testId}
          href={item.href}
          onClick={onNavigate}
          className={(active) => navLinkClass(item, location, variant, active)}
          data-testid={item.testId}
        >
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {(item.testId === "nav-dealer-base" || item.testId === "nav-trade-points") && item.badgeLoading ? (
            <span
              className="h-6 min-w-7 shrink-0 animate-pulse rounded-md bg-muted"
              aria-busy
              aria-label={item.testId === "nav-trade-points" ? "Загрузка количества точек" : "Загрузка количества клиентов"}
              data-testid={
                item.testId === "nav-trade-points"
                  ? variant === "sidebar"
                    ? "text-sidebar-trade-points-count"
                    : "text-mobile-sidebar-trade-points-count"
                  : variant === "sidebar"
                    ? "text-sidebar-clients-count"
                    : "text-mobile-sidebar-clients-count"
              }
            />
          ) : item.badge != null ? (
            <Badge
              variant="secondary"
              className="h-6 min-w-6 shrink-0 rounded-md border border-border/60 bg-muted px-1.5 text-xs tabular-nums text-foreground"
              data-testid={
                item.testId === "nav-trade-points"
                  ? variant === "sidebar"
                    ? "text-sidebar-trade-points-count"
                    : "text-mobile-sidebar-trade-points-count"
                  : variant === "sidebar"
                    ? "text-sidebar-clients-count"
                    : "text-mobile-sidebar-clients-count"
              }
            >
              {item.badge}
            </Badge>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

function buildIconRail(navItems: PilotNavItem[]): { href: string; label: string; icon: LucideIcon; key: string }[] {
  const out: { href: string; label: string; icon: LucideIcon; key: string }[] = [];
  for (const item of navItems) {
    const Icon = ICON_BY_TESTID[item.testId];
    if (!Icon) continue;
    const short = item.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
    out.push({ href: item.href, label: short || item.label, icon: Icon, key: item.testId });
  }
  return out;
}

export type AppShellProps = {
  children: ReactNode;
  navItems: PilotNavItem[];
  homeHref: string;
  userName: string;
  cityLabel?: string;
  onLogout: () => void;
  /** POC Bitrix24: без боковых панелей и с компактной шапкой. */
  embeddedBitrix24?: boolean;
};

export function AppShell({
  children,
  navItems,
  homeHref,
  userName,
  cityLabel = "—",
  onLogout,
  embeddedBitrix24 = false,
}: AppShellProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctx = headerContextLabel(location);
  const iconRail = useMemo(() => buildIconRail(navItems), [navItems]);

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
                  active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
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
        <div className="border-b border-border/60 px-4 pb-4 pt-5">
          <BrandBlock homeHref={homeHref} />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4">
          <NavLinksList items={navItems} location={location} variant="sidebar" data-testid="nav-preview-desktop" />
        </div>
        <div className="mt-auto border-t border-border/60 px-4 py-4">
          <p className="text-[10px] text-muted-foreground">Рабочий кабинет Tandoor</p>
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
                  className="flex w-[min(100vw-2rem,300px)] flex-col gap-0 overflow-y-auto border-r border-border/70 bg-card p-0"
                >
                  <div className="border-b border-border/60 px-5 pb-3 pt-4">
                    <BrandBlock homeHref={homeHref} />
                  </div>
                  <SheetHeader className="px-5 pt-3 text-left">
                    <SheetTitle className="text-left text-base">Разделы</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 px-5 pb-4 pt-2">
                    <NavLinksList
                      items={navItems}
                      location={location}
                      variant="drawer"
                      onNavigate={() => setMobileOpen(false)}
                      data-testid="nav-preview-mobile"
                    />
                  </div>
                  <ThemeToggleMobileBlock />
                  <div className="border-t border-border/60 px-5 pb-4 pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">{userName}</p>
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
