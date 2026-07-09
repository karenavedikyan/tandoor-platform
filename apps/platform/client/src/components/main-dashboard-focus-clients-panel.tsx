import { useMemo, type Ref } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMainDashboardCityFilter } from "@/context/main-dashboard-city-filter-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { canAccessLegacyDealerBaseForUser } from "@/lib/auth-access";
import { loadClientNextStepsStorage } from "@/lib/client-next-step-data";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { dealerRowMatchesCityFilter } from "@/lib/main-dashboard-city-stats";
import {
  dealerRowMatchesFocusTile,
  getMainFocusTileDef,
  type MainFocusTileId,
} from "@/lib/main-focus-tiles";
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
  selectedSegment?: MainFocusTileId | null;
  onClearSegment?: () => void;
  panelRef?: Ref<HTMLDivElement>;
};

function clientCountLabel(count: number): string {
  if (count === 1) return "1 клиент";
  if (count >= 2 && count <= 4) return `${count} клиента`;
  return `${count} клиентов`;
}

export function MainDashboardFocusClientsPanel({
  rows,
  act,
  profile,
  role,
  focusList,
  selectedSegment = null,
  onClearSegment,
  panelRef,
}: MainDashboardFocusClientsPanelProps) {
  const { user } = useCurrentUser();
  const { selectedCity, clearCity } = useMainDashboardCityFilter();
  const nextStepsStorage = useMemo(() => loadClientNextStepsStorage(), []);

  const filteredRows = useMemo(() => {
    if (!selectedSegment && !selectedCity) return [];
    return rows.filter((r) => {
      if (selectedSegment && !dealerRowMatchesFocusTile(r, selectedSegment, act)) return false;
      if (selectedCity && !dealerRowMatchesCityFilter(r, selectedCity)) return false;
      return true;
    });
  }, [rows, selectedSegment, selectedCity, act]);

  if (!selectedSegment && !selectedCity) return null;

  const access = mapSalesRoleToDealerBaseAccess(role);
  const segmentMeta = selectedSegment ? getMainFocusTileDef(selectedSegment) : null;

  const titleParts: string[] = [];
  if (segmentMeta) titleParts.push(segmentMeta.title);
  if (selectedCity) titleParts.push(selectedCity);
  const cardTitle = titleParts.length > 0 ? `Клиенты: ${titleParts.join(" · ")}` : "Клиенты";

  return (
    <div ref={panelRef} className="min-w-0 scroll-mt-4">
      <section className="min-w-0 space-y-2" data-testid="section-main-focus-clients-panel">
        {segmentMeta && onClearSegment ? (
          <div
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
            data-testid="chip-main-focus-segment"
          >
            <span className="text-base leading-none" aria-hidden>
              {segmentMeta.icon}
            </span>
            <span>{segmentMeta.title}</span>
            <button
              type="button"
              className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="button-main-focus-segment-clear"
              aria-label={`Снять фильтр ${segmentMeta.title}`}
              onClick={onClearSegment}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <Card className="rounded-2xl border border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">{cardTitle}</CardTitle>
              <CardDescription>
                {clientCountLabel(filteredRows.length)}
                {access === "sales_director" || access === "team_lead"
                  ? " · откройте карточку или клиентскую базу для деталей"
                  : ""}
              </CardDescription>
            </div>
            {selectedCity ? (
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
            ) : null}
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedSegment && selectedCity
                  ? "Нет клиентов по выбранному сегменту в этом городе."
                  : selectedCity
                    ? "В этом городе нет активных клиентов в текущем scope."
                    : "Нет клиентов по выбранному сегменту в текущем scope."}
              </p>
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
            {canAccessLegacyDealerBaseForUser(user?.role) ? (
              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm" data-testid="button-main-open-dealer-base-focus">
                  <Link href="/dealer-base">Открыть в клиентской базе</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
