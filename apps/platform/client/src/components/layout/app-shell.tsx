import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TandoorLogo } from "@/components/tandoor-logo";
import { cn } from "@/lib/utils";

const MAIN_HREF = "/main";
const DEALER_BASE_HREF = "/dealer-base";
const ORDERS_HREF = "/orders";
const CATALOG_HREF = "/catalog";
const TASKS_HREF = "/tasks";
const SALES_MANAGER_HREF = "/sales-manager";

const PREVIEW_NAV = [
  { href: MAIN_HREF, label: "Главное", testId: "nav-main" },
  { href: DEALER_BASE_HREF, label: "Клиентская база", testId: "nav-dealer-base" },
  { href: ORDERS_HREF, label: "Заказы", testId: "nav-orders" },
  { href: CATALOG_HREF, label: "Каталог", testId: "nav-catalog" },
  { href: TASKS_HREF, label: "Задачи", testId: "nav-tasks" },
] as const;

function isMainPath(path: string) {
  return path === "/" || path === MAIN_HREF || path === SALES_MANAGER_HREF;
}

function isDealerBasePath(path: string) {
  return path === DEALER_BASE_HREF;
}

function isOrdersListPath(path: string) {
  return path === ORDERS_HREF;
}

function isCatalogPath(path: string) {
  return path === CATALOG_HREF || path.startsWith(`${CATALOG_HREF}/`);
}

function isTasksPath(path: string) {
  return path === TASKS_HREF || path.startsWith(`${TASKS_HREF}/`);
}

function isNavActive(href: string, location: string, isActiveFromLink?: boolean): boolean {
  if (isActiveFromLink !== undefined) return isActiveFromLink;
  if (href === MAIN_HREF) return isMainPath(location);
  if (href === DEALER_BASE_HREF) return isDealerBasePath(location);
  if (href === ORDERS_HREF) return isOrdersListPath(location);
  if (href === CATALOG_HREF) return isCatalogPath(location);
  if (href === TASKS_HREF) return isTasksPath(location);
  return location === href;
}

function navLinkClass(href: string, location: string, variant: "sidebar" | "drawer", isActiveFromLink?: boolean) {
  const active = isNavActive(href, location, isActiveFromLink);
  const base =
    variant === "sidebar"
      ? "flex w-full min-h-10 items-center rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-colors"
      : "flex w-full min-h-10 items-center rounded-full px-4 py-2 text-sm font-medium no-underline transition-colors";
  return cn(
    base,
    active
      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function headerContextLabel(location: string) {
  if (isMainPath(location)) return "Главное";
  if (isDealerBasePath(location)) return "Клиентская база";
  if (location === ORDERS_HREF || location.startsWith(`${ORDERS_HREF}/`)) return "Заказы";
  if (isTasksPath(location)) return "Задачи";
  if (isCatalogPath(location)) return "Каталог";
  if (location.startsWith("/dealers/")) return "Карточка клиента";
  return "";
}

function BrandBlock({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start", className)}>
      <Link href={MAIN_HREF} className="block leading-none no-underline">
        <TandoorLogo
          className="h-10 w-auto max-w-full object-contain object-left lg:h-[2.75rem]"
          data-testid="brand-logo-tandoor"
        />
      </Link>
      <p
        data-testid="text-brand-subtitle"
        className="mt-1.5 max-w-full text-[11px] font-medium leading-tight tracking-[0.03em] text-muted-foreground"
      >
        двери / фурнитура
      </p>
    </div>
  );
}

function NavLinks({
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
    <nav className="flex flex-col gap-1" data-testid={navTestId}>
      {PREVIEW_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={(active) => navLinkClass(item.href, location, variant, active)}
          data-testid={item.testId}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ctx = headerContextLabel(location);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background" data-testid="app-shell-preview">
      <aside
        className="sticky top-0 z-30 hidden h-screen w-[272px] shrink-0 flex-col border-r border-border/80 bg-card px-4 py-5 shadow-sm lg:flex"
        aria-label="Основная навигация"
      >
        <BrandBlock className="border-b border-border/60 pb-4" />
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-4">
          <NavLinks location={location} variant="sidebar" data-testid="nav-preview-desktop" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90 lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-border bg-card"
                    type="button"
                    data-testid="button-mobile-nav-open"
                    aria-label="Открыть меню"
                  >
                    <Menu className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-[min(100vw-2rem,300px)] flex-col gap-0 overflow-y-auto p-0">
                  <div className="border-b border-border/80 px-5 pb-3 pt-4">
                    <BrandBlock />
                  </div>
                  <SheetHeader className="px-5 pt-3 text-left">
                    <SheetTitle className="text-left text-base">Разделы</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 px-5 pb-6 pt-2">
                    <NavLinks
                      location={location}
                      variant="drawer"
                      onNavigate={() => setMobileOpen(false)}
                      data-testid="nav-preview-mobile"
                    />
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

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-5 sm:py-7 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
