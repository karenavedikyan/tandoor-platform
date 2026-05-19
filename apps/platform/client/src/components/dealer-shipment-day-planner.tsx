import { useCallback, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  type DealerShipmentDayId,
  type DealerShipmentStatusResult,
} from "@/lib/dealer-shipment-days";
import {
  addRouteSlot,
  buildRouteCopyText,
  countDealersOnRouteSettlements,
  deleteRouteSlot,
  reorderRouteDealer,
  removeDealerFromRoute,
  type ShipmentRouteDefinition,
  type ShipmentRouteSlotId,
  upsertRouteDefinition,
} from "@/lib/dealer-route-plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

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

function routeRowsForCopy(ordered: DealerRow[], settlementFallback: DealerRow[]): DealerRow[] {
  if (ordered.length > 0) return ordered;
  return [...settlementFallback].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function clientsOnRouteCardCount(
  def: ShipmentRouteDefinition,
  dayId: DealerShipmentDayId,
  scopedRows: DealerRow[],
  orderedLen: number,
): number {
  if (def.settlements.length > 0) {
    return countDealersOnRouteSettlements(dayId, def, scopedRows);
  }
  return orderedLen;
}

export type PlannerProps = {
  userId: string;
  dayCounts: ShipmentDayCounts;
  /** Для подсчёта клиентов по населённым пунктам маршрута (учёт текущего scope). */
  rowsForRouteSettlementCounts: DealerRow[];
  routeDefsByDay: Record<DealerShipmentDayId, ShipmentRouteDefinition[]>;
  settlementOptions: string[];
  activeShipmentDayId: DealerShipmentDayId | null;
  onSelectDay: (d: DealerShipmentDayId) => void;
  onResetDay: () => void;
  /** Основная строка под карточками дней (день + клиенты + маршруты). */
  activeDaySummaryLine: string | null;
  /** Баннер фильтра по маршруту. */
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
  dayCounts,
  rowsForRouteSettlementCounts,
  routeDefsByDay,
  settlementOptions,
  activeShipmentDayId,
  onSelectDay,
  onResetDay,
  activeDaySummaryLine,
  routeFilterBanner,
  onClearRouteFilter,
  canEditRoute,
  routeRowsBySlot,
  settlementRowsBySlot,
  onShowRouteClients,
  getShipmentStatus,
  buildDealerHref,
}: PlannerProps) {
  const [routeCopyOpen, setRouteCopyOpen] = useState(false);
  const [routeCopyText, setRouteCopyText] = useState("");
  const [expandedSlotId, setExpandedSlotId] = useState<ShipmentRouteSlotId | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ShipmentRouteDefinition | null>(null);

  const activeDayDefs = activeShipmentDayId ? routeDefsByDay[activeShipmentDayId] ?? [] : [];

  const runCopyRoute = useCallback(
    (slotId: ShipmentRouteSlotId, routeName: string) => {
      if (!activeShipmentDayId) return;
      const ordered = routeRowsBySlot[slotId] ?? [];
      const fallback = settlementRowsBySlot[slotId] ?? [];
      const rows = routeRowsForCopy(ordered, fallback);
      const text = buildRouteCopyText(rows, activeShipmentDayId, routeName, buildDealerHref, (row) =>
        getShipmentStatus(row).label,
      );
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
    },
    [activeShipmentDayId, routeRowsBySlot, settlementRowsBySlot, buildDealerHref, getShipmentStatus],
  );

  const openEdit = (def: ShipmentRouteDefinition) => {
    setEditDraft({ ...def, settlements: [...def.settlements] });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!activeShipmentDayId || !editDraft) return;
    upsertRouteDefinition(userId, activeShipmentDayId, {
      ...editDraft,
      name: editDraft.name.trim() || "Маршрут",
    });
    setEditOpen(false);
    setEditDraft(null);
    toast({ title: "Маршрут сохранён" });
  };

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
            const defs = routeDefsByDay[d] ?? [];
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
                <span
                  className="line-clamp-2 w-full text-left text-[9px] leading-snug text-muted-foreground sm:text-[10px]"
                  data-testid={`text-dealer-shipment-day-route-summary-${d}`}
                >
                  {defs.length === 0 ? (
                    <span className="text-muted-foreground/90">Маршруты не заданы</span>
                  ) : (
                    defs.map((def) => {
                      const n = countDealersOnRouteSettlements(d, def, rowsForRouteSettlementCounts);
                      return (
                        <span key={def.slotId} className="block truncate" data-testid={`text-dealer-shipment-day-route-count-${d}-${def.slotId}`}>
                          {def.name} · {n}
                        </span>
                      );
                    })
                  )}
                </span>
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
        {activeDaySummaryLine ? (
          <p className="mt-3 text-sm font-medium text-foreground" data-testid="text-dealer-shipment-day-active">
            {activeDaySummaryLine}
          </p>
        ) : null}
        {routeFilterBanner ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">{routeFilterBanner}</p>
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

      {activeShipmentDayId ? (
        <Card className="rounded-xl border border-border/80 shadow-sm" data-testid="section-dealer-shipment-routes">
          <CardHeader className="space-y-1 p-3 pb-2 sm:p-4">
            <CardTitle className="text-base">Маршруты дня — {DEALER_SHIPMENT_DAY_LABELS[activeShipmentDayId]}</CardTitle>
            <p className="text-xs text-muted-foreground">До двух маршрутов на день. Подробности — внутри карточки.</p>
          </CardHeader>
          <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
            {activeDayDefs.length === 0 ? (
              <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/10 p-3">
                <p className="text-sm text-muted-foreground">Добавьте маршрут и населённые пункты для выбранного дня.</p>
                {canEditRoute ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-9 text-xs"
                    onClick={() => {
                      addRouteSlot(userId, activeShipmentDayId);
                    }}
                  >
                    Добавить маршрут
                  </Button>
                ) : null}
              </div>
            ) : (
              activeDayDefs.map((def) => {
                const ordered = routeRowsBySlot[def.slotId] ?? [];
                const settlementFallback = settlementRowsBySlot[def.slotId] ?? [];
                const routeClientCount = clientsOnRouteCardCount(
                  def,
                  activeShipmentDayId,
                  rowsForRouteSettlementCounts,
                  ordered.length,
                );
                const expanded = expandedSlotId === def.slotId;
                return (
                  <div
                    key={def.slotId}
                    className="rounded-lg border border-border/70 bg-card"
                    data-testid={`row-dealer-shipment-route-${def.slotId}`}
                  >
                    <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:p-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{def.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {def.settlements.length > 0 ? def.settlements.join(", ") : "Населённые пункты не заданы"}
                        </p>
                        <p className="text-xs font-medium text-foreground">Клиентов по маршруту: {routeClientCount}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:max-w-[14rem] sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 flex-1 text-[11px] sm:flex-none"
                          data-testid={`button-dealer-shipment-route-show-clients-${def.slotId}`}
                          disabled={def.settlements.length === 0}
                          onClick={() => onShowRouteClients(def.slotId, def.settlements)}
                        >
                          Показать клиентов
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 flex-1 gap-1 text-[11px] sm:flex-none"
                          data-testid={`button-dealer-shipment-route-expand-${def.slotId}`}
                          onClick={() => setExpandedSlotId((prev) => (prev === def.slotId ? null : def.slotId))}
                        >
                          {expanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              Свернуть
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              Подробнее
                            </>
                          )}
                        </Button>
                        {canEditRoute ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-9 w-9 touch-manipulation"
                              data-testid={`button-dealer-shipment-route-edit-${def.slotId}`}
                              aria-label="Редактировать маршрут"
                              onClick={() => openEdit(def)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9 touch-manipulation"
                              data-testid={`button-dealer-shipment-route-delete-${def.slotId}`}
                              aria-label="Удалить маршрут"
                              onClick={() => {
                                deleteRouteSlot(userId, activeShipmentDayId, def.slotId);
                                setExpandedSlotId((prev) => (prev === def.slotId ? null : prev));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {expanded ? (
                      <div
                        className="border-t border-border/60 bg-muted/10 px-2.5 py-3 sm:px-3"
                        data-testid={`section-dealer-shipment-route-plan-${def.slotId}`}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Маршрутный лист</p>
                        {ordered.length === 0 ? (
                          <p className="mb-3 text-sm text-muted-foreground">Клиенты маршрута не выбраны</p>
                        ) : (
                          <div className="mb-3 space-y-2">
                            {ordered.map((row) => {
                              const st = getShipmentStatus(row);
                              return (
                                <div
                                  key={row.id}
                                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3"
                                  data-testid={`row-dealer-shipment-route-plan-client-${row.id}`}
                                >
                                  <span className="hidden" data-testid={`row-dealer-route-${row.id}`} aria-hidden />
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
                                        onClick={() => reorderRouteDealer(userId, activeShipmentDayId, row.id, "up", def.slotId)}
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
                                        onClick={() => reorderRouteDealer(userId, activeShipmentDayId, row.id, "down", def.slotId)}
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
                                        onClick={() => removeDealerFromRoute(userId, activeShipmentDayId, row.id, def.slotId)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full min-h-10 text-xs sm:w-auto"
                          data-testid={`button-dealer-shipment-route-copy-${def.slotId}`}
                          onClick={() => runCopyRoute(def.slotId, def.name)}
                          disabled={routeRowsForCopy(ordered, settlementFallback).length === 0}
                        >
                          Скопировать маршрут
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            {canEditRoute && activeDayDefs.length > 0 && activeDayDefs.length < 2 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 w-full text-xs sm:w-auto"
                onClick={() => {
                  addRouteSlot(userId, activeShipmentDayId);
                }}
              >
                Добавить маршрут
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-dealer-shipment-route-edit">
          <DialogHeader>
            <DialogTitle>Маршрут</DialogTitle>
          </DialogHeader>
          {editDraft ? (
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label htmlFor="dealer-route-name">Название</Label>
                <Input
                  id="dealer-route-name"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1">
                <Label>Населённые пункты</Label>
                <MultiSelect
                  options={settlementOptions.map((c) => ({ value: c, label: c }))}
                  value={editDraft.settlements}
                  onChange={(next) => setEditDraft({ ...editDraft, settlements: next })}
                  placeholder="Выберите пункты"
                  allLabel="Все доступные"
                  triggerClassName="min-h-10"
                  testId="select-dealer-shipment-route-settlements"
                  ariaLabel="Населённые пункты маршрута"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={saveEdit} disabled={!editDraft?.name.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
