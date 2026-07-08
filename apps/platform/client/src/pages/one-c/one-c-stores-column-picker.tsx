import { useState, type DragEvent, type ReactElement } from "react";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  STORE_COLUMN_LABELS,
  type StoreColumnKey,
  type StoreColumnsState,
} from "./one-c-stores-columns";

type OneCStoresColumnPickerProps = {
  columns: StoreColumnsState;
  onToggleColumn: (key: StoreColumnKey) => void;
  onReorderColumns: (fromIdx: number, toIdx: number) => void;
  onResetColumns: () => void;
  testIdPrefix?: string;
};

export function OneCStoresColumnPicker({
  columns,
  onToggleColumn,
  onReorderColumns,
  onResetColumns,
  testIdPrefix = "one-c-stores",
}: OneCStoresColumnPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    setDragIdx(idx);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDragOver = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };

  const handleDrop = (idx: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const fromRaw = event.dataTransfer.getData("text/plain");
    const fromIdx = dragIdx ?? Number.parseInt(fromRaw, 10);
    if (!Number.isNaN(fromIdx) && fromIdx !== idx) {
      onReorderColumns(fromIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          data-testid={`${testIdPrefix}-columns-toggle`}
        >
          <Columns3 className="h-3.5 w-3.5" />
          Колонки
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3" data-testid={`${testIdPrefix}-columns-popover`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Колонки таблицы</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onResetColumns}
            data-testid={`${testIdPrefix}-columns-reset`}
          >
            Сбросить
          </Button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {columns.map((col, idx) => (
            <div
              key={col.key}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 rounded-md px-1 py-1.5",
                overIdx === idx && dragIdx !== idx && "bg-muted",
                dragIdx === idx && "opacity-50",
              )}
              data-testid={`${testIdPrefix}-columns-item-${col.key}`}
            >
              <button
                type="button"
                className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
                aria-label="Перетащить"
                tabIndex={-1}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <Checkbox
                id={`${testIdPrefix}-col-${col.key}`}
                checked={col.visible}
                onCheckedChange={() => onToggleColumn(col.key)}
              />
              <label
                htmlFor={`${testIdPrefix}-col-${col.key}`}
                className="min-w-0 flex-1 cursor-pointer truncate text-sm"
              >
                {STORE_COLUMN_LABELS[col.key]}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
