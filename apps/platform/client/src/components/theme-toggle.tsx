import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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


function themeIconButtonClass(active: boolean) {
  return cn(
    "h-9 w-9 shrink-0 border-border/80",
    active && "border-primary bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
  );
}

/** Компактный переключатель темы внизу sidebar / mobile drawer (Промт 55). */
export function ThemeToggleSidebarCompact({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const choices: { value: TandoorThemeChoice; Icon: typeof Sun; label: string; testId: string }[] = [
    { value: "light", Icon: Sun, label: "Светлая", testId: "option-theme-light" },
    { value: "dark", Icon: Moon, label: "Тёмная", testId: "option-theme-dark" },
    { value: "system", Icon: Monitor, label: "Как в системе", testId: "option-theme-system" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("space-y-2 border-t border-border/60 px-5 py-4", className)} data-testid="menu-theme-options">
        <p className="text-[10px] font-medium text-muted-foreground">Тема</p>
        <div className="flex flex-row items-center gap-2">
          {choices.map(({ value, Icon, label, testId }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={themeIconButtonClass(theme === value)}
                  aria-label={label}
                  data-testid={testId}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** @deprecated Используйте ThemeToggleSidebarCompact */
export function ThemeToggleMobileBlock() {
  return <ThemeToggleSidebarCompact />;
}
