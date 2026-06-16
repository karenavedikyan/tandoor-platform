import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";
import { DistributionScopeSummary } from "@/components/distribution/distribution-scope-summary";
import { useDistributionScopedTradePoints } from "@/hooks/use-distribution-scoped-dealers";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";

export default function DistributionPage() {
  const { profile } = useReleaseDemoProfile();
  const [entryAxisActive, setEntryAxisActive] = useState(false);
  const [view, setView] = useState<"wizard" | "summary">("wizard");
  const tradePoints = useDistributionScopedTradePoints(profile);

  if (view === "summary") {
    return (
      <div
        className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
        data-testid="page-distribution"
      >
        <DistributionScopeSummary
          tradePoints={tradePoints}
          onClose={() => setView("wizard")}
        />
      </div>
    );
  }

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-3 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution"
    >
      {!entryAxisActive ? (
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-8">
          <div
            className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary"
            aria-hidden
          />
          <div className="relative flex min-w-0 flex-col gap-3 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">Дистрибуция</h1>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block sm:text-base">
                Внесение данных по витринам торговых точек.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="button-distribution-summary"
                onClick={() => setView("summary")}
              >
                Свод
              </Button>
              <Button asChild variant="outline" size="sm" data-testid="link-distribution-matrix-catalog">
                <Link href="/distribution/matrix-catalog">Справочник матриц</Link>
              </Button>
            </div>
          </div>
        </header>
      ) : null}

      <DistributionEntryWizard profile={profile} onAxisChange={setEntryAxisActive} />
    </div>
  );
}
