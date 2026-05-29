import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, useLocation } from "wouter";
import { Globe, Loader2, MoreHorizontal, Share2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { BriefVisibilityIcon } from "@/components/marketing-brief/brief-visibility-ui";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  DEFAULT_MARKETING_BRIEF_ACCENT,
  formatBriefUpdatedAt,
  formatMarketingBriefPeriodLabel,
  getBrief,
  listBlocks,
  updateBrief,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
  type MarketingBriefVisibility,
} from "@/lib/marketing-briefs-api";
import { cn } from "@/lib/utils";

export type BriefListViewMode = "cards" | "table" | "compact";

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

async function makeBriefPublicAndCopy(briefId: string, onMutate: () => void) {
  try {
    await updateBrief(briefId, { visibility: "public" });
    await navigator.clipboard.writeText(buildPublicBriefShareUrl(briefId));
    toast({ title: "Бриф теперь публичный, ссылка скопирована" });
    onMutate();
  } catch (e) {
    toast({
      variant: "destructive",
      description: e instanceof Error ? e.message : "Не удалось сделать бриф публичным",
    });
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
}: {
  status: MarketingBriefRow["status"];
  className?: string;
}) {
  const map = {
    published: {
      label: "Опубликовано",
      cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
    },
    draft: { label: "Черновик", cls: "bg-muted text-foreground border border-border" },
    archived: {
      label: "В архиве",
      cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    },
  } as const;
  const m = map[status] ?? map.draft;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap",
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
      <Button asChild variant="outline" size="sm" className="min-h-8 h-8 px-2 text-xs">
        <Link href={`/marketing-briefs/view/${brief.id}`}>Открыть</Link>
      </Button>
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

function CardShareButton({ brief, onMutate }: { brief: MarketingBriefRow; onMutate: () => void }) {
  if (brief.status !== "published") return null;
  const visibility = brief.visibility ?? "private";
  if (visibility === "public") {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-9 gap-1"
        onClick={(e) => {
          e.stopPropagation();
          void copyBriefLink(brief.id);
        }}
        data-testid={`button-card-share-${brief.id}`}
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Поделиться
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="min-h-9 gap-1"
      onClick={(e) => {
        e.stopPropagation();
        void makeBriefPublicAndCopy(brief.id, onMutate);
      }}
      data-testid={`button-card-make-public-${brief.id}`}
    >
      <Globe className="h-3.5 w-3.5" aria-hidden />
      Сделать публичным
    </Button>
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

  const handlePrint = () => {
    window.requestAnimationFrame(() => window.print());
  };

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
            data-testid="button-brief-preview-share"
          >
            <Share2 className="mr-2 h-4 w-4" aria-hidden />
            Поделиться
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint} data-testid="button-brief-preview-pdf">
            Скачать PDF
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          {displayBrief && canManage ? (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditor(displayBrief.id);
              }}
              data-testid="button-brief-preview-edit"
            >
              Открыть для редактирования
            </Button>
          ) : displayBrief ? (
            <Button type="button" asChild>
              <Link href={`/marketing-briefs/view/${displayBrief.id}`}>Открыть</Link>
            </Button>
          ) : null}
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
  renderCardFooter,
  onPreview,
}: {
  brief: MarketingBriefRow;
  canManage: boolean;
  selection: BriefListSelection | null;
  selectionActive: boolean;
  menuHandlers: BriefRowMenuHandlers;
  renderCardFooter: (brief: MarketingBriefRow) => ReactNode;
  onPreview: (id: string) => void;
}) {
  const selected = selection?.isSelected(b.id) ?? false;
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(b.title);

  useEffect(() => {
    if (!editingTitle) setDraftTitle(b.title);
  }, [b.title, editingTitle]);

  async function commitRename() {
    const next = draftTitle.trim();
    setEditingTitle(false);
    if (!next || next === b.title.trim()) return;
    try {
      await updateBrief(b.id, { title: next });
      toast({ description: "Название сохранено" });
      menuHandlers.onMutate();
    } catch {
      toast({ variant: "destructive", description: "Не удалось сохранить название" });
      setDraftTitle(b.title);
    }
  }

  function cancelRename() {
    setEditingTitle(false);
    setDraftTitle(b.title);
  }

  const openPreview = () => onPreview(b.id);

  return (
    <Card
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/80 shadow-sm"
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
      {canManage && selection ? (
        <div
          className={cn(
            "absolute left-2 top-2 z-10 rounded-md bg-background/90 p-0.5 shadow-sm backdrop-blur-sm transition-opacity",
            selected || selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => selection.onToggle(b.id)}
            aria-label={`Выбрать ${b.title}`}
            data-testid={`checkbox-brief-${b.id}`}
          />
        </div>
      ) : null}
      <div
        className="absolute right-3 top-3 z-10"
        data-no-print="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <BriefRowActionsMenu brief={b} canManage={canManage} handlers={menuHandlers} compact />
      </div>
      <div
        className="relative px-4 py-6 pr-12"
        style={{ backgroundColor: b.accent_color || DEFAULT_MARKETING_BRIEF_ACCENT }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {canManage && editingTitle ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded bg-white/95 px-2 py-1 text-lg font-semibold text-foreground outline-none ring-2 ring-emerald-400"
            data-testid={`input-rename-${b.id}`}
          />
        ) : canManage ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDraftTitle(b.title);
              setEditingTitle(true);
            }}
            className="block w-full text-left text-lg font-semibold text-white hover:underline"
            data-testid={`title-${b.id}`}
          >
            {briefDisplayTitle(b.title).text}
          </button>
        ) : (
          <p className="text-lg font-semibold leading-snug text-white">{briefDisplayTitle(b.title).text}</p>
        )}
        <p className="mt-1 text-sm font-medium text-white/80">
          {formatMarketingBriefPeriodLabel(b.period_label)}
        </p>
      </div>
      <CardHeader className="flex-1 pb-2">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <BriefStatusBadge status={b.status} />
          <BriefVisibilityIcon visibility={b.visibility ?? "private"} />
        </div>
        <CardTitle className="sr-only">{briefDisplayTitle(b.title).text}</CardTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          {b.author_name ?? "—"} · обновлено {formatBriefUpdatedAt(b.updated_at)}
        </p>
      </CardHeader>
      <CardFooter
        className="flex flex-wrap gap-2 border-t border-border/50 pt-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {canManage ? <CardShareButton brief={b} onMutate={menuHandlers.onMutate} /> : null}
        <div
          className="contents"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {renderCardFooter(b)}
        </div>
      </CardFooter>
    </Card>
  );
}

type BriefListViewsProps = {
  briefs: MarketingBriefRow[];
  canManage: boolean;
  selection: BriefListSelection | null;
  selectAllRef?: RefObject<HTMLInputElement>;
  menuHandlers: BriefRowMenuHandlers;
  renderCardFooter: (brief: MarketingBriefRow) => ReactNode;
};

export function BriefCardsListView({
  briefs,
  canManage,
  selection,
  menuHandlers,
  renderCardFooter,
}: Pick<BriefListViewsProps, "briefs" | "canManage" | "selection" | "menuHandlers" | "renderCardFooter">) {
  const selectionActive = selection?.selectionActive ?? false;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="section-marketing-briefs-list-cards">
        {briefs.map((b) => (
          <MarketingBriefCard
            key={b.id}
            brief={b}
            canManage={canManage}
            selection={selection}
            selectionActive={selectionActive}
            menuHandlers={menuHandlers}
            renderCardFooter={renderCardFooter}
            onPreview={setPreviewId}
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
                <div className="flex items-center gap-1">
                  <span className="md:hidden">
                    <BriefStatusDot status={b.status} />
                  </span>
                  <span className="hidden md:inline-flex">
                    <BriefStatusBadge status={b.status} />
                  </span>
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
