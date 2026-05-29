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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { asBonusBlock, newBriefBlockItemId } from "@/components/marketing-brief/marketing-brief-block-shared";
import type { BonusBlockItem, MarketingBriefBlockRow } from "@/lib/marketing-briefs-api";
import { cn } from "@/lib/utils";

function SortableBonusCard({
  item,
  readOnly,
  onChange,
  onDelete,
}: {
  item: BonusBlockItem;
  readOnly: boolean;
  onChange: (patch: Partial<BonusBlockItem>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/70 bg-card p-3 space-y-2",
        isDragging && "shadow-md",
      )}
    >
      <div className="flex gap-2">
        {!readOnly ? (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Перетащить"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">За что</Label>
            <Input
              value={item.trigger}
              disabled={readOnly}
              onChange={(e) => onChange({ trigger: e.target.value })}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">
              Конкретное действие, за которое даётся бонус. Например: «За продажу VIP-дверей».
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Сколько / что получает</Label>
            <Textarea
              rows={2}
              value={item.reward}
              disabled={readOnly}
              onChange={(e) => onChange({ reward: e.target.value })}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">
              Размер вознаграждения. Например: «1000 руб», «5% от продажи».
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Кому</Label>
            <Input
              value={item.audience ?? ""}
              disabled={readOnly}
              onChange={(e) => onChange({ audience: e.target.value })}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">Менеджер, ТП, ROP — кто получает.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Условия</Label>
            <Textarea
              rows={2}
              value={item.conditions ?? ""}
              disabled={readOnly}
              onChange={(e) => onChange({ conditions: e.target.value })}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">При каких условиях. Например: «От 10 шт.».</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Срок действия</Label>
              <Input
                type="date"
                value={item.valid_until ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange({ valid_until: e.target.value || undefined })}
              />
              <p className="text-[10px] leading-snug text-muted-foreground">Дата окончания акции.</p>
            </div>
            <div className="flex flex-col gap-1 pb-1">
              <div className="flex items-end gap-2">
                <Checkbox
                  id={`photo-${item.id}`}
                  checked={item.require_photo_report === true}
                  disabled={readOnly}
                  onCheckedChange={(v) => onChange({ require_photo_report: v === true })}
                />
                <Label htmlFor={`photo-${item.id}`} className="text-xs font-normal">
                  Требуется фотоотчёт
                </Label>
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Включи, если нужно фотоподтверждение продажи.
              </p>
            </div>
          </div>
        </div>
        {!readOnly ? (
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function BonusBlockEditor({
  block,
  readOnly,
  onPatch,
}: {
  block: MarketingBriefBlockRow;
  readOnly: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const p = asBonusBlock(block.payload);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateItems(items: BonusBlockItem[]) {
    onPatch({ items });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = p.items.findIndex((i) => i.id === active.id);
    const newIndex = p.items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateItems(arrayMove(p.items, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3" data-testid="bonus-block-editor">
      <div className="space-y-1.5">
        <Label className="text-xs">Заголовок</Label>
        <Input
          value={p.heading ?? ""}
          disabled={readOnly}
          onChange={(e) => onPatch({ heading: e.target.value })}
        />
        <p className="text-[10px] leading-snug text-muted-foreground">
          Опционально. По умолчанию: «БОНУС ЗА ПРОДАЖУ».
        </p>
      </div>
      {p.items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={p.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {p.items.map((item) => (
                <SortableBonusCard
                  key={item.id}
                  item={item}
                  readOnly={readOnly}
                  onChange={(patch) =>
                    updateItems(p.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
                  }
                  onDelete={() => updateItems(p.items.filter((i) => i.id !== item.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">Условия не добавлены</p>
      )}
      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() =>
            updateItems([
              ...p.items,
              {
                id: newBriefBlockItemId(),
                trigger: "",
                reward: "",
                require_photo_report: false,
              },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добавить условие
        </Button>
      ) : null}
    </div>
  );
}
