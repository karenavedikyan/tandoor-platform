import type { ReactElement } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { SortDir } from "@/lib/distribution-analytics/distribution-analytics-sort";

type SortOption = {
  value: string;
  label: string;
};

type Props = {
  options: SortOption[];
  value: string;
  dir: SortDir;
  onChange: (value: string) => void;
  onToggleDir: () => void;
  testIdPrefix?: string;
  className?: string;
};

export function DistributionAnalyticsMobileSort({
  options,
  value,
  dir,
  onChange,
  onToggleDir,
  testIdPrefix = "distribution-analytics",
  className,
}: Props): ReactElement {
  return (
    <div
      className={className ?? "flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5"}
      data-testid={`${testIdPrefix}-sort`}
    >
      <span className="shrink-0 text-xs text-muted-foreground">Сортировка</span>
      <select
        className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`${testIdPrefix}-sort-select`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="shrink-0 rounded-md border border-border bg-background p-1.5"
        onClick={onToggleDir}
        aria-label={dir === "asc" ? "По возрастанию" : "По убыванию"}
        data-testid={`${testIdPrefix}-sort-dir`}
      >
        {dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
}
