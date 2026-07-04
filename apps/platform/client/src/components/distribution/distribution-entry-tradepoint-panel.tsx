import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LayoutGrid, List, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { DistributionRefreshDiag } from "@/components/diag/distribution-refresh-diag";
import { useDistributionRefreshDiagEnabled } from "@/lib/diag-distribution-refresh-enabled";
import { DistributionEntryTradePointCard } from "@/components/distribution/distribution-entry-tradepoint-card";
import { DistributionEntryTradePointFiltersPanel } from "@/components/distribution/distribution-entry-tradepoint-filters-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { buildHashWithQuery, navigateHashPathInHash, useHashQuery } from "@/lib/hash-location-router";
import {
  readDistributionEntryTradePointView,
  writeDistributionEntryTradePointView,
  type DistributionEntryTradePointView,
} from "@/lib/distribution-entry-tradepoint-view";
import {
  DistributionTradePointMatrixEntry,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getCatalogDealerRows } from "@/lib/dealer-base-source";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { useRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import {
  buildDistributionEntryTradePointRows,
  collectScopedTradePointIds,
  findDealerTradePointForEntryRow,
  scopedTradePointIdsStableKey,
  type DistributionEntryTradePointRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import {
  countByStatusTab,
  defaultSortForTab,
  filterRowsByPeriod,
  filterRowsByStatusTab,
  sortEntryRows,
  type DistributionEntryPeriod,
  type DistributionEntrySortKey,
  type DistributionEntryStatusTab,
} from "@/lib/distribution-entry-tradepoint-status";
import {
  defaultDistributionEntryTradePointFilterState,
  listActiveEntryTradePointFilterChips,
  type DistributionEntryTradePointFilterState,
} from "@/lib/distribution-filters";
import { buildDistributionAnalyticsFilterOptionsFromDealers } from "@/lib/distribution-analytics/distribution-analytics-filter-options";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { fetchShowcaseMatrixScope } from "@/lib/showcase-matrix-api";
import {
  applyScopeEntriesToMatrixCache,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryDesktopLayout,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";

import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

export function isEntryDataLoading(
  actxEnabled: boolean,
  actxLoading: boolean,
  teamFetchLoading: boolean,
): boolean {
  return actxEnabled && (actxLoading || teamFetchLoading);
}

export function shouldShowEntryLoadingPlaceholder(args: {
  selectedTradePointId: string | null;
  hasSelectedRow: boolean;
  isEntryDataLoading: boolean;
  isWithinResolveGrace: boolean;
}): boolean {
  if (!args.selectedTradePointId) return false;
  if (args.hasSelectedRow) return false;
  return args.isEntryDataLoading || args.isWithinResolveGrace;
}

type DistributionEntryTradePointPanelProps = {
  profile: ReleaseDemoProfile;
  /** Отфильтрованные дилеры из мастера «Ввод»; если не переданы — считаются внутри панели. */
  dealers?: readonly DealerRow[];
  /** Полный scope дилеров для опций фильтров. */
  scopedDealers?: readonly DealerRow[];
  filter: DistributionEntryTradePointFilterState;
  onFilterChange: (next: DistributionEntryTradePointFilterState) => void;
  hideRegion?: boolean;
};

export function DistributionEntryTradePointPanel({
  profile,
  dealers: dealersProp,
  scopedDealers: scopedDealersProp,
  filter,
  onFilterChange,
  hideRegion,
}: DistributionEntryTradePointPanelProps) {
  const diagEnabled = useDistributionRefreshDiagEnabled();
  const { user } = useCurrentUser();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const routeQs = useHashQuery();
  const selectedTradePointId = routeQs.get("tp");
  const [query, setQuery] = useState("");
  const [cacheBump, setCacheBump] = useState(0);
  const [statusTab, setStatusTab] = useState<DistributionEntryStatusTab>("all");
  const [sortKey, setSortKey] = useState<DistributionEntrySortKey>(() => defaultSortForTab("all"));
  const [period, setPeriod] = useState<DistributionEntryPeriod>("all");
  const [countsPrefetching, setCountsPrefetching] = useState(false);
  const lastPrefetchedScopeKeyRef = useRef("");
  const isMobile = useIsMobile();
  const isDesktopLayout = useDistributionEntryDesktopLayout();
  const [tradePointView, setTradePointView] = useState<DistributionEntryTradePointView>(() =>
    readDistributionEntryTradePointView(isMobile),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: orgSnap } = useOrgSnapshot();

  useEffect(() => {
    writeDistributionEntryTradePointView(tradePointView);
  }, [tradePointView]);

  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
                      })
        : getCatalogDealerRows(),
    [actx.enabled, managementPlane.mergedState, profile],
  );

  const scopedDealersInternal = useRoleScopedDealerRowsAuto(workingDealerRows, profile);

  const filterOptionLabels = useMemo(() => {
    const scoped = scopedDealersProp ?? scopedDealersInternal;
    const options = buildDistributionAnalyticsFilterOptionsFromDealers(scoped, orgSnap);
    const toMap = (items: { value: string; label: string }[]) => new Map(items.map((o) => [o.value, o.label]));
    return {
      managers: toMap(options.managerOptions),
      regionalManagers: toMap(options.regionalManagerOptions),
      rops: toMap(options.ropOptions),
    };
  }, [orgSnap, scopedDealersInternal, scopedDealersProp]);

  const activeChips = useMemo(
    () => listActiveEntryTradePointFilterChips(filter, filterOptionLabels),
    [filter, filterOptionLabels],
  );

  const scopedDealers = dealersProp ?? scopedDealersInternal;

  const scopedTradePointIds = useMemo(
    () => collectScopedTradePointIds(scopedDealers),
    [scopedDealers],
  );

  const scopedTradePointIdsKey = useMemo(
    () => scopedTradePointIdsStableKey(scopedTradePointIds),
    [scopedTradePointIds],
  );

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (scopedTradePointIds.length === 0) return;
    if (lastPrefetchedScopeKeyRef.current === scopedTradePointIdsKey) return;

    let cancelled = false;
    const keyForRun = scopedTradePointIdsKey;
    setCountsPrefetching(true);

    void (async () => {
      try {
        const entries = await fetchShowcaseMatrixScope({ tradePointIds: scopedTradePointIds });
        if (cancelled) return;
        if (entries != null && entries.length > 0) {
          applyScopeEntriesToMatrixCache(entries);
        }
      } finally {
        if (!cancelled) {
          lastPrefetchedScopeKeyRef.current = keyForRun;
          setCountsPrefetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scopedTradePointIdsKey, scopedTradePointIds]);

  const baseRows = useMemo(() => {
    void cacheBump;
    return buildDistributionEntryTradePointRows({ dealers: scopedDealers, query });
  }, [scopedDealers, query, cacheBump]);

  const tabCounts = useMemo(() => countByStatusTab(baseRows), [baseRows]);

  const statusFilteredRows = useMemo(
    () => filterRowsByStatusTab(baseRows, statusTab),
    [baseRows, statusTab],
  );

  const periodFilteredRows = useMemo(
    () => (statusTab === "filled" ? filterRowsByPeriod(statusFilteredRows, period) : statusFilteredRows),
    [statusFilteredRows, statusTab, period],
  );

  const sortedRows = useMemo(
    () => sortEntryRows(periodFilteredRows, sortKey),
    [periodFilteredRows, sortKey],
  );

  const handleStatusTabChange = useCallback((next: string) => {
    const tab = next as DistributionEntryStatusTab;
    setStatusTab(tab);
    setSortKey(defaultSortForTab(tab));
    setPeriod("all");
  }, []);

  const setSelectedTradePointId = useCallback((tpId: string | null) => {
    const target = buildHashWithQuery("/distribution", {
      view: "entry",
      ax: "tradePoint",
      tp: tpId ?? undefined,
    });
    const current = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    if (current === target) return;
    navigateHashPathInHash(target);
  }, []);

  const rowRefs = useMemo(() => {
    const map = new Map<string, { dealer: DealerRow; point: DealerTradePoint }>();
    for (const row of baseRows) {
      const ref = findDealerTradePointForEntryRow(scopedDealers, row);
      if (ref) map.set(row.tradePointId, ref);
    }
    return map;
  }, [baseRows, scopedDealers]);

  const selectedRow = useMemo(
    () => baseRows.find((r) => r.tradePointId === selectedTradePointId) ?? null,
    [baseRows, selectedTradePointId],
  );

  const selectedRef = useMemo(
    () => (selectedRow ? findDealerTradePointForEntryRow(scopedDealers, selectedRow) : null),
    [scopedDealers, selectedRow],
  );

  const RESOLVE_GRACE_MS = 1200;
  const [resolveGraceActive, setResolveGraceActive] = useState(false);
  const resolveGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const needsGrace = Boolean(selectedTradePointId) && selectedRow === null;

    if (selectedRow !== null || !selectedTradePointId) {
      if (resolveGraceTimerRef.current) {
        clearTimeout(resolveGraceTimerRef.current);
        resolveGraceTimerRef.current = null;
      }
      setResolveGraceActive(false);
      return;
    }

    if (needsGrace && !resolveGraceTimerRef.current) {
      setResolveGraceActive(true);
      resolveGraceTimerRef.current = setTimeout(() => {
        resolveGraceTimerRef.current = null;
        setResolveGraceActive(false);
      }, RESOLVE_GRACE_MS);
    }

    return () => {
      if (resolveGraceTimerRef.current) {
        clearTimeout(resolveGraceTimerRef.current);
        resolveGraceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grace tracks tp selection vs row resolve only
  }, [selectedTradePointId, selectedRow]);

  const entryDataLoading = isEntryDataLoading(
    actx.enabled,
    actx.loading,
    managementPlane.teamFetchLoading,
  );
  const isResolvingSelectedTradePoint = shouldShowEntryLoadingPlaceholder({
    selectedTradePointId,
    hasSelectedRow: selectedRow !== null,
    isEntryDataLoading: entryDataLoading,
    isWithinResolveGrace: resolveGraceActive,
  });

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const handleSelectRow = useCallback((row: DistributionEntryTradePointRow) => {
    setSelectedTradePointId(row.tradePointId);
  }, [setSelectedTradePointId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const displayRows = useMemo(() => {
    const visible = sortedRows.filter((r) => rowRefs.has(r.tradePointId));
    if (filter.status === "all") return visible;
    return visible.filter((row) => {
      const entries = loadCachedMatrix(row.tradePointId);
      return entries.some((entry) => entry.status === filter.status);
    });
  }, [filter.status, rowRefs, sortedRows, cacheBump]);

  const virtualRowCount = displayRows.length;

  const listEstimateSize =
    tradePointView === "detailed"
      ? DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.tradepointDetailed
      : DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.tradepointCompact;

  const virtualizer = useDistributionEntryVirtualizer({
    count: virtualRowCount,
    estimateSize: listEstimateSize,
    scrollRef,
  });

  useEffect(() => {
    if (!selectedTradePointId || displayRows.length === 0) return;
    const idx = displayRows.findIndex((r) => r.tradePointId === selectedTradePointId);
    if (idx < 0) return;
    virtualizer.scrollToIndex(idx, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when selection/view changes only
  }, [selectedTradePointId, displayRows.length, tradePointView]);

  const renderTradePointCard = (row: DistributionEntryTradePointRow) => {
    const ref = rowRefs.get(row.tradePointId);
    if (!ref) return null;
    return (
      <DistributionEntryTradePointCard
        key={row.tradePointId}
        row={row}
        dealer={ref.dealer}
        point={ref.point}
        profile={profile}
        view={tradePointView}
        selected={row.tradePointId === selectedTradePointId}
        onSelect={() => handleSelectRow(row)}
      />
    );
  };

  const listColumn = (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="relative w-full min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по точке, клиенту, городу"
            className="min-h-10 pl-9"
            data-testid="input-distribution-entry-tradepoint-search"
          />
        </div>
        <div className="flex items-start gap-2">
          <Tabs value={statusTab} onValueChange={handleStatusTabChange} className="min-w-0 flex-1">
            <TabsList
              className="flex h-auto w-full flex-wrap justify-start gap-1 p-1"
              data-testid="distribution-entry-tradepoint-status-tabs"
            >
              {(
                [
                  { id: "all" as const, label: "Все", count: tabCounts.all },
                  { id: "empty" as const, label: "Не заполнены", count: tabCounts.empty },
                  { id: "filled" as const, label: "Заполнены", count: tabCounts.filled },
                ] as const
              ).map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-8 flex-1 gap-1 px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
                  data-testid={`distribution-entry-tradepoint-tab-${tab.id}`}
                >
                  <span className="truncate">{tab.label}</span>
                  <Badge variant="secondary" className="h-5 min-w-5 shrink-0 rounded-full px-1.5 text-[10px] tabular-nums">
                    {tab.count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {countsPrefetching ? (
            <span
              className="flex shrink-0 items-center gap-1 pt-1 text-[10px] text-muted-foreground"
              data-testid="distribution-entry-tradepoint-counts-prefetching"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              обновляем…
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="min-h-9 w-full min-w-0 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs sm:max-w-xs sm:text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as DistributionEntrySortKey)}
            aria-label="Сортировка списка торговых точек"
            data-testid="distribution-entry-tradepoint-sort-select"
          >
            <option value="incomplete-first">Сначала незаполненные</option>
            <option value="recent-first">Сначала недавно заполненные</option>
            <option value="coverage-desc">По покрытию (убывание)</option>
            <option value="name-asc">По названию (А–Я)</option>
          </select>
          {statusTab === "filled" ? (
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => {
                if (v) setPeriod(v as DistributionEntryPeriod);
              }}
              className="flex w-full flex-wrap justify-start gap-1"
              aria-label="Период последнего внесения"
              data-testid="distribution-entry-tradepoint-period-toggle"
            >
              {(
                [
                  { id: "today" as const, label: "Сегодня" },
                  { id: "week" as const, label: "Неделя" },
                  { id: "month" as const, label: "Месяц" },
                  { id: "all" as const, label: "Всё время" },
                ] as const
              ).map((opt) => (
                <ToggleGroupItem
                  key={opt.id}
                  value={opt.id}
                  className="h-8 flex-1 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:flex-none sm:px-3"
                  data-testid={`distribution-entry-tradepoint-period-${opt.id}`}
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
        {statusTab === "filled" ? (
          <p className="text-xs text-muted-foreground" data-testid="distribution-entry-tradepoint-period-count">
            {period === "all" ? `Заполнено всего: ${displayRows.length}` : `Занесено за период: ${displayRows.length}`}
          </p>
        ) : null}
        <div className="flex items-center gap-2 self-start">
          <div
            className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
            role="radiogroup"
            aria-label="Вид списка торговых точек"
            data-testid="distribution-entry-tradepoint-view-toggle"
          >
            {(
              [
                { id: "compact" as const, label: "Компактно", icon: List },
                { id: "detailed" as const, label: "Развёрнуто", icon: LayoutGrid },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = tradePointView === opt.id;
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
                  aria-label={opt.label}
                  aria-pressed={active}
                  onClick={() => setTradePointView(opt.id)}
                  data-testid={`distribution-entry-tradepoint-view-${opt.id}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative h-9 gap-1.5 px-2.5"
            data-testid="button-distribution-entry-tt-filters"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-xs sm:text-sm">Фильтры</span>
            {activeChips.length > 0 ? (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-medium tabular-nums"
              >
                {activeChips.length}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="font-normal">
              {chip.label}
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onFilterChange(defaultDistributionEntryTradePointFilterState())}
            data-testid="distribution-entry-reset-filters"
          >
            Сбросить фильтры
          </Button>
        </div>
      ) : null}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Фильтры списка: по торговой точке</SheetTitle>
          </SheetHeader>
          <div className="mt-4 min-w-0 flex-1">
            <DistributionEntryTradePointFiltersPanel
              scopedDealers={scopedDealersProp ?? scopedDealersInternal}
              value={filter}
              onChange={onFilterChange}
              hideRegion={hideRegion}
            />
          </div>
        </SheetContent>
      </Sheet>

      {baseRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В вашей зоне видимости нет торговых точек для ввода.</p>
      ) : displayRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет торговых точек по выбранным фильтрам.</p>
      ) : (
        <div
          ref={scrollRef}
          className={cn(
            "max-h-[min(70vh,720px)] overflow-y-auto pr-0.5",
            tradePointView === "compact" &&
              "rounded-xl border border-border/80 bg-card shadow-sm",
          )}
          data-testid="list-distribution-entry-tradepoints"
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const row = displayRows[vi.index];
              if (!row) return null;
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    tradePointView === "detailed" ? "pb-3" : "border-b border-border/70 last:border-0",
                  )}
                  style={distributionEntryVirtualItemStyle(virtualizer, vi.start)}
                >
                  {renderTradePointCard(row)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const loadingEntryPlaceholder = (
    <Card className="rounded-xl border border-border bg-card shadow-xs">
      <CardContent
        className="flex min-h-[min(60vh,520px)] flex-col items-center justify-center gap-3 px-4 py-10 text-center"
        data-testid="distribution-entry-tradepoint-loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Загружаем торговую точку…</p>
      </CardContent>
    </Card>
  );

  const entryColumn = selectedRow && selectedRef ? (
    <DistributionTradePointMatrixEntry
      dealer={selectedRef.dealer}
      point={selectedRef.point}
      profile={profile}
      actorUserId={actorUserId}
      actorName={actorName}
      onBackToList={() => setSelectedTradePointId(null)}
    />
  ) : isResolvingSelectedTradePoint ? (
    loadingEntryPlaceholder
  ) : (
    <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-none">
      <CardContent className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Выберите торговую точку в списке, чтобы внести факт по матрице.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-entry-tradepoint-panel">
      {isDesktopLayout ? (
        <div className="grid min-h-[min(70vh,780px)] gap-4 grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-3 sm:p-4">{listColumn}</CardContent>
          </Card>
          <div className="min-w-0">{entryColumn}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedTradePointId && selectedRow ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setSelectedTradePointId(null)}
                data-testid="button-distribution-entry-back-to-list"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Назад к списку
              </Button>
              {entryColumn}
            </>
          ) : isResolvingSelectedTradePoint ? (
            loadingEntryPlaceholder
          ) : (
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardContent className="p-3 sm:p-4">{listColumn}</CardContent>
            </Card>
          )}
        </div>
      )}
      <DistributionRefreshDiag
        enabled={diagEnabled}
        axis="tradePoint"
        panelState={{ selectedTradePointId, tradePointView, filtersOpen }}
      />
    </div>
  );
}
