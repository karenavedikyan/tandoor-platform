import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  testId?: string;
  ariaLabel?: string;
  showSearchThreshold?: number;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Выбрать",
  allLabel,
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  className,
  triggerClassName,
  contentClassName,
  testId,
  ariaLabel,
  showSearchThreshold = 8,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const toggle = useCallback(
    (v: string) => {
      const has = selectedSet.has(v);
      const next = has ? value.filter((x) => x !== v) : [...value, v];
      onChange(next);
    },
    [onChange, selectedSet, value],
  );

  const clear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const selectAllVisible = useCallback(() => {
    const visibleValues = filtered.map((o) => o.value);
    const merged = Array.from(new Set([...value, ...visibleValues]));
    onChange(merged);
  }, [filtered, onChange, value]);

  const triggerLabel = useMemo(() => {
    if (value.length === 0) return allLabel ?? placeholder;
    if (value.length === 1) return labelByValue.get(value[0]!) ?? value[0]!;
    if (value.length <= 2) {
      return value.map((v) => labelByValue.get(v) ?? v).join(", ");
    }
    return `Выбрано: ${value.length}`;
  }, [allLabel, labelByValue, placeholder, value]);

  const showSearch = options.length >= showSearchThreshold;

  return (
    <div className={cn("min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel ?? placeholder}
            className={cn(
              "h-auto min-h-11 w-full min-w-0 justify-between rounded-xl border-border bg-card px-3 py-2 text-left font-normal",
              triggerClassName,
            )}
            data-testid={testId}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                value.length === 0 ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {triggerLabel}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] min-w-[14rem] max-w-[min(22rem,calc(100vw-1rem))] p-0",
            contentClassName,
          )}
        >
          <div className="flex flex-col">
            {showSearch ? (
              <div className="border-b border-border p-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 rounded-md"
                  data-testid={testId ? `${testId}-search` : undefined}
                  autoFocus
                />
              </div>
            ) : null}
            <div
              className="max-h-64 min-w-0 overflow-y-auto p-1"
              role="listbox"
              aria-multiselectable
            >
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>
              ) : (
                filtered.map((o) => {
                  const checked = selectedSet.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted/60 focus:bg-muted/60 focus:outline-none",
                      )}
                      data-testid={testId ? `${testId}-option-${o.value}` : undefined}
                    >
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden
                        className="h-4 w-4 shrink-0 pointer-events-none"
                      />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {checked ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2 text-xs">
              <span className="text-muted-foreground" data-testid={testId ? `${testId}-summary` : undefined}>
                {value.length === 0 ? allLabel ?? "Все" : `Выбрано: ${value.length}`}
              </span>
              <div className="flex gap-1">
                {showSearch && filtered.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={selectAllVisible}
                    className="h-7 px-2 text-xs"
                    data-testid={testId ? `${testId}-select-visible` : undefined}
                  >
                    Выбрать видимые
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clear}
                  disabled={value.length === 0}
                  className="h-7 px-2 text-xs"
                  data-testid={testId ? `${testId}-clear` : undefined}
                >
                  <X className="mr-1 h-3 w-3" aria-hidden /> Очистить
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
