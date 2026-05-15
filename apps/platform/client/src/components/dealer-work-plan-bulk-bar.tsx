import { useCallback, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { buildDealerWorkPlanCopyText } from "@/lib/dealer-work-plan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  selectedRows: DealerRow[];
  scheduleDate: string;
  onScheduleDateChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  onSchedule: () => void;
  onHide: () => void;
  onRestore: () => void;
  onCopy: (text: string) => void;
  onClearSelection: () => void;
  buildDealerHref: (dealerId: string) => string;
};

export function DealerWorkPlanBulkBar({
  selectedRows,
  scheduleDate,
  onScheduleDateChange,
  note,
  onNoteChange,
  onSchedule,
  onHide,
  onRestore,
  onCopy,
  onClearSelection,
  buildDealerHref,
}: Props) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackText, setFallbackText] = useState("");

  const runCopy = useCallback(() => {
    const text = buildDealerWorkPlanCopyText(selectedRows, {
      workDateIso: scheduleDate.trim() || undefined,
      note: note.trim() || undefined,
      buildDealerHref,
    });
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => {
          toast({ title: "Список скопирован" });
          onCopy(text);
        },
        () => {
          setFallbackText(text);
          setFallbackOpen(true);
        },
      );
    } else {
      setFallbackText(text);
      setFallbackOpen(true);
    }
  }, [selectedRows, scheduleDate, note, buildDealerHref, onCopy]);

  const n = selectedRows.length;

  return (
    <>
      <section
        data-testid="section-dealer-work-plan-bulk-bar"
        className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 sm:px-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
          <p className="text-sm font-semibold text-foreground" data-testid="text-dealer-work-plan-selected-count">
            Выбрано {n}
          </p>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[11rem]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="work-plan-date-input">
              Дата
            </label>
            <Input
              id="work-plan-date-input"
              type="date"
              value={scheduleDate}
              onChange={(e) => onScheduleDateChange(e.target.value)}
              className="h-9 min-h-9 text-sm"
              data-testid="input-dealer-work-plan-date"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[12rem] sm:max-w-[20rem]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="work-plan-note-input">
              Комментарий
            </label>
            <Input
              id="work-plan-note-input"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Необязательно"
              className="h-9 min-h-9 text-sm"
              data-testid="input-dealer-work-plan-note"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
            data-testid="button-dealer-work-plan-schedule"
            onClick={onSchedule}
            disabled={!scheduleDate.trim()}
          >
            Назначить на дату
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
            data-testid="button-dealer-work-plan-hide"
            onClick={onHide}
          >
            Скрыть из рабочего списка
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
            data-testid="button-dealer-work-plan-restore"
            onClick={onRestore}
          >
            Вернуть в рабочий список
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
            data-testid="button-dealer-work-plan-copy"
            onClick={runCopy}
          >
            Скопировать список
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("min-h-9 flex-1 text-xs font-semibold sm:flex-none")}
            data-testid="button-dealer-work-plan-clear-selection"
            onClick={onClearSelection}
          >
            Снять выбор
          </Button>
        </div>
      </section>

      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-dealer-work-plan-copy-fallback">
          <DialogHeader>
            <DialogTitle>Скопируйте текст вручную</DialogTitle>
          </DialogHeader>
          <Textarea
            readOnly
            value={fallbackText}
            className="min-h-[200px] font-mono text-xs"
            data-testid="textarea-dealer-work-plan-copy-text"
            onFocus={(e) => e.target.select()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFallbackOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
