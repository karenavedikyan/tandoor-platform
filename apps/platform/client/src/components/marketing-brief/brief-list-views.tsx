import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, MoreHorizontal, Share2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { BriefVisibilityIcon } from "@/components/marketing-brief/brief-visibility-ui";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  briefDisplayTitle,
  buildPublicBriefShareUrl,
  formatBriefUpdatedAt,
  formatMarketingBriefPeriodLabel,
  getBrief,
  listBlocks,
  updateBrief,
  type MarketingBriefBlockRow,
  type MarketingBriefCategory,
  type MarketingBriefRow,
  type MarketingBriefVisibility,
} from "@/lib/marketing-briefs-api";
import { CategoryBadge } from "@/components/marketing/CategoryBadge";
import { isBriefNew } from "@/lib/marketing-briefs-utils";
import { cn } from "@/lib/utils";

function BriefNewBadge({ briefId }: { briefId: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[#9ACA3C] px-2 py-0.5 text-xs font-medium text-[#222631]"
      data-testid={`badge-brief-new-${briefId}`}
      title="Опубликовано за последние 7 дней"
    >
      Новое
    </span>
  );
}

export type BriefListViewMode = "cards" | "table" | "compact";

export const MARKETING_BRIEF_CATEGORY_SECTIONS: ReadonlyArray<{
  category: MarketingBriefCategory;
  label: string;
}> = [
  { category: "brief", label: "Брифы" },
  { category: "promo", label: "Акции" },
  { category: "info", label: "Информация" },
  { category: "letter", label: "Информационные письма" },
];

export const BRIEF_LIST_VIEW_MODE_KEY = "marketing-briefs:view-mode";

export function readBriefListViewMode(): BriefListViewMode {
  try {
    const v = localStorage.getItem(BRIEF_LIST_VIEW_MODE_KEY);
    if (v === "cards" || v === "table" || v === "compact") return v;
  } catch {
    /* ignore */
  }
  return "cards";
}

export function writeBriefListViewMode(mode: BriefListViewMode): void {
  try {
    localStorage.setItem(BRIEF_LIST_VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function formatBriefCreatedAt(iso: string): string {
  return formatBriefUpdatedAt(iso);
}

function formatBriefUpdatedShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

async function copyBriefLink(briefId: string) {
  try {
    await navigator.clipboard.writeText(buildPublicBriefShareUrl(briefId));
    toast({ description: "Ссылка скопирована" });
  } catch {
    toast({ variant: "destructive", description: "Не удалось скопировать ссылку" });
  }
}

function BriefStatusDot({ status }: { status: MarketingBriefRow["status"] }) {
  const cls =
    status === "published"
      ? "bg-emerald-500"
      : status === "archived"
        ? "bg-amber-500"
        : "bg-muted-foreground/50";
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", cls)}
      aria-label={status}
      data-testid={`brief-status-dot-${status}`}
    />
  );
}

export type BriefListSelection = {
  selectedIds: string[];
  selectionActive: boolean;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
};

function SelectAllCheckbox({
  selection,
  selectAllRef,
  "aria-label": ariaLabel,
}: {
  selection: BriefListSelection;
  selectAllRef?: RefObject<HTMLInputElement>;
  "aria-label"?: string;
}) {
  const { allSelected, someSelected, onToggleAll } = selection;

  useEffect(() => {
    if (selectAllRef?.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [allSelected, someSelected, selectAllRef]);

  if (selectAllRef) {
    return (
      <input
        ref={selectAllRef}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border border-primary accent-primary"
        checked={allSelected}
        onChange={onToggleAll}
        aria-label={ariaLabel ?? "Выбрать все на странице"}
        data-testid="checkbox-select-all-briefs"
      />
    );
  }

  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={onToggleAll}
      aria-label={ariaLabel ?? "Выбрать все на странице"}
      data-testid="checkbox-select-all-briefs"
    />
  );
}

export function BriefCardsSelectAllLink({ selection }: { selection: BriefListSelection }) {
  const { allSelected, onToggleAll } = selection;
  return (
    <button
      type="button"
      className="text-xs text-primary underline-offset-2 hover:underline"
      onClick={onToggleAll}
      data-testid="link-select-all-briefs-cards"
    >
      {allSelected ? "Снять выделение со всех" : "Выбрать все на странице"}
    </button>
  );
}

export function BriefStatusBadge({
  status,
  className,
  onAccent = false,
}: {
  status: MarketingBriefRow["status"];
  className?: string;
  /** Бейдж на зелёной опубликованной карточке */
  onAccent?: boolean;
}) {
  const map = {
    published: {
      label: "Опубликовано",
      cls: onAccent
        ? "bg-white text-[#9ACA3C]"
        : "bg-[#9ACA3C]/15 text-[#7a9e2f] border border-[#9ACA3C]/30",
    },
    draft: {
      label: "Черновик",
      cls: onAccent ? "bg-white text-[#343F5B]" : "bg-background text-foreground border border-card-border",
    },
    archived: {
      label: "Архивировано",
      cls: onAccent ? "bg-white text-[#8F96B0]" : "bg-background text-muted-foreground border border-card-border",
    },
  } as const;
  const m = map[status] ?? map.draft;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  );
}

export type BriefRowMenuHandlers = {
  onOpen: (brief: MarketingBriefRow) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onMutate: () => void;
};

function BriefRowActionsMenu({
  brief,
  canManage,
  handlers,
  compact = false,
}: {
  brief: MarketingBriefRow;
  canManage: boolean;
  handlers: BriefRowMenuHandlers;
  /** Иконка «…» на цветной плашке карточки */
  compact?: boolean;
}) {
  if (!canManage) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0",
              compact && "h-9 w-9 bg-white/20 text-white hover:bg-white/30 hover:text-white",
            )}
            aria-label="Действия"
            data-testid={`button-brief-actions-${brief.id}`}
            data-no-print="true"
          >
            <MoreHorizontal className={cn("h-4 w-4", compact && "text-white")} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href={`/marketing-briefs/view/${brief.id}`}>Открыть</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const visibility = brief.visibility ?? "private";
  const isPublished = brief.status === "published";
  const isPublic = visibility === "public";

  async function handleRename() {
    const next = window.prompt("Название брифа", brief.title);
    if (!next?.trim() || next.trim() === brief.title.trim()) return;
    try {
      await updateBrief(brief.id, { title: next.trim() });
      toast({ title: "Название сохранено" });
      handlers.onMutate();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Не удалось сохранить название",
      });
    }
  }

  async function handleVisibility(next: MarketingBriefVisibility) {
    if (next === visibility) return;
    try {
      await updateBrief(brief.id, { visibility: next });
      toast({ title: "Доступ обновлён" });
      handlers.onMutate();
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "Не удалось обновить доступ",
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            compact && "h-9 w-9 bg-white/20 text-white hover:bg-white/30 hover:text-white",
          )}
          aria-label="Действия"
          data-testid={`button-brief-actions-${brief.id}`}
          data-no-print="true"
        >
          <MoreHorizontal className={cn("h-4 w-4", compact && "text-white")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onOpen(brief)}>
          Открыть
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => void handleRename()}>
          Переименовать
        </DropdownMenuItem>
        {isPublic ? (
          <DropdownMenuItem className="cursor-pointer" onClick={() => void handleVisibility("private")}>
            Сделать приватным
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="cursor-pointer" onClick={() => void handleVisibility("public")}>
            Сделать публичным
          </DropdownMenuItem>
        )}
        {isPublished && isPublic ? (
          <DropdownMenuItem className="cursor-pointer" onClick={() => void copyBriefLink(brief.id)}>
            Поделиться ссылкой
          </DropdownMenuItem>
        ) : null}
        {(brief.status === "draft" || brief.status === "archived") && handlers.onPublish ? (
          <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onPublish!(brief.id)}>
            Опубликовать
          </DropdownMenuItem>
        ) : null}
        {brief.status === "published" && handlers.onUnpublish ? (
          <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onUnpublish!(brief.id)}>
            Снять с публикации
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {brief.status !== "archived" ? (
          <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onArchive(brief.id)}>
            Архивировать
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onRestore(brief.id)}>
            Восстановить
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => handlers.onDelete(brief.id)}
        >
          Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BriefPreviewDialog({
  previewId,
  briefs,
  canManage,
  onClose,
  onOpenEditor,
}: {
  previewId: string | null;
  briefs: MarketingBriefRow[];
  canManage: boolean;
  onClose: () => void;
  onOpenEditor: (id: string) => void;
}) {
  const listBrief = previewId ? briefs.find((b) => b.id === previewId) : undefined;
  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewId) {
      setBrief(null);
      setBlocks([]);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBrief(previewId);
        if (cancelled) return;
        const allowDraft = canManage;
        if (data.brief.status !== "published" && !allowDraft) {
          setBrief(null);
          setError("not_found");
          return;
        }
        setBrief(data.brief);
        try {
          const blockRows = await listBlocks(data.brief.id);
          if (!cancelled) setBlocks(blockRows);
        } catch {
          if (!cancelled) setBlocks([]);
        }
      } catch {
        if (!cancelled) {
          setBrief(null);
          setError("not_found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewId, canManage]);

  const displayBrief = brief ?? listBrief;
  const title = displayBrief ? briefDisplayTitle(displayBrief.title).text : "Без названия";

  async function handleShareFromPreview() {
    if (!displayBrief) return;
    try {
      await navigator.clipboard.writeText(buildPublicBriefShareUrl(displayBrief.id));
      toast({
        description:
          (displayBrief.visibility ?? "private") === "public"
            ? "Ссылка скопирована — откроется любому"
            : "Ссылка скопирована — требуется вход в ЛК",
      });
    } catch {
      toast({ variant: "destructive", description: "Не удалось скопировать ссылку" });
    }
  }

  return (
    <Dialog open={previewId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl"
        data-testid="dialog-brief-preview"
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4" data-no-print="true">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Предпросмотр</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : error || !displayBrief ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Не удалось загрузить бриф</p>
          ) : (
            <BrandBriefView
              brief={displayBrief}
              blocks={blocks}
              readOnly
              embed
              previewMode={canManage && displayBrief.status !== "published"}
            />
          )}
        </div>
        <DialogFooter
          className="flex shrink-0 flex-wrap gap-2 border-t bg-background px-6 py-3"
          data-no-print="true"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleShareFromPreview()}
            disabled={!displayBrief}
            data-testid="button-brief-preview-share"
          >
            <Share2 className="mr-2 h-4 w-4" aria-hidden />
            Поделиться
          </Button>
          {displayBrief && canManage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenEditor(displayBrief.id);
              }}
              data-testid="button-brief-preview-edit"
            >
              Открыть для редактирования
            </Button>
          ) : displayBrief ? (
            <Button type="button" variant="outline" asChild>
              <Link href={`/marketing-briefs/view/${displayBrief.id}`}>Открыть</Link>
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketingBriefCard({
  brief: b,
  canManage,
  selection,
  selectionActive,
  menuHandlers,
  onPreview,
}: {
  brief: MarketingBriefRow;
  canManage: boolean;
  selection: BriefListSelection | null;
  selectionActive: boolean;
  menuHandlers: BriefRowMenuHandlers;
  onPreview: (id: string) => void;
}) {
  const selected = selection?.isSelected(b.id) ?? false;
  const isPublished = b.status === "published";
  const isArchived = b.status === "archived";
  const openPreview = () => onPreview(b.id);
  const titleText = briefDisplayTitle(b.title).text;

  return (
    <article
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-[7px] border p-4 transition-shadow hover:shadow-sm",
        isPublished ? "border-[#9ACA3C] bg-[#9ACA3C]" : "border-card-border bg-card",
        isArchived && !isPublished && "opacity-80",
      )}
      data-testid={`card-marketing-brief-${b.id}`}
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPreview();
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className="min-h-8 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {canManage && selection ? (
            <Checkbox
              checked={selected}
              onCheckedChange={() => selection.onToggle(b.id)}
              aria-label={`Выбрать ${b.title}`}
              data-testid={`checkbox-brief-${b.id}`}
              className={cn(
                "border-card-border data-[state=checked]:border-[#9ACA3C] data-[state=checked]:bg-[#9ACA3C]",
                isPublished && "border-white/60 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#9ACA3C]",
                !selected && !selectionActive && "opacity-0 group-hover:opacity-100",
              )}
            />
          ) : null}
        </div>
        <div
          data-no-print="true"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <BriefRowActionsMenu
            brief={b}
            canManage={canManage}
            handlers={menuHandlers}
            compact={isPublished}
          />
        </div>
      </div>

      <h3
        className={cn(
          "text-xl font-semibold leading-snug",
          isPublished ? "text-white" : isArchived ? "text-muted-foreground" : "text-foreground",
        )}
        data-testid={`title-${b.id}`}
      >
        {titleText}
      </h3>
      <p
        className={cn(
          "mt-1 text-base font-normal",
          isPublished ? "text-white/90" : "text-muted-foreground",
        )}
      >
        {formatMarketingBriefPeriodLabel(b.period_label)}
      </p>

      <div
        className={cn(
          "mt-3 inline-flex w-fit flex-wrap items-center gap-1.5 rounded-md px-2 py-1",
          isPublished ? "bg-white/95" : "bg-background",
        )}
      >
        <CategoryBadge category={b.category ?? "brief"} />
        <BriefStatusBadge status={b.status} onAccent={isPublished} />
        {b.status === "published" && isBriefNew(b.published_at) ? <BriefNewBadge briefId={b.id} /> : null}
      </div>

      <p
        className={cn(
          "mt-auto pt-3 text-[10px]",
          isPublished ? "text-white/80" : "text-muted-foreground",
        )}
      >
        {b.author_name ? `${b.author_name} · ` : ""}
        обновлено {formatBriefUpdatedAt(b.updated_at)}
      </p>
    </article>
  );
}

function AddActivityTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-2 self-center py-4"
      onClick={onClick}
      data-testid="button-add-marketing-activity"
    >
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-card-border bg-card text-3xl font-light text-[#9ACA3C] transition-colors hover:border-[#9ACA3C]/50">
        +
      </span>
      <span className="text-xs text-muted-foreground">Добавить активность</span>
    </button>
  );
}

function buildDefaultExpandedState(briefs: MarketingBriefRow[]): Record<MarketingBriefCategory, boolean> {
  const counts = new Map<MarketingBriefCategory, number>();
  for (const section of MARKETING_BRIEF_CATEGORY_SECTIONS) {
    counts.set(section.category, 0);
  }
  for (const b of briefs) {
    const cat = b.category ?? "brief";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  let firstExpanded = false;
  const state = {} as Record<MarketingBriefCategory, boolean>;
  for (const section of MARKETING_BRIEF_CATEGORY_SECTIONS) {
    const hasItems = (counts.get(section.category) ?? 0) > 0;
    if (!firstExpanded && hasItems) {
      state[section.category] = true;
      firstExpanded = true;
    } else {
      state[section.category] = false;
    }
  }
  return state;
}

function BriefCategorySection({
  label,
  category,
  briefs,
  expanded,
  onToggleExpanded,
  canManage,
  selection,
  selectionActive,
  menuHandlers,
  onPreview,
  onSelectAllInSection,
  onAddActivity,
}: {
  label: string;
  category: MarketingBriefCategory;
  briefs: MarketingBriefRow[];
  expanded: boolean;
  onToggleExpanded: () => void;
  canManage: boolean;
  selection: BriefListSelection | null;
  selectionActive: boolean;
  menuHandlers: BriefRowMenuHandlers;
  onPreview: (id: string) => void;
  onSelectAllInSection: (category: MarketingBriefCategory) => void;
  onAddActivity?: () => void;
}) {
  const sectionBriefs = briefs.filter((b) => (b.category ?? "brief") === category);
  const sectionIds = sectionBriefs.map((b) => b.id);
  const allSectionSelected =
    sectionIds.length > 0 && sectionIds.every((id) => selection?.isSelected(id) ?? false);

  return (
    <section className="space-y-4" data-testid={`section-marketing-briefs-category-${category}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold text-foreground">{label}</h2>
        {canManage && selection && sectionIds.length > 0 ? (
          <button
            type="button"
            className="text-base text-[#9ACA3C] underline underline-offset-2 hover:text-[#7a9e2f]"
            onClick={() => onSelectAllInSection(category)}
            data-testid={`link-select-all-category-${category}`}
          >
            {allSectionSelected ? "Снять выделение в разделе" : "Выбрать все в разделе"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sectionBriefs.map((b) => (
            <MarketingBriefCard
              key={b.id}
              brief={b}
              canManage={canManage}
              selection={selection}
              selectionActive={selectionActive}
              menuHandlers={menuHandlers}
              onPreview={onPreview}
            />
          ))}
          {canManage && onAddActivity ? <AddActivityTile onClick={onAddActivity} /> : null}
        </div>
      ) : null}

      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={onToggleExpanded}
        data-testid={`button-toggle-category-${category}`}
      >
        {expanded && sectionBriefs.length > 0 ? "Свернуть ↑" : "Посмотреть ↓"}
      </button>
    </section>
  );
}

type BriefListViewsProps = {
  briefs: MarketingBriefRow[];
  canManage: boolean;
  selection: BriefListSelection | null;
  selectAllRef?: RefObject<HTMLInputElement>;
  menuHandlers: BriefRowMenuHandlers;
};

export function BriefCardsListView({
  briefs,
  canManage,
  selection,
  menuHandlers,
  onAddActivity,
  onSelectAllInSection,
  listKey,
}: Pick<BriefListViewsProps, "briefs" | "canManage" | "selection" | "menuHandlers"> & {
  onAddActivity?: () => void;
  onSelectAllInSection?: (category: MarketingBriefCategory) => void;
  /** Сброс сворачивания секций при смене фильтров */
  listKey?: string;
}) {
  const selectionActive = selection?.selectionActive ?? false;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const [expandedByCategory, setExpandedByCategory] = useState<Record<MarketingBriefCategory, boolean>>(() =>
    buildDefaultExpandedState(briefs),
  );

  useEffect(() => {
    setExpandedByCategory(buildDefaultExpandedState(briefs));
  }, [listKey, briefs]);

  function handleSelectAllInSection(category: MarketingBriefCategory) {
    if (onSelectAllInSection) {
      onSelectAllInSection(category);
      return;
    }
    if (!selection) return;
    const sectionIds = briefs.filter((b) => (b.category ?? "brief") === category).map((b) => b.id);
    const allSelected = sectionIds.every((id) => selection.isSelected(id));
    if (allSelected) {
      for (const id of sectionIds) {
        if (selection.isSelected(id)) selection.onToggle(id);
      }
    } else {
      for (const id of sectionIds) {
        if (!selection.isSelected(id)) selection.onToggle(id);
      }
    }
  }

  return (
    <>
      <div className="space-y-10" data-testid="section-marketing-briefs-list-cards">
        {MARKETING_BRIEF_CATEGORY_SECTIONS.map((section) => (
          <BriefCategorySection
            key={section.category}
            label={section.label}
            category={section.category}
            briefs={briefs}
            expanded={expandedByCategory[section.category] ?? false}
            onToggleExpanded={() =>
              setExpandedByCategory((prev) => ({
                ...prev,
                [section.category]: !prev[section.category],
              }))
            }
            canManage={canManage}
            selection={selection}
            selectionActive={selectionActive}
            menuHandlers={menuHandlers}
            onPreview={setPreviewId}
            onSelectAllInSection={handleSelectAllInSection}
            onAddActivity={onAddActivity}
          />
        ))}
      </div>
      <BriefPreviewDialog
        previewId={previewId}
        briefs={briefs}
        canManage={canManage}
        onClose={() => setPreviewId(null)}
        onOpenEditor={(id) => setLocation(`/marketing-briefs/${id}`)}
      />
    </>
  );
}

export function BriefTableListView({
  briefs,
  canManage,
  selection,
  selectAllRef,
  menuHandlers,
}: Pick<BriefListViewsProps, "briefs" | "canManage" | "selection" | "selectAllRef" | "menuHandlers">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80" data-testid="section-marketing-briefs-list-table">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b text-left text-xs text-muted-foreground">
            {canManage && selection ? (
              <th className="w-10 px-2 py-2.5">
                <SelectAllCheckbox selection={selection} selectAllRef={selectAllRef} />
              </th>
            ) : null}
            <th className="min-w-[120px] px-2 py-2.5 font-medium">Название</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Сегмент</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Создан</th>
            <th className="whitespace-nowrap px-2 py-2.5 font-medium">Обновлён</th>
            <th className="whitespace-nowrap px-2 py-2.5 font-medium">Статус</th>
            <th className="w-10 px-1 py-2.5 font-medium">
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {briefs.map((b) => (
            <tr
              key={b.id}
              className="border-b border-border/50 last:border-0 hover:bg-muted/30"
              data-testid={`row-marketing-brief-${b.id}`}
            >
              {canManage && selection ? (
                <td className="px-2 py-2">
                  <Checkbox
                    checked={selection.isSelected(b.id)}
                    onCheckedChange={() => selection.onToggle(b.id)}
                    aria-label={`Выбрать ${b.title}`}
                    data-testid={`checkbox-brief-${b.id}`}
                  />
                </td>
              ) : null}
              <td className="max-w-[140px] px-2 py-2 font-medium sm:max-w-xs">
                {(() => {
                  const { text, isPlaceholder } = briefDisplayTitle(b.title);
                  return (
                    <span className={cn("line-clamp-2 sm:truncate", isPlaceholder && "text-muted-foreground")}>
                      {text}
                    </span>
                  );
                })()}
              </td>
              <td className="hidden truncate px-3 py-2 text-muted-foreground md:table-cell">
                {formatMarketingBriefPeriodLabel(b.period_label)}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground md:table-cell">
                {formatBriefCreatedAt(b.created_at)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                <span className="md:hidden">{formatBriefUpdatedShort(b.updated_at)}</span>
                <span className="hidden md:inline">{formatBriefUpdatedAt(b.updated_at)}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="md:hidden">
                    <BriefStatusDot status={b.status} />
                  </span>
                  <span className="hidden md:inline-flex">
                    <BriefStatusBadge status={b.status} />
                  </span>
                  {b.status === "published" && isBriefNew(b.published_at) ? <BriefNewBadge briefId={b.id} /> : null}
                  <BriefVisibilityIcon visibility={b.visibility ?? "private"} />
                </div>
              </td>
              <td className="w-10 px-1 py-2">
                <BriefRowActionsMenu brief={b} canManage={canManage} handlers={menuHandlers} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BriefCompactListView({
  briefs,
  canManage,
  selection,
  selectAllRef,
  menuHandlers,
}: Pick<BriefListViewsProps, "briefs" | "canManage" | "selection" | "selectAllRef" | "menuHandlers">) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80" data-testid="section-marketing-briefs-list-compact">
      {canManage && selection ? (
        <div className="flex h-10 items-center gap-3 border-b bg-muted/20 px-3">
          <SelectAllCheckbox selection={selection} selectAllRef={selectAllRef} />
          <span className="text-xs text-muted-foreground">Выбрать все на странице</span>
        </div>
      ) : null}
      <ul>
        {briefs.map((b) => {
          const { text, isPlaceholder } = briefDisplayTitle(b.title);
          return (
            <li
              key={b.id}
              className="flex min-h-10 items-center gap-2 border-b border-border/50 px-2 py-1.5 last:border-0 hover:bg-muted/30 sm:px-3"
              data-testid={`row-marketing-brief-compact-${b.id}`}
            >
              {canManage && selection ? (
                <Checkbox
                  checked={selection.isSelected(b.id)}
                  onCheckedChange={() => selection.onToggle(b.id)}
                  aria-label={`Выбрать ${b.title}`}
                  data-testid={`checkbox-brief-${b.id}`}
                  className="shrink-0"
                />
              ) : null}
              <BriefStatusDot status={b.status} />
              {b.status === "published" && isBriefNew(b.published_at) ? <BriefNewBadge briefId={b.id} /> : null}
              <BriefVisibilityIcon visibility={b.visibility ?? "private"} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium leading-tight",
                    isPlaceholder && "text-muted-foreground",
                  )}
                  title={text}
                >
                  {text}
                </p>
                <p className="hidden truncate text-[10px] leading-tight text-muted-foreground sm:block">
                  Обновлён {formatBriefUpdatedAt(b.updated_at)}
                </p>
              </div>
              <div className="w-10 shrink-0">
                <BriefRowActionsMenu brief={b} canManage={canManage} handlers={menuHandlers} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BriefBulkActionBar({
  count,
  busy,
  primaryLabel,
  onPrimary,
  onDelete,
  onClear,
}: {
  count: number;
  busy: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;

  return (
    <div
      className="fixed bottom-2 left-2 right-2 z-50 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-auto sm:max-w-2xl sm:-translate-x-1/2 sm:px-4"
      data-testid="bar-brief-bulk-actions"
      role="toolbar"
      aria-label="Массовые действия"
    >
      <span className="text-sm font-medium tabular-nums" data-testid="text-brief-bulk-count">
        Выбрано: {count}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={onPrimary}
          data-testid="button-brief-bulk-primary"
        >
          {primaryLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={onDelete}
          data-testid="button-brief-bulk-delete"
        >
          Удалить
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClear} data-testid="button-brief-bulk-clear">
          Снять
        </Button>
      </div>
    </div>
  );
}
