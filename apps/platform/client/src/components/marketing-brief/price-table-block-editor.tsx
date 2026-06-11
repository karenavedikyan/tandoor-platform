import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  asPriceTableBlock,
  calcPriceBenefit,
  formatBriefPriceRub,
  newBriefBlockItemId,
  parseBriefPriceInput,
} from "@/components/marketing-brief/marketing-brief-block-shared";
import type { MarketingBriefBlockRow, PriceTableRow } from "@/lib/marketing-briefs-api";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "h-9 rounded-[6px] border border-card-border bg-background text-foreground focus-visible:ring-ring/30";

function SortablePriceRow({
  row,
  showBenefit,
  readOnly,
  onChange,
  onDelete,
}: {
  row: PriceTableRow;
  showBenefit: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<PriceTableRow>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: readOnly,
  });
  const benefit = calcPriceBenefit(row.price_old, row.price_new);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr ref={setNodeRef} style={style} className={cn(isDragging && "bg-background")}>
      <td className="w-8 p-1.5">
        {!readOnly ? (
          <button
            type="button"
            className="flex h-9 w-9 cursor-grab items-center justify-center rounded-[6px] text-muted-foreground hover:bg-card active:cursor-grabbing"
            aria-label="Перетащить"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </td>
      <td className="p-1.5">
        <Input
          value={row.model}
          disabled={readOnly}
          className={cn(FIELD_CLASS, "min-w-[8rem]")}
          onChange={(e) => onChange({ model: e.target.value })}
        />
      </td>
      <td className="p-1.5">
        <Input
          type="number"
          inputMode="numeric"
          disabled={readOnly}
          className={cn(FIELD_CLASS, "w-24")}
          value={row.price_old != null ? String(row.price_old) : ""}
          onChange={(e) => onChange({ price_old: parseBriefPriceInput(e.target.value) })}
        />
      </td>
      <td className="p-1.5">
        <Input
          type="number"
          inputMode="numeric"
          disabled={readOnly}
          className={cn(FIELD_CLASS, "w-24")}
          value={row.price_new != null ? String(row.price_new) : ""}
          onChange={(e) => onChange({ price_new: parseBriefPriceInput(e.target.value) })}
        />
      </td>
      {showBenefit ? (
        <td className="p-1.5 text-sm tabular-nums text-muted-foreground whitespace-nowrap">
          {benefit != null ? formatBriefPriceRub(benefit) : "—"}
        </td>
      ) : null}
      <td className="p-1.5">
        <Input
          value={row.note ?? ""}
          disabled={readOnly}
          className={cn(FIELD_CLASS, "min-w-[6rem]")}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </td>
      <td className="w-10 p-1.5">
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function PriceTableBlockEditor({
  block,
  readOnly,
  onPatch,
}: {
  block: MarketingBriefBlockRow;
  readOnly: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const p = asPriceTableBlock(block.payload);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateRows(rows: PriceTableRow[]) {
    onPatch({ rows });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = p.rows.findIndex((r) => r.id === active.id);
    const newIndex = p.rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateRows(arrayMove(p.rows, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3" data-testid="price-table-block-editor">
      <div className="space-y-1.5">
        <Label className="text-xs text-foreground">Заголовок таблицы</Label>
        <Input
          value={p.heading ?? ""}
          disabled={readOnly}
          className={FIELD_CLASS}
          onChange={(e) => onPatch({ heading: e.target.value })}
        />
        <p className="text-[10px] leading-snug text-muted-foreground">
          Например: «АКЦИИ ИЮНЯ» или «НОВЫЕ ЦЕНЫ».
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`show-benefit-${block.id}`}
          checked={p.show_benefit}
          disabled={readOnly}
          onCheckedChange={(v) => onPatch({ show_benefit: v })}
        />
        <Label htmlFor={`show-benefit-${block.id}`} className="text-xs text-foreground">
          Показывать выгоду
        </Label>
      </div>
      <div className="overflow-x-auto rounded-[7px] border border-card-border bg-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-card-border bg-background text-left text-xs text-muted-foreground">
                <th className="w-8 p-2" />
                <th className="p-2 font-medium">Модель</th>
                <th className="p-2 font-medium">Было ₽</th>
                <th className="p-2 font-medium">Стало ₽</th>
                {p.show_benefit ? <th className="p-2 font-medium">Выгода ₽</th> : null}
                <th className="p-2 font-medium">Комментарий</th>
                <th className="w-10 p-2" />
              </tr>
            </thead>
            <tbody>
              <SortableContext items={p.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {p.rows.map((row) => (
                  <SortablePriceRow
                    key={row.id}
                    row={row}
                    showBenefit={p.show_benefit}
                    readOnly={readOnly}
                    onChange={(patch) =>
                      updateRows(p.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))
                    }
                    onDelete={() => updateRows(p.rows.filter((r) => r.id !== row.id))}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 rounded-[6px] border-card-border bg-card text-foreground"
          onClick={() =>
            updateRows([
              ...p.rows,
              { id: newBriefBlockItemId(), model: "", price_old: null, price_new: null, note: "" },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добавить строку
        </Button>
      ) : null}
    </div>
  );
}
