import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Boxes,
  Building2,
  LayoutDashboard,
  Menu,
  Network,
  ScrollText,
  ShoppingCart,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TandoorLogo } from "@/components/tandoor-logo";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Дашборд", path: "/", icon: LayoutDashboard },
  { label: "Дилеры", path: "/dealers", icon: Building2 },
  { label: "Каталог", path: "/catalog", icon: Boxes },
  { label: "Заказы", path: "/orders", icon: ShoppingCart },
  { label: "Рекламации", path: "/claims", icon: ScrollText },
  { label: "События", path: "/activity", icon: Activity },
  { label: "Архитектура", path: "/architecture", icon: Network },
];

function SidebarNav({
  location,
  onNavigate,
}: {
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1" data-testid="sidebar-nav">
      {navItems.map((item) => {
        const isActive = location === item.path;
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
            )}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground" data-testid="app-shell">
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden min-h-screen w-72 border-r border-sidebar-border bg-sidebar px-4 py-6 lg:block">
          <div className="px-2">
            <TandoorLogo className="h-10 w-auto" data-testid="tandoor-logo-sidebar" />
            <p className="mt-3 text-xs text-muted-foreground">
              Дилерская платформа
            </p>
          </div>
          <div className="mt-8">
            <SidebarNav location={location} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      className="lg:hidden"
                      variant="outline"
                      size="icon"
                      data-testid="mobile-menu-trigger"
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Открыть навигацию</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[290px] border-r border-border p-5">
                    <SheetHeader className="mb-6">
                      <SheetTitle className="text-left">
                        <TandoorLogo className="h-9 w-auto" data-testid="tandoor-logo-mobile" />
                      </SheetTitle>
                    </SheetHeader>
                    <SidebarNav location={location} onNavigate={() => setMobileOpen(false)} />
                  </SheetContent>
                </Sheet>

                <div>
                  <h1 className="text-base font-semibold tracking-tight sm:text-lg" data-testid="platform-title">
                    Платформа Tandoor
                  </h1>
                  <p className="text-xs text-muted-foreground sm:text-sm" data-testid="platform-subtitle">
                    MVP B2B2C-экосистемы
                  </p>
                </div>
              </div>

              <Badge
                className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-foreground sm:text-xs"
                variant="outline"
                data-testid="workspace-badge"
              >
                Продажи / дилерский контур
              </Badge>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
