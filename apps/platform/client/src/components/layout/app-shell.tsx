import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand/brand-mark";
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

function isOrdersPath(path: string) {
  return path === ORDERS_HREF || path.startsWith(`${ORDERS_HREF}/`);
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

function navClassForHref(href: string, location: string, isActiveFromLink?: boolean) {
  const active =
    isActiveFromLink ??
    (href === MAIN_HREF
      ? isMainPath(location)
      : href === DEALER_BASE_HREF
        ? isDealerBasePath(location)
        : href === ORDERS_HREF
          ? isOrdersListPath(location)
          : href === CATALOG_HREF
            ? isCatalogPath(location)
            : href === TASKS_HREF
              ? isTasksPath(location)
              : location === href);
  return cn(
    "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

function headerContextLabel(location: string) {
  if (isMainPath(location)) return "Главное";
  if (isDealerBasePath(location)) return "Клиентская база";
  if (isOrdersPath(location)) return "Заказы";
  if (isTasksPath(location)) return "Задачи";
  if (isCatalogPath(location)) return "Каталог";
  if (location.startsWith("/dealers/")) return "Карточка клиента";
  return "";
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showMobileMenu = PREVIEW_NAV.length > 1;
  const ctx = headerContextLabel(location);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background" data-testid="app-shell-preview">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
              {showMobileMenu ? (
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="mt-0.5 h-10 w-10 shrink-0 border-border bg-card sm:mt-0 md:hidden"
                      type="button"
                      data-testid="button-mobile-nav-open"
                      aria-label="Открыть меню"
                    >
                      <Menu className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[min(100vw-2rem,280px)]">
                    <SheetHeader>
                      <SheetTitle className="text-left">Меню</SheetTitle>
                    </SheetHeader>
                    <nav className="mt-6 flex flex-col gap-2" data-testid="nav-preview-mobile">
                      {PREVIEW_NAV.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={(active) => cn(navClassForHref(item.href, location, active), "no-underline")}
                          data-testid={item.testId}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                <Link href={MAIN_HREF} className="flex shrink-0 flex-col gap-0.5 no-underline">
                  <BrandMark />
                  <p
                    data-testid="text-brand-subtitle"
                    className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
                  >
                    двери / фурнитура
                  </p>
                </Link>
                <p
                  data-testid="text-brand-slogan"
                  className="hidden max-w-[11rem] text-sm font-semibold leading-snug text-foreground sm:block sm:max-w-[13rem] md:max-w-xs md:text-base"
                >
                  Сравнивая выбирают нас
                </p>
              </div>
            </div>

            {ctx ? (
              <p className="hidden min-w-0 truncate text-sm font-medium text-muted-foreground sm:block sm:max-w-[10rem] md:max-w-[14rem] lg:max-w-xs">
                {ctx}
              </p>
            ) : null}

            <nav className="hidden shrink-0 flex-wrap items-center justify-end gap-2 md:flex" data-testid="nav-preview-desktop">
              {PREVIEW_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={(active) => cn(navClassForHref(item.href, location, active), "no-underline")}
                  data-testid={item.testId}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-7">{children}</main>
    </div>
  );
}
