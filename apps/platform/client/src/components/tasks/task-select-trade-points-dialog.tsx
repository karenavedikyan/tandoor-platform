import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { activeTradePointsForDealerRow, taskSelectTargetKey } from "@/lib/task-select-mode";
import { resolveTradePointDisplayName } from "@/lib/trade-point-display-labels";

type Props = {
  open: boolean;
  row: DealerRow | null;
  actualizationState: ActualizationState;
  selectedKeys: Set<string>;
  onOpenChange: (open: boolean) => void;
  onApply: (keys: string[]) => void;
};

export function TaskSelectTradePointsDialog({
  open,
  row,
  actualizationState,
  selectedKeys,
  onOpenChange,
  onApply,
}: Props) {
  const tradePoints = useMemo(
    () => (row ? activeTradePointsForDealerRow(row, actualizationState) : []),
    [row, actualizationState],
  );

  const [localSelected, setLocalSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open || !row) return;
    const next = new Set<string>();
    for (const e of tradePoints) {
      const key = taskSelectTargetKey(row.id, e.point.id);
      if (selectedKeys.has(key)) next.add(key);
    }
    setLocalSelected(next);
  }, [open, row, tradePoints, selectedKeys]);

  const toggle = (key: string, checked: boolean) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(localSelected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md" data-testid="dialog-task-select-trade-points">
        <DialogHeader>
          <DialogTitle>Выберите торговые точки</DialogTitle>
          <DialogDescription>
            {row ? `Клиент «${row.name}» — отметьте ТТ для задания.` : "Выберите торговые точки клиента."}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {tradePoints.map((e) => {
            const key = row ? taskSelectTargetKey(row.id, e.point.id) : "";
            const label = row
              ? [resolveTradePointDisplayName(row, e.point), e.point.city?.trim()].filter(Boolean).join(" · ")
              : e.point.id;
            return (
              <li key={e.point.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40">
                  <Checkbox
                    checked={localSelected.has(key)}
                    onCheckedChange={(v) => toggle(key, v === true)}
                    className="mt-0.5"
                    data-testid={`checkbox-task-select-tp-${e.point.id}`}
                  />
                  <span className="min-w-0 text-sm leading-snug">{label || e.point.id}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} data-testid="button-task-select-tp-apply">
            Применить ({localSelected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
