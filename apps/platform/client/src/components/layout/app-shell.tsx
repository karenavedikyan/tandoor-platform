import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active ? "bg-[#7DC400]/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showMobileMenu = PREVIEW_NAV.length > 1;

  return (
    <div className="min-h-screen bg-[#f7f8f6]" data-testid="app-shell-preview">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showMobileMenu ? (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-neutral-200 md:hidden"
                    type="button"
                    data-testid="button-mobile-nav-open"
                    aria-label="Открыть меню"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[min(100vw-2rem,280px)]">
                  <SheetHeader>
                    <SheetTitle className="text-left">Меню</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-1" data-testid="nav-preview-mobile">
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
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <Link href={FIRST_STAGE_HREF} className="shrink-0 no-underline">
                <span className="flex cursor-pointer flex-col leading-tight" data-testid="link-app-brand">
                  <span className="text-base font-semibold tracking-tight text-foreground">Tandoor Platform</span>
                  <span className="text-xs text-muted-foreground">Единая карточка дилера</span>
                </span>
              </Link>
            </div>
          </div>
          <nav className="hidden shrink-0 items-center gap-1 md:flex" data-testid="nav-preview-desktop">
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
