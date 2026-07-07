import type { ReactElement } from "react";
import { LayoutGrid, LayoutTemplate, List, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OneCListDensity } from "./use-one-c-list-density";

const DENSITY_OPTIONS = [
  { id: "large" as const, label: "Крупно", tid: "button-one-c-density-large", icon: LayoutTemplate },
  { id: "grid" as const, label: "Сетка", tid: "button-one-c-density-grid", icon: LayoutGrid },
  { id: "list" as const, label: "Список", tid: "button-one-c-density-list", icon: List },
  { id: "table" as const, label: "Таблица", tid: "button-one-c-density-table", icon: Table2 },
];

type Props = {
  value: OneCListDensity;
  onChange: (value: OneCListDensity) => void;
  testIdPrefix?: string;
};

export function OneCListDensityToggle({ value, onChange, testIdPrefix }: Props): ReactElement {
  return (
    <div
      className="flex min-w-0 items-center justify-end gap-0.5 rounded-lg border border-border bg-card p-0.5"
      role="radiogroup"
      aria-label="Плотность отображения списка"
      data-testid={testIdPrefix ? `${testIdPrefix}-density-toggle` : undefined}
    >
      {DENSITY_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <Button
            key={opt.id}
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-md border",
              active
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={opt.tid}
            aria-label={opt.label}
            aria-pressed={active}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
