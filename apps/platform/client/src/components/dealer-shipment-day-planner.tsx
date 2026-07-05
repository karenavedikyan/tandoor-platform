import { useEffect, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  DEALER_SHIPMENT_DAY_SHORT_LABELS,
  type DealerShipmentDayId,
  type DealerShipmentStatusResult,
} from "@/lib/dealer-shipment-days";
import {
  DEALER_ROUTE_PLAN_EVENT,
  countDealersOnRouteSettlements,
  type ShipmentRouteDefinition,
  type ShipmentRouteSlotId,
} from "@/lib/dealer-route-plan";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ruClientNoun(n: number): "клиент" | "клиента" | "клиентов" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиент";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "клиента";
  return "клиентов";
}

function formatRouteClientsLine(routeName: string, n: number): string {
  return `${routeName} · ${n} ${ruClientNoun(n)}`;
}

export type PlannerProps = {
  userId: string;
  /** Клиенты для маршрута (scope без фильтра ТОП-сегмента). */
  rowsForRouteSettlementCounts: DealerRow[];
  routeDefsByDay: Record<DealerShipmentDayId, ShipmentRouteDefinition[]>;
  settlementOptions: string[];
  activeShipmentDayId: DealerShipmentDayId | null;
  onSelectDay: (d: DealerShipmentDayId) => void;
  onResetDay: () => void;
  activeDaySummaryLine: string | null;
  routeFilterBanner: string | null;
  onClearRouteFilter: () => void;
  canEditRoute: boolean;
  routeRowsBySlot: Record<ShipmentRouteSlotId, DealerRow[]>;
  settlementRowsBySlot: Record<ShipmentRouteSlotId, DealerRow[]>;
  onShowRouteClients: (slotId: ShipmentRouteSlotId, settlements: string[]) => void;
  getShipmentStatus: (row: DealerRow) => DealerShipmentStatusResult;
  buildDealerHref: (dealerId: string) => string;
};

export function DealerShipmentDayPlanner({
  userId,
  rowsForRouteSettlementCounts,
  routeDefsByDay,
  activeShipmentDayId,
  onSelectDay,
  onResetDay,
  activeDaySummaryLine,
  routeFilterBanner,
  onClearRouteFilter,
}: PlannerProps) {
  const [, setRouteLocalBump] = useState(0);

  useEffect(() => {
    const h = () => setRouteLocalBump((n) => n + 1);
    window.addEventListener(DEALER_ROUTE_PLAN_EVENT, h);
    return () => window.removeEventListener(DEALER_ROUTE_PLAN_EVENT, h);
  }, []);

  return (
    <section data-testid="section-dealer-shipment-days" className="rounded-xl border border-border/80 bg-muted/15 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Дни отгрузок</p>
          <p className="text-[11px] text-muted-foreground">Готовность к работе в день отгрузки (план визита, не факт отгрузки).</p>
        </div>
        {activeShipmentDayId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0 self-start text-xs"
            data-testid="button-dealer-shipment-day-reset"
            onClick={onResetDay}
          >
            Сбросить день
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEALER_SHIPMENT_DAY_ORDER.map((d) => {
          const active = activeShipmentDayId === d;
          const defs = routeDefsByDay[d] ?? [];
          return (
            <Button
              key={d}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-auto min-h-10 min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5 text-left max-sm:gap-0 max-sm:px-1.5 max-sm:py-1 sm:flex-none sm:px-3",
                !active && "border-border bg-card",
              )}
              data-testid={`button-dealer-shipment-day-${d}`}
              onClick={() => onSelectDay(d)}
            >
              <span className="hidden text-xs font-semibold leading-tight sm:inline">{DEALER_SHIPMENT_DAY_LABELS[d]}</span>
              <span className="text-xs font-semibold leading-none sm:hidden">{DEALER_SHIPMENT_DAY_SHORT_LABELS[d]}</span>
              <span
                className="line-clamp-2 w-full text-left text-[9px] leading-snug text-muted-foreground sm:text-[10px]"
                data-testid={`text-dealer-shipment-day-route-summary-${d}`}
              >
                {defs.length === 0 ? (
                  <span className="text-muted-foreground/90">Маршруты не заданы</span>
                ) : (
                  defs.map((def) => {
                    const n = countDealersOnRouteSettlements(userId, d, def, rowsForRouteSettlementCounts);
                    return (
                      <span key={def.slotId} className="block truncate" data-testid={`text-dealer-shipment-day-route-count-${d}-${def.slotId}`}>
                        {formatRouteClientsLine(def.name, n)}
                      </span>
                    );
                  })
                )}
              </span>
            </Button>
          );
        })}
      </div>
      {activeDaySummaryLine ? (
        <p className="mt-3 text-sm font-medium text-foreground" data-testid="text-dealer-shipment-day-active">
          {activeDaySummaryLine}
        </p>
      ) : null}
      {routeFilterBanner ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-foreground" data-testid="text-dealer-shipment-route-filter-banner">
            {routeFilterBanner}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0 text-xs"
            data-testid="button-dealer-shipment-route-clear-filter"
            onClick={onClearRouteFilter}
          >
            Сбросить маршрут
          </Button>
        </div>
      ) : null}
    </section>
  );
}
