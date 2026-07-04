import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import type { TradePointShowcaseSelectedModel } from "@/lib/client-base-actualization-state";
import {
  capacityByEquipmentType,
  equipmentCapacityKey,
  legacyCategoryCapacityFromRec,
  seedInputsWithLegacyFallback,
  validateMkPortalSecondCapacity,
  type EquipmentCapacityInputV2,
} from "@/lib/showcase-capacity-by-equipment";
import type { ShowcasePlacementSegment } from "@/lib/showcase-matrix-api";
import {
  allowedTypesForSegment,
  PLACEMENT_SEGMENT_LABEL_RU,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import { loadCachedPlacements } from "@/lib/showcase-matrix-store";
import {
  countSelectedByType,
  findShowcaseCapacityGaps,
  getShowcaseTypeCapacity,
  SHOWCASE_TYPE_LABEL_RU,
  type ShowcaseTypeKey,
} from "@/lib/showcase-type-capacity";
import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";
import { cn } from "@/lib/utils";

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

const SEGMENT_TO_TYPE_KEY: Record<ShowcasePlacementSegment, ShowcaseTypeKey> = {
  vh: "entrance",
  mk: "interior",
  hardware: "hardware",
};

export type ShowcaseEquipmentCapacityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradePointId: string;
  getCandidateRec: () => TradePointShowcaseActualization | undefined;
  selectedModels: readonly TradePointShowcaseSelectedModel[];
  catalogLookup: (id: string) => CatalogProduct | undefined;
  onConfirm: (inputs: EquipmentCapacityInputV2) => void;
  onCancel: () => void;
};

function parseCapacityInput(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function ShowcaseEquipmentCapacityDialog({
  open,
  onOpenChange,
  tradePointId,
  getCandidateRec,
  selectedModels,
  catalogLookup,
  onConfirm,
  onCancel,
}: ShowcaseEquipmentCapacityDialogProps) {
  const placements = useMemo(() => loadCachedPlacements(tradePointId), [tradePointId, open]);
  const byEquipment = useMemo(() => capacityByEquipmentType(placements), [placements]);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [legacyInputs, setLegacyInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const candidateRec = getCandidateRec();
    const legacy = legacyCategoryCapacityFromRec(candidateRec);
    const initial = seedInputsWithLegacyFallback(placements, legacy);
    const nextCapacity: Record<string, string> = {};
    const nextLegacy: Record<string, string> = {};
    for (const [key, value] of Object.entries(initial.capacity)) {
      nextCapacity[key] = String(value);
    }
    for (const [key, value] of Object.entries(initial.legacyOurs)) {
      nextLegacy[key] = String(value);
    }
    setInputs(nextCapacity);
    setLegacyInputs(nextLegacy);
  }, [open, placements, getCandidateRec]);

  const candidateRec = getCandidateRec();
  const categoryGaps = useMemo(
    () => findShowcaseCapacityGaps(candidateRec, selectedModels, catalogLookup),
    [candidateRec, selectedModels, catalogLookup],
  );

  const segmentTotals = useMemo(() => {
    const totals: Record<ShowcasePlacementSegment, number> = { vh: 0, mk: 0, hardware: 0 };
    for (const segment of SEGMENTS) {
      for (const row of byEquipment[segment]) {
        const key = equipmentCapacityKey(segment, row.placementType);
        totals[segment] += parseCapacityInput(inputs[key] ?? String(row.capacity));
      }
    }
    return totals;
  }, [byEquipment, inputs]);

  const legacySegmentTotals = useMemo(() => {
    const totals: Record<ShowcasePlacementSegment, number> = { vh: 0, mk: 0, hardware: 0 };
    for (const segment of SEGMENTS) {
      for (const row of byEquipment[segment]) {
        const key = equipmentCapacityKey(segment, row.placementType);
        totals[segment] += parseCapacityInput(legacyInputs[key] ?? String(row.legacyOurs));
      }
    }
    return totals;
  }, [byEquipment, legacyInputs]);

  const grandTotal = segmentTotals.vh + segmentTotals.mk + segmentTotals.hardware;

  const hasMinError = useMemo(
    () =>
      SEGMENTS.some((segment) => {
        const typeKey = SEGMENT_TO_TYPE_KEY[segment];
        const selectedCount = countSelectedByType(selectedModels, typeKey, catalogLookup);
        return selectedCount > 0 && segmentTotals[segment] < selectedCount;
      }),
    [catalogLookup, segmentTotals, selectedModels],
  );

  const hasLegacyOverflow = useMemo(
    () =>
      SEGMENTS.some((segment) => {
        const typeKey = SEGMENT_TO_TYPE_KEY[segment];
        const selectedCount = countSelectedByType(selectedModels, typeKey, catalogLookup);
        const capacity = segmentTotals[segment];
        const legacyForSegment = legacySegmentTotals[segment];
        return selectedCount + legacyForSegment > capacity;
      }),
    [catalogLookup, legacySegmentTotals, segmentTotals, selectedModels],
  );

  const parsedCapacity = useMemo(() => {
    const capacity: Record<string, number> = {};
    for (const segment of SEGMENTS) {
      for (const row of byEquipment[segment]) {
        const key = equipmentCapacityKey(segment, row.placementType);
        capacity[key] = parseCapacityInput(inputs[key] ?? "0");
      }
    }
    return capacity;
  }, [byEquipment, inputs]);

  const mkPortalSecondValidation = useMemo(
    () => validateMkPortalSecondCapacity(parsedCapacity),
    [parsedCapacity],
  );

  const hasSaveError = hasMinError || hasLegacyOverflow || !mkPortalSecondValidation.valid;

  const handleConfirm = useCallback(() => {
    if (hasSaveError) return;
    const capacity: Record<string, number> = {};
    const legacyOurs: Record<string, number> = {};
    for (const segment of SEGMENTS) {
      for (const row of byEquipment[segment]) {
        const key = equipmentCapacityKey(segment, row.placementType);
        capacity[key] = parseCapacityInput(inputs[key] ?? "0");
        legacyOurs[key] = parseCapacityInput(legacyInputs[key] ?? "0");
      }
    }
    onConfirm({ capacity, legacyOurs });
  }, [byEquipment, hasSaveError, inputs, legacyInputs, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg"
        data-testid="dialog-equipment-capacity"
      >
        <DialogHeader>
          <DialogTitle>Количество витрин по типам оборудования</DialogTitle>
          <DialogDescription>
            Укажите общее количество витрин для каждого типа оборудования. Сумма по категории определяет
            ёмкость для аналитики дистрибуции.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SEGMENTS.map((segment) => {
            const typeKey = SEGMENT_TO_TYPE_KEY[segment];
            const selectedCount = countSelectedByType(selectedModels, typeKey, catalogLookup);
            const categoryGap = categoryGaps.includes(typeKey);
            const minCapacityError = selectedCount > 0 && segmentTotals[segment] < selectedCount;
            const legacyForSegment = legacySegmentTotals[segment];
            const legacyOverflowError =
              selectedCount + legacyForSegment > segmentTotals[segment];
            return (
              <div key={segment} className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{PLACEMENT_SEGMENT_LABEL_RU[segment]}</p>
                  <p
                    className="text-xs tabular-nums text-muted-foreground"
                    data-testid={`text-category-capacity-total-${segment}`}
                  >
                    Всего витрин по категории: {segmentTotals[segment]}
                  </p>
                </div>
                {categoryGap ? (
                  <p className="text-xs text-amber-900 dark:text-amber-100">
                    По типу «{SHOWCASE_TYPE_LABEL_RU[typeKey]}» отмечено {selectedCount} моделей на витрине, но
                    суммарная ёмкость равна 0. Укажите количество витрин.
                  </p>
                ) : null}
                {minCapacityError ? (
                  <p
                    className="text-xs font-medium text-red-600 dark:text-red-400"
                    data-testid={`text-equipment-capacity-min-error-${segment}`}
                  >
                    Витрин меньше, чем выбрано моделей:{" "}
                    <span className="tabular-nums">
                      {segmentTotals[segment]} {"<"} {selectedCount}
                    </span>
                    .
                  </p>
                ) : null}
                {legacyOverflowError ? (
                  <p
                    className="text-xs font-medium text-red-600 dark:text-red-400"
                    data-testid={`text-equipment-legacy-overflow-${segment}`}
                  >
                    Превышение ёмкости: неактуальные{" "}
                    <span className="tabular-nums">{legacyForSegment}</span> + каталог{" "}
                    <span className="tabular-nums">{selectedCount}</span> {">"} витрин{" "}
                    <span className="tabular-nums">{segmentTotals[segment]}</span>.
                  </p>
                ) : null}
                {segment === "mk" && !mkPortalSecondValidation.valid ? (
                  <p
                    className="text-xs font-medium text-red-600 dark:text-red-400"
                    data-testid="text-equipment-mk-portal-second-overflow"
                  >
                    {mkPortalSecondValidation.message}
                  </p>
                ) : null}
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <span />
                  <span className="text-center">Витрин всего</span>
                  <span className="text-center">Неактуальные</span>
                </div>
                <div className="space-y-2">
                  {allowedTypesForSegment(segment).map((placementType) => {
                    const key = equipmentCapacityKey(segment, placementType);
                    const current = getShowcaseTypeCapacity(candidateRec, typeKey);
                    const portalSecondFieldError =
                      segment === "mk" &&
                      placementType === "portal_second" &&
                      !mkPortalSecondValidation.valid;
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2"
                      >
                        <Label htmlFor={key} className="text-xs font-normal text-foreground">
                          {PLACEMENT_TYPE_LABEL_RU[placementType]}
                        </Label>
                        <Input
                          id={key}
                          className={cn(
                            "h-9 tabular-nums",
                            categoryGap && segmentTotals[segment] === 0 && "border-amber-500/60",
                            (minCapacityError || legacyOverflowError || portalSecondFieldError) &&
                              "border-red-500/60",
                          )}
                          inputMode="numeric"
                          data-testid={`input-equipment-capacity-${segment}-${placementType}`}
                          value={inputs[key] ?? "0"}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          aria-describedby={current != null ? undefined : `${key}-hint`}
                        />
                        <Input
                          className={cn(
                            "h-9 tabular-nums",
                            legacyOverflowError && "border-red-500/60",
                          )}
                          inputMode="numeric"
                          data-testid={`input-equipment-legacy-ours-${segment}-${placementType}`}
                          value={legacyInputs[key] ?? "0"}
                          onChange={(e) =>
                            setLegacyInputs((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <p className="text-xs tabular-nums text-muted-foreground">Общий итог по всем категориям: {grandTotal}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={hasSaveError}
            data-testid="button-equipment-capacity-confirm"
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
