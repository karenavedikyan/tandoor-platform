import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  collectScopeTradePointIds,
  collectScopeTradePoints,
  countStatuses,
  entriesForDealer,
  entriesForTradePoint,
  groupMatrixEntries,
  haystackForDealer,
  haystackForScopeRef,
  matchesSearch,
  mergeEntriesFromCache,
  resolvePositionDisplayName,
  type DistributionScope,
  type ScopeTradePointRef,
  type ShowcaseMatrixStatusCounts,
} from "@/lib/distribution-tree-data";
import { fetchShowcaseMatrixScope, type ShowcaseMatrixEntryDto, type ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import {
  SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";
import { formatRelativeTime } from "@/lib/format-datetime";
import { computeDistributionMetrics } from "@/lib/distribution-metrics";
import { PLACEMENT_TYPE_LABEL_RU } from "@/lib/showcase-placement-labels";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type DistributionTreeProps = {
  scope: DistributionScope;
  profile: ReleaseDemoProfile;
  searchQuery?: string;
  actualizationLoading?: boolean;
};

function statusBadgeClass(status: ShowcaseMatrixStatus): string {
  if (status === "need_install") return "border-primary/40 bg-primary/10 text-primary";
  if (status === "installed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "postponed") return "border-border bg-muted/70 text-foreground";
  return "border-border bg-muted/50 text-muted-foreground";
}

function StatusSummaryBadges({ counts, testIdPrefix }: { counts: ShowcaseMatrixStatusCounts; testIdPrefix?: string }) {
  const items: { status: ShowcaseMatrixStatus; label: string }[] = [
    { status: "need_install", label: "нужно выставить" },
    { status: "installed", label: "выставлено" },
    { status: "postponed", label: "отложено" },
  ];

  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      {items.map(({ status, label }) => {
        const n = counts[status];
        if (n <= 0) return null;
        return (
          <Badge
            key={status}
            variant="outline"
            className={cn("shrink-0 whitespace-nowrap text-[10px] font-medium sm:text-xs", statusBadgeClass(status))}
            data-testid={testIdPrefix ? `${testIdPrefix}-${status}` : undefined}
          >
            {label} {n}
          </Badge>
        );
      })}
    </div>
  );
}

function formatMetricPct(value: number | null): string {
  return value == null ? "—" : String(value);
}

function TradePointDistributionMetricsPanel({
  entries,
  pointId,
}: {
  entries: ShowcaseMatrixEntryDto[];
  pointId: string;
}) {
  const metrics = useMemo(() => computeDistributionMetrics(entries), [entries]);

  if (metrics.byType.length === 0) return null;

  return (
    <div
      className="space-y-2 border-b border-border/50 px-2 py-2.5 sm:px-3"
      data-testid={`distribution-tp-metrics-${pointId}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Дистрибуция по типам витрины
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
        <span data-testid={`distribution-tp-quantitative-${pointId}`}>
          Количественная: {formatMetricPct(metrics.quantitativePct)}%
        </span>
        <span data-testid={`distribution-tp-qualitative-${pointId}`}>
          Качественная: {formatMetricPct(metrics.qualitativePct)}%
        </span>
      </div>
      <ul className="space-y-2">
        {metrics.byType.map((row) => (
          <li
            key={row.type}
            className="space-y-1"
            data-testid={`distribution-tp-metric-${row.type}-${pointId}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium text-foreground">{PLACEMENT_TYPE_LABEL_RU[row.type]}</span>
              <span className="text-muted-foreground">
                {row.actual}/{row.capacity} ({formatMetricPct(row.quantitativePct)}%)
              </span>
            </div>
            {row.capacity > 0 ? (
              <Progress
                value={row.quantitativePct ?? 0}
                className="h-1.5"
                aria-label={`Доля наших в ${PLACEMENT_TYPE_LABEL_RU[row.type]}`}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Качественная считается по весам типов размещения; будет уточнена по матрице ценности.
      </p>
    </div>
  );
}

function PositionRow({ entry, dealer }: { entry: ShowcaseMatrixEntryDto; dealer: DealerRow }) {
  const name = resolvePositionDisplayName(entry, dealer);
  const status = entry.status as ShowcaseMatrixStatusId;
  const meta =
    entry.updatedByName?.trim() || entry.updatedAt
      ? [entry.updatedByName?.trim(), entry.updatedAt ? formatRelativeTime(entry.updatedAt) : null]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div
      className="flex flex-col gap-1.5 border-b border-border/50 px-2 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      data-testid="distribution-position-row"
    >
      <p className="min-w-0 text-sm font-medium text-foreground">{name}</p>
      <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
        <Badge
          variant="outline"
          className={cn("shrink-0 whitespace-nowrap text-xs", statusBadgeClass(entry.status))}
          data-testid="distribution-status-badge"
        >
          {statusLabelRu(status)}
        </Badge>
        {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  );
}

function TradePointNode({
  ref: tpRef,
  entries,
  defaultOpen,
}: {
  ref: ScopeTradePointRef;
  entries: ShowcaseMatrixEntryDto[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const positionEntries = useMemo(
    () => entries.filter((e) => e.targetKind !== "placement"),
    [entries],
  );
  const metrics = useMemo(() => computeDistributionMetrics(entries), [entries]);
  const counts = useMemo(() => countStatuses(positionEntries), [positionEntries]);
  const sorted = useMemo(
    () =>
      [...positionEntries].sort((a, b) =>
        resolvePositionDisplayName(a, tpRef.dealer).localeCompare(resolvePositionDisplayName(b, tpRef.dealer), "ru"),
      ),
    [positionEntries, tpRef.dealer],
  );

  if (positionEntries.length === 0 && metrics.byType.length === 0) return null;

  const city = tpRef.point.city?.trim();
  const title = tpRef.point.name?.trim() || tpRef.point.id;

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="distribution-trade-point-node">
      <CollapsibleTrigger
        type="button"
        className="flex w-full min-w-0 items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-2.5 py-2 text-left transition-colors hover:bg-muted/20"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {city ? <span className="text-xs text-muted-foreground">{city}</span> : null}
          </div>
          <StatusSummaryBadges counts={counts} testIdPrefix={`distribution-tp-summary-${tpRef.point.id}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 overflow-hidden rounded-lg border border-border/40 bg-card">
        <TradePointDistributionMetricsPanel entries={entries} pointId={tpRef.point.id} />
        {sorted.map((entry) => (
          <PositionRow key={entry.id} entry={entry} dealer={tpRef.dealer} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DealerNode({
  dealer,
  tpRefs,
  grouped,
  defaultOpen,
  searchQuery,
}: {
  dealer: DealerRow;
  tpRefs: ScopeTradePointRef[];
  grouped: ReturnType<typeof groupMatrixEntries>;
  defaultOpen: boolean;
  searchQuery: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dealerEntries = useMemo(() => entriesForDealer(grouped, dealer.id), [grouped, dealer.id]);
  const counts = useMemo(() => countStatuses(dealerEntries), [dealerEntries]);

  const visibleTpRefs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tpRefs.filter((ref) => {
      const tpEntries = entriesForTradePoint(grouped, dealer.id, ref.point.id);
      if (tpEntries.length === 0) return false;
      if (!q) return true;
      if (matchesSearch(haystackForScopeRef(ref), q)) return true;
      return tpEntries.some((e) => matchesSearch(resolvePositionDisplayName(e, dealer).toLowerCase(), q));
    });
  }, [tpRefs, grouped, dealer.id, searchQuery]);

  if (visibleTpRefs.length === 0) return null;

  const city = dealer.city?.trim();

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="distribution-dealer-node">
      <CollapsibleTrigger
        type="button"
        className="flex w-full min-w-0 items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-xs transition-colors hover:bg-muted/10"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground sm:text-base">{dealer.name}</span>
            {city ? <span className="text-xs text-muted-foreground">{city}</span> : null}
          </div>
          <StatusSummaryBadges counts={counts} testIdPrefix={`distribution-dealer-summary-${dealer.id}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 pl-1 sm:pl-2">
        {visibleTpRefs.map((ref) => (
          <TradePointNode
            key={ref.point.id}
            ref={ref}
            entries={entriesForTradePoint(grouped, dealer.id, ref.point.id)}
            defaultOpen={false}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DistributionTree({
  scope,
  profile: _profile,
  searchQuery = "",
  actualizationLoading = false,
}: DistributionTreeProps) {
  const scopeRefs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const tradePointIds = useMemo(() => collectScopeTradePointIds(scope), [scope]);

  const [entries, setEntries] = useState<ShowcaseMatrixEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeStale, setScopeStale] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    const onBump = () => bumpRefresh();
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onBump);
    window.addEventListener(SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT, onBump);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onBump);
      window.removeEventListener(SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT, onBump);
    };
  }, [bumpRefresh]);

  useEffect(() => {
    if (actualizationLoading) {
      setLoading(true);
      return;
    }

    if (tradePointIds.length === 0) {
      setEntries([]);
      setScopeStale(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchShowcaseMatrixScope({ tradePointIds }).then((remote) => {
      if (cancelled) return;
      if (remote == null) {
        setEntries(mergeEntriesFromCache(tradePointIds));
        setScopeStale(true);
      } else {
        setEntries(remote);
        setScopeStale(false);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [actualizationLoading, tradePointIds, refreshTick]);

  const grouped = useMemo(() => groupMatrixEntries(entries), [entries]);

  const dealersInScope = useMemo(() => {
    if (scope.kind === "global") return scope.dealers;
    if (scope.kind === "dealer") return [scope.dealer];
    return [scope.dealer];
  }, [scope]);

  const showDealerLevel = scope.kind === "global" && dealersInScope.length > 1;

  const filteredDealers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dealersInScope;

    return dealersInScope.filter((dealer) => {
      if (matchesSearch(haystackForDealer(dealer), q)) return true;
      const refs = scopeRefs.filter((r) => r.dealer.id === dealer.id);
      return refs.some((ref) => {
        if (matchesSearch(haystackForScopeRef(ref), q)) return true;
        return entriesForTradePoint(grouped, dealer.id, ref.point.id).some((e) =>
          matchesSearch(resolvePositionDisplayName(e, dealer).toLowerCase(), q),
        );
      });
    });
  }, [dealersInScope, searchQuery, scopeRefs, grouped]);

  const hasAnyEntries = entries.length > 0;

  if (actualizationLoading || loading) {
    return (
      <CardContent className="px-3 py-6 sm:px-4" data-testid="distribution-tree">
        <p className="text-sm text-muted-foreground">Загрузка данных дистрибуции…</p>
      </CardContent>
    );
  }

  if (tradePointIds.length === 0) {
    return (
      <CardContent className="px-3 py-6 sm:px-4" data-testid="distribution-tree">
        <p className="text-sm text-muted-foreground">Данных по витринам пока нет.</p>
      </CardContent>
    );
  }

  if (!hasAnyEntries) {
    return (
      <CardContent className="px-3 py-6 sm:px-4" data-testid="distribution-tree">
        <p className="text-sm text-muted-foreground">Данных по витринам пока нет.</p>
      </CardContent>
    );
  }

  if (scope.kind === "trade-point") {
    const tpEntries = entriesForTradePoint(grouped, scope.dealer.id, scope.point.id);
    const positionEntries = tpEntries.filter((e) => e.targetKind !== "placement");
    const metrics = computeDistributionMetrics(tpEntries);
    const sorted = [...positionEntries].sort((a, b) =>
      resolvePositionDisplayName(a, scope.dealer).localeCompare(resolvePositionDisplayName(b, scope.dealer), "ru"),
    );
    const q = searchQuery.trim().toLowerCase();
    const visible = q
      ? sorted.filter((e) => matchesSearch(resolvePositionDisplayName(e, scope.dealer).toLowerCase(), q))
      : sorted;

    if (positionEntries.length === 0 && metrics.byType.length === 0) {
      return (
        <CardContent className="px-3 py-6 sm:px-4" data-testid="distribution-tree">
          <p className="text-sm text-muted-foreground">Данных по витринам пока нет.</p>
        </CardContent>
      );
    }

    return (
      <CardContent className="space-y-2 px-3 py-3 sm:px-4" data-testid="distribution-tree">
        {scopeStale ? (
          <p className="text-xs text-muted-foreground">
            Не удалось обновить, показаны последние данные
          </p>
        ) : null}
        {visible.length === 0 && metrics.byType.length === 0 && q ? (
          <p className="text-sm text-muted-foreground">По запросу ничего не найдено.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
            <TradePointDistributionMetricsPanel entries={tpEntries} pointId={scope.point.id} />
            {visible.map((entry) => (
              <PositionRow key={entry.id} entry={entry} dealer={scope.dealer} />
            ))}
          </div>
        )}
      </CardContent>
    );
  }

  const dealerTpRefs = (dealerId: string) => scopeRefs.filter((r) => r.dealer.id === dealerId);

  return (
    <CardContent className="space-y-3 px-3 py-3 sm:px-4" data-testid="distribution-tree">
      {scopeStale ? (
        <p className="text-xs text-muted-foreground">Не удалось обновить, показаны последние данные</p>
      ) : null}

      {showDealerLevel ? (
        <div className="space-y-3">
          {filteredDealers.map((dealer) => (
            <DealerNode
              key={dealer.id}
              dealer={dealer}
              tpRefs={dealerTpRefs(dealer.id)}
              grouped={grouped}
              defaultOpen={false}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(scope.kind === "dealer" ? [scope.dealer] : filteredDealers).map((dealer) => {
            const refs = dealerTpRefs(dealer.id).filter((ref) => {
              const tpEntries = entriesForTradePoint(grouped, dealer.id, ref.point.id);
              if (tpEntries.length === 0) return false;
              const q = searchQuery.trim().toLowerCase();
              if (!q) return true;
              if (matchesSearch(haystackForScopeRef(ref), q)) return true;
              return tpEntries.some((e) =>
                matchesSearch(resolvePositionDisplayName(e, dealer).toLowerCase(), q),
              );
            });
            return refs.map((ref) => (
              <TradePointNode
                key={ref.point.id}
                ref={ref}
                entries={entriesForTradePoint(grouped, dealer.id, ref.point.id)}
                defaultOpen={scope.kind === "dealer" ? false : true}
              />
            ));
          })}
        </div>
      )}

      {filteredDealers.length === 0 && searchQuery.trim() ? (
        <p className="text-sm text-muted-foreground">По запросу ничего не найдено.</p>
      ) : null}
    </CardContent>
  );
}
