import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

const FIRST_STAGE_HREF = "/dealer-card-foundation";

const PREVIEW_NAV = [
  { href: FIRST_STAGE_HREF, label: "Единая карточка дилера", testId: "nav-dealer-card-foundation" },
] as const;

function isFirstStagePath(path: string) {
  return path === "/" || path === FIRST_STAGE_HREF;
}

function navClassForHref(href: string, location: string, isActiveFromLink?: boolean) {
  const active =
    isActiveFromLink ?? (href === FIRST_STAGE_HREF ? isFirstStagePath(location) : location === href);
  return cn(
    "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
    active
      ? "bg-[#7DC400] text-[#142200] shadow-sm shadow-[#7DC400]/25"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showMobileMenu = PREVIEW_NAV.length > 1;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eef0ed]" data-testid="app-shell-preview">
      <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {showMobileMenu ? (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-neutral-200 bg-white md:hidden"
                    type="button"
                    data-testid="button-mobile-nav-open"
                    aria-label="Открыть меню"
                  >
                    <Menu className="h-5 w-5 text-neutral-700" />
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
            <Link href={FIRST_STAGE_HREF} className="min-w-0 shrink no-underline">
              <BrandMark />
            </Link>
            <div className="hidden h-8 w-px shrink-0 bg-neutral-200 sm:block" aria-hidden />
            <p className="hidden min-w-0 truncate text-sm font-medium text-neutral-600 sm:block sm:max-w-[14rem] md:max-w-xs">
              Единая карточка дилера
            </p>
          </div>
          <nav className="hidden shrink-0 items-center gap-2 md:flex" data-testid="nav-preview-desktop">
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
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-7">{children}</main>
    </div>
  );
}
