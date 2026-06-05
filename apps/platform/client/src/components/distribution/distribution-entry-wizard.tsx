import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { distributionEntryScopedDealerRows } from "@/lib/distribution-entry-dealer-scope";
import {
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterScopeDealers,
  listActiveDistributionFilterChips,
  type DistributionFilterState,
} from "@/lib/distribution-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";

type DistributionEntryWizardProps = {
  profile: ReleaseDemoProfile;
};

export function DistributionEntryWizard({ profile }: DistributionEntryWizardProps) {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const [axis, setAxis] = useState<DistributionEntryAxis | null>(null);
  const [filter, setFilter] = useState<DistributionFilterState>(defaultDistributionFilterState);

  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
            includeArchivedDealers: false,
          })
        : DEALER_BASE_ROWS,
    [actx.enabled, managementPlane.mergedState, profile],
  );

  const scoped = useMemo(
    () => distributionEntryScopedDealerRows(workingDealerRows, profile),
    [workingDealerRows, profile],
  );

  const filteredDealers = useMemo(() => filterScopeDealers(scoped, filter), [scoped, filter]);

  const regionOptions = useMemo(() => extractRegionOptions(scoped), [scoped]);
  const cityOptions = useMemo(() => extractCityOptions(scoped), [scoped]);

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
            onClick={() => setAxis(null)}
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

      {axis ? (
        <DistributionFiltersBar
          value={filter}
          onChange={setFilter}
          regionOptions={regionOptions}
          cityOptions={cityOptions}
          title={`Фильтры списка${axisTitle ? `: ${axisTitle.toLowerCase()}` : ""}`}
        />
      ) : null}

      {axis && activeChips.length > 0 ? (
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
        <DistributionEntryAxisPicker onSelect={setAxis} />
      ) : axis === "tradePoint" ? (
        <DistributionEntryTradePointPanel profile={profile} dealers={filteredDealers} />
      ) : axis === "product" ? (
        <DistributionEntryProductPanel profile={profile} dealers={filteredDealers} filter={filter} />
      ) : (
        <DistributionEntryCityPanel profile={profile} dealers={filteredDealers} />
      )}
    </div>
  );
}
