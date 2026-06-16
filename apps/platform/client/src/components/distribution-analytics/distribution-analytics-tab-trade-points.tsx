import type { ReactElement } from "react";
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import type { AnalyticsTradePointRow } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionGroupMetrics, EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { DistributionAnalyticsExportButton } from "./distribution-analytics-export-button";
import { DistributionAnalyticsKpiTiles, DistributionPercentBadge } from "./distribution-analytics-kpi-tiles";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";
import { cn } from "@/lib/utils";

type SortKey = "average" | "entrance" | "interior" | "hardware" | "name";

type Props = {
  rows: AnalyticsTradePointRow[];
  aggregate: DistributionGroupMetrics;
  activeEquipmentTypes?: EquipmentTypeKey[];
};

export function DistributionAnalyticsTabTradePoints({ rows, aggregate, activeEquipmentTypes = [] }: Props): ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("average");
  const [sortAsc, setSortAsc] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv, "ru") : bv.localeCompare(av, "ru");
      const an = av == null || !Number.isFinite(Number(av)) ? -1 : Number(av);
      const bn = bv == null || !Number.isFinite(Number(bv)) ? -1 : Number(bv);
      return sortAsc ? an - bn : bn - an;
    });
    return list;
  }, [rows, sortAsc, sortKey]);

  const virtualizer = useDistributionEntryVirtualizer({
    count: sorted.length,
    estimateSize: DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.simpleRow,
    scrollRef,
    lanes: 1,
  });

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

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[960px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
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
        </table>
        <div ref={scrollRef} className="max-h-[min(70vh,720px)] overflow-y-auto">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const item = sorted[vi.index];
              if (!item) return null;
              const { row, metrics } = item;
              return (
                <div
                  key={row.tradePointId}
                  style={distributionEntryVirtualItemStyle(vi, virtualizer)}
                  className="border-b border-border/50"
                >
                  <Link
                    href={`/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}?tradePointShowcase=1`}
                    className="grid min-w-[960px] grid-cols-[minmax(160px,1.4fr)_repeat(7,minmax(80px,1fr))] gap-1 px-2 py-2 text-xs hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.tradePointDisplayCode}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{row.tradePointName}</p>
                    </div>
                    <Cell>{row.city}</Cell>
                    <Cell>{row.dealerName}</Cell>
                    <Cell>{row.clientCategoryLabel}</Cell>
                    <Cell>{row.manager}</Cell>
                    <TypeCell type="entrance" metrics={metrics} />
                    <TypeCell type="interior" metrics={metrics} />
                    <TypeCell type="hardware" metrics={metrics} />
                    <div className="flex items-center">
                      <DistributionPercentBadge value={metrics.averagePercent} />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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

function Cell({ children }: { children: React.ReactNode }): ReactElement {
  return <div className="flex items-center truncate text-muted-foreground">{children}</div>;
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
    setAsc(next === "name" ? true : true);
  }
}
