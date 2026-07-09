import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Package, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { computePlacementDistribution } from "@/lib/showcase-placement-distribution";
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

function sumCompetitors(block: ShowcaseMatrixEntryDto): number {
  return (block.placementCompetitors ?? []).reduce((acc, c) => acc + (c?.count ?? 0), 0);
}

function remainingSlots(block: ShowcaseMatrixEntryDto): number {
  const cap = block.placementCapacity ?? 0;
  const ours = block.placementActual ?? 0;
  return Math.max(0, cap - ours - sumCompetitors(block));
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
  const [competitorDraftByBlock, setCompetitorDraftByBlock] = useState<
    Record<string, { brand: string; count: string }>
  >({});
  const [competitorErrorByBlock, setCompetitorErrorByBlock] = useState<Record<string, string | null>>({});

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

  const persistCompetitors = (
    block: ShowcaseMatrixEntryDto,
    next: ShowcaseMatrixEntryDto["placementCompetitors"],
  ) => {
    if (!block.placementType || !block.placementSegment) return;
    setMatrixPlacement({
      dealerId,
      tradePointId,
      targetId: block.targetId,
      placementType: block.placementType,
      placementSegment: block.placementSegment,
      placementCapacity: block.placementCapacity ?? 0,
      placementActual: block.placementActual ?? 0,
      placementCompetitors: next,
      updatedBy: actorUserId,
      updatedByName: actorName,
    });
    bumpCache();
  };

  const handleAddCompetitor = (block: ShowcaseMatrixEntryDto) => {
    setCompetitorErrorByBlock((prev) => ({ ...prev, [block.targetId]: null }));
    const draft = competitorDraftByBlock[block.targetId] ?? { brand: "", count: "1" };
    const brand = draft.brand.trim();
    const count = Number.parseInt(draft.count.trim(), 10);
    if (!brand || !Number.isFinite(count) || count < 1) return;
    const next = [
      ...(block.placementCompetitors ?? []),
      { brand: brand.slice(0, 120), count },
    ];
    const capacity = block.placementCapacity ?? 0;
    const actual = block.placementActual ?? 0;
    const sumCompetitors = next.reduce((acc, c) => acc + (c?.count ?? 0), 0);
    if (actual + sumCompetitors > capacity) {
      setCompetitorErrorByBlock((prev) => ({
        ...prev,
        [block.targetId]: "Сумма наших и конкурентов превышает общую вместимость",
      }));
      return;
    }
    persistCompetitors(block, next);
    setCompetitorDraftByBlock((prev) => ({
      ...prev,
      [block.targetId]: { brand: "", count: "1" },
    }));
  };

  const handleRemoveCompetitor = (block: ShowcaseMatrixEntryDto, index: number) => {
    const next = (block.placementCompetitors ?? []).filter((_, i) => i !== index);
    persistCompetitors(block, next);
  };

  const distributionSummary = useMemo(
    () => computePlacementDistribution(placements),
    [placements],
  );

  return (
    <section
      data-testid="section-trade-point-placement-blocks"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between text-xs sm:w-auto"
            data-testid="button-placement-blocks-toggle"
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" aria-hidden />
              Типы размещения витрины
            </span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3">
          <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Физические блоки на точке: тип размещения, сегмент и заполнение нашими образцами.
          </p>

          {distributionSummary.overall.totalCapacity > 0 ? (
        <Card
          className="rounded-xl border border-border bg-card shadow-xs"
          data-testid="card-placement-distribution"
        >
          <CardContent className="space-y-2 px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                % дистрибуции по витрине
              </span>
              <span
                className="text-base font-bold tabular-nums text-foreground"
                data-testid="text-distribution-overall"
              >
                {distributionSummary.overall.distributionPercent}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Наши {distributionSummary.overall.totalOurs} из {distributionSummary.overall.totalCapacity}{" "}
              мест
              {distributionSummary.overall.totalCompetitors > 0
                ? ` · конкуренты ${distributionSummary.overall.totalCompetitors}`
                : ""}
              {` · свободно ${distributionSummary.overall.remaining}`}
            </p>
            {distributionSummary.bySegment.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {distributionSummary.bySegment.map((seg) => (
                  <div
                    key={seg.segment}
                    className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                    data-testid={`segment-distribution-${seg.segment}`}
                  >
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {PLACEMENT_SEGMENT_LABEL_RU[seg.segment]}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {seg.stats.distributionPercent}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {seg.stats.totalOurs}/{seg.stats.totalCapacity}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                        <span
                          className="w-full text-xs text-muted-foreground tabular-nums sm:w-auto"
                          data-testid={`text-capacity-summary-${block.targetId}`}
                        >
                          {formatCapacityLine(block.placementActual, block.placementCapacity)}
                          {block.placementCapacity != null && block.placementCapacity > 0 ? (
                            <span> · {pct}%</span>
                          ) : null}
                          {remainingSlots(block) > 0 ? (
                            <span> · своб. {remainingSlots(block)}</span>
                          ) : null}
                          {sumCompetitors(block) > 0 ? (
                            <span> · конк. {sumCompetitors(block)}</span>
                          ) : null}
                        </span>
                      </div>

                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="group h-8 min-h-8 justify-start gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                            data-testid={`button-toggle-capacity-${block.targetId}`}
                          >
                            Подробнее о вместимости
                            <ChevronDown
                              className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                              aria-hidden
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent
                          className="space-y-2 pt-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
                          data-testid={`capacity-details-${block.targetId}`}
                        >
                          <p className="text-xs text-muted-foreground">
                            Наши / общая вместимость:{" "}
                            <span className="font-medium text-foreground">
                              {formatCapacityLine(block.placementActual, block.placementCapacity)}
                            </span>
                            {block.placementCapacity != null && block.placementCapacity > 0 ? (
                              <span className="text-muted-foreground"> · {pct}% наших</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Остаток мест:{" "}
                            <span className="font-medium text-foreground">{remainingSlots(block)}</span>
                            {sumCompetitors(block) > 0 ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · конкуренты: {sumCompetitors(block)}
                              </span>
                            ) : null}
                          </p>
                          {block.placementCapacity != null && block.placementCapacity > 0 ? (
                            <Progress value={pct} className="h-2" aria-label="Доля наших образцов" />
                          ) : null}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {models.length > 0 ? (
                      <ul className="space-y-1 rounded-lg border border-border/60 bg-muted/10 px-2 py-2">
                        {models.map((entry) => {
                          const name =
                            getProductById(entry.targetId)?.name?.trim() ||
                            entry.targetName?.trim() ||
                            entry.targetId;
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

                    {(block.placementCompetitors ?? []).length > 0 ? (
                      <ul className="space-y-1 rounded-lg border border-amber-200/60 bg-amber-50/40 px-2 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                        {(block.placementCompetitors ?? []).map((c, i) => (
                          <li
                            key={`${c.brand}-${i}`}
                            className="flex min-w-0 items-center justify-between gap-2 text-xs"
                          >
                            <span className="min-w-0 break-words text-foreground">{c.brand}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="font-medium tabular-nums text-foreground">{c.count}</span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  aria-label="Удалить конкурента"
                                  data-testid={`button-remove-competitor-${block.targetId}-${i}`}
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveCompetitor(block, i)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {canEdit ? (
                      <div className="space-y-1.5">
                        <Label
                          className="text-xs text-muted-foreground"
                          htmlFor={`competitor-brand-${block.targetId}`}
                        >
                          Добавить конкурента (чужой товар)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`competitor-brand-${block.targetId}`}
                            data-testid={`input-competitor-brand-${block.targetId}`}
                            value={competitorDraftByBlock[block.targetId]?.brand ?? ""}
                            onChange={(e) =>
                              setCompetitorDraftByBlock((prev) => ({
                                ...prev,
                                [block.targetId]: {
                                  brand: e.target.value,
                                  count: prev[block.targetId]?.count ?? "1",
                                },
                              }))
                            }
                            placeholder="Бренд / название"
                            className="h-9 flex-1 text-sm"
                          />
                          <Input
                            data-testid={`input-competitor-count-${block.targetId}`}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={competitorDraftByBlock[block.targetId]?.count ?? "1"}
                            onChange={(e) =>
                              setCompetitorDraftByBlock((prev) => ({
                                ...prev,
                                [block.targetId]: {
                                  brand: prev[block.targetId]?.brand ?? "",
                                  count: e.target.value,
                                },
                              }))
                            }
                            className="h-9 w-16 text-sm"
                            aria-label="Количество"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 shrink-0"
                            data-testid={`button-add-competitor-${block.targetId}`}
                            onClick={() => handleAddCompetitor(block)}
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                        {competitorErrorByBlock[block.targetId] ? (
                          <p className="text-xs text-destructive">{competitorErrorByBlock[block.targetId]}</p>
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
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
