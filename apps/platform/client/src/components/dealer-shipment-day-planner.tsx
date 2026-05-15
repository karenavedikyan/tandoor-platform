import { useCallback, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  type DealerShipmentDayId,
  type DealerShipmentStatusResult,
} from "@/lib/dealer-shipment-days";
import { buildRouteCopyText } from "@/lib/dealer-route-plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

export type ShipmentDayCounts = Record<
  DealerShipmentDayId,
  { total: number; green: number; yellow: number; red: number }
>;

function trafficDotClass(level: "green" | "yellow" | "red"): string {
  if (level === "green") return "bg-emerald-500";
  if (level === "yellow") return "bg-amber-400";
  return "bg-rose-500";
}

function trafficBadgeClass(level: "green" | "yellow" | "red"): string {
  if (level === "green") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (level === "yellow") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

type PlannerProps = {
  dayCounts: ShipmentDayCounts;
  activeShipmentDayId: DealerShipmentDayId | null;
  onSelectDay: (d: DealerShipmentDayId) => void;
  onResetDay: () => void;
  activeDaySummary: string | null;
  canEditRoute: boolean;
  routeRows: DealerRow[];
  onRouteUp: (dealerId: string) => void;
  onRouteDown: (dealerId: string) => void;
  onRouteRemove: (dealerId: string) => void;
  getShipmentStatus: (row: DealerRow) => DealerShipmentStatusResult;
  buildDealerHref: (dealerId: string) => string;
};

export function DealerShipmentDayPlanner({
  dayCounts,
  activeShipmentDayId,
  onSelectDay,
  onResetDay,
  activeDaySummary,
  canEditRoute,
  routeRows,
  onRouteUp,
  onRouteDown,
  onRouteRemove,
  getShipmentStatus,
  buildDealerHref,
}: PlannerProps) {
  const [routeCopyOpen, setRouteCopyOpen] = useState(false);
  const [routeCopyText, setRouteCopyText] = useState("");

  const runCopyRoute = useCallback(() => {
    if (!activeShipmentDayId) return;
    const text = buildRouteCopyText(routeRows, activeShipmentDayId, buildDealerHref, (row) => getShipmentStatus(row).label);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => {
          toast({ title: "Маршрут скопирован" });
        },
        () => {
          setRouteCopyText(text);
          setRouteCopyOpen(true);
        },
      );
    } else {
      setRouteCopyText(text);
      setRouteCopyOpen(true);
    }
  }, [activeShipmentDayId, routeRows, buildDealerHref, getShipmentStatus]);

  return (
    <>
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
            const c = dayCounts[d];
            const active = activeShipmentDayId === d;
            return (
              <Button
                key={d}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-auto min-h-10 min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5 text-left sm:flex-none sm:px-3",
                  !active && "border-border bg-card",
                )}
                data-testid={`button-dealer-shipment-day-${d}`}
                onClick={() => onSelectDay(d)}
              >
                <span className="text-xs font-semibold leading-tight">{DEALER_SHIPMENT_DAY_LABELS[d]}</span>
                <span className="text-[10px] text-muted-foreground">Клиентов: {c.total}</span>
                <span className="flex items-center gap-1 text-[10px] tabular-nums">
                  <span className="flex items-center gap-0.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", trafficDotClass("green"))} aria-hidden />
                    {c.green}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", trafficDotClass("yellow"))} aria-hidden />
                    {c.yellow}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", trafficDotClass("red"))} aria-hidden />
                    {c.red}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
        {activeDaySummary ? (
          <p className="mt-3 text-sm font-medium text-foreground" data-testid="text-dealer-shipment-day-active">
            {activeDaySummary}
          </p>
        ) : null}
      </section>

      {activeShipmentDayId ? (
        <Card className="rounded-xl border border-border/80 shadow-sm" data-testid="section-dealer-route-plan">
          <CardHeader className="space-y-1 p-3 pb-2 sm:p-4">
            <CardTitle className="text-base">Маршрутный лист</CardTitle>
            <p className="text-xs text-muted-foreground">
              Порядок визитов на выбранный день. Можно менять порядок и копировать список.
            </p>
            <p className="text-sm font-semibold tabular-nums text-foreground" data-testid="text-dealer-route-count">
              {routeRows.length} {routeRows.length === 1 ? "клиент" : "клиентов"}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0 sm:p-4 sm:pt-0">
            {routeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Маршрут пуст. Выберите клиентов в списке и нажмите «Добавить в маршрут».
              </p>
            ) : (
              routeRows.map((row) => {
                const st = getShipmentStatus(row);
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3"
                    data-testid={`row-dealer-route-${row.id}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.city}</p>
                      <Badge variant="outline" className={cn("text-[10px] font-medium", trafficBadgeClass(st.level))}>
                        {st.label}
                      </Badge>
                    </div>
                    {canEditRoute ? (
                      <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 touch-manipulation"
                          data-testid={`button-dealer-route-up-${row.id}`}
                          aria-label="Выше"
                          onClick={() => onRouteUp(row.id)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 touch-manipulation"
                          data-testid={`button-dealer-route-down-${row.id}`}
                          aria-label="Ниже"
                          onClick={() => onRouteDown(row.id)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 touch-manipulation"
                          data-testid={`button-dealer-route-remove-${row.id}`}
                          aria-label="Удалить из маршрута"
                          onClick={() => onRouteRemove(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 w-full min-h-10 text-xs sm:w-auto"
              data-testid="button-dealer-route-copy"
              onClick={runCopyRoute}
              disabled={!activeShipmentDayId || routeRows.length === 0}
            >
              Скопировать маршрут
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={routeCopyOpen} onOpenChange={setRouteCopyOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-dealer-route-copy-fallback">
          <DialogHeader>
            <DialogTitle>Скопируйте маршрут вручную</DialogTitle>
          </DialogHeader>
          <Textarea
            readOnly
            value={routeCopyText}
            className="min-h-[200px] font-mono text-xs"
            data-testid="textarea-dealer-route-copy-text"
            onFocus={(e) => e.target.select()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRouteCopyOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
