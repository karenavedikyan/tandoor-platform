import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ListTodo,
  MapPinned,
  Search,
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TandoorLogo } from "@/components/tandoor-logo";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Дашборд", path: "/", icon: LayoutDashboard },
  { label: "ЛК отдела продаж", path: "/sales-department", icon: BriefcaseBusiness },
  { label: "Панель продаж", path: "/sales/leadership", icon: BarChart3 },
  { label: "Маршрут РМ", path: "/regional-manager/route", icon: MapPinned },
  { label: "Цели по витринам", path: "/sales/showcase-goals", icon: ClipboardCheck },
  { label: "Задачи продаж", path: "/sales/tasks", icon: ListTodo },
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
            data-testid={
              item.path === "/sales-department"
                ? "nav-sales-department"
                : item.path === "/sales/leadership"
                  ? "nav-sales-leadership"
                : item.path === "/regional-manager/route"
                  ? "nav-regional-manager-route"
                  : item.path === "/sales/showcase-goals"
                    ? "nav-showcase-goals"
                    : item.path === "/sales/tasks"
                      ? "nav-sales-tasks"
                  : `nav-${item.label.toLowerCase()}`
            }
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
    <div className="min-h-screen bg-background text-foreground" data-testid="app-shell">
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden min-h-screen w-72 border-r border-sidebar-border bg-sidebar px-4 py-6 lg:block">
          <div className="px-2">
            <TandoorLogo
              className="h-10 w-auto max-w-[190px]"
              data-testid="img-tandoor-logo-sidebar"
            />
            <p className="mt-3 text-xs text-muted-foreground">Дилерская платформа</p>
          </div>
          <div className="mt-8">
            <SidebarNav location={location} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/90 bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TandoorLogo
                    className="h-7 w-auto max-w-[120px] sm:h-8 sm:max-w-[150px]"
                    compact
                    data-testid="img-tandoor-logo-header"
                  />
                  <div className="hidden lg:block">
                    <h1 className="text-lg font-bold tracking-tight" data-testid="platform-title">
                      Платформа Tandoor
                    </h1>
                    <p className="text-xs text-muted-foreground sm:text-sm" data-testid="platform-subtitle">
                      MVP B2B2C-экосистемы
                    </p>
                  </div>
                </div>
                <Badge
                  className="hidden rounded-full border-border bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex"
                  variant="outline"
                  data-testid="workspace-badge"
                >
                  Продажи / дилерский контур
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1" data-testid="header-search">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Поиск"
                    aria-label="Поиск"
                    className="h-10 rounded-xl border-border bg-[#E8E8E8] pl-9 text-sm shadow-none focus-visible:ring-1"
                  />
                </div>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      className="h-10 w-10 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 lg:hidden"
                      variant="default"
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
                        <TandoorLogo
                          className="h-9 w-auto max-w-[170px]"
                          data-testid="img-tandoor-logo-compact"
                        />
                      </SheetTitle>
                    </SheetHeader>
                    <SidebarNav location={location} onNavigate={() => setMobileOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
