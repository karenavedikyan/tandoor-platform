import { useState, type DragEvent, type ReactElement } from "react";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ORDER_COLUMN_LABELS,
  type OrderColumnKey,
  type OrderColumnsState,
} from "./one-c-orders-columns";

type OneCOrdersColumnPickerProps = {
  columns: OrderColumnsState;
  onToggleColumn: (key: OrderColumnKey) => void;
  onReorderColumns: (fromIdx: number, toIdx: number) => void;
  onResetColumns: () => void;
  testIdPrefix?: string;
};

export function OneCOrdersColumnPicker({
  columns,
  onToggleColumn,
  onReorderColumns,
  onResetColumns,
  testIdPrefix = "one-c-orders",
}: OneCOrdersColumnPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" data-testid={`${testIdPrefix}-columns-toggle`}>
          <Columns3 className="h-3.5 w-3.5" />
          Колонки
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3" data-testid={`${testIdPrefix}-columns-popover`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Колонки таблицы</p>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onResetColumns}>
            Сбросить
          </Button>
        </div>
        <div className="space-y-1">
          {columns.map((col, idx) => (
            <div
              key={col.key}
              draggable
              onDragStart={(e: DragEvent<HTMLDivElement>) => {
                setDragIdx(idx);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
              }}
              onDragOver={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setOverIdx(idx);
              }}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                const fromIdx = dragIdx ?? Number.parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(fromIdx) && fromIdx !== idx) onReorderColumns(fromIdx, idx);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5",
                overIdx === idx && "border-primary/40 bg-muted/50",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Checkbox
                id={`${testIdPrefix}-col-${col.key}`}
                checked={col.visible}
                onCheckedChange={() => onToggleColumn(col.key)}
              />
              <label htmlFor={`${testIdPrefix}-col-${col.key}`} className="flex-1 cursor-pointer text-sm">
                {ORDER_COLUMN_LABELS[col.key]}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
