import type { ReactElement } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getDealerManagerDisplay } from "@/lib/dealer-base-mock-data";
import { isVirtualDefaultTradePointId } from "@/lib/dealer-trade-points-overrides";
import { taskSelectTargetKey } from "@/lib/task-select-mode";
import { cn } from "@/lib/utils";

export type TaskSelectFlatTradePointEntry = {
  row: DealerRow;
  point: DealerTradePoint;
};

type TaskSelectFlatTradePointsListProps = {
  entries: TaskSelectFlatTradePointEntry[];
  selectedKeys: Set<string>;
  onToggle: (dealerId: string, tradePointId: string, checked: boolean) => void;
  onOpenShowcase: (dealerId: string, tradePointId: string) => void;
};

function tradePointTitle(row: DealerRow, point: DealerTradePoint): string {
  const name = point.name?.trim();
  if (
    !name ||
    isVirtualDefaultTradePointId(row.id, point.id) ||
    name.toLowerCase() === "основная торговая точка"
  ) {
    return row.name;
  }
  return name;
}

function tradePointLocation(row: DealerRow, point: DealerTradePoint): string {
  const city = point.city?.trim() || row.city?.trim() || "";
  const address = point.address?.trim() || "";
  if (city && address) return `${city} · ${address}`;
  return city || address || "—";
}

export function TaskSelectFlatTradePointsList({
  entries,
  selectedKeys,
  onToggle,
  onOpenShowcase,
}: TaskSelectFlatTradePointsListProps): ReactElement {
  if (entries.length === 0) {
    return (
      <Card
        className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground"
        data-testid="task-select-flat-tradepoints-empty"
      >
        Ничего не найдено.
      </Card>
    );
  }

  return (
    <ul className="space-y-2" data-testid="task-select-flat-tradepoints-list">
      {entries.map(({ row, point }) => {
        const key = taskSelectTargetKey(row.id, point.id);
        const checked = selectedKeys.has(key);
        const manager = getDealerManagerDisplay(row) || "—";
        const code = point.releaseCode?.trim();
        return (
          <li key={key}>
            <button
              type="button"
              className={cn(
                "flex w-full min-h-[44px] items-start gap-3 rounded-xl border border-border/80 bg-card p-3 text-left shadow-xs transition-colors",
                "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              onClick={() => onOpenShowcase(row.id, point.id)}
              data-testid={`task-select-flat-tradepoint-row-${point.id}`}
            >
              <span
                className="flex shrink-0 items-center pt-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => onToggle(row.id, point.id, v === true)}
                  aria-label={`Выбрать торговую точку ${tradePointTitle(row, point)}`}
                  data-testid={`task-select-flat-tradepoint-checkbox-${point.id}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {tradePointTitle(row, point)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {tradePointLocation(row, point)}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {row.name}
                  {code ? ` · ${code}` : ""}
                  {` · ${manager}`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
