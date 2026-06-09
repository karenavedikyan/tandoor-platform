import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GlobalSearchTriggerProps = {
  onOpen: () => void;
  variant: "desktop" | "mobile";
  className?: string;
};

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function GlobalSearchTrigger({ onOpen, variant, className }: GlobalSearchTriggerProps): ReactElement {
  const shortcutLabel = isMacPlatform() ? "⌘K" : "Ctrl+K";

  if (variant === "mobile") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("h-11 w-11 shrink-0 border-border/80 bg-card", className)}
        onClick={onOpen}
        data-testid="button-global-search-mobile"
        aria-label="Поиск по платформе"
      >
        <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
      </Button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex h-11 min-h-[44px] w-full min-w-0 max-w-xl flex-1 items-center gap-2 rounded-md border border-border/80 bg-card px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={onOpen}
      data-testid="input-global-search"
      aria-label="Поиск по платформе"
    >
      <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Поиск...</span>
      <kbd className="hidden shrink-0 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
        {shortcutLabel}
      </kbd>
    </button>
  );
}
