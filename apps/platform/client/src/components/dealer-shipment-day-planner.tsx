import { useCallback, useMemo, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  DEALER_SHIPMENT_DAY_SHORT_LABELS,
  type DealerShipmentDayId,
  type DealerShipmentStatusResult,
} from "@/lib/dealer-shipment-days";
import {
  addRouteSlot,
  buildRouteCopyText,
  computeDisplayedRouteDealerIds,
  countDealersOnRouteSettlements,
  deleteRouteSlot,
  listDealersWrongShipmentDayForRoute,
  loadDealerRoutePlanState,
  reorderRouteDealer,
  removeDealerFromRoute,
  saveRouteEditorState,
  sortRouteByUnloadingOrder,
  type ShipmentRouteDefinition,
  type ShipmentRouteSlotId,
} from "@/lib/dealer-route-plan";
import { getDealerUnloadingOrder } from "@/lib/dealer-unloading-order-storage";
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

function trafficBadgeClass(level: "green" | "yellow" | "red"): string {
  if (level === "green") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (level === "yellow") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

function routeRowsForCopy(ordered: DealerRow[], settlementFallback: DealerRow[]): DealerRow[] {
  if (ordered.length > 0) return ordered;
  return [...settlementFallback].sort((a, b) => a.name.localeCompare(b.name, "ru"));
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
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);
  const [editClientSearch, setEditClientSearch] = useState("");

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
    if (!activeShipmentDayId) return;
    const state = loadDealerRoutePlanState();
    const ids = computeDisplayedRouteDealerIds(userId, activeShipmentDayId, def, rowsForRouteSettlementCounts, state);
    setEditSelectedIds(ids);
    setEditClientSearch("");
    setEditDraft({
      ...def,
      settlements: [...def.settlements],
      pinnedDealerIds: def.pinnedDealerIds ? [...def.pinnedDealerIds] : undefined,
      excludedDealerIds: def.excludedDealerIds ? [...def.excludedDealerIds] : undefined,
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!activeShipmentDayId || !editDraft) return;
    const named: ShipmentRouteDefinition = { ...editDraft, name: editDraft.name.trim() || "Маршрут" };
    saveRouteEditorState(userId, activeShipmentDayId, named, editSelectedIds, rowsForRouteSettlementCounts);
    setEditOpen(false);
    setEditDraft(null);
    setEditSelectedIds([]);
    toast({ title: "Маршрут сохранён" });
  };

  const byId = useMemo(() => new Map(rowsForRouteSettlementCounts.map((r) => [r.id, r])), [rowsForRouteSettlementCounts]);

  const searchOptions = useMemo(() => {
    const q = editClientSearch.trim().toLowerCase();
    const selected = new Set(editSelectedIds);
    return rowsForRouteSettlementCounts
      .filter((r) => !selected.has(r.id))
      .filter((r) => {
        if (!q) return true;
        return `${r.name} ${r.city}`.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [editClientSearch, editSelectedIds, rowsForRouteSettlementCounts]);

  const selectedRows = useMemo(
    () => editSelectedIds.map((id) => byId.get(id)).filter((r): r is DealerRow => Boolean(r)),
    [editSelectedIds, byId],
  );

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
                const expanded = expandedSlotId === def.slotId;
                const routeClientCount = countDealersOnRouteSettlements(
                  userId,
                  activeShipmentDayId,
                  def,
                  rowsForRouteSettlementCounts,
                );
                const pinnedN = def.pinnedDealerIds?.length ?? 0;
                const wrongDay =
                  activeShipmentDayId != null
                    ? listDealersWrongShipmentDayForRoute(activeShipmentDayId, def, rowsForRouteSettlementCounts)
                    : [];
                return (
                  <div
                    key={def.slotId}
                    className="rounded-lg border border-border/70 bg-card"
                    data-testid={`row-dealer-shipment-route-${def.slotId}`}
                  >
                    <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:p-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{formatRouteClientsLine(def.name, routeClientCount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {def.settlements.length > 0 ? def.settlements.join(", ") : "Населённые пункты не заданы"}
                        </p>
                        <ul className="list-inside list-disc text-[11px] leading-snug text-muted-foreground">
                          <li>По населённым пунктам и дню отгрузки</li>
                          {pinnedN > 0 ? <li>Закреплено вручную: {pinnedN}</li> : null}
                        </ul>
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
                        {wrongDay.length > 0 ? (
                          <div className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs text-amber-950">
                            <p className="font-semibold">Не входят из-за другого дня отгрузки ({wrongDay.length})</p>
                            <p className="mt-1 text-[11px] leading-snug text-amber-900/90">
                              {wrongDay
                                .slice(0, 6)
                                .map((r) => r.name)
                                .join(", ")}
                              {wrongDay.length > 6 ? "…" : ""}
                            </p>
                            <p className="mt-1 text-[11px] text-amber-900/80">Добавьте клиента вручную в маршрут через «Редактировать».</p>
                          </div>
                        ) : null}
                        {canEditRoute ? (
                          <div className="mb-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-9 w-full text-xs sm:w-auto"
                              data-testid={`button-dealer-shipment-route-sort-by-unloading-order-${def.slotId}`}
                              onClick={() => {
                                sortRouteByUnloadingOrder(userId, activeShipmentDayId, def, rowsForRouteSettlementCounts);
                                toast({ title: "Порядок по выгрузке применён" });
                              }}
                            >
                              Сортировать по порядку выгрузки
                            </Button>
                          </div>
                        ) : null}
                        {ordered.length === 0 ? (
                          <p className="mb-3 text-sm text-muted-foreground">Клиенты маршрута не выбраны</p>
                        ) : (
                          <div className="mb-3 space-y-2">
                            {ordered.map((row) => {
                              const st = getShipmentStatus(row);
                              const uo = getDealerUnloadingOrder(row.id);
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
                                    <p className="text-[11px] text-muted-foreground" data-testid={`text-dealer-route-client-unloading-order-${row.id}`}>
                                      Порядок выгрузки: {uo != null ? uo : "—"}
                                    </p>
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
                                        onClick={() =>
                                          reorderRouteDealer(userId, activeShipmentDayId, row.id, "up", def.slotId, {
                                            def,
                                            scopedRows: rowsForRouteSettlementCounts,
                                          })
                                        }
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
                                        onClick={() =>
                                          reorderRouteDealer(userId, activeShipmentDayId, row.id, "down", def.slotId, {
                                            def,
                                            scopedRows: rowsForRouteSettlementCounts,
                                          })
                                        }
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
                                        onClick={() => removeDealerFromRoute(userId, activeShipmentDayId, row.id, def.slotId, row)}
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
                        <div data-testid={`button-dealer-shipment-route-copy-${def.slotId}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full min-h-10 text-xs sm:w-auto"
                            data-testid="button-dealer-route-copy"
                            onClick={() => runCopyRoute(def.slotId, def.name)}
                            disabled={routeRowsForCopy(ordered, settlementFallback).length === 0}
                          >
                            Скопировать маршрут
                          </Button>
                        </div>
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

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) {
            setEditDraft(null);
            setEditSelectedIds([]);
            setEditClientSearch("");
          }
        }}
      >
        <DialogContent
          className="flex max-h-[min(92vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          data-testid="dialog-dealer-shipment-route-edit"
        >
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 pb-3 pt-4">
            <DialogTitle>Редактирование маршрута</DialogTitle>
          </DialogHeader>
          {editDraft && activeShipmentDayId ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="dealer-route-name">Название</Label>
                <Input
                  id="dealer-route-name"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  className="min-h-10"
                  data-testid="input-dealer-shipment-route-name"
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
              <div className="space-y-1">
                <Label htmlFor="dealer-route-client-search">Поиск клиента</Label>
                <Input
                  id="dealer-route-client-search"
                  value={editClientSearch}
                  onChange={(e) => setEditClientSearch(e.target.value)}
                  placeholder="Название или город"
                  className="min-h-10"
                  data-testid="input-dealer-shipment-route-client-search"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Доступные</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-card p-1.5">
                    {searchOptions.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">Нет совпадений</p>
                    ) : (
                      searchOptions.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded border border-transparent px-1.5 py-1 hover:bg-muted/50"
                          data-testid={`row-dealer-shipment-route-client-option-${r.id}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{r.city}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 shrink-0 px-2 text-[10px]"
                            data-testid={`button-dealer-shipment-route-client-add-${r.id}`}
                            onClick={() => setEditSelectedIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]))}
                          >
                            Добавить
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">В маршруте ({editSelectedIds.length})</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-card p-1.5">
                    {selectedRows.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">Список пуст</p>
                    ) : (
                      selectedRows.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded border border-transparent px-1.5 py-1 hover:bg-muted/50"
                          data-testid={`row-dealer-shipment-route-client-selected-${r.id}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{r.city}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 px-2 text-[10px]"
                            data-testid={`button-dealer-shipment-route-client-remove-${r.id}`}
                            onClick={() => setEditSelectedIds((prev) => prev.filter((id) => id !== r.id))}
                          >
                            Убрать
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button type="button" data-testid="button-dealer-shipment-route-save" onClick={saveEdit} disabled={!editDraft?.name.trim()}>
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
