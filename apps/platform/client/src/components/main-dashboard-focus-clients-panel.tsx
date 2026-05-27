import { useMemo } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMainDashboardCityFilter } from "@/context/main-dashboard-city-filter-context";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { loadClientNextStepsStorage } from "@/lib/client-next-step-data";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { dealerRowMatchesCityFilter } from "@/lib/main-dashboard-city-stats";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerFocusViewListCtx } from "@/pages/dealer-base";
import { DealerBaseDataTable } from "@/pages/dealer-base";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import type { SalesRole } from "@/lib/sales-control-data";

type MainDashboardFocusClientsPanelProps = {
  rows: DealerRow[];
  act: ActualizationState;
  profile: ReleaseDemoProfile;
  role: SalesRole;
  focusList?: DealerFocusViewListCtx;
};

export function MainDashboardFocusClientsPanel({
  rows,
  act,
  profile,
  role,
  focusList,
}: MainDashboardFocusClientsPanelProps) {
  const { selectedCity, clearCity } = useMainDashboardCityFilter();
  const nextStepsStorage = useMemo(() => loadClientNextStepsStorage(), []);

  const filteredRows = useMemo(() => {
    if (!selectedCity) return [];
    return rows.filter((r) => dealerRowMatchesCityFilter(r, selectedCity));
  }, [rows, selectedCity]);

  if (!selectedCity) return null;

  const access = mapSalesRoleToDealerBaseAccess(role);

  return (
    <section className="min-w-0 space-y-2" data-testid="section-main-focus-clients-panel">
      <Card className="rounded-2xl border border-border bg-card">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Клиенты: {selectedCity}</CardTitle>
            <CardDescription>
              {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "клиент" : filteredRows.length >= 2 && filteredRows.length <= 4 ? "клиента" : "клиентов"}
              {access === "sales_director" || access === "team_lead" ? " · откройте карточку или клиентскую базу для деталей" : ""}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            data-testid="button-main-focus-city-clear"
            aria-label="Снять фильтр по городу"
            onClick={clearCity}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 space-y-3">
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">В этом городе нет активных клиентов в текущем scope.</p>
          ) : (
            <DealerBaseDataTable
              rows={filteredRows}
              empty=""
              profile={profile}
              actualizationState={act}
              nextStepsStorage={nextStepsStorage}
              focusList={focusList}
            />
          )}
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm" data-testid="button-main-open-dealer-base-city">
              <Link href="/dealer-base">Открыть в клиентской базе</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
