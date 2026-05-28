/**
 * <ProfileShell/> — общая обёртка раздела «Профиль» (Промт 47 Part A2).
 *
 * Левая sub-sidebar:
 *   ПРОФИЛЬ
 *     · Личные данные   (/profile)
 *     · Безопасность    (/profile/change-password)
 *   АДМИНИСТРИРОВАНИЕ — только для admin/director
 *     · Пользователи           (/admin/users)
 *     · Назначения клиентов    (/admin/client-assignments)
 *     · Приглашения            (/admin/invitations)
 *     · Запросы на сброс       (/reset-requests)
 *     · Журнал событий         (/admin/audit)
 *     · Дедуп актуализации     (/admin/actualization/dedupe)
 *     · Миграция БД            (/admin/migration) — только admin
 *
 * Desktop — sticky 240px sidebar слева. Mobile — accordion сверху.
 */

import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { userCanManageInvitations, userHas } from "@/lib/auth-rbac";
import type { UserRole } from "@shared/auth";

type SubNavItem = { href: string; label: string; testId: string };
type SubNavGroup = { key: string; label: string; testId: string; items: SubNavItem[] };

function buildProfileNav(role: UserRole | null): SubNavGroup[] {
  const groups: SubNavGroup[] = [
    {
      key: "profile",
      label: "ПРОФИЛЬ",
      testId: "profile-nav-group-self",
      items: [
        { href: "/profile", label: "Личные данные", testId: "profile-nav-item-personal" },
        { href: "/profile/change-password", label: "Безопасность", testId: "profile-nav-item-security" },
      ],
    },
  ];
  if (!role) return groups;

  // Промт 47: Администрирование показываем admin/director. Не подмешиваем
  // RoP сюда — у них и так нет соответствующих разрешений.
  const isAdmin = role === "admin" || role === "director";
  if (!isAdmin) return groups;

  const admin: SubNavItem[] = [];
  if (userHas(role, "users.list")) {
    admin.push({ href: "/admin/users", label: "Пользователи", testId: "profile-nav-item-admin-users" });
  }
  admin.push({ href: "/admin/client-assignments", label: "Назначения клиентов", testId: "profile-nav-item-admin-client-assignments" });
  if (userCanManageInvitations(role)) {
    admin.push({ href: "/admin/invitations", label: "Приглашения", testId: "profile-nav-item-admin-invitations" });
  }
  admin.push({ href: "/reset-requests", label: "Запросы на сброс", testId: "profile-nav-item-reset-requests" });
  if (userHas(role, "audit.read")) {
    admin.push({ href: "/admin/audit", label: "Журнал событий", testId: "profile-nav-item-admin-audit" });
  }
  if (role === "admin") {
    admin.push({
      href: "/admin/actualization/dedupe",
      label: "Дедуп актуализации",
      testId: "profile-nav-item-admin-actualization-dedupe",
    });
    admin.push({
      href: "/admin/migration",
      label: "Миграция БД",
      testId: "profile-nav-item-admin-migration",
    });
  }
  if (admin.length > 0) {
    groups.push({
      key: "administration",
      label: "АДМИНИСТРИРОВАНИЕ",
      testId: "profile-nav-group-admin",
      items: admin,
    });
  }
  return groups;
}

function isActive(href: string, location: string): boolean {
  if (href === location) return true;
  // /profile должен быть активен только если location === /profile (не /profile/change-password).
  if (href === "/profile") return location === "/profile";
  if (location.startsWith(`${href}/`)) return true;
  return false;
}

function ProfileNavLink({ item, location }: { item: SubNavItem; location: string }) {
  const active = isActive(item.href, location);
  return (
    <Link
      href={item.href}
      data-testid={item.testId}
      className={cn(
        "block min-h-9 rounded-md px-3 py-2 text-sm no-underline transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {item.label}
    </Link>
  );
}

export function ProfileShell({ children }: { children: ReactNode }): ReactElement {
  const [location] = useLocation();
  const { user } = useAuthUser();
  const groups = buildProfileNav((user?.role as UserRole | undefined) ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6" data-testid="profile-shell">
      {/* Mobile accordion-toggle */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => setMobileOpen((v) => !v)}
          data-testid="button-profile-nav-toggle-mobile"
          aria-expanded={mobileOpen}
        >
          <span className="text-sm font-medium">Разделы профиля</span>
          {mobileOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        {mobileOpen ? (
          <nav className="mt-2 space-y-3 rounded-lg border border-border bg-card p-3" aria-label="Профиль">
            {groups.map((g) => (
              <div key={g.key} data-testid={g.testId}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <ProfileNavLink key={item.href} item={item} location={location} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        ) : null}
      </div>

      {/* Desktop sub-sidebar */}
      <aside
        className="hidden w-[240px] shrink-0 self-start lg:sticky lg:top-20 lg:block"
        aria-label="Профиль"
        data-testid="profile-shell-sidebar"
      >
        <nav className="space-y-4 rounded-lg border border-border bg-card p-3 shadow-sm">
          {groups.map((g) => (
            <div key={g.key} data-testid={g.testId}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <ProfileNavLink key={item.href} item={item} location={location} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1" data-testid="profile-shell-content">
        {children}
      </main>
    </div>
  );
}
