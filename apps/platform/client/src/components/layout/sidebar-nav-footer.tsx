import { useState } from "react";
import { ChevronDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-provider";
import type { TandoorThemeChoice } from "@/lib/tandoor-theme";

function themeLabel(t: TandoorThemeChoice): string {
  if (t === "light") return "Светлая";
  if (t === "dark") return "Тёмная";
  return "Как в системе";
}

type SidebarNavFooterProps = {
  userName: string;
  userSubtitle?: string;
  onLogout: () => void;
  /** Мобильный drawer: по умолчанию блок «Настройки» свёрнут. */
  settingsDefaultOpen?: boolean;
  paddingClass?: string;
  className?: string;
};

function themeRowButtonClass(active: boolean) {
  return cn(
    "flex min-h-[40px] w-full items-center gap-2 rounded-lg border border-transparent px-3 text-left text-sm transition-colors",
    active
      ? "border-[#E3E6F3] bg-[#EEEFF6] font-medium text-[#222631]"
      : "text-[#8F96B0] hover:bg-[#EEEFF6]/80 hover:text-[#222631]",
  );
}

/**
 * Нижняя зона drawer / desktop sidebar: пользователь + компактный блок «Настройки» (тема, выход).
 */
export function SidebarNavFooter({
  userName,
  userSubtitle,
  onLogout,
  settingsDefaultOpen = false,
  paddingClass = "px-4",
  className,
}: SidebarNavFooterProps) {
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(settingsDefaultOpen);

  return (
    <div
      className={cn("border-t border-[#E3E6F3]/90 bg-card/95 pt-2", paddingClass, className)}
      data-testid="nav-settings-section"
    >
      <div className="pb-2">
        <p className="truncate text-sm font-medium leading-tight text-[#222631]" data-testid="text-sidebar-user-name">
          {userName}
        </p>
        {userSubtitle ? (
          <p className="mt-0.5 truncate text-xs leading-snug text-[#8F96B0]" data-testid="text-sidebar-user-subtitle">
            {userSubtitle}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="mb-1 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs font-semibold uppercase tracking-wide text-[#8F96B0] transition-colors hover:bg-[#EEEFF6]/70"
        data-testid="button-nav-settings-toggle"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((v) => !v)}
      >
        <span>Настройки</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", settingsOpen && "rotate-180")} aria-hidden />
      </button>

      {!settingsOpen ? (
        <p className="mb-2 px-2 text-xs text-[#8F96B0]" data-testid="nav-theme-current">
          Тема: {themeLabel(theme)}
        </p>
      ) : null}

      {settingsOpen ? (
        <div className="flex flex-col gap-1 pb-2" data-testid="menu-theme-options">
          <p className="px-2 text-xs text-[#8F96B0]" data-testid="nav-theme-current">
            <span data-testid="text-current-theme">Сейчас: {themeLabel(theme)}</span>
          </p>
          <button
            type="button"
            className={themeRowButtonClass(theme === "light")}
            data-testid="button-nav-theme-light"
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4 shrink-0" aria-hidden data-testid="icon-theme-light" />
            Светлая
          </button>
          <button
            type="button"
            className={themeRowButtonClass(theme === "dark")}
            data-testid="button-nav-theme-dark"
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4 shrink-0" aria-hidden data-testid="icon-theme-dark" />
            Тёмная
          </button>
          <button
            type="button"
            className={themeRowButtonClass(theme === "system")}
            data-testid="button-nav-theme-system"
            onClick={() => setTheme("system")}
          >
            <Monitor className="h-4 w-4 shrink-0" aria-hidden data-testid="icon-theme-system" />
            Как в системе
          </button>
          <Button
            type="button"
            variant="outline"
            className="mt-1 h-10 w-full justify-start gap-2 border-[#E3E6F3] text-sm text-[#222631]"
            data-testid="button-nav-logout"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
            Выйти
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="mb-3 h-9 w-full justify-start gap-2 px-2 text-sm text-[#222631] hover:bg-[#EEEFF6]"
          data-testid="button-nav-logout"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
          Выйти
        </Button>
      )}
    </div>
  );
}
