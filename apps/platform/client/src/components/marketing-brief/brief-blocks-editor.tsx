import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
  ChevronDown,
  Gift,
  GripVertical,
  Link2,
  ListOrdered,
  Loader2,
  Package,
  Plus,
  Table2,
  Tags,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  wrapBriefTextSelection,
  type BriefInlineWrapKind,
} from "@/components/marketing-brief/marketing-brief-blocks-published";
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

const FIELD_CLASS =
  "rounded-[6px] border border-[#E8EAEE] bg-[#F9FAFF] text-[#222631] focus-visible:ring-[#9ACA3C]/30";
const LABEL_CLASS = "text-xs text-[#222631]";
const HINT_CLASS = "text-[10px] leading-snug text-[#8F96B0]";
const ACTION_BTN_CLASS =
  "h-9 gap-1.5 rounded-[6px] border border-[#E8EAEE] bg-white px-3 text-sm text-[#343F5B] hover:bg-[#F9FAFF]";

function blockCardTitle(type: MarketingBriefBlockType): string {
  switch (type) {
    case "price_table":
      return "Таблица";
    case "callout":
      return "Выноска";
    default:
      return blockTypeLabel(type);
  }
}

function blockSaveStatusLabel(saveState: "idle" | "saving" | "saved" | "error"): string | null {
  if (saveState === "saving") return "Сохраняется…";
  if (saveState === "saved") return "Сохранено";
  if (saveState === "error") return "Ошибка";
  return null;
}

function applyFormatToField(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  onChange: (next: string) => void,
  kind: BriefInlineWrapKind,
) {
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  let linkUrl: string | undefined;
  if (kind === "link") {
    const url = window.prompt("Адрес ссылки", "https://");
    if (url == null) return;
    linkUrl = url;
  }
  const next = wrapBriefTextSelection(value, start, end, kind, linkUrl);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const cursor = start + (next.length - value.length);
    el.setSelectionRange(cursor, cursor);
  });
}

function TextFormatToolbar({
  inputRef,
  value,
  onChange,
  disabled,
}: {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const btnClass =
    "flex h-8 w-8 items-center justify-center rounded-[6px] text-sm font-semibold text-[#8F96B0] transition-colors hover:bg-[#F9FAFF] hover:text-[#9ACA3C] disabled:pointer-events-none disabled:opacity-40";

  function format(kind: BriefInlineWrapKind) {
    applyFormatToField(inputRef.current, value, onChange, kind);
  }

  return (
    <div className="flex flex-wrap gap-1 pt-1" role="toolbar" aria-label="Форматирование текста">
      <button type="button" className={btnClass} disabled={disabled} aria-label="Жирный" onClick={() => format("bold")}>
        B
      </button>
      <button
        type="button"
        className={cn(btnClass, "italic font-normal")}
        disabled={disabled}
        aria-label="Курсив"
        onClick={() => format("italic")}
      >
        I
      </button>
      <button type="button" className={btnClass} disabled={disabled} aria-label="Подчёркнутый" onClick={() => format("underline")}>
        <span className="underline">U</span>
      </button>
      <button type="button" className={btnClass} disabled={disabled} aria-label="Ссылка" onClick={() => format("link")}>
        <Link2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function FormattedTextInput({
  label,
  value,
  onChange,
  disabled,
  multiline = false,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  return (
    <div className="space-y-1.5">
      <Label className={LABEL_CLASS}>{label}</Label>
      {multiline ? (
        <Textarea
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          rows={rows}
          className={cn(FIELD_CLASS, "font-mono text-sm")}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          ref={inputRef as RefObject<HTMLInputElement>}
          className={FIELD_CLASS}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <TextFormatToolbar inputRef={inputRef} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
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
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className={LABEL_CLASS}>Номер раздела</Label>
          <Input
            value={p.number ?? ""}
            disabled={readOnly}
            placeholder="01"
            maxLength={3}
            className={FIELD_CLASS}
            onChange={(e) => onPatch({ number: e.target.value.slice(0, 3) })}
          />
          <p className={HINT_CLASS}>До 3 символов: «01», «02», «А», «В».</p>
        </div>
        <div className="space-y-1.5">
          <Label className={LABEL_CLASS}>Заголовок раздела</Label>
          <Input
            value={p.title}
            disabled={readOnly}
            className={FIELD_CLASS}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={LABEL_CLASS}>Подзаголовок раздела</Label>
          <Input
            value={p.subtitle ?? ""}
            disabled={readOnly}
            className={FIELD_CLASS}
            onChange={(e) => onPatch({ subtitle: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (block.type === "text") {
    const p = asText(block.payload);
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[#222631]">Текст</p>
        <FormattedTextInput
          label="Заголовок текста"
          value={p.heading ?? ""}
          disabled={readOnly}
          onChange={(heading) => onPatch({ heading })}
        />
        <FormattedTextInput
          label="Текст"
          value={p.body}
          disabled={readOnly}
          multiline
          rows={6}
          onChange={(body) => onPatch({ body })}
        />
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
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#222631]">Таблица</p>
        <PriceTableBlockEditor block={block} readOnly={readOnly} onPatch={onPatch} />
      </div>
    );
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: readOnly,
  });

  const summary = blockSummary(block);
  const saveLabel = blockSaveStatusLabel(saveState);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex overflow-hidden rounded-[7px] border border-[#E8EAEE] bg-white",
        isDragging && "z-10 opacity-90 shadow-lg",
      )}
      data-testid={`brief-block-card-${block.id}`}
    >
      <div className="w-1.5 shrink-0 bg-[#9ACA3C]" aria-hidden />
      <div className="min-w-0 flex-1">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-start gap-2 px-4 pb-3 pt-4 sm:px-5">
            {!readOnly ? (
              <button
                type="button"
                className="mt-0.5 flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-[6px] text-[#8F96B0] hover:bg-[#F9FAFF] active:cursor-grabbing"
                aria-label="Перетащить блок"
                data-testid={`brief-block-drag-${block.id}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="min-w-0 flex-1 text-left">
                  <span className="text-xl font-semibold text-[#222631]">{blockCardTitle(block.type)}</span>
                  <p className="mt-0.5 truncate text-xs text-[#8F96B0]">{summary}</p>
                </button>
              </CollapsibleTrigger>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {saveLabel ? (
                  <span
                    className={cn(
                      "text-sm",
                      saveState === "error"
                        ? "text-destructive"
                        : saveState === "saved"
                          ? "text-[#9ACA3C]"
                          : "text-[#8F96B0]",
                    )}
                  >
                    {saveLabel}
                  </span>
                ) : null}
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8F96B0] hover:bg-[#F9FAFF]"
                    aria-label={open ? "Свернуть блок" : "Развернуть блок"}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                </CollapsibleTrigger>
              </div>
            </div>
          </div>
          <CollapsibleContent>
            <div className="space-y-4 px-4 pb-4 sm:px-5">
              <BlockFields block={block} readOnly={readOnly} onPatch={onPatch} />
              {!readOnly ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#E8EAEE] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={ACTION_BTN_CLASS}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 text-[#8F96B0]" aria-hidden />
                    Удалить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={ACTION_BTN_CLASS}
                    onClick={() => onAddBelow("text")}
                  >
                    <Plus className="h-4 w-4 text-[#8F96B0]" aria-hidden />
                    Добавить текст
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={ACTION_BTN_CLASS}
                    onClick={() => onAddBelow("price_table")}
                  >
                    <Plus className="h-4 w-4 text-[#8F96B0]" aria-hidden />
                    Добавить таблицу
                  </Button>
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

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
    </div>
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
