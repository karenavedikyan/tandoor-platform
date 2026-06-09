import type { ReactElement } from "react";
import { useCallback } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Home,
  Loader2,
  MapPinned,
  Package,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { UserRole } from "@shared/auth";
import { useGlobalSearch } from "@/lib/search/use-global-search";

type GlobalSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: UserRole | null;
};

function ResultSublabel({ text }: { text?: string }): ReactElement | null {
  if (!text) return null;
  return <span className="ml-2 truncate text-xs text-muted-foreground">{text}</span>;
}

export function GlobalSearchDialog({ open, onOpenChange, role }: GlobalSearchDialogProps): ReactElement {
  const [, setLocation] = useLocation();
  const { query, setQuery, quickLinks, results, isServerLoading, hasContentQuery, isEmpty } = useGlobalSearch(
    open,
    role,
  );

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      setLocation(href);
    },
    [onOpenChange, setLocation],
  );

  const showGroups =
    hasContentQuery &&
    (results.clients.length > 0 ||
      results.tradePoints.length > 0 ||
      results.products.length > 0 ||
      results.assignments.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Поиск по платформе..."
        value={query}
        onValueChange={setQuery}
        aria-label="Поиск по платформе"
        data-testid="global-search-input"
      />
      <CommandList className="max-h-[min(70vh,480px)] sm:max-h-[420px]">
        {isEmpty ? <CommandEmpty>Ничего не найдено</CommandEmpty> : null}

        {quickLinks.length > 0 ? (
          <CommandGroup heading="Быстрые переходы">
            {quickLinks.map((link) => (
              <CommandItem
                key={link.id}
                value={`${link.label} ${link.keywords ?? ""}`}
                onSelect={() => navigate(link.href)}
                className="min-h-[44px]"
                data-testid={`global-search-quick-${link.id}`}
              >
                <QuickLinkIcon href={link.href} />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {showGroups ? <CommandSeparator /> : null}

        {results.clients.length > 0 ? (
          <CommandGroup heading="Клиенты">
            {results.clients.map((item) => (
              <CommandItem
                key={`client-${item.id}`}
                value={`client ${item.label} ${item.sublabel ?? ""}`}
                onSelect={() => navigate(item.href)}
                className="min-h-[44px]"
              >
                <Users className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ResultSublabel text={item.sublabel} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.tradePoints.length > 0 ? (
          <CommandGroup heading="Торговые точки">
            {results.tradePoints.map((item) => (
              <CommandItem
                key={`tp-${item.id}`}
                value={`trade-point ${item.label} ${item.sublabel ?? ""}`}
                onSelect={() => navigate(item.href)}
                className="min-h-[44px]"
              >
                <Store className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ResultSublabel text={item.sublabel} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.products.length > 0 ? (
          <CommandGroup heading="Каталог">
            {results.products.map((item) => (
              <CommandItem
                key={`product-${item.id}`}
                value={`product ${item.label} ${item.sublabel ?? ""}`}
                onSelect={() => navigate(item.href)}
                className="min-h-[44px]"
              >
                <Package className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ResultSublabel text={item.sublabel} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results.assignments.length > 0 ? (
          <CommandGroup heading="Задачи">
            {results.assignments.map((item) => (
              <CommandItem
                key={`assignment-${item.id}`}
                value={`assignment ${item.label} ${item.sublabel ?? ""}`}
                onSelect={() => navigate(item.href)}
                className="min-h-[44px]"
              >
                <ClipboardList className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ResultSublabel text={item.sublabel} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {isServerLoading && hasContentQuery ? (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Уточняем результаты...
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

function QuickLinkIcon({ href }: { href: string }): ReactElement {
  const cls = "h-4 w-4 shrink-0 opacity-70";
  if (href === "/") return <Home className={cls} aria-hidden />;
  if (href.startsWith("/dealer-base")) return <Users className={cls} aria-hidden />;
  if (href.startsWith("/trade-points")) return <MapPinned className={cls} aria-hidden />;
  if (href.startsWith("/distribution")) return <Building2 className={cls} aria-hidden />;
  if (href.startsWith("/catalog")) return <BookOpen className={cls} aria-hidden />;
  if (href.startsWith("/assignments") || href.startsWith("/assignment")) {
    return <ClipboardList className={cls} aria-hidden />;
  }
  if (href.startsWith("/analytics")) return <BarChart3 className={cls} aria-hidden />;
  if (href.startsWith("/profile")) return <UserRound className={cls} aria-hidden />;
  if (href.startsWith("/admin")) return <Users className={cls} aria-hidden />;
  return <Home className={cls} aria-hidden />;
}
