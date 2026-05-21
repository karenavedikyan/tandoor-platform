import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme-provider";
import type { TandoorThemeChoice } from "@/lib/tandoor-theme";

function themeLabel(t: TandoorThemeChoice): string {
  if (t === "light") return "Светлая";
  if (t === "dark") return "Тёмная";
  return "Как в системе";
}

function TriggerIcon({ theme }: { theme: TandoorThemeChoice }) {
  if (theme === "system") return <Monitor className="h-4 w-4" aria-hidden data-testid="icon-theme-system" />;
  if (theme === "dark") return <Moon className="h-4 w-4" aria-hidden data-testid="icon-theme-dark" />;
  return <Sun className="h-4 w-4" aria-hidden data-testid="icon-theme-light" />;
}

/** Компактный переключатель для desktop topbar. */
export function ThemeToggleDesktop({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-11 w-11 shrink-0 border-border/80", className)}
          title="Тема интерфейса"
          aria-label="Тема интерфейса"
          data-testid="button-theme-toggle"
        >
          <TriggerIcon theme={theme} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]" data-testid="menu-theme-options">
        <DropdownMenuItem className="gap-2" data-testid="option-theme-light" onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4" aria-hidden />
          Светлая
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" data-testid="option-theme-dark" onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4" aria-hidden />
          Тёмная
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" data-testid="option-theme-system" onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4" aria-hidden />
          Как в системе
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Крупные кнопки для mobile drawer. */
export function ThemeToggleMobileBlock() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-3 border-t border-border/60 px-5 py-4" data-testid="menu-theme-options">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тема интерфейса</p>
      <p className="text-sm text-foreground" data-testid="text-current-theme">
        Сейчас: {themeLabel(theme)}
      </p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={theme === "light" ? "default" : "outline"}
          className="h-12 w-full justify-start gap-2 text-base"
          data-testid="option-theme-light"
          onClick={() => setTheme("light")}
        >
          <Sun className="h-5 w-5 shrink-0" aria-hidden data-testid="icon-theme-light" />
          Светлая
        </Button>
        <Button
          type="button"
          variant={theme === "dark" ? "default" : "outline"}
          className="h-12 w-full justify-start gap-2 text-base"
          data-testid="option-theme-dark"
          onClick={() => setTheme("dark")}
        >
          <Moon className="h-5 w-5 shrink-0" aria-hidden data-testid="icon-theme-dark" />
          Тёмная
        </Button>
        <Button
          type="button"
          variant={theme === "system" ? "default" : "outline"}
          className="h-12 w-full justify-start gap-2 text-base"
          data-testid="option-theme-system"
          onClick={() => setTheme("system")}
        >
          <Monitor className="h-5 w-5 shrink-0" aria-hidden data-testid="icon-theme-system" />
          Как в системе
        </Button>
      </div>
    </div>
  );
}
