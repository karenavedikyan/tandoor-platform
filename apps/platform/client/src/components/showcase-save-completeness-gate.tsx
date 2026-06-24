import type { ReactElement } from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ShowcaseTypeCapacityInlineForm } from "@/components/showcase-type-capacity-inline-form";
import type {
  TradePointShowcaseActualization,
  TradePointShowcaseSelectedModel,
} from "@/lib/client-base-actualization-state";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import {
  countSelectedByType,
  findShowcaseCapacityGaps,
  getShowcaseTypeCapacity,
  SHOWCASE_TYPE_LABEL_RU,
  type ShowcaseTypeKey,
} from "@/lib/showcase-type-capacity";

export type ShowcaseSaveCompletenessGateProps = {
  gaps: ShowcaseTypeKey[];
  getCandidateRec: () => TradePointShowcaseActualization | undefined;
  selectedModels: readonly TradePointShowcaseSelectedModel[];
  catalogLookup: (id: string) => CatalogProduct | undefined;
  onSaveCapacity: (type: ShowcaseTypeKey, value: number) => void;
  onConfirm: () => void;
  onSaveAnyway: () => void;
  onCancel: () => void;
  confirmLabel?: string;
};

export function ShowcaseSaveCompletenessGate({
  gaps,
  getCandidateRec,
  selectedModels,
  catalogLookup,
  onSaveCapacity,
  onConfirm,
  onSaveAnyway,
  onCancel,
  confirmLabel = "Сохранить",
}: ShowcaseSaveCompletenessGateProps): ReactElement {
  const candidateRec = getCandidateRec();
  const remainingGaps = useMemo(
    () => findShowcaseCapacityGaps(candidateRec, selectedModels, catalogLookup),
    [candidateRec, selectedModels, catalogLookup],
  );
  const typesToShow = gaps.filter((t) => remainingGaps.includes(t));

  return (
    <div
      className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-50/90 p-3 dark:border-amber-800/50 dark:bg-amber-950/40"
      data-testid="showcase-save-completeness-gate"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Укажите количество витрин</p>
        <p className="text-xs leading-snug text-muted-foreground">
          По некоторым типам отмечены модели на витрине, но не указано количество витрин. Без этого
          заполнение не попадёт в аналитику дистрибуции.
        </p>
      </div>

      {typesToShow.map((type) => {
        const n = countSelectedByType(selectedModels, type, catalogLookup);
        return (
          <ShowcaseTypeCapacityInlineForm
            key={type}
            type={type}
            currentCapacity={getShowcaseTypeCapacity(candidateRec, type)}
            hint={`По типу «${SHOWCASE_TYPE_LABEL_RU[type]}» отмечено ${n} моделей на витрине, но не указано количество витрин. Без этого заполнение не попадёт в аналитику. Укажите количество.`}
            onSave={(value) => onSaveCapacity(type, value)}
            onCancel={() => {}}
          />
        );
      })}

      {remainingGaps.length === 0 && gaps.length > 0 ? (
        <p className="text-xs text-muted-foreground">Ёмкость по всем типам указана. Можно сохранить.</p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          disabled={remainingGaps.length > 0}
          onClick={onConfirm}
          data-testid="button-showcase-completeness-gate-confirm"
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSaveAnyway}
          data-testid="button-showcase-completeness-gate-save-anyway"
        >
          Сохранить без ёмкости
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          data-testid="button-showcase-completeness-gate-cancel"
        >
          Отмена
        </Button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        При сохранении без ёмкости отмеченные модели не будут видны в аналитике по этим типам.
      </p>
    </div>
  );
}
