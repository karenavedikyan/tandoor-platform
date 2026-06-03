import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DistributionAnalyticsRow } from "@/lib/distribution-analytics";
import { formatRelativeTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export type DistributionBreakdownSortKey =
  | "label"
  | "dataCoveragePct"
  | "quantitativePct"
  | "qualitativePct"
  | "deficitCount"
  | "lastUpdatedAt";

type SortDirection = "asc" | "desc";

type DistributionBreakdownTableProps = {
  rows: DistributionAnalyticsRow<unknown>[];
  loading: boolean;
  levelLabel: string;
  onDrill?: (row: DistributionAnalyticsRow<unknown>) => void;
  emptyHint?: string;
  renderLabelAddon?: (row: DistributionAnalyticsRow<unknown>) => ReactNode;
};

const DEFAULT_EMPTY = "Данные ещё наполняются менеджерами";

function formatPct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function pctTone(value: number | null): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (value >= 50) return "text-foreground";
  return "text-amber-800 dark:text-amber-200";
}

function coverageBadgeClass(pct: number): string {
  if (pct >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (pct >= 50) return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
}

function sortValue(
  row: DistributionAnalyticsRow<unknown>,
  key: DistributionBreakdownSortKey,
): string | number {
  const c = row.coverage;
  switch (key) {
    case "label":
      return row.label;
    case "dataCoveragePct":
      return c.dataCoveragePct ?? -1;
    case "quantitativePct":
      return c.quantitativePct ?? -1;
    case "qualitativePct":
      return c.qualitativePct ?? -1;
    case "deficitCount":
      return c.deficitCount;
    case "lastUpdatedAt": {
      const ms = c.lastUpdatedAt ? Date.parse(c.lastUpdatedAt) : 0;
      return Number.isFinite(ms) ? ms : 0;
    }
    default:
      return 0;
  }
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: DistributionBreakdownSortKey;
  activeKey: DistributionBreakdownSortKey;
  direction: SortDirection;
  onSort: (key: DistributionBreakdownSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={cn("whitespace-nowrap", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

export function DistributionBreakdownTable({
  rows,
  loading,
  levelLabel,
  onDrill,
  emptyHint,
  renderLabelAddon,
}: DistributionBreakdownTableProps) {
  const [sortKey, setSortKey] = useState<DistributionBreakdownSortKey>("dataCoveragePct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (key: DistributionBreakdownSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "label" || key === "lastUpdatedAt" ? "asc" : "asc");
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv, "ru");
      } else {
        cmp = Number(av) - Number(bv);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDirection]);

  const drillable = Boolean(onDrill);

  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs" data-testid="distribution-breakdown-table">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center shadow-none"
        data-testid="distribution-breakdown-table-empty"
      >
        <p className="text-sm text-muted-foreground">{emptyHint ?? DEFAULT_EMPTY}</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      data-testid="distribution-breakdown-table"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead
                label={levelLabel}
                sortKey="label"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
                className="min-w-[10rem]"
              />
              <SortableHead
                label="Покрытие данными"
                sortKey="dataCoveragePct"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                label="ЧД"
                sortKey="quantitativePct"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                label="КД"
                sortKey="qualitativePct"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                label="Дефицит"
                sortKey="deficitCount"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                label="Свежесть"
                sortKey="lastUpdatedAt"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              {drillable ? <TableHead className="w-8" aria-hidden /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const c = row.coverage;
              const dataPct = c.dataCoveragePct;
              const qPct = c.quantitativePct;
              const kPct = c.qualitativePct;
              const factPlan =
                c.planCount > 0 ? `${c.factCount}/${c.planCount}` : "—";

              const rowInner = (
                <>
                  <TableCell className="font-medium text-foreground">
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{row.label}</span>
                      {renderLabelAddon?.(row)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5 min-w-[7rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-sm tabular-nums font-medium", pctTone(dataPct))}>
                          {formatPct(dataPct)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.tradePointsWithData}/{c.tradePointsTotal}
                        </span>
                      </div>
                      {dataPct != null ? (
                        <Progress value={Math.min(100, Math.max(0, dataPct))} className="h-1.5" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5 min-w-[5.5rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("tabular-nums", qPct != null && coverageBadgeClass(qPct))}>
                          {formatPct(qPct)}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">{factPlan}</span>
                      </div>
                      {qPct != null ? (
                        <Progress value={Math.min(100, Math.max(0, qPct))} className="h-1.5" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm tabular-nums font-medium", pctTone(kPct))}>
                      {formatPct(kPct)}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{c.deficitCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {c.lastUpdatedAt ? formatRelativeTime(c.lastUpdatedAt) : "нет данных"}
                  </TableCell>
                  {drillable ? (
                    <TableCell className="w-8 pr-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </TableCell>
                  ) : null}
                </>
              );

              if (drillable) {
                return (
                  <TableRow
                    key={row.key}
                    className="cursor-pointer"
                    onClick={() => onDrill?.(row)}
                    data-testid={`distribution-breakdown-row-${row.key}`}
                  >
                    {rowInner}
                  </TableRow>
                );
              }

              return (
                <TableRow key={row.key} data-testid={`distribution-breakdown-row-${row.key}`}>
                  {rowInner}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
