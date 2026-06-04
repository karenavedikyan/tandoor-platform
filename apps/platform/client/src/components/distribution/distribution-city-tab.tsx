import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DistributionBreakdownTable } from "@/components/distribution/distribution-breakdown-table";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { DistributionAnalyticsRow } from "@/lib/distribution-analytics";
import { useDistributionAnalytics } from "@/lib/distribution-analytics-store";
import {
  buildCityLevelRows,
  buildCityTradePointRows,
  cityDrilldownLevelLabel,
  getCityDrilldownLevel,
  parentCityDrilldownPath,
  type CityDrilldownPath,
} from "@/lib/distribution-city-drilldown";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import { collectScopeTradePoints, type DistributionScope, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionCityTabProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
  profile: ReleaseDemoProfile;
};

export function DistributionCityTab({ scope, filter, profile }: DistributionCityTabProps) {
  const { user } = useCurrentUser();
  const { snapshot } = useDistributionAnalytics(scope);
  const [path, setPath] = useState<CityDrilldownPath>({});
  const [entryRef, setEntryRef] = useState<ScopeTradePointRef | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const ctxBuilder = useMemo(() => createFilteredMetricsContextBuilder(filter), [filter]);
  const level = getCityDrilldownLevel(path);

  const rows = useMemo(() => {
    switch (level) {
      case "cities":
        return buildCityLevelRows(refs, ctxBuilder);
      case "tradePoints":
        return buildCityTradePointRows(refs, ctxBuilder, path.city!);
      default:
        return [];
    }
  }, [refs, ctxBuilder, level, path, snapshot]);

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const openEntryForRef = useCallback((ref: ScopeTradePointRef) => {
    setEntryRef(ref);
    setEntryOpen(true);
  }, []);

  const handleDrill = useCallback(
    (row: DistributionAnalyticsRow<unknown>) => {
      if (level !== "cities") return;
      const group = row.drilldownRef as { city: string };
      setPath({ city: group.city });
    },
    [level],
  );

  const handleBack = () => {
    setPath(parentCityDrilldownPath(path));
  };

  const crumbs: { label: string; index: number }[] = useMemo(() => {
    const items: { label: string; index: number }[] = [{ label: "Города", index: 0 }];
    if (path.city) items.push({ label: path.city, index: 1 });
    return items;
  }, [path]);

  const renderLabelAddon = useCallback(
    (row: DistributionAnalyticsRow<unknown>): ReactNode => {
      if (level !== "tradePoints") return null;
      const ref = row.drilldownRef as ScopeTradePointRef;
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          data-testid={`btn-city-entry-${ref.point.id}`}
          onClick={(e) => {
            e.stopPropagation();
            openEntryForRef(ref);
          }}
        >
          <PencilLine className="h-3.5 w-3.5" aria-hidden />
          Ввод
        </Button>
      );
    },
    [level, openEntryForRef],
  );

  const canGoBack = level === "tradePoints";
  const onDrill = level === "cities" ? handleDrill : undefined;

  return (
    <>
      <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-city-tab">
        <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Разрез по городу</CardTitle>
            {canGoBack ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack} data-testid="city-drilldown-back">
                Назад
              </Button>
            ) : null}
          </div>
          <nav
            className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            aria-label="Навигация по разрезу"
            data-testid="city-drilldown-breadcrumbs"
          >
            {crumbs.map((crumb, i) => (
              <span key={crumb.index} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {i < crumbs.length - 1 ? (
                  <button
                    type="button"
                    className="hover:text-foreground underline-offset-2 hover:underline"
                    onClick={() => setPath({})}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-4">
          <DistributionBreakdownTable
            rows={rows as DistributionAnalyticsRow<unknown>[]}
            loading={snapshot.loading}
            levelLabel={cityDrilldownLevelLabel(level)}
            onDrill={onDrill}
            renderLabelAddon={level === "tradePoints" ? renderLabelAddon : undefined}
          />
        </CardContent>
      </Card>

      <Sheet
        open={entryOpen && entryRef != null}
        onOpenChange={(open) => {
          setEntryOpen(open);
          if (!open) setEntryRef(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl"
          data-testid="sheet-city-tradepoint-entry"
        >
          {entryRef ? (
            <>
              <SheetHeader className="border-b border-border px-4 py-4 text-left sm:px-6">
                <SheetTitle className="text-base">{entryRef.point.name?.trim() || entryRef.point.id}</SheetTitle>
                <SheetDescription>
                  {entryRef.dealer.name?.trim() || entryRef.dealer.id}
                  {path.city ? ` · ${path.city}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                <DistributionTradePointMatrixEntry
                  dealer={entryRef.dealer}
                  point={entryRef.point}
                  profile={profile}
                  actorUserId={actorUserId}
                  actorName={actorName}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
