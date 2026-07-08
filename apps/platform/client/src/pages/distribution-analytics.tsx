import { useState, type ReactElement } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-platform";
import { useDistributionAnalyticsData } from "@/hooks/use-distribution-analytics-data";
import { useAuthUser } from "@/hooks/use-auth-user";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import type { DistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import { DistributionAnalyticsFiltersPanel } from "@/components/distribution-analytics/distribution-analytics-filters";
import { DistributionAnalyticsTabTradePoints } from "@/components/distribution-analytics/distribution-analytics-tab-trade-points";
import { DistributionAnalyticsTabTerritory } from "@/components/distribution-analytics/distribution-analytics-tab-territory";
import { DistributionAnalyticsTabProduct } from "@/components/distribution-analytics/distribution-analytics-tab-product";
import { DistributionAnalyticsTabByRop } from "@/components/distribution-analytics/distribution-analytics-tab-by-rop";

export type DistributionAnalyticsTab = "trade-points" | "territory" | "product" | "by-rop";

function canViewByRopTab(profile: ReleaseDemoProfile, authRole?: string): boolean {
  if (profile.role === "sales_director") return true;
  return authRole === "admin" || authRole === "director";
}

type Props = {
  profile: ReleaseDemoProfile;
  tab: DistributionAnalyticsTab;
  filters: DistributionAnalyticsFilters;
  filtersEncoded: string;
  onTabChange: (tab: DistributionAnalyticsTab) => void;
  onFiltersChange: (filters: DistributionAnalyticsFilters) => void;
};

export function DistributionAnalyticsPage({
  profile,
  tab,
  filters,
  filtersEncoded,
  onTabChange,
  onFiltersChange,
}: Props): ReactElement {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuthUser();
  const scopedDealers = useDistributionScopedDealers(profile);
  const data = useDistributionAnalyticsData(profile, filters);
  const canViewByRop = canViewByRopTab(profile, user?.role);
  const effectiveTab = !canViewByRop && tab === "by-rop" ? "trade-points" : tab;

  const scopeTooLargeWithoutFilters =
    scopedDealers.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD &&
    !hasAnyDistributionAnalyticsFilters(filters);

  const totalRowsInScope = data.filteredRows.length;
  const hasAnyEligible = data.groupAggregate.tradePointsCount > 0;
  const hasTradePointsInScope = data.tradePointRows.length > 0;

  return (
    <div className="space-y-3" data-testid="page-distribution-analytics">
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground"
        data-testid="banner-distribution-analytics-lk-source"
      >
        Аналитика ещё на LK-каталоге, скоро переедет на 1С.
      </div>
      <DistributionAnalyticsFiltersPanel
        scopedDealers={scopedDealers}
        filters={filters}
        filteredCount={data.filteredRows.length}
        onApply={onFiltersChange}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
      />

      {scopeTooLargeWithoutFilters ? (
        <EmptyState
          title="Слишком большой scope"
          hint={`В вашем доступе ${scopedDealers.length} дилеров. Примените фильтр по региону, городу или сегменту, чтобы построить аналитику.`}
          cta={
            <Button type="button" onClick={() => setFiltersOpen(true)}>
              Открыть фильтры
            </Button>
          }
          testId="distribution-analytics-scope-too-large"
        />
      ) : !hasTradePointsInScope ? (
        <div
          className="py-8 text-center text-sm text-muted-foreground"
          data-testid="distribution-analytics-empty-scope"
        >
          Нет ТТ в вашей зоне ответственности.
        </div>
      ) : (
        <Tabs
          value={effectiveTab}
          onValueChange={(v) => {
            const next = v as DistributionAnalyticsTab;
            if (next === "by-rop" && !canViewByRop) {
              onTabChange("trade-points");
              return;
            }
            onTabChange(next);
          }}
        >
          <TabsList
            className={cn("grid w-full", canViewByRop ? "grid-cols-4" : "grid-cols-3")}
            data-testid="distribution-analytics-tabs"
          >
            <TabsTrigger value="trade-points">По ТТ</TabsTrigger>
            <TabsTrigger value="territory">По территории</TabsTrigger>
            <TabsTrigger value="product">По продукту</TabsTrigger>
            {canViewByRop ? <TabsTrigger value="by-rop">По РОПам</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="trade-points" className="mt-3">
            <DistributionAnalyticsTabTradePoints
              rows={data.tradePointRows}
              aggregate={data.groupAggregate}
              activeEquipmentTypes={filters.equipmentTypes}
              totalRowsInScope={totalRowsInScope}
              hasAnyEligible={hasAnyEligible}
            />
          </TabsContent>
          <TabsContent value="territory" className="mt-3">
            <DistributionAnalyticsTabTerritory
              territoryRows={data.territoryRows}
              aggregate={data.groupAggregate}
              activeEquipmentTypes={filters.equipmentTypes}
              totalRowsInScope={totalRowsInScope}
              hasAnyEligible={hasAnyEligible}
            />
          </TabsContent>
          <TabsContent value="product" className="mt-3">
            <DistributionAnalyticsTabProduct
              productRows={data.productRows}
              aggregate={data.groupAggregate}
              filtersEncoded={filtersEncoded}
              activeEquipmentTypes={filters.equipmentTypes}
              totalRowsInScope={totalRowsInScope}
              hasAnyEligible={hasAnyEligible}
            />
          </TabsContent>
          {canViewByRop ? (
            <TabsContent value="by-rop" className="mt-3">
              <DistributionAnalyticsTabByRop scopedDealers={scopedDealers} act={data.act} />
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}
