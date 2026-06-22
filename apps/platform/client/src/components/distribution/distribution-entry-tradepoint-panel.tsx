import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LayoutGrid, List, Search, SlidersHorizontal, Square } from "lucide-react";
import { DistributionRefreshDiag } from "@/components/diag/distribution-refresh-diag";
import { useDistributionRefreshDiagEnabled } from "@/lib/diag-distribution-refresh-enabled";
import { DistributionEntryTradePointCard } from "@/components/distribution/distribution-entry-tradepoint-card";
import { DistributionFiltersBar } from "@/components/distribution/distribution-filters-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { useRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";import {
  buildDistributionEntryTradePointRows,
  findDealerTradePointForEntryRow,
  type DistributionEntryTradePointRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import {
  defaultDistributionFilterState,
  listActiveDistributionFilterChips,
  type DistributionFilterState,
} from "@/lib/distribution-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryDesktopLayout,
  useDistributionEntryTradepointGridLanes,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";

import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionEntryTradePointPanelProps = {
  profile: ReleaseDemoProfile;
  /** Отфильтрованные дилеры из мастера «Ввод»; если не переданы — считаются внутри панели. */
  dealers?: readonly DealerRow[];
  filter: DistributionFilterState;
  onFilterChange: (next: DistributionFilterState) => void;
  regionOptions: string[];
  cityOptions: string[];
  hideRegion?: boolean;
};

export function DistributionEntryTradePointPanel({
  profile,
  dealers: dealersProp,
  filter,
  onFilterChange,
  regionOptions,
  cityOptions,
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
  const isMobile = useIsMobile();
  const isDesktopLayout = useDistributionEntryDesktopLayout();
  const [tradePointView, setTradePointView] = useState<DistributionEntryTradePointView>(() =>
    readDistributionEntryTradePointView(isMobile),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeChips = useMemo(() => listActiveDistributionFilterChips(filter), [filter]);

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

  const scopedDealers = dealersProp ?? scopedDealersInternal;

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const rows = useMemo(() => {
    void cacheBump;
    return buildDistributionEntryTradePointRows({ dealers: scopedDealers, query });
  }, [scopedDealers, query, cacheBump]);

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

  useEffect(() => {
    if (!selectedTradePointId || scopedDealers.length === 0) return;
    const exists = rows.some((r) => r.tradePointId === selectedTradePointId);
    if (!exists) {
      navigateHashPathInHash(buildHashWithQuery("/distribution", { view: "entry", ax: "tradePoint" }), {
        replace: true,
      });
    }
  }, [selectedTradePointId, rows, scopedDealers.length]);

  const rowRefs = useMemo(() => {
    const map = new Map<string, { dealer: DealerRow; point: DealerTradePoint }>();
    for (const row of rows) {
      const ref = findDealerTradePointForEntryRow(scopedDealers, row);
      if (ref) map.set(row.tradePointId, ref);
    }
    return map;
  }, [rows, scopedDealers]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.tradePointId === selectedTradePointId) ?? null,
    [rows, selectedTradePointId],
  );

  const selectedRef = useMemo(
    () => (selectedRow ? findDealerTradePointForEntryRow(scopedDealers, selectedRow) : null),
    [scopedDealers, selectedRow],
  );

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const handleSelectRow = useCallback((row: DistributionEntryTradePointRow) => {
    setSelectedTradePointId(row.tradePointId);
  }, [setSelectedTradePointId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridLanes = useDistributionEntryTradepointGridLanes();
  const displayRows = useMemo(
    () => rows.filter((r) => rowRefs.has(r.tradePointId)),
    [rows, rowRefs],
  );

  const virtualRowCount =
    tradePointView === "grid" ? Math.ceil(displayRows.length / gridLanes) : displayRows.length;

  const listEstimateSize =
    tradePointView === "large"
      ? DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.tradepointLarge
      : tradePointView === "grid"
        ? DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.tradepointGridRow
        : DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.tradepointList;

  const virtualizer = useDistributionEntryVirtualizer({
    count: virtualRowCount,
    estimateSize: listEstimateSize,
    scrollRef,
  });

  useEffect(() => {
    if (!selectedTradePointId || displayRows.length === 0) return;
    const idx = displayRows.findIndex((r) => r.tradePointId === selectedTradePointId);
    if (idx < 0) return;
    const virtualIndex = tradePointView === "grid" ? Math.floor(idx / gridLanes) : idx;
    virtualizer.scrollToIndex(virtualIndex, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when selection/view changes only
  }, [selectedTradePointId, displayRows.length, tradePointView, gridLanes]);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
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
        <div className="flex shrink-0 items-center gap-2 self-start">
          <div
            className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
            role="radiogroup"
            aria-label="Вид списка торговых точек"
            data-testid="distribution-entry-tradepoint-view-toggle"
          >
            {(
              [
                { id: "large" as const, label: "Крупные", icon: Square },
                { id: "grid" as const, label: "Сетка", icon: LayoutGrid },
                { id: "list" as const, label: "Список", icon: List },
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
            onClick={() => onFilterChange(defaultDistributionFilterState())}
            data-testid="distribution-entry-reset-filters"
          >
            Сбросить фильтры
          </Button>
        </div>
      ) : null}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Фильтры списка</SheetTitle>
          </SheetHeader>
          <div className="mt-4 min-w-0">
            <DistributionFiltersBar
              value={filter}
              onChange={onFilterChange}
              regionOptions={regionOptions}
              cityOptions={cityOptions}
              hideRegion={hideRegion}
              title="Фильтры списка: по торговой точке"
            />
          </div>
        </SheetContent>
      </Sheet>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В вашей зоне видимости нет торговых точек для ввода.</p>
      ) : (
        <div
          ref={scrollRef}
          className={cn(
            "max-h-[min(70vh,720px)] overflow-y-auto pr-0.5",
            tradePointView === "list" &&
              "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
          )}
          data-testid="list-distribution-entry-tradepoints"
        >
          <div
            className={cn(
              "relative w-full",
              tradePointView === "large" && "mx-auto max-w-4xl",
            )}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              if (tradePointView === "grid") {
                const startIdx = vi.index * gridLanes;
                const slice = displayRows.slice(startIdx, startIdx + gridLanes);
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className="pb-2"
                    style={distributionEntryVirtualItemStyle(virtualizer, vi.start)}
                  >
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      {slice.map((row) => renderTradePointCard(row))}
                    </div>
                  </div>
                );
              }
              const row = displayRows[vi.index];
              if (!row) return null;
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    tradePointView === "large" ? "pb-3" : "border-b border-border/70 last:border-0",
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

  const entryColumn = selectedRow && selectedRef ? (
    <DistributionTradePointMatrixEntry
      dealer={selectedRef.dealer}
      point={selectedRef.point}
      profile={profile}
      actorUserId={actorUserId}
      actorName={actorName}
      onBackToList={() => setSelectedTradePointId(null)}
    />
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
