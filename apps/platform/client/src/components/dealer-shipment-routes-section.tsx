import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { MultiSelect } from "@/components/ui/multi-select";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  type DealerShipmentDayId,
} from "@/lib/dealer-shipment-days";
import {
  DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT,
  formatShipmentRouteCities,
  type DealerShipmentRouteDefinition,
} from "@/lib/dealer-shipment-route-definitions";

type EditTarget =
  | { mode: "create" }
  | { mode: "edit"; route: DealerShipmentRouteDefinition };

type Props = {
  activeDayId: DealerShipmentDayId;
  routes: DealerShipmentRouteDefinition[];
  cityOptions: string[];
  canEdit: boolean;
  activeRouteId: string | null;
  routeClientCount: (route: DealerShipmentRouteDefinition) => number;
  onSave: (input: { id?: string; name: string; cities: string[] }) => void;
  onRemove: (routeId: string) => void;
  onApplyRoute: (route: DealerShipmentRouteDefinition) => void;
  onClearRoute: () => void;
};

export function DealerShipmentRoutesSection({
  activeDayId,
  routes,
  cityOptions,
  canEdit,
  activeRouteId,
  routeClientCount,
  onSave,
  onRemove,
  onApplyRoute,
  onClearRoute,
}: Props) {
  const dayLabel = DEALER_SHIPMENT_DAY_LABELS[activeDayId];
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeCities, setRouteCities] = useState<string[]>([]);

  useEffect(() => {
    if (!target) return;
    if (target.mode === "edit") {
      setRouteName(target.route.name);
      setRouteCities(target.route.cities);
    } else {
      const idx = routes.length + 1;
      setRouteName(`Маршрут №${idx}`);
      setRouteCities([]);
    }
  }, [target, routes.length]);

  const canAdd = canEdit && routes.length < DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT;
  const limitReached = routes.length >= DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT;

  const dialogTitle = useMemo(() => {
    if (!target) return "";
    return target.mode === "edit" ? "Редактирование маршрута" : "Новый маршрут";
  }, [target]);

  const handleSubmit = () => {
    const name = routeName.trim();
    if (!name) return;
    const payload = target?.mode === "edit"
      ? { id: target.route.id, name, cities: routeCities }
      : { name, cities: routeCities };
    onSave(payload);
    setTarget(null);
  };

  const dialogOpen = target !== null;

  return (
    <>
      <Card
        className="rounded-xl border border-border/80 shadow-sm"
        data-testid="section-dealer-shipment-routes"
      >
        <CardHeader className="space-y-1 p-3 pb-2 sm:p-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Маршруты дня — {dayLabel}</CardTitle>
              <p className="text-xs text-muted-foreground">
                До 2 маршрутов на день: укажите название и населённые пункты.
              </p>
            </div>
            {activeRouteId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start text-xs"
                data-testid="button-dealer-shipment-route-clear-filter"
                onClick={onClearRoute}
              >
                Сбросить фильтр маршрута
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0 sm:p-4 sm:pt-0">
          {routes.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-dealer-shipment-routes-empty"
            >
              {canEdit
                ? "Добавьте маршрут и населённые пункты, чтобы фильтровать клиентов по нему."
                : "Маршруты не заданы."}
            </p>
          ) : (
            routes.map((route) => {
              const isActive = activeRouteId === route.id;
              const count = routeClientCount(route);
              return (
                <div
                  key={route.id}
                  className={`flex flex-col gap-2 rounded-lg border px-2 py-2 sm:px-3 ${
                    isActive ? "border-primary bg-primary/5" : "border-border/70 bg-card"
                  }`}
                  data-testid={`row-dealer-shipment-route-${route.id}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {route.name || "Без названия"}
                        </p>
                        {isActive ? (
                          <Badge variant="outline" className="border-primary text-primary text-[10px]">
                            Фильтр активен
                          </Badge>
                        ) : null}
                      </div>
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={`text-dealer-shipment-route-cities-${route.id}`}
                      >
                        Населённые пункты: {formatShipmentRouteCities(route.cities)}
                      </p>
                      <p
                        className="text-xs font-medium tabular-nums text-foreground"
                        data-testid={`text-dealer-shipment-route-count-${route.id}`}
                      >
                        Клиентов по маршруту: {count}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-nowrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        className="min-h-9 text-xs"
                        data-testid={`button-dealer-shipment-route-show-clients-${route.id}`}
                        onClick={() => onApplyRoute(route)}
                        disabled={route.cities.length === 0}
                      >
                        Показать клиентов
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 touch-manipulation"
                            aria-label="Редактировать маршрут"
                            data-testid={`button-dealer-shipment-route-edit-${route.id}`}
                            onClick={() => setTarget({ mode: "edit", route })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-9 w-9 touch-manipulation"
                            aria-label="Удалить маршрут"
                            data-testid={`button-dealer-shipment-route-remove-${route.id}`}
                            onClick={() => onRemove(route.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-9 text-xs"
                data-testid="button-dealer-shipment-route-add"
                onClick={() => setTarget({ mode: "create" })}
                disabled={!canAdd}
              >
                <Plus className="mr-1 h-4 w-4" /> Добавить маршрут
              </Button>
              {limitReached ? (
                <span className="text-xs text-muted-foreground">
                  На день можно задать не более {DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT} маршрутов.
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-dealer-shipment-route-edit">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dealer-shipment-route-name" className="text-xs font-medium text-muted-foreground">
                Название маршрута
              </Label>
              <Input
                id="dealer-shipment-route-name"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Например, Маршрут №1"
                data-testid="input-dealer-shipment-route-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Населённые пункты</Label>
              <MultiSelect
                options={cityOptions.map((c) => ({ value: c, label: c }))}
                value={routeCities}
                onChange={setRouteCities}
                placeholder="Выберите населённые пункты"
                allLabel="Все доступные"
                testId="multi-select-dealer-shipment-route-cities"
                ariaLabel="Населённые пункты маршрута"
                triggerClassName="min-h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Выбор формирует фильтр клиентской базы по маршруту.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget(null)}
              data-testid="button-dealer-shipment-route-cancel"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!routeName.trim()}
              data-testid="button-dealer-shipment-route-save"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
