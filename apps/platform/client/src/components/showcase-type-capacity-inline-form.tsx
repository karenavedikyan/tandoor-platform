import type { ReactElement } from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SHOWCASE_TYPE_LABEL_RU, type ShowcaseTypeKey } from "@/lib/showcase-type-capacity";
import { cn } from "@/lib/utils";

type Props = {
  type: ShowcaseTypeKey;
  currentCapacity: number | null;
  hint?: string;
  onSave: (value: number) => void;
  onCancel: () => void;
  className?: string;
};

export function ShowcaseTypeCapacityInlineForm({
  type,
  currentCapacity,
  hint,
  onSave,
  onCancel,
  className,
}: Props): ReactElement {
  const [value, setValue] = useState(currentCapacity != null ? String(currentCapacity) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const t = value.trim();
    if (!t && t !== "0") {
      setError("Введите 0 или больше");
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      setError("Введите 0 или больше");
      return;
    }
    setError(null);
    onSave(n);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/30 bg-amber-50/80 px-2.5 py-2 dark:border-amber-800/50 dark:bg-amber-950/30",
        className,
      )}
      data-testid={`form-showcase-type-capacity-${type}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold leading-snug text-amber-950 dark:text-amber-50">
          Сколько {SHOWCASE_TYPE_LABEL_RU[type]} в ТТ?
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Закрыть"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {hint ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          className="h-8 w-24 text-sm"
          value={value}
          data-testid={`input-showcase-type-capacity-${type}`}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={submit}>
          Сохранить
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-[10px] font-medium text-destructive" data-testid={`text-showcase-type-capacity-error-${type}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
