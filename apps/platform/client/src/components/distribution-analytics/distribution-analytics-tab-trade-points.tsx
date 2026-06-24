import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import type { AnalyticsTradePointRow } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionGroupMetrics, EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { DistributionAnalyticsExportButton } from "./distribution-analytics-export-button";
import { DistributionAnalyticsKpiTiles, DistributionPercentBadge } from "./distribution-analytics-kpi-tiles";
import { DistributionEmptyDataNotice } from "./distribution-empty-data-notice";
import { DistributionAnalyticsMobileSort } from "./distribution-analytics-mobile-sort";
import { compareLocaleString, compareNullableNumber } from "@/lib/distribution-analytics/distribution-analytics-sort";
import { cn } from "@/lib/utils";

type SortKey = "average" | "entrance" | "interior" | "hardware" | "name";

const MOBILE_PAGE_SIZE = 50;

type Props = {
  rows: AnalyticsTradePointRow[];
  aggregate: DistributionGroupMetrics;
  activeEquipmentTypes?: EquipmentTypeKey[];
  totalRowsInScope: number;
  hasAnyEligible: boolean;
};

export function DistributionAnalyticsTabTradePoints({
  rows,
  aggregate,
  activeEquipmentTypes = [],
  totalRowsInScope,
  hasAnyEligible,
}: Props): ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("average");
  const [sortAsc, setSortAsc] = useState(false);
  const [mobilePage, setMobilePage] = useState(0);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av =
        sortKey === "name"
          ? a.row.tradePointName
          : sortKey === "average"
            ? a.metrics.averagePercent
            : a.metrics.byType[sortKey].percent;
      const bv =
        sortKey === "name"
          ? b.row.tradePointName
          : sortKey === "average"
            ? b.metrics.averagePercent
            : b.metrics.byType[sortKey].percent;
      if (typeof av === "string" && typeof bv === "string") {
        return compareLocaleString(av, bv, sortAsc ? "asc" : "desc");
      }
      return compareNullableNumber(
        av as number | null,
        bv as number | null,
        sortAsc ? "asc" : "desc",
      );
    });
    return list;
  }, [rows, sortAsc, sortKey]);

  useEffect(() => {
    setMobilePage(0);
  }, [sortKey, sortAsc]);

  const mobilePagedRows = useMemo(
    () => sorted.slice(mobilePage * MOBILE_PAGE_SIZE, (mobilePage + 1) * MOBILE_PAGE_SIZE),
    [sorted, mobilePage],
  );
  const totalPages = Math.ceil(sorted.length / MOBILE_PAGE_SIZE);

  return (
    <div className="space-y-3" data-testid="distribution-analytics-tab-trade-points">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <DistributionAnalyticsKpiTiles
            aggregate={aggregate}
            tradePointsCount={rows.length}
            activeEquipmentTypes={activeEquipmentTypes}
          />
        </div>
        <DistributionAnalyticsExportButton rows={sorted} />
      </div>

      <DistributionEmptyDataNotice hasAnyEligible={hasAnyEligible} totalRowsInScope={totalRowsInScope} />

      <div className="md:hidden space-y-2" data-testid="distribution-analytics-tab-trade-points-mobile">
        <DistributionAnalyticsMobileSort
          className="md:hidden flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5"
          options={[
            { value: "average", label: "Средняя %" },
            { value: "entrance", label: "ВХ %" },
            { value: "interior", label: "МК %" },
            { value: "hardware", label: "Фурн %" },
            { value: "name", label: "Название ТТ" },
          ]}
          value={sortKey}
          dir={sortAsc ? "asc" : "desc"}
          onChange={(next) => {
            const key = next as SortKey;
            if (key === sortKey) return;
            setSortKey(key);
            setSortAsc(key === "name");
          }}
          onToggleDir={() => setSortAsc((v) => !v)}
          testIdPrefix="distribution-analytics-trade-points"
        />
        {mobilePagedRows.map((item) => (
          <TradePointMobileCard key={item.row.tradePointId} item={item} />
        ))}
        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
              disabled={mobilePage === 0}
              onClick={() => setMobilePage((p) => Math.max(0, p - 1))}
            >
              Назад
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {mobilePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
              disabled={mobilePage >= totalPages - 1}
              onClick={() => setMobilePage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Вперёд
            </button>
          </div>
        ) : null}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-border/70">
        <div className="max-h-[min(70vh,720px)] overflow-y-auto">
          <table className="min-w-[960px] w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortTh label="ТТ" active={sortKey === "name"} asc={sortAsc} onClick={() => toggleSort("name", sortKey, sortAsc, setSortKey, setSortAsc)} />
                <th className="px-2 py-2">Город</th>
                <th className="px-2 py-2">Дилер</th>
                <th className="px-2 py-2">Категория</th>
                <th className="px-2 py-2">Менеджер</th>
                <SortTh label="ВХ %" active={sortKey === "entrance"} asc={sortAsc} onClick={() => toggleSort("entrance", sortKey, sortAsc, setSortKey, setSortAsc)} />
                <SortTh label="МК %" active={sortKey === "interior"} asc={sortAsc} onClick={() => toggleSort("interior", sortKey, sortAsc, setSortKey, setSortAsc)} />
                <SortTh label="Фурн %" active={sortKey === "hardware"} asc={sortAsc} onClick={() => toggleSort("hardware", sortKey, sortAsc, setSortKey, setSortAsc)} />
                <SortTh label="Средняя %" active={sortKey === "average"} asc={sortAsc} onClick={() => toggleSort("average", sortKey, sortAsc, setSortKey, setSortAsc)} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.row.tradePointId} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="min-w-[160px] px-2 py-2">
                    <Link
                      href={`/dealers/${encodeURIComponent(item.row.dealerId)}/trade-points/${encodeURIComponent(item.row.tradePointId)}?tradePointShowcase=1`}
                      className="block"
                    >
                      <p className="truncate font-medium">{item.row.tradePointDisplayCode}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.row.tradePointName}</p>
                    </Link>
                  </td>
                  <td className="truncate px-2 py-2 text-muted-foreground">{item.row.city}</td>
                  <td className="truncate px-2 py-2 text-muted-foreground">{item.row.dealerName}</td>
                  <td className="truncate px-2 py-2 text-muted-foreground">{item.row.clientCategoryLabel}</td>
                  <td className="truncate px-2 py-2 text-muted-foreground">{item.row.manager}</td>
                  <td className="px-2 py-2">
                    <TypeCell type="entrance" metrics={item.metrics} />
                  </td>
                  <td className="px-2 py-2">
                    <TypeCell type="interior" metrics={item.metrics} />
                  </td>
                  <td className="px-2 py-2">
                    <TypeCell type="hardware" metrics={item.metrics} />
                  </td>
                  <td className="px-2 py-2">
                    <DistributionPercentBadge value={item.metrics.averagePercent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TradePointMobileCard({ item }: { item: AnalyticsTradePointRow }): ReactElement {
  const { row, metrics } = item;
  return (
    <Link
      href={`/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}?tradePointShowcase=1`}
      className="block rounded-lg border border-border/70 bg-card p-3 hover:bg-muted/30"
      data-testid={`distribution-analytics-trade-point-card-${row.tradePointId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.tradePointDisplayCode}</p>
          <p className="truncate text-xs text-muted-foreground">{row.tradePointName}</p>
        </div>
        <DistributionPercentBadge value={metrics.averagePercent} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        <div className="truncate">
          Город: <span className="text-foreground">{row.city || "—"}</span>
        </div>
        <div className="truncate">
          Дилер: <span className="text-foreground">{row.dealerName || "—"}</span>
        </div>
        <div className="truncate">
          Категория: <span className="text-foreground">{row.clientCategoryLabel || "—"}</span>
        </div>
        <div className="truncate">
          Менеджер: <span className="text-foreground">{row.manager || "—"}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <MobileTypeCell label="ВХ" type="entrance" metrics={metrics} />
        <MobileTypeCell label="МК" type="interior" metrics={metrics} />
        <MobileTypeCell label="Фурн" type="hardware" metrics={metrics} />
      </div>
    </Link>
  );
}

function MobileTypeCell({
  label,
  type,
  metrics,
}: {
  label: string;
  type: EquipmentTypeKey;
  metrics: AnalyticsTradePointRow["metrics"];
}): ReactElement {
  const t = metrics.byType[type];
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <DistributionPercentBadge value={t.percent} />
      <p className="text-[10px] text-muted-foreground">
        {t.tandoorOnShelf}/{t.capacity ?? "—"}
      </p>
    </div>
  );
}

function SortTh({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <th className="px-2 py-2">
      <button type="button" className={cn("font-semibold", active && "text-foreground")} onClick={onClick}>
        {label}
        {active ? (asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function TypeCell({
  type,
  metrics,
}: {
  type: EquipmentTypeKey;
  metrics: AnalyticsTradePointRow["metrics"];
}): ReactElement {
  const t = metrics.byType[type];
  return (
    <div className="min-w-0">
      <DistributionPercentBadge value={t.percent} />
      <p className="text-[10px] text-muted-foreground">
        {t.tandoorOnShelf}/{t.capacity ?? "—"}
      </p>
    </div>
  );
}

function toggleSort(
  next: SortKey,
  current: SortKey,
  asc: boolean,
  setKey: (k: SortKey) => void,
  setAsc: (v: boolean) => void,
): void {
  if (current === next) setAsc(!asc);
  else {
    setKey(next);
    setAsc(next === "name");
  }
}
