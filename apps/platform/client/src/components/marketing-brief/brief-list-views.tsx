import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import { BriefVisibilityIcon } from "@/components/marketing-brief/brief-visibility-ui";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  briefDisplayTitle,
  DEFAULT_MARKETING_BRIEF_ACCENT,
  formatBriefUpdatedAt,
  formatMarketingBriefPeriodLabel,
  type MarketingBriefRow,
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
};

export function BriefRowActionsMenu({
  brief,
  canManage,
  handlers,
}: {
  brief: MarketingBriefRow;
  canManage: boolean;
  handlers: BriefRowMenuHandlers;
}) {
  if (!canManage) {
    return (
      <Button asChild variant="outline" size="sm" className="min-h-8 h-8 px-2 text-xs">
        <Link href={`/marketing-briefs/view/${brief.id}`}>Открыть</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Действия"
          data-testid={`button-brief-actions-${brief.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuItem className="cursor-pointer" onClick={() => handlers.onOpen(brief)}>
          Открыть
        </DropdownMenuItem>
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

type BriefListViewsProps = {
  briefs: MarketingBriefRow[];
  canManage: boolean;
  selection: BriefListSelection | null;
  selectAllRef?: RefObject<HTMLInputElement>;
  menuHandlers: BriefRowMenuHandlers;
  /** Card grid only — existing per-card actions */
  renderCardFooter: (brief: MarketingBriefRow) => ReactNode;
};

export function BriefCardsListView({
  briefs,
  canManage,
  selection,
  renderCardFooter,
}: Pick<BriefListViewsProps, "briefs" | "canManage" | "selection" | "renderCardFooter">) {
  const selectionActive = selection?.selectionActive ?? false;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="section-marketing-briefs-list-cards">
      {briefs.map((b) => {
        const selected = selection?.isSelected(b.id) ?? false;
        return (
          <Card
            key={b.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-sm"
            data-testid={`card-marketing-brief-${b.id}`}
          >
            {canManage && selection ? (
              <div
                className={cn(
                  "absolute left-2 top-2 z-10 rounded-md bg-background/90 p-0.5 shadow-sm backdrop-blur-sm transition-opacity",
                  selected || selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
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
              className="px-4 py-6"
              style={{ backgroundColor: b.accent_color || DEFAULT_MARKETING_BRIEF_ACCENT }}
            >
              {(() => {
                const { text, isPlaceholder } = briefDisplayTitle(b.title);
                return (
                  <>
                    <p
                      className={cn(
                        "text-lg font-semibold leading-snug text-[#222631]",
                        isPlaceholder && "text-[#222631]/60",
                      )}
                    >
                      {text}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#222631]/80">
                      {formatMarketingBriefPeriodLabel(b.period_label)}
                    </p>
                  </>
                );
              })()}
            </div>
            <CardHeader className="flex-1 pb-2">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <BriefStatusBadge status={b.status} />
                <BriefVisibilityIcon visibility={b.visibility} />
              </div>
              <CardTitle className="sr-only">{briefDisplayTitle(b.title).text}</CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">
                {b.author_name ?? "—"} · обновлено {formatBriefUpdatedAt(b.updated_at)}
              </p>
            </CardHeader>
            <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 pt-3">{renderCardFooter(b)}</CardFooter>
          </Card>
        );
      })}
    </div>
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
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b text-left text-xs text-muted-foreground">
            {canManage && selection ? (
              <th className="w-10 px-3 py-2.5">
                <SelectAllCheckbox selection={selection} selectAllRef={selectAllRef} />
              </th>
            ) : null}
            <th className="px-3 py-2.5 font-medium">Название</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Сегмент</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Создан</th>
            <th className="px-3 py-2.5 font-medium">Обновлён</th>
            <th className="px-3 py-2.5 font-medium">Статус</th>
            <th className="w-12 px-3 py-2.5 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {briefs.map((b) => (
            <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30" data-testid={`row-marketing-brief-${b.id}`}>
              {canManage && selection ? (
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selection.isSelected(b.id)}
                    onCheckedChange={() => selection.onToggle(b.id)}
                    aria-label={`Выбрать ${b.title}`}
                    data-testid={`checkbox-brief-${b.id}`}
                  />
                </td>
              ) : null}
              <td className="max-w-[200px] truncate px-3 py-2 font-medium sm:max-w-xs">
                {(() => {
                  const { text, isPlaceholder } = briefDisplayTitle(b.title);
                  return <span className={cn(isPlaceholder && "text-muted-foreground")}>{text}</span>;
                })()}
              </td>
              <td className="hidden truncate px-3 py-2 text-muted-foreground md:table-cell">
                {formatMarketingBriefPeriodLabel(b.period_label)}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground md:table-cell">
                {formatBriefCreatedAt(b.created_at)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatBriefUpdatedAt(b.updated_at)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <BriefStatusBadge status={b.status} />
                  <BriefVisibilityIcon visibility={b.visibility} />
                </div>
              </td>
              <td className="px-2 py-2">
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
        {briefs.map((b) => (
          <li
            key={b.id}
            className="flex h-10 items-center gap-2 border-b border-border/50 px-3 last:border-0 hover:bg-muted/30"
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
            <div className="flex shrink-0 items-center gap-1">
              <BriefStatusBadge status={b.status} />
              <BriefVisibilityIcon visibility={b.visibility} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-medium leading-tight",
                  briefDisplayTitle(b.title).isPlaceholder && "text-muted-foreground",
                )}
              >
                {briefDisplayTitle(b.title).text}
              </p>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">
                Обновлён {formatBriefUpdatedAt(b.updated_at)}
              </p>
            </div>
            <BriefRowActionsMenu brief={b} canManage={canManage} handlers={menuHandlers} />
          </li>
        ))}
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
