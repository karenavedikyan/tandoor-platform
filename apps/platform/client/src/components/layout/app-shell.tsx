import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  ClipboardList,
  Home,
  LayoutGrid,
  ListTodo,
  MapPinned,
  Megaphone,
  Menu,
  Package,
  PieChart,
  Rocket,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { TandoorLogo } from "@/components/tandoor-logo";
import { AppTopbarDemoStrip } from "@/components/app-topbar-demo-strip";
import { cn } from "@/lib/utils";

const MAIN_HREF = "/main";
const TERRITORY_CARD_HREF = "/territory-card";
const DEALER_BASE_HREF = "/dealer-base";
const ORDERS_HREF = "/orders";
const CATALOG_HREF = "/catalog";
const TASKS_HREF = "/tasks";
const ANALYTICS_HREF = "/analytics";
const TRAINING_HREF = "/training";
const SALES_CONTROL_HREF = "/sales-control";
const ANALYTICS_WORKSPACE_HREF = "/analytics-workspace";
const MARKETING_BRIEFS_HREF = "/marketing-briefs";
const RELEASE_ONE_HREF = "/release-one";
const SALES_MANAGER_HREF = "/sales-manager";

const NAV_BADGE_CLIENTS = 28;
const NAV_BADGE_ORDERS = 14;
const MOCK_MANAGER_NAME = "Антон Иванов";
const MOCK_MANAGER_CITY = "Ростов-на-Дону";

type NavDef = {
  href: string;
  label: string;
  testId: string;
  badge?: number;
};

const NAV_ITEMS: NavDef[] = [
  { href: MAIN_HREF, label: "Главная", testId: "nav-main" },
  { href: TERRITORY_CARD_HREF, label: "Карточка территории", testId: "nav-territory-card" },
  { href: DEALER_BASE_HREF, label: "Клиенты", testId: "nav-dealer-base", badge: NAV_BADGE_CLIENTS },
  { href: ORDERS_HREF, label: "Заказы", testId: "nav-orders", badge: NAV_BADGE_ORDERS },
  { href: CATALOG_HREF, label: "Каталог", testId: "nav-catalog" },
  { href: TASKS_HREF, label: "Задачи", testId: "nav-tasks" },
  { href: ANALYTICS_HREF, label: "Аналитика", testId: "nav-analytics" },
  { href: TRAINING_HREF, label: "Обучение", testId: "nav-training" },
  { href: SALES_CONTROL_HREF, label: "План-факт продаж", testId: "nav-sales-control" },
  { href: ANALYTICS_WORKSPACE_HREF, label: "Аналитика команды", testId: "nav-analytics-workspace" },
  { href: MARKETING_BRIEFS_HREF, label: "Маркетинговые брифы", testId: "nav-marketing-briefs" },
  { href: RELEASE_ONE_HREF, label: "Первый релиз", testId: "nav-release-one" },
];

const ICON_RAIL: { href: string; label: string; icon: LucideIcon }[] = [
  { href: MAIN_HREF, label: "Главная", icon: Home },
  { href: TERRITORY_CARD_HREF, label: "Территория", icon: MapPinned },
  { href: DEALER_BASE_HREF, label: "Клиенты", icon: Users },
  { href: ORDERS_HREF, label: "Заказы", icon: Package },
  { href: CATALOG_HREF, label: "Каталог", icon: LayoutGrid },
  { href: TASKS_HREF, label: "Задачи", icon: ListTodo },
  { href: TRAINING_HREF, label: "Обучение", icon: BookOpen },
  { href: SALES_CONTROL_HREF, label: "План-факт", icon: ClipboardList },
  { href: ANALYTICS_WORKSPACE_HREF, label: "Аналитика команды", icon: PieChart },
  { href: MARKETING_BRIEFS_HREF, label: "Брифы", icon: Megaphone },
  { href: RELEASE_ONE_HREF, label: "Релиз 1", icon: Rocket },
];

function isMainPath(path: string) {
  return path === "/" || path === MAIN_HREF || path === SALES_MANAGER_HREF;
}

function isDealerBasePath(path: string) {
  return path === DEALER_BASE_HREF;
}

function isOrdersSectionPath(path: string) {
  return path === ORDERS_HREF || path.startsWith(`${ORDERS_HREF}/`);
}

function isCatalogPath(path: string) {
  return path === CATALOG_HREF || path.startsWith(`${CATALOG_HREF}/`);
}

function isTasksPath(path: string) {
  return path === TASKS_HREF || path.startsWith(`${TASKS_HREF}/`);
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

function isMarketingBriefsPath(path: string) {
  return path === MARKETING_BRIEFS_HREF || path.startsWith(`${MARKETING_BRIEFS_HREF}/`);
}

function isReleaseOnePath(path: string) {
  return path === RELEASE_ONE_HREF;
}

function isNavItemActive(item: NavDef, location: string, isActiveFromLink?: boolean): boolean {
  if (isActiveFromLink !== undefined) return isActiveFromLink;
  if (item.testId === "nav-main") return isMainPath(location);
  if (item.testId === "nav-dealer-base") return isDealerBasePath(location);
  if (item.testId === "nav-orders") return isOrdersSectionPath(location);
  if (item.testId === "nav-catalog") return isCatalogPath(location);
  if (item.testId === "nav-tasks") return isTasksPath(location);
  if (item.testId === "nav-territory-card") return isTerritoryCardPath(location);
  if (item.testId === "nav-analytics") return isAnalyticsPath(location);
  if (item.testId === "nav-training") return isTrainingPath(location);
  if (item.testId === "nav-sales-control") return isSalesControlPath(location);
  if (item.testId === "nav-analytics-workspace") return isAnalyticsWorkspacePath(location);
  if (item.testId === "nav-marketing-briefs") return isMarketingBriefsPath(location);
  if (item.testId === "nav-release-one") return isReleaseOnePath(location);
  return location === item.href;
}

function isIconRailActive(href: string, location: string) {
  if (href === MAIN_HREF) return isMainPath(location);
  if (href === DEALER_BASE_HREF) return isDealerBasePath(location);
  if (href === ORDERS_HREF) return isOrdersSectionPath(location);
  if (href === CATALOG_HREF) return isCatalogPath(location);
  if (href === TASKS_HREF) return isTasksPath(location);
  if (href === TERRITORY_CARD_HREF) return isTerritoryCardPath(location);
  if (href === TRAINING_HREF) return isTrainingPath(location);
  if (href === SALES_CONTROL_HREF) return isSalesControlPath(location);
  if (href === ANALYTICS_WORKSPACE_HREF) return isAnalyticsWorkspacePath(location);
  if (href === MARKETING_BRIEFS_HREF) return isMarketingBriefsPath(location);
  if (href === RELEASE_ONE_HREF) return isReleaseOnePath(location);
  return false;
}

function navLinkClass(item: NavDef, location: string, variant: "sidebar" | "drawer", isActiveFromLink?: boolean) {
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
  if (isMainPath(location)) return "Главная";
  if (isDealerBasePath(location)) return "Клиенты";
  if (isOrdersSectionPath(location)) return "Заказы";
  if (isTasksPath(location)) return "Задачи";
  if (isCatalogPath(location)) return "Каталог";
  if (isTerritoryCardPath(location)) return "Карточка территории";
  if (isAnalyticsPath(location)) return "Аналитика";
  if (isTrainingPath(location)) return "Обучение";
  if (isSalesControlPath(location)) return "План-факт продаж";
  if (isAnalyticsWorkspacePath(location)) return "Аналитика команды";
  if (isMarketingBriefsPath(location)) return "Маркетинговые брифы";
  if (isReleaseOnePath(location)) return "Первый релиз";
  if (location.startsWith("/dealers/")) return "Карточка клиента";
  return "";
}

function BrandBlock({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start px-0.5", className)}>
      <Link href={MAIN_HREF} className="block w-full max-w-[168px] leading-none no-underline">
        <TandoorLogo className="max-h-[52px] w-full max-w-[168px] object-contain object-left" data-testid="brand-logo-tandoor" />
      </Link>
    </div>
  );
}

function NavLinksList({
  location,
  variant,
  onNavigate,
  "data-testid": navTestId,
}: {
  location: string;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
  "data-testid": string;
}) {
  return (
    <nav className="flex flex-col gap-0.5" data-testid={navTestId}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.testId}
          href={item.href}
          onClick={onNavigate}
          className={(active) => navLinkClass(item, location, variant, active)}
          data-testid={item.testId}
        >
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {item.badge != null ? (
            <Badge variant="secondary" className="h-6 min-w-6 shrink-0 rounded-md border border-border/60 bg-muted px-1.5 text-xs tabular-nums text-foreground">
              {item.badge}
            </Badge>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

function IntegrationChips({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Интеграции</p>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled
          className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
          data-testid="quick-integration-tandoor"
        >
          Tandoor
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
          data-testid="quick-integration-bitrix24"
        >
          Битрикс 24
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
          data-testid="quick-integration-1c"
        >
          1С
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctx = headerContextLabel(location);

  return (
    <div
      className="flex min-h-screen overflow-x-hidden bg-background text-foreground"
      data-testid="app-shell-desktop"
    >
      {/* Узкий icon rail — desktop */}
      <aside
        className="sticky top-0 z-30 hidden h-screen w-14 shrink-0 flex-col border-r border-border/70 bg-[hsl(var(--muted))] py-4 lg:flex"
        data-testid="app-shell-icon-rail"
        aria-label="Быстрые разделы"
      >
        <div className="flex flex-1 flex-col items-center gap-2 px-1">
          {ICON_RAIL.map(({ href, label, icon: Icon }) => {
            const active = isIconRailActive(href, location);
            return (
              <Link
                key={href + label}
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

      {/* Основной sidebar — desktop */}
      <aside
        className="sticky top-0 z-30 hidden h-screen w-[256px] shrink-0 flex-col border-r border-border/70 bg-card shadow-sm lg:flex"
        data-testid="app-shell-sidebar"
        aria-label="Основная навигация"
      >
        <div className="border-b border-border/60 px-4 pb-4 pt-5">
          <BrandBlock />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4">
          <NavLinksList location={location} variant="sidebar" data-testid="nav-preview-desktop" />
        </div>
        <div className="mt-auto border-t border-border/60 px-4 py-4">
          <IntegrationChips />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar */}
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
            <div className="hidden max-w-[min(100%,28rem)] flex-1 basis-full lg:block lg:basis-auto">
              <AppTopbarDemoStrip />
            </div>
            <Button type="button" variant="outline" size="sm" className="max-w-[10rem] truncate border-border/80" data-testid="button-current-city">
              <span data-testid="text-current-city">{MOCK_MANAGER_CITY}</span>
            </Button>
            <Button type="button" variant="outline" size="sm" className="max-w-[12rem] truncate border-border/80" data-testid="button-manager-profile">
              {MOCK_MANAGER_NAME}
            </Button>
          </div>
        </header>

        {/* Mobile header */}
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
                    <BrandBlock />
                  </div>
                  <SheetHeader className="px-5 pt-3 text-left">
                    <SheetTitle className="text-left text-base">Разделы</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 px-5 pb-4 pt-2">
                    <NavLinksList
                      location={location}
                      variant="drawer"
                      onNavigate={() => setMobileOpen(false)}
                      data-testid="nav-preview-mobile"
                    />
                  </div>
                  <div className="border-t border-border/60 px-5 pb-3 pt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Демо-роль</p>
                    <AppTopbarDemoStrip />
                  </div>
                  <div className="border-t border-border/60 px-5 pb-6 pt-3">
                    <IntegrationChips />
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
