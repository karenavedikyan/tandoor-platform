import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Gift,
  GripVertical,
  Hash,
  LayoutGrid,
  ListOrdered,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  Table2,
  Tags,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { mergeBlocksFromServer } from "@/lib/brief-blocks-editor-state";
import { BonusBlockEditor } from "@/components/marketing-brief/bonus-block-editor";
import { PriceTableBlockEditor } from "@/components/marketing-brief/price-table-block-editor";
import { ProductsBlockEditor } from "@/components/marketing-brief/products-block-editor";
import {
  asBonusBlock,
  asPriceTableBlock,
  asProductsBlock,
  productDisplayName,
} from "@/components/marketing-brief/marketing-brief-block-shared";
import {
  blockTypeLabel,
  createBlock,
  deleteBlock,
  listBlocks,
  reorderBlocks,
  updateBlock,
  type CalloutBlockPayload,
  type MarketingBriefBlockRow,
  type MarketingBriefBlockType,
  type SectionBlockPayload,
  type SegmentsBlockPayload,
  type TextBlockPayload,
} from "@/lib/marketing-briefs-api";

const BLOCKS_QUERY_KEY = "brief-blocks";

export const BRIEF_TOOLBAR_BLOCK_TYPES: ReadonlyArray<{
  type: MarketingBriefBlockType;
  label: string;
  Icon: LucideIcon;
}> = [
  { type: "section", label: "Добавить раздел", Icon: ListOrdered },
  { type: "text", label: "Добавить текст", Icon: Type },
  { type: "price_table", label: "Добавить таблицу", Icon: Table2 },
  { type: "products", label: "Добавить товары", Icon: Package },
  { type: "segments", label: "Добавить сегменты", Icon: Tags },
  { type: "bonus", label: "Добавить бонус", Icon: Gift },
];

export function BriefBlocksAddToolbar({
  onAdd,
  disabled,
  orientation = "vertical",
}: {
  onAdd: (type: MarketingBriefBlockType) => void;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <div
      className={cn(
        "rounded-[7px] border border-[#E8EAEE] bg-white shadow-sm",
        orientation === "vertical" ? "flex flex-col gap-1 p-2" : "flex flex-wrap gap-2 p-2",
      )}
      data-testid="brief-blocks-add-toolbar"
      role="toolbar"
      aria-label="Добавление блоков"
    >
      {BRIEF_TOOLBAR_BLOCK_TYPES.map(({ type, label, Icon }) => (
        <button
          key={type}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={() => onAdd(type)}
          data-testid={`button-add-block-type-${type}`}
          className={cn(
            "flex items-center justify-center rounded-[6px] text-[#8F96B0] transition-colors hover:bg-[#F9FAFF] hover:text-[#9ACA3C] disabled:pointer-events-none disabled:opacity-50",
            orientation === "vertical" ? "h-10 w-10" : "h-9 w-9",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function blockIcon(type: MarketingBriefBlockType) {
  switch (type) {
    case "section":
      return Hash;
    case "text":
      return Type;
    case "segments":
      return LayoutGrid;
    case "callout":
      return MessageCircle;
    case "products":
      return Package;
    case "price_table":
      return Tags;
    case "bonus":
      return Gift;
    default:
      return Hash;
  }
}

function blockSummary(block: MarketingBriefBlockRow): string {
  if (block.type === "section") return asSection(block.payload).title || "Раздел";
  if (block.type === "text") return asText(block.payload).heading || "Текст";
  if (block.type === "segments") return asSegments(block.payload).heading || "Сегменты";
  if (block.type === "callout") return asCallout(block.payload).heading || "Выноска";
  if (block.type === "products") {
    const pb = asProductsBlock(block.payload);
    if (pb.items.length === 0) return "Товары";
    return productDisplayName(pb.items[0]!);
  }
  if (block.type === "price_table") {
    const pt = asPriceTableBlock(block.payload);
    return pt.heading?.trim() || (pt.rows[0]?.model ?? "Прайс");
  }
  if (block.type === "bonus") {
    const bb = asBonusBlock(block.payload);
    return bb.heading?.trim() || (bb.items[0]?.trigger ?? "Бонус");
  }
  return blockTypeLabel(block.type);
}

function asSection(payload: Record<string, unknown>): SectionBlockPayload {
  return {
    number: typeof payload.number === "string" ? payload.number : "",
    title: typeof payload.title === "string" ? payload.title : "",
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : "",
  };
}

function asText(payload: Record<string, unknown>): TextBlockPayload {
  return {
    heading: typeof payload.heading === "string" ? payload.heading : "",
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

function asSegments(payload: Record<string, unknown>): SegmentsBlockPayload {
  const seg = payload.segments;
  const s =
    seg && typeof seg === "object" && !Array.isArray(seg) ? (seg as Record<string, unknown>) : {};
  return {
    heading: typeof payload.heading === "string" ? payload.heading : "",
    segments: {
      top150: typeof s.top150 === "string" ? s.top150 : "",
      top350: typeof s.top350 === "string" ? s.top350 : "",
      top500: typeof s.top500 === "string" ? s.top500 : "",
      top500plus: typeof s.top500plus === "string" ? s.top500plus : "",
    },
  };
}

function asCallout(payload: Record<string, unknown>): CalloutBlockPayload {
  const toneRaw = payload.tone;
  const tone =
    toneRaw === "warning" || toneRaw === "success" || toneRaw === "info" ? toneRaw : "info";
  return {
    tone,
    heading: typeof payload.heading === "string" ? payload.heading : "",
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

function AddBlockButtons({
  onAdd,
  disabled,
  variant = "inline",
}: {
  onAdd: (type: MarketingBriefBlockType) => void;
  disabled?: boolean;
  variant?: "inline" | "empty";
}) {
  const row1: MarketingBriefBlockType[] = ["section", "text"];
  const row2: MarketingBriefBlockType[] = ["segments", "callout"];
  const row3: MarketingBriefBlockType[] = ["products", "price_table", "bonus"];
  const rows = [row1, row2, row3];

  return (
    <div className={cn("flex flex-col gap-2", variant === "empty" && "items-center")}>
      {rows.map((types, ri) => (
        <div key={ri} className="flex flex-wrap gap-2 justify-center">
          {types.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={variant === "empty" ? "outline" : "secondary"}
              disabled={disabled}
              className={variant === "empty" ? "border-[#9ACA3C]/50" : undefined}
              onClick={() => onAdd(t)}
              data-testid={`button-add-block-type-${t}`}
            >
              {blockTypeLabel(t)}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}

function BlockFields({
  block,
  readOnly,
  onPatch,
}: {
  block: MarketingBriefBlockRow;
  readOnly: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  if (block.type === "section") {
    const p = asSection(block.payload);
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Номер раздела</Label>
          <Input
            value={p.number ?? ""}
            disabled={readOnly}
            placeholder="01"
            maxLength={3}
            onChange={(e) => onPatch({ number: e.target.value.slice(0, 3) })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            До 3 символов: «01», «02», «А», «B». Полное название идёт в «Заголовок».
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Заголовок</Label>
          <Input
            value={p.title}
            disabled={readOnly}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Краткое название раздела заглавными буквами, например: «УСЛОВИЯ ВЫСТАВЛЕНИЯ», «МЕЖКОМНАТНЫЕ ДВЕРИ».
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Подзаголовок</Label>
          <Input
            value={p.subtitle ?? ""}
            disabled={readOnly}
            onChange={(e) => onPatch({ subtitle: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Короткое уточнение под заголовком — необязательно. Например: «Для ТОП-350».
          </p>
        </div>
      </div>
    );
  }

  if (block.type === "text") {
    const p = asText(block.payload);
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Заголовок</Label>
          <Input
            value={p.heading ?? ""}
            disabled={readOnly}
            onChange={(e) => onPatch({ heading: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Необязательно. Если заполнено, идёт жирной строкой над текстом.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Текст</Label>
          <Textarea
            rows={6}
            className="font-mono text-sm"
            value={p.body}
            disabled={readOnly}
            onChange={(e) => onPatch({ body: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Основной абзац. Можно вставлять переносы строк — каждая новая строка становится отдельным абзацем.
          </p>
        </div>
      </div>
    );
  }

  if (block.type === "segments") {
    const p = asSegments(block.payload);
    const cols = [
      { key: "top150", label: "ТОП-150" },
      { key: "top350", label: "ТОП-350" },
      { key: "top500", label: "ТОП-500" },
      { key: "top500plus", label: "ТОП-500+" },
    ] as const;
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Заголовок</Label>
          <Input
            value={p.heading ?? ""}
            disabled={readOnly}
            onChange={(e) => onPatch({ heading: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Необязательно. Заголовок над четырьмя колонками.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {cols.map((col) => (
            <div key={col.key} className="space-y-1.5">
              <Label className="text-xs">{col.label}</Label>
              <Textarea
                rows={5}
                className="text-sm"
                disabled={readOnly}
                value={p.segments[col.key]}
                onChange={(e) =>
                  onPatch({
                    segments: { ...p.segments, [col.key]: e.target.value },
                  })
                }
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                Условия и проценты для этого сегмента. Можно несколько строк.
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "callout") {
    const p = asCallout(block.payload);
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Тон</Label>
          <Select
            value={p.tone}
            disabled={readOnly}
            onValueChange={(v) => onPatch({ tone: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Информация</SelectItem>
              <SelectItem value="warning">Внимание</SelectItem>
              <SelectItem value="success">Успех</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Тип акцента: «info» — нейтрально, «warning» — внимание, «success» — позитив.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Заголовок</Label>
          <Input
            value={p.heading ?? ""}
            disabled={readOnly}
            onChange={(e) => onPatch({ heading: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            Опционально. Если заполнено — выводится плакаткой над текстом.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Текст</Label>
          <Textarea
            rows={4}
            value={p.body}
            disabled={readOnly}
            onChange={(e) => onPatch({ body: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">Основное сообщение.</p>
        </div>
      </div>
    );
  }

  if (block.type === "products") {
    return <ProductsBlockEditor block={block} readOnly={readOnly} onPatch={onPatch} />;
  }
  if (block.type === "price_table") {
    return <PriceTableBlockEditor block={block} readOnly={readOnly} onPatch={onPatch} />;
  }
  if (block.type === "bonus") {
    return <BonusBlockEditor block={block} readOnly={readOnly} onPatch={onPatch} />;
  }

  return null;
}

function SortableBlockCard({
  block,
  readOnly,
  saveState,
  onPatch,
  onDelete,
  onAddBelow,
}: {
  block: MarketingBriefBlockRow;
  readOnly: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddBelow: (type: MarketingBriefBlockType) => void;
}) {
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: readOnly,
  });

  const Icon = blockIcon(block.type);
  const summary = blockSummary(block);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("border-border/80", isDragging && "z-10 opacity-90 shadow-lg")}
      data-testid={`brief-block-card-${block.id}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-start gap-2 space-y-0 p-3 pb-2">
          {!readOnly ? (
            <button
              type="button"
              className="mt-1 flex h-10 min-h-10 w-10 min-w-10 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label="Перетащить блок"
              data-testid={`brief-block-drag-${block.id}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <Icon className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
              <span className="truncate text-sm font-medium text-[#222631]">
                {blockTypeLabel(block.type)}: «{summary}»
              </span>
            </button>
          </CollapsibleTrigger>
          <span
            className={cn(
              "shrink-0 text-[10px]",
              saveState === "error"
                ? "text-destructive"
                : saveState === "saved"
                  ? "text-emerald-700"
                  : "text-muted-foreground",
            )}
          >
            {saveState === "saving" ? "Сохраняется…" : saveState === "saved" ? "Сохранено" : null}
          </span>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 px-3 pb-3 pt-0">
            <BlockFields block={block} readOnly={readOnly} onPatch={onPatch} />
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                  Удалить
                </Button>
                <Popover open={addOpen} onOpenChange={setAddOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1">
                      <Plus className="h-4 w-4" aria-hidden />
                      Добавить блок ниже
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <p className="mb-2 px-1 text-xs text-muted-foreground">Тип блока</p>
                    <AddBlockButtons
                      onAdd={(t) => {
                        setAddOpen(false);
                        onAddBelow(t);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блок</AlertDialogTitle>
            <AlertDialogDescription>Блок будет удалён без возможности восстановления.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function BriefBlocksEditor({
  briefId,
  canEdit,
  externalAddToolbar = false,
  registerAddBlock,
}: {
  briefId: string;
  canEdit: boolean;
  /** Скрыть встроенные кнопки добавления — используется внешний тулбар */
  externalAddToolbar?: boolean;
  /** Коллбэк для регистрации добавления блока в конец списка */
  registerAddBlock?: (addBlock: (type: MarketingBriefBlockType) => void) => void;
}) {
  const qc = useQueryClient();
  const readOnly = !canEdit;

  const blocksQ = useQuery({
    queryKey: [BLOCKS_QUERY_KEY, briefId],
    queryFn: () => listBlocks(briefId),
    enabled: Boolean(briefId),
  });

  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [saveById, setSaveById] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatchRef = useRef<Record<string, Record<string, unknown>>>({});
  const dirtyBlockIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!blocksQ.data) return;
    setBlocks((prev) => mergeBlocksFromServer(blocksQ.data, prev, dirtyBlockIdsRef.current));
  }, [blocksQ.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const scheduleSave = useCallback(
    (blockId: string, patch: Record<string, unknown>) => {
      if (readOnly) return;
      pendingPatchRef.current[blockId] = {
        ...(pendingPatchRef.current[blockId] ?? {}),
        ...patch,
      };
      if (timersRef.current[blockId]) clearTimeout(timersRef.current[blockId]);
      timersRef.current[blockId] = setTimeout(() => {
        const merged = pendingPatchRef.current[blockId];
        delete pendingPatchRef.current[blockId];
        if (!merged || Object.keys(merged).length === 0) return;

        void (async () => {
          setSaveById((s) => ({ ...s, [blockId]: "saving" }));
          try {
            await updateBlock(blockId, merged);
            setBlocks((prev) =>
              prev.map((b) =>
                b.id === blockId ? { ...b, updated_at: new Date().toISOString() } : b,
              ),
            );
            setSaveById((s) => ({ ...s, [blockId]: "saved" }));
            if (!pendingPatchRef.current[blockId]) {
              dirtyBlockIdsRef.current.delete(blockId);
            }
          } catch (e) {
            setSaveById((s) => ({ ...s, [blockId]: "error" }));
            toast({
              title: "Не удалось сохранить блок",
              description: e instanceof Error ? e.message : undefined,
              variant: "destructive",
            });
          }
        })();
      }, 800);
    },
    [readOnly],
  );

  const handlePatch = useCallback(
    (blockId: string, patch: Record<string, unknown>) => {
      dirtyBlockIdsRef.current.add(blockId);
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, payload: { ...b.payload, ...patch } } : b)),
      );
      scheduleSave(blockId, patch);
    },
    [scheduleSave],
  );

  useEffect(() => {
    return () => {
      for (const [blockId, patch] of Object.entries(pendingPatchRef.current)) {
        if (patch && Object.keys(patch).length > 0) {
          void updateBlock(blockId, patch).catch(() => {});
        }
      }
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
    };
  }, []);

  const handleAdd = useCallback(
    async (type: MarketingBriefBlockType, insertAfterId?: string) => {
      try {
        const created = await createBlock({
          brief_id: briefId,
          type,
          insert_after_id: insertAfterId,
        });
        await qc.invalidateQueries({ queryKey: [BLOCKS_QUERY_KEY, briefId] });
        const fresh = await listBlocks(briefId);
        setBlocks((prev) => mergeBlocksFromServer(fresh, prev, dirtyBlockIdsRef.current));
        setSaveById((s) => ({ ...s, [created.id]: "saved" }));
      } catch (e) {
        toast({
          title: "Не удалось добавить блок",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      }
    },
    [briefId, qc],
  );

  useEffect(() => {
    if (!registerAddBlock) return;
    registerAddBlock((type) => {
      void handleAdd(type);
    });
  }, [registerAddBlock, handleAdd]);

  async function handleDelete(blockId: string) {
    try {
      await deleteBlock(blockId);
      dirtyBlockIdsRef.current.delete(blockId);
      delete pendingPatchRef.current[blockId];
      if (timersRef.current[blockId]) clearTimeout(timersRef.current[blockId]);
      const fresh = await listBlocks(briefId);
      setBlocks((prev) => mergeBlocksFromServer(fresh, prev, dirtyBlockIdsRef.current));
      void qc.invalidateQueries({ queryKey: [BLOCKS_QUERY_KEY, briefId] });
    } catch (e) {
      toast({
        title: "Не удалось удалить блок",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || readOnly) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(next);

    try {
      const saved = await reorderBlocks(
        briefId,
        next.map((b) => b.id),
      );
      dirtyBlockIdsRef.current.clear();
      setBlocks(saved);
      void qc.invalidateQueries({ queryKey: [BLOCKS_QUERY_KEY, briefId] });
    } catch (e) {
      setBlocks(blocksQ.data ?? blocks);
      toast({
        title: "Не удалось изменить порядок",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  if (blocksQ.isLoading) {
    return (
      <div className="flex justify-center py-8" data-testid="brief-blocks-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (blocksQ.isError) {
    return (
      <p className="text-sm text-destructive" data-testid="brief-blocks-error">
        Не удалось загрузить блоки
      </p>
    );
  }

  return (
    <section className="space-y-4" data-testid="brief-blocks-editor">
      <h2 className="text-sm font-semibold text-[#222631]">Блоки</h2>

      {blocks.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-10 text-center"
          data-testid="brief-blocks-empty"
        >
          <p className="text-sm text-muted-foreground">Добавьте первый блок с помощью панели добавления</p>
          {!readOnly && !externalAddToolbar ? (
            <AddBlockButtons variant="empty" onAdd={(t) => void handleAdd(t)} />
          ) : null}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block) => (
                <SortableBlockCard
                  key={block.id}
                  block={block}
                  readOnly={readOnly}
                  saveState={saveById[block.id] ?? "idle"}
                  onPatch={(patch) => handlePatch(block.id, patch)}
                  onDelete={() => void handleDelete(block.id)}
                  onAddBelow={(type) => void handleAdd(type, block.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && !externalAddToolbar && blocks.length > 0 ? (
        <div className="pt-2">
          <p className="mb-2 text-xs text-muted-foreground">Добавить в конец</p>
          <AddBlockButtons onAdd={(t) => void handleAdd(t)} />
        </div>
      ) : null}
    </section>
  );
}
