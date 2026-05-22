import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { suggestAddress, type DadataAddressSuggestItem } from "@/lib/dadata-address-suggest-api";

export type AddressSuggestInputProps = {
  value: string;
  onChange: (next: string) => void;
  onSelect?: (item: DadataAddressSuggestItem) => void;
  localOptions?: { value: string; label?: string; description?: string; testId?: string }[];
  placeholder?: string;
  disabled?: boolean;
  testId: string;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  rows?: number;
};

export function AddressSuggestInput({
  value,
  onChange,
  onSelect,
  localOptions = [],
  placeholder,
  disabled,
  testId,
  label,
  description,
  className,
  rows = 3,
}: AddressSuggestInputProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DadataAddressSuggestItem[]>([]);
  const [serviceOff, setServiceOff] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [emptyResults, setEmptyResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const runFetch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 3) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setEmptyResults(false);
      setFetchError(null);
      return;
    }
    if (disabled || serviceOff) {
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setFetchError(null);
    setEmptyResults(false);
    const res = await suggestAddress(query, { count: 8 });
    if (seq !== seqRef.current) return;
    setLoading(false);
    if (!res.success) {
      if (res.code === "DADATA_NOT_CONFIGURED") {
        setServiceOff(true);
        setItems([]);
        setOpen(false);
        return;
      }
      setFetchError(res.message ?? "Ошибка запроса");
      setItems([]);
      setOpen(false);
      return;
    }
    setItems(res.items);
    setEmptyResults(res.items.length === 0);
    setOpen(res.items.length > 0);
  }, [disabled, serviceOff]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value;
    if (q.trim().length < 3) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setEmptyResults(false);
      setFetchError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runFetch(q);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runFetch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || !(e.target instanceof Node)) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const statusText = (() => {
    if (disabled) return null;
    if (serviceOff) return "Сервис подсказок адресов не подключён";
    if (loading) return "Ищем адрес…";
    if (fetchError) return fetchError;
    if (value.trim().length >= 3 && emptyResults && !loading) return "Ничего не найдено";
    return "Можно заполнить вручную";
  })();

  const pick = (item: DadataAddressSuggestItem) => {
    const line = (item.unrestrictedValue || item.value).trim();
    onChange(line);
    onSelect?.(item);
    setOpen(false);
    setItems([]);
  };

  const normalizedValue = value.trim().toLowerCase();
  const visibleLocalOptions = localOptions
    .map((option, index) => ({ ...option, value: option.value.trim(), testId: option.testId ?? `option-address-suggest-local-${index}` }))
    .filter((option) => {
      if (!option.value) return false;
      if (option.value === value.trim()) return false;
      if (normalizedValue.length < 1) return true;
      return option.value.toLowerCase().includes(normalizedValue);
    });
  const shouldShowOptions = open || visibleLocalOptions.length > 0;

  return (
    <div className={cn("space-y-1.5", className)} ref={rootRef}>
      {label ? (
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
      ) : null}
      {description ? <p className="text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
      <div className="relative">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            if (serviceOff && next.trim().length < 3) setServiceOff(false);
          }}
          onFocus={() => {
            if ((items.length > 0 || visibleLocalOptions.length > 0) && !disabled) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="min-h-[72px] w-full min-w-0 resize-y text-sm"
          data-testid={testId}
        />
        {shouldShowOptions && !disabled ? (
          <ul
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
            role="listbox"
            data-testid="list-address-suggest-options"
          >
            {visibleLocalOptions.map((option) => (
              <li key={`local-${option.value}`}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  data-testid={option.testId}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(option.value);
                    setOpen(false);
                    setItems([]);
                  }}
                >
                  <span className="font-medium text-foreground">{option.label ?? option.value}</span>
                  {option.description ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.description}</span> : null}
                </button>
              </li>
            ))}
            {items.map((item, index) => (
              <li key={`${item.fiasId}-${index}`}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  data-testid={`option-address-suggest-${index}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item);
                  }}
                >
                  <span className="font-medium text-foreground">{item.value || item.unrestrictedValue}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {!disabled && statusText ? (
        <p className="text-[11px] leading-snug text-muted-foreground" data-testid="text-address-suggest-status">
          {statusText}
        </p>
      ) : null}
    </div>
  );
}
