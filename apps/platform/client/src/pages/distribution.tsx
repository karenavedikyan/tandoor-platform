import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";
import { DistributionScopeSummary } from "@/components/distribution/distribution-scope-summary";
import { DistributionAnalyticsPage, type DistributionAnalyticsTab } from "@/pages/distribution-analytics";
import { useDistributionScopedTradePoints } from "@/hooks/use-distribution-scoped-dealers";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import {
  deserializeFilters,
  serializeFilters,
  type DistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import { cn } from "@/lib/utils";

type PageMode = "entry" | "analytics";

function parseMode(qs: URLSearchParams): PageMode {
  return qs.get("view") === "analytics" ? "analytics" : "entry";
}

function parseAnalyticsTab(qs: URLSearchParams): DistributionAnalyticsTab {
  const tab = qs.get("tab");
  if (tab === "territory" || tab === "product") return tab;
  return "trade-points";
}

export default function DistributionPage() {
  const { profile } = useReleaseDemoProfile();
  const [, navigate] = useLocation();
  const routeQs = useRouteSearchParams();
  const [entryAxisActive, setEntryAxisActive] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const tradePoints = useDistributionScopedTradePoints(profile);

  const mode = parseMode(routeQs);
  const analyticsTab = parseAnalyticsTab(routeQs);
  const filters = useMemo(
    () => deserializeFilters(routeQs.get("f")),
    [routeQs],
  );
  const filtersEncoded = useMemo(() => serializeFilters(filters), [filters]);

  const setMode = useCallback(
    (next: PageMode) => {
      if (next === "analytics") {
        navigate(
          buildHashPath("/distribution", {
            view: "analytics",
            tab: analyticsTab,
            f: filtersEncoded || undefined,
          }),
        );
        return;
      }
      navigate(buildHashPath("/distribution"));
    },
    [analyticsTab, filtersEncoded, navigate],
  );

  const setAnalyticsTab = useCallback(
    (tab: DistributionAnalyticsTab) => {
      navigate(
        buildHashPath("/distribution", {
          view: "analytics",
          tab,
          f: filtersEncoded || undefined,
        }),
      );
    },
    [filtersEncoded, navigate],
  );

  const setFilters = useCallback(
    (next: DistributionAnalyticsFilters) => {
      const encoded = serializeFilters(next);
      navigate(
        buildHashPath("/distribution", {
          view: "analytics",
          tab: analyticsTab,
          f: encoded || undefined,
        }),
      );
    },
    [analyticsTab, navigate],
  );

  if (summaryOpen) {
    return (
      <div
        className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
        data-testid="page-distribution"
      >
        <DistributionScopeSummary tradePoints={tradePoints} onClose={() => setSummaryOpen(false)} />
      </div>
    );
  }

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution"
    >
      {!entryAxisActive || mode === "analytics" ? (
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
          <div className="relative space-y-3 pl-3 sm:pl-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Дистрибуция</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "analytics" ? "Аналитический снимок дистрибуции по срезам." : "Внесение данных по витринам торговых точек."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {mode === "entry" ? (
                  <>
                    <Button type="button" variant="outline" size="sm" data-testid="button-distribution-summary" onClick={() => setSummaryOpen(true)}>
                      Свод
                    </Button>
                    <Button asChild variant="outline" size="sm" data-testid="link-distribution-matrix-catalog">
                      <Link href="/distribution/matrix-catalog">Справочник матриц</Link>
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 rounded-full border border-border/70 bg-muted/30 p-1" data-testid="distribution-mode-toggle">
              <ModePill active={mode === "entry"} onClick={() => setMode("entry")} testId="button-distribution-mode-entry">
                Внесение
              </ModePill>
              <ModePill active={mode === "analytics"} onClick={() => setMode("analytics")} testId="button-distribution-mode-analytics">
                Аналитика
              </ModePill>
            </div>
          </div>
        </header>
      ) : null}

      {mode === "analytics" ? (
        <DistributionAnalyticsPage
          profile={profile}
          tab={analyticsTab}
          filters={filters}
          filtersEncoded={filtersEncoded}
          onTabChange={setAnalyticsTab}
          onFiltersChange={setFilters}
        />
      ) : (
        <DistributionEntryWizard profile={profile} onAxisChange={setEntryAxisActive} />
      )}
    </div>
  );
}

function ModePill({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  testId: string;
}): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
