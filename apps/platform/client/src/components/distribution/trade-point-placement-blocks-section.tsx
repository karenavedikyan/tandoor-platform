import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProductById, searchCatalog } from "@/lib/catalog-data";
import type { ShowcaseMatrixEntryDto, ShowcasePlacementSegment, ShowcasePlacementType } from "@/lib/showcase-matrix-api";
import {
  allowedTypesForSegment,
  PLACEMENT_SEGMENT_LABEL_RU,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import {
  loadCachedPlacementModels,
  loadCachedPlacements,
  setMatrixPlacement,
  setMatrixPlacementModel,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";

type TradePointPlacementBlocksSectionProps = {
  dealerId: string;
  tradePointId: string;
  canEdit: boolean;
  actorUserId: string;
  actorName: string;
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

function newBlockTargetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `placement-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function fillPercent(actual: number | null, capacity: number | null): number {
  if (capacity == null || capacity <= 0 || actual == null) return 0;
  return Math.min(100, Math.round((actual / capacity) * 100));
}

function formatCapacityLine(actual: number | null, capacity: number | null): string {
  const a = actual ?? 0;
  const c = capacity ?? 0;
  return `${a} / ${c}`;
}

export function TradePointPlacementBlocksSection({
  dealerId,
  tradePointId,
  canEdit,
  actorUserId,
  actorName,
}: TradePointPlacementBlocksSectionProps) {
  const [cacheBump, setCacheBump] = useState(0);
  const [segment, setSegment] = useState<ShowcasePlacementSegment>("vh");
  const [placementType, setPlacementType] = useState<ShowcasePlacementType>("portal");
  const [capacityInput, setCapacityInput] = useState("4");
  const [actualInput, setActualInput] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [modelSearchByBlock, setModelSearchByBlock] = useState<Record<string, string>>({});

  const bumpCache = useCallback(() => setCacheBump((n) => n + 1), []);

  useEffect(() => {
    const onChange = () => bumpCache();
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
  }, [bumpCache]);

  const placements = useMemo(() => {
    void cacheBump;
    return [...loadCachedPlacements(tradePointId)].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [tradePointId, cacheBump]);

  const typeOptions = useMemo(() => allowedTypesForSegment(segment), [segment]);

  useEffect(() => {
    if (!typeOptions.includes(placementType)) {
      setPlacementType(typeOptions[0] ?? "portal");
    }
  }, [typeOptions, placementType]);

  const resetAddForm = () => {
    setSegment("vh");
    setPlacementType("portal");
    setCapacityInput("4");
    setActualInput("0");
    setFormError(null);
  };

  const handleAddBlock = () => {
    setFormError(null);
    const capacity = Number.parseInt(capacityInput.trim(), 10);
    const actual = Number.parseInt(actualInput.trim(), 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      setFormError("Укажите общую вместимость не меньше 1.");
      return;
    }
    if (!Number.isFinite(actual) || actual < 0 || actual > capacity) {
      setFormError("Количество наших образцов должно быть от 0 до общей вместимости.");
      return;
    }

    setMatrixPlacement({
      dealerId,
      tradePointId,
      targetId: newBlockTargetId(),
      placementType,
      placementSegment: segment,
      placementCapacity: capacity,
      placementActual: actual,
      updatedBy: actorUserId,
      updatedByName: actorName,
    });
    resetAddForm();
    bumpCache();
  };

  const handleAttachModel = (block: ShowcaseMatrixEntryDto, productId: string) => {
    setMatrixPlacementModel({
      dealerId,
      tradePointId,
      targetKind: "model",
      targetId: productId,
      placementRef: block.targetId,
      status: "installed",
      updatedBy: actorUserId,
      updatedByName: actorName,
    });
    setModelSearchByBlock((prev) => ({ ...prev, [block.targetId]: "" }));
    bumpCache();
  };

  return (
    <section
      data-testid="section-trade-point-placement-blocks"
      className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
          Типы размещения витрины
        </h3>
        <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
          Физические блоки на точке: тип размещения, сегмент и заполнение нашими образцами.
        </p>
      </div>

      {placements.length === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="px-3 py-4 text-sm text-muted-foreground sm:px-4">
            Блоки размещения ещё не заведены
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="list-placement-blocks">
          {placements.map((block) => {
            void cacheBump;
            const models = loadCachedPlacementModels(tradePointId, block.targetId);
            const pct = fillPercent(block.placementActual, block.placementCapacity);
            const searchQ = modelSearchByBlock[block.targetId] ?? "";
            const searchHits =
              canEdit && searchQ.trim().length > 0 ? searchCatalog(searchQ.trim(), 20) : [];

            return (
              <li key={block.id}>
                <Card
                  className="rounded-xl border border-border bg-card shadow-xs"
                  data-testid={`row-placement-block-${block.targetId}`}
                >
                  <CardContent className="space-y-3 px-3 py-3 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {block.placementType
                              ? PLACEMENT_TYPE_LABEL_RU[block.placementType]
                              : block.targetId}
                          </span>
                          {block.placementSegment ? (
                            <Badge variant="outline" className="shrink-0 whitespace-nowrap text-xs">
                              {PLACEMENT_SEGMENT_LABEL_RU[block.placementSegment]}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Наши / общая вместимость:{" "}
                          <span className="font-medium text-foreground">
                            {formatCapacityLine(block.placementActual, block.placementCapacity)}
                          </span>
                          {block.placementCapacity != null && block.placementCapacity > 0 ? (
                            <span className="text-muted-foreground"> · {pct}% наших</span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {block.placementCapacity != null && block.placementCapacity > 0 ? (
                      <Progress value={pct} className="h-2" aria-label="Доля наших образцов" />
                    ) : null}

                    {models.length > 0 ? (
                      <ul className="space-y-1 rounded-lg border border-border/60 bg-muted/10 px-2 py-2">
                        {models.map((entry) => {
                          const name = getProductById(entry.targetId)?.name?.trim() || entry.targetId;
                          return (
                            <li
                              key={entry.id}
                              className="flex min-w-0 items-center gap-2 text-xs text-foreground"
                            >
                              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 break-words">{name}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Привязанных моделей пока нет</p>
                    )}

                    {canEdit ? (
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs text-muted-foreground"
                          htmlFor={`placement-model-search-${block.targetId}`}
                        >
                          Привязать модель из каталога
                        </Label>
                        <Input
                          id={`placement-model-search-${block.targetId}`}
                          data-testid={`input-placement-model-search-${block.targetId}`}
                          value={searchQ}
                          onChange={(e) =>
                            setModelSearchByBlock((prev) => ({
                              ...prev,
                              [block.targetId]: e.target.value,
                            }))
                          }
                          placeholder="Поиск по названию или артикулу"
                          className="h-9 text-sm"
                        />
                        {searchHits.length > 0 ? (
                          <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
                            {searchHits.map((product) => (
                              <li key={product.id}>
                                <button
                                  type="button"
                                  className="flex w-full min-w-0 px-2 py-2 text-left text-xs hover:bg-muted/60"
                                  onClick={() => handleAttachModel(block, product.id)}
                                >
                                  <span className="min-w-0 break-words font-medium text-foreground">
                                    {product.name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-xs">
          <CardContent className="space-y-3 px-3 py-4 sm:px-4" data-testid="form-add-placement-block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Добавить блок размещения
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="select-placement-segment" className="text-xs text-muted-foreground">
                  Сегмент
                </Label>
                <Select
                  value={segment}
                  onValueChange={(v) => setSegment(v as ShowcasePlacementSegment)}
                >
                  <SelectTrigger id="select-placement-segment" data-testid="select-placement-segment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PLACEMENT_SEGMENT_LABEL_RU[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="select-placement-type" className="text-xs text-muted-foreground">
                  Тип размещения
                </Label>
                <Select
                  value={placementType}
                  onValueChange={(v) => setPlacementType(v as ShowcasePlacementType)}
                >
                  <SelectTrigger id="select-placement-type" data-testid="select-placement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PLACEMENT_TYPE_LABEL_RU[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="input-placement-capacity" className="text-xs text-muted-foreground">
                  Общая вместимость
                </Label>
                <Input
                  id="input-placement-capacity"
                  data-testid="input-placement-capacity"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="input-placement-actual" className="text-xs text-muted-foreground">
                  Сколько наших образцов
                </Label>
                <Input
                  id="input-placement-actual"
                  data-testid="input-placement-actual"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={actualInput}
                  onChange={(e) => setActualInput(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
            <Button
              type="button"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-add-placement-block"
              onClick={handleAddBlock}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Добавить блок
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
