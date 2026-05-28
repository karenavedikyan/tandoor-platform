import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EntityListFilterOption = { value: string; label: string };

export type EntityListFilterDef = {
  key: string;
  label: string;
  value: string;
  options: EntityListFilterOption[];
  onChange: (next: string) => void;
  hidden?: boolean;
};

export type EntityListFiltersProps = {
  search: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder?: string;
  filters: EntityListFilterDef[];
  resultCount: number;
  activeCount: number;
  onReset: () => void;
  rightSlot?: ReactNode;
  className?: string;
};

export function EntityListFilters(props: EntityListFiltersProps) {
  const visibleFilters = props.filters.filter((f) => !f.hidden);
  const cols = Math.min(visibleFilters.length, 4);
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/80 p-3 shadow-xs",
        props.className,
      )}
      data-testid="entity-list-filters"
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-2 sm:gap-3",
          cols >= 3 ? "lg:grid-cols-4" : cols === 2 ? "lg:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder={props.searchPlaceholder ?? "Поиск..."}
            className="h-9 pl-8 pr-8"
            data-testid="entity-list-filters-search"
          />
          {props.search ? (
            <button
              type="button"
              onClick={() => props.onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {visibleFilters.map((f) => (
          <div key={f.key} className="min-w-0">
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="h-9" data-testid={`entity-list-filter-${f.key}`}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    data-testid={`entity-list-filter-${f.key}-option-${o.value}`}
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary" className="tabular-nums" data-testid="entity-list-filters-result-count">
          Найдено: {props.resultCount}
        </Badge>
        <div className="flex items-center gap-2">
          {props.rightSlot}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={props.onReset}
            disabled={props.activeCount === 0 && props.search.length === 0}
            data-testid="entity-list-filters-reset"
          >
            Сбросить{props.activeCount > 0 ? ` (${props.activeCount})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
