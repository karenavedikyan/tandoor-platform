import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { DistributionEntryAxis } from "@/components/distribution/distribution-entry-axis-picker";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";
import { DistributionScopeSummary } from "@/components/distribution/distribution-scope-summary";
import { DistributionAnalyticsPage, type DistributionAnalyticsTab } from "@/pages/distribution-analytics";
import { useDistributionScopedTradePoints } from "@/hooks/use-distribution-scoped-dealers";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import {
  buildHashWithQuery,
  navigateHashPathInHash,
  useHashQuery,
} from "@/lib/hash-location-router";
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

export function parseEntryAxis(qs: URLSearchParams): DistributionEntryAxis | null {
  const ax = qs.get("ax");
  return ax === "tradePoint" || ax === "product" || ax === "city" ? ax : null;
}

function currentHashPath(): string {
  const hash = window.location.hash;
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

export default function DistributionPage() {
  const { profile } = useReleaseDemoProfile();
  const routeQs = useHashQuery();
  const [entryAxisActive, setEntryAxisActive] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const tradePoints = useDistributionScopedTradePoints(profile);

  const mode = parseMode(routeQs);
  const analyticsTab = parseAnalyticsTab(routeQs);
  const entryAxis = parseEntryAxis(routeQs);
  const fParam = routeQs.get("f") ?? "";
  const filters = useMemo(() => deserializeFilters(fParam || null), [fParam]);
  const filtersEncoded = useMemo(() => serializeFilters(filters), [filters]);

  const navigateAnalytics = useCallback(
    (next: { tab: DistributionAnalyticsTab; f: string | undefined }) => {
      const target = buildHashWithQuery("/distribution", {
        view: "analytics",
        tab: next.tab,
        f: next.f,
      });
      if (currentHashPath() === target) return;
      navigateHashPathInHash(target);
    },
    [],
  );

  const navigateEntryAxis = useCallback((next: DistributionEntryAxis | null) => {
    const target = buildHashWithQuery("/distribution", {
      view: "entry",
      ax: next ?? undefined,
    });
    if (currentHashPath() === target) return;
    navigateHashPathInHash(target);
  }, []);

  const setMode = useCallback(
    (next: PageMode) => {
      if (next === "analytics") {
        navigateAnalytics({ tab: analyticsTab, f: filtersEncoded || undefined });
        return;
      }
      const target = "/distribution";
      if (currentHashPath() === target) return;
      navigateHashPathInHash(target);
    },
    [analyticsTab, filtersEncoded, navigateAnalytics],
  );

  const setAnalyticsTab = useCallback(
    (tab: DistributionAnalyticsTab) => {
      navigateAnalytics({ tab, f: filtersEncoded || undefined });
    },
    [filtersEncoded, navigateAnalytics],
  );

  const setFilters = useCallback(
    (nextFilters: DistributionAnalyticsFilters) => {
      navigateAnalytics({
        tab: analyticsTab,
        f: serializeFilters(nextFilters) || undefined,
      });
    },
    [analyticsTab, navigateAnalytics],
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

  const headerCompact = entryAxisActive && mode === "entry";

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution"
    >
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg",
          headerCompact ? "p-3 sm:p-4" : "p-4 sm:p-6",
        )}
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className={cn("relative space-y-2", headerCompact ? "pl-2 sm:pl-3" : "space-y-3 pl-3 sm:pl-4")}>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h1 className={cn("font-semibold tracking-tight text-foreground", headerCompact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl")}>
                Дистрибуция
              </h1>
              {!headerCompact ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "analytics" ? "Аналитический снимок дистрибуции по срезам." : "Внесение данных по витринам торговых точек."}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {mode === "entry" ? (
                <>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    data-testid="button-distribution-go-analytics"
                    onClick={() => setMode("analytics")}
                  >
                    Аналитика дистрибуции
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-testid="button-distribution-summary" onClick={() => setSummaryOpen(true)}>
                    Свод
                  </Button>
                  <Button asChild variant="outline" size="sm" data-testid="link-distribution-matrix-catalog">
                    <Link href="/distribution/matrix-catalog">Справочник матриц</Link>
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" data-testid="button-distribution-back-to-entry" onClick={() => setMode("entry")}>
                  Назад к внесению
                </Button>
              )}
            </div>
          </div>
          <div
            className="inline-flex flex-wrap gap-1 rounded-full border border-primary/30 bg-background p-1 shadow-sm"
            data-testid="distribution-mode-toggle"
          >
            <ModePill active={mode === "entry"} onClick={() => setMode("entry")} testId="button-distribution-mode-entry">
              Внесение
            </ModePill>
            <ModePill active={mode === "analytics"} onClick={() => setMode("analytics")} testId="button-distribution-mode-analytics">
              Аналитика
            </ModePill>
          </div>
        </div>
      </header>

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
        <DistributionEntryWizard
          profile={profile}
          axis={entryAxis}
          onAxisChange={setEntryAxisActive}
          onAxisSelect={navigateEntryAxis}
        />
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
        "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/80 hover:bg-primary/10 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
