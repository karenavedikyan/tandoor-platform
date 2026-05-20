import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionSavePhase } from "@/hooks/use-section-save-feedback";

type Props = {
  /** data-testid кнопки (например button-dealer-section-save-passport) */
  testId: string;
  phase: SectionSavePhase;
  /** Запуск сохранения (обычно обёртка над runSave из useSectionSaveFeedback) */
  onSave: () => void;
  disabled?: boolean;
  className?: string;
  /** Если задан — скрытый текст статуса для e2e */
  statusTestId?: string;
};

export function SectionSaveButton({ testId, phase, onSave, disabled, className, statusTestId }: Props) {
  const busy = phase === "saving";
  const saved = phase === "success";
  const label = busy ? "Сохраняем…" : saved ? "Сохранено" : "Сохранить";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        className={cn(
          "min-h-9 font-semibold",
          saved && "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90",
          className,
        )}
        variant="default"
        data-testid={testId}
        disabled={disabled || busy || saved}
        onClick={onSave}
      >
        {label}
      </Button>
      {statusTestId ? (
        <span className="sr-only" data-testid={statusTestId} aria-live="polite">
          {phase}
        </span>
      ) : null}
    </div>
  );
}
