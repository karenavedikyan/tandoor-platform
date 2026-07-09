import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DistributionRefreshDiag } from "@/components/diag/distribution-refresh-diag";
import { useDistributionRefreshDiagEnabled } from "@/lib/diag-distribution-refresh-enabled";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DistributionEntryAxisPicker,
  type DistributionEntryAxis,
} from "@/components/distribution/distribution-entry-axis-picker";
import { DistributionEntryCityPanel } from "@/components/distribution/distribution-entry-city-panel";
import { DistributionEntryProductPanel } from "@/components/distribution/distribution-entry-product-panel";
import { DistributionEntryTradePointPanel } from "@/components/distribution/distribution-entry-tradepoint-panel";
import { DistributionFiltersBar } from "@/components/distribution/distribution-filters-bar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import { useOneCScopedStores } from "@/hooks/use-one-c-scoped-stores";
import { buildDistributionEntryTradePointRowsFromOneC } from "@/lib/one-c-distribution-adapter";
import {
  readDistributionAnalyticsSourceFromHash,
  resolveDistributionEntrySource,
} from "@/lib/distribution-analytics/distribution-analytics-source";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import {
  defaultDistributionEntryTradePointFilterState,
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterScopeDealers,
  filterScopeDealersByEntryTradePointFilters,
  listActiveDistributionFilterChips,
  sanitizeDistributionFilterForScope,
  sanitizeEntryTradePointFilterForScope,
  type DistributionFilterState,
  type DistributionEntryTradePointFilterState,
} from "@/lib/distribution-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

type DistributionEntryWizardProps = {
  profile: ReleaseDemoProfile;
  axis: DistributionEntryAxis | null;
  onAxisChange?: (active: boolean) => void;
  onAxisSelect: (axis: DistributionEntryAxis | null) => void;
};

export function DistributionEntryWizard({ profile, axis, onAxisChange, onAxisSelect }: DistributionEntryWizardProps) {
  const diagEnabled = useDistributionRefreshDiagEnabled();
  const { user } = useAuthUser();
  const qs = readDistributionAnalyticsSourceFromHash(window.location.hash);
  const entrySource = resolveDistributionEntrySource(user?.role, qs);
  const oneCStoreNavigation = entrySource === "one-c";

  const [filter, setFilter] = useState<DistributionFilterState>(defaultDistributionFilterState);
  const [ttFilter, setTtFilter] = useState<DistributionEntryTradePointFilterState>(
    defaultDistributionEntryTradePointFilterState,
  );
  const legacyScoped = useDistributionScopedDealers(profile);
  const oneCStores = useOneCScopedStores();
  const sourceDealers = entrySource === "one-c" ? oneCStores.dealers : legacyScoped;

  const oneCEntryRows = useMemo(
    () => buildDistributionEntryTradePointRowsFromOneC(oneCStores.items),
    [oneCStores.items],
  );

  useEffect(() => {
    onAxisChange?.(axis !== null);
    return () => onAxisChange?.(false);
  }, [axis, onAxisChange]);

  const filterScope = useMemo(() => {
    const access = mapSalesRoleToDealerBaseAccess(profile.role);
    return { hideRegion: access === "sales_manager" || access === "team_lead" };
  }, [profile.role]);

  useEffect(() => {
    setFilter((prev) => sanitizeDistributionFilterForScope(prev, filterScope));
    setTtFilter((prev) => sanitizeEntryTradePointFilterForScope(prev, filterScope));
  }, [filterScope]);

  const filteredDealers = useMemo(() => {
    if (axis === "tradePoint") {
      return filterScopeDealersByEntryTradePointFilters(sourceDealers, ttFilter);
    }
    return filterScopeDealers(sourceDealers, filter);
  }, [axis, filter, sourceDealers, ttFilter]);

  const regionOptions = useMemo(() => extractRegionOptions(sourceDealers), [sourceDealers]);
  const cityOptions = useMemo(() => extractCityOptions(sourceDealers), [sourceDealers]);

  const activeChips = useMemo(() => listActiveDistributionFilterChips(filter), [filter]);

  const axisTitle =
    axis === "tradePoint"
      ? "По торговой точке"
      : axis === "product"
        ? "По продукту"
        : axis === "city"
          ? "По городу"
          : null;

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-entry-wizard">
      {axis ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10"
            onClick={() => onAxisSelect(null)}
            data-testid="distribution-entry-axis-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            К выбору разреза
          </Button>
          {axisTitle ? (
            <span className="text-sm font-medium text-muted-foreground">{axisTitle}</span>
          ) : null}
        </div>
      ) : null}

      {axis && axis !== "tradePoint" ? (
        <DistributionFiltersBar
          value={filter}
          onChange={setFilter}
          regionOptions={regionOptions}
          cityOptions={cityOptions}
          hideRegion={filterScope.hideRegion}
          title={`Фильтры списка${axisTitle ? `: ${axisTitle.toLowerCase()}` : ""}`}
        />
      ) : null}

      {axis && axis !== "tradePoint" && activeChips.length > 0 ? (
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
            onClick={() => setFilter(defaultDistributionFilterState())}
            data-testid="distribution-entry-reset-filters"
          >
            Сбросить фильтры
          </Button>
        </div>
      ) : null}

      {!axis ? (
        <DistributionEntryAxisPicker onSelect={onAxisSelect} />
      ) : axis === "tradePoint" ? (
        oneCStoreNavigation && oneCStores.loading ? (
          <p className="text-sm text-muted-foreground" data-testid="distribution-entry-one-c-loading">
            Загрузка магазинов 1С…
          </p>
        ) : oneCStoreNavigation && oneCStores.error ? (
          <p className="text-sm text-destructive">{oneCStores.error}</p>
        ) : (
        <DistributionEntryTradePointPanel
          profile={profile}
          dealers={filteredDealers}
          scopedDealers={sourceDealers}
          filter={ttFilter}
          onFilterChange={setTtFilter}
          hideRegion={filterScope.hideRegion}
          oneCEntryRows={oneCEntryRows}
          oneCRowRefs={oneCStores.rowRefs}
          oneCStoreNavigation={oneCStoreNavigation}
        />
        )
      ) : axis === "product" ? (
        oneCStoreNavigation && oneCStores.loading ? (
          <p className="text-sm text-muted-foreground" data-testid="distribution-entry-one-c-loading">
            Загрузка магазинов 1С…
          </p>
        ) : oneCStoreNavigation && oneCStores.error ? (
          <p className="text-sm text-destructive">{oneCStores.error}</p>
        ) : (
          <DistributionEntryProductPanel
            profile={profile}
            dealers={filteredDealers}
            filter={filter}
            oneCStoreNavigation={oneCStoreNavigation}
          />
        )
      ) : oneCStoreNavigation && oneCStores.loading ? (
        <p className="text-sm text-muted-foreground" data-testid="distribution-entry-one-c-loading">
          Загрузка магазинов 1С…
        </p>
      ) : oneCStoreNavigation && oneCStores.error ? (
        <p className="text-sm text-destructive">{oneCStores.error}</p>
      ) : (
        <DistributionEntryCityPanel
          profile={profile}
          dealers={filteredDealers}
          oneCStoreNavigation={oneCStoreNavigation}
        />
      )}
      <DistributionRefreshDiag enabled={diagEnabled} axis={axis} />
    </div>
  );
}
