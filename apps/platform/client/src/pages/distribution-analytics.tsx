import type { ReactElement } from "react";
import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDistributionAnalyticsData } from "@/hooks/use-distribution-analytics-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  buildScopedAnalyticsTradePointRows,
} from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import type { DistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import { DistributionAnalyticsFiltersPanel } from "@/components/distribution-analytics/distribution-analytics-filters";
import { DistributionAnalyticsTabTradePoints } from "@/components/distribution-analytics/distribution-analytics-tab-trade-points";
import { DistributionAnalyticsTabTerritory } from "@/components/distribution-analytics/distribution-analytics-tab-territory";
import { DistributionAnalyticsTabProduct } from "@/components/distribution-analytics/distribution-analytics-tab-product";

export type DistributionAnalyticsTab = "trade-points" | "territory" | "product";

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
  const data = useDistributionAnalyticsData(profile, filters);
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const realScope = useSidebarNavRealScope();
  const scopedDealers = useDistributionScopedDealers(profile);
  const act = actx.enabled ? managementPlane.mergedState : actx.state;

  const scopedRows = useMemo(
    () => buildScopedAnalyticsTradePointRows(act, profile, scopedDealers, realScope),
    [act, profile, scopedDealers, realScope],
  );

  const totalRowsInScope = data.filteredRows.length;
  const hasAnyEligible = data.groupAggregate.tradePointsCount > 0;
  const hasTradePointsInScope = data.tradePointRows.length > 0;

  if (!hasTradePointsInScope) {
    return (
      <div className="space-y-3" data-testid="page-distribution-analytics">
        <DistributionAnalyticsFiltersPanel
          scopedRows={scopedRows}
          filters={filters}
          filteredCount={data.filteredRows.length}
          onApply={onFiltersChange}
        />
        <div
          className="py-8 text-center text-sm text-muted-foreground"
          data-testid="distribution-analytics-empty-scope"
        >
          Нет ТТ в вашей зоне ответственности.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="page-distribution-analytics">
      <DistributionAnalyticsFiltersPanel
        scopedRows={scopedRows}
        filters={filters}
        filteredCount={data.filteredRows.length}
        onApply={onFiltersChange}
      />

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as DistributionAnalyticsTab)}>
        <TabsList className="grid w-full grid-cols-3" data-testid="distribution-analytics-tabs">
          <TabsTrigger value="trade-points">По ТТ</TabsTrigger>
          <TabsTrigger value="territory">По территории</TabsTrigger>
          <TabsTrigger value="product">По продукту</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
