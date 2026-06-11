import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Grid3x3,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  Package,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getProductById } from "@/lib/catalog-data";
import type { CatalogCardSize } from "@/lib/catalog-card-grid";
import {
  listAssignments,
  type AssignmentDto,
  type AssignmentItemStatus,
} from "@/lib/showcase-assignments-api";
import type { AssignmentStatus } from "@shared/showcase-assignments-handlers";

export type TradePointShowcaseAssignmentsPanelProps = {
  dealerId: string;
  tradePointId: string;
  tradePointName?: string;
  actorUserId?: string;
  actorName?: string;
};

const ACTIVE_STATUSES = new Set<AssignmentStatus>(["open", "in_progress", "submitted"]);
const ARCHIVE_STATUSES = new Set<AssignmentStatus>(["verified", "closed"]);

type StatusFilter = "all" | "open" | "submitted" | "verified" | "closed";

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  open: "Открыто",
  in_progress: "В работе",
  submitted: "Выполнено менеджером",
  verified: "Подтверждено",
  closed: "Закрыто",
};

const ITEM_STATUS_LABEL: Record<AssignmentItemStatus, string> = {
  pending: "Нужно поставить",
  shipped: "Отгружено",
  installed: "На витрине",
  problem: "Проблема",
  not_relevant: "Уже не актуально",
};

function assignmentStatusTone(status: AssignmentStatus): string {
  if (status === "verified" || status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "submitted") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

function itemStatusTone(status: AssignmentItemStatus): string {
  if (status === "installed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "shipped") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "problem") return "border-red-200 bg-red-50 text-red-900";
  if (status === "not_relevant") return "border-border bg-muted/60 text-muted-foreground";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function isDueOverdue(dueDate: string | null, status: AssignmentStatus): boolean {
  if (!dueDate || status === "verified" || status === "closed") return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function assignmentItemCounts(assignment: AssignmentDto) {
  const shipped = assignment.items.filter((i) => i.itemStatus === "shipped").length;
  const problems = assignment.items.filter((i) => i.itemStatus === "problem").length;
  const installed = assignment.items.filter((i) => i.itemStatus === "installed").length;
  return { shipped, problems, installed, total: assignment.items.length };
}

function filterAssignments(
  assignments: AssignmentDto[],
  archiveMode: boolean,
  statusFilter: StatusFilter,
): AssignmentDto[] {
  let list = assignments.filter((a) =>
    archiveMode ? ARCHIVE_STATUSES.has(a.status) : ACTIVE_STATUSES.has(a.status),
  );
  if (statusFilter === "open") {
    list = list.filter((a) => a.status === "open" || a.status === "in_progress");
  } else if (statusFilter !== "all") {
    list = list.filter((a) => a.status === statusFilter);
  }
  return list;
}

function catalogGridClass(size: CatalogCardSize, compact: boolean): string {
  if (size === "list") return "flex flex-col gap-2";
  if (compact) {
    const compactDense: Record<Exclude<CatalogCardSize, "list">, string> = {
      xl: "grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5",
      m: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5",
      s: "grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6",
    };
    return compactDense[size];
  }
  const dense: Record<Exclude<CatalogCardSize, "list">, string> = {
    xl: "grid grid-cols-2 gap-3 md:grid-cols-3",
    m: "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
    s: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5",
  };
  return dense[size];
}

function AssignmentCatalogItemCard({
  item,
  cardSize,
}: {
  item: AssignmentDto["items"][number];
  cardSize: CatalogCardSize;
}) {
  const product = getProductById(item.targetId);
  const img = product?.image?.trim() || "";
  const name = item.modelName || product?.name || item.targetId;
  const titleSize =
    cardSize === "xl" ? "text-sm" : cardSize === "s" ? "text-[11px]" : "text-xs";

  if (cardSize === "list") {
    return (
      <article
        className="flex items-center gap-3 rounded-lg border border-border/80 bg-card p-2"
        data-testid={`assignment-catalog-item-${item.id}`}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted/40">
          {img ? (
            <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">—</div>
          )}
          {item.photoThumbUrl ? (
            <img
              src={item.photoThumbUrl}
              alt=""
              className="absolute bottom-0 right-0 h-6 w-6 rounded-tl border border-background object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <Badge className={cn("mt-1 border text-[10px]", itemStatusTone(item.itemStatus))}>
            {ITEM_STATUS_LABEL[item.itemStatus]}
          </Badge>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs",
        cardSize === "s" ? "p-1.5" : "p-2",
      )}
      data-testid={`assignment-catalog-item-${item.id}`}
    >
      <div
        className={cn(
          "relative mb-2 w-full overflow-hidden rounded-lg bg-muted/40",
          cardSize === "xl" ? "aspect-[4/5]" : cardSize === "s" ? "aspect-square" : "aspect-[3/4]",
        )}
      >
        {img ? (
          <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
        )}
        {item.photoThumbUrl ? (
          <a
            href={item.photoUrl ?? item.photoThumbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-1 right-1 block"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={item.photoThumbUrl}
              alt="Доказательство"
              className="h-10 w-10 rounded border-2 border-background object-cover shadow-sm"
            />
          </a>
        ) : null}
      </div>
      <p className={cn("line-clamp-2 font-medium leading-tight", titleSize)}>{name}</p>
      <Badge className={cn("mt-1.5 w-fit border text-[10px]", itemStatusTone(item.itemStatus))}>
        {ITEM_STATUS_LABEL[item.itemStatus]}
      </Badge>
      {item.itemStatus === "problem" && item.problemReason ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-destructive">{item.problemReason}</p>
      ) : null}
    </article>
  );
}

function AssignmentItemsCatalog({
  assignment,
  cardSize,
  onCardSizeChange,
  onFullscreen,
  compact,
}: {
  assignment: AssignmentDto;
  cardSize: CatalogCardSize;
  onCardSizeChange: (size: CatalogCardSize) => void;
  onFullscreen: () => void;
  compact?: boolean;
}) {
  const gridClass = catalogGridClass(cardSize, compact ?? false);

  return (
    <div className="space-y-2" data-testid={`assignment-catalog-${assignment.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["xl", "m", "s", "list"] as const).map((size) => (
            <Button
              key={size}
              type="button"
              variant={cardSize === size ? "default" : "outline"}
              size="sm"
              className="h-8 px-2"
              onClick={() => onCardSizeChange(size)}
              data-testid={`button-assignment-catalog-size-${size}`}
            >
              {size === "xl" ? (
                <LayoutGrid className="h-4 w-4" aria-hidden />
              ) : size === "m" ? (
                <Grid3x3 className="h-4 w-4" aria-hidden />
              ) : size === "list" ? (
                <List className="h-4 w-4" aria-hidden />
              ) : (
                <span className="text-xs font-semibold">S</span>
              )}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onFullscreen}
          data-testid="button-assignment-catalog-fullscreen"
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
          На весь экран
        </Button>
      </div>
      <div className={gridClass}>
        {assignment.items.map((item) => (
          <AssignmentCatalogItemCard key={item.id} item={item} cardSize={cardSize} />
        ))}
      </div>
    </div>
  );
}

function AssignmentCatalogFullscreen({
  assignment,
  onClose,
}: {
  assignment: AssignmentDto;
  onClose: () => void;
}) {
  const [cardSize, setCardSize] = useState<CatalogCardSize>("m");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="assignment-catalog-fullscreen"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/80 px-3 py-2">
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{assignment.title}</p>
          <p className="text-xs text-muted-foreground">{assignment.items.length} позиций</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AssignmentItemsCatalog
          assignment={assignment}
          cardSize={cardSize}
          onCardSizeChange={setCardSize}
          onFullscreen={onClose}
          compact
        />
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment,
  expanded,
  onToggleExpand,
  cardSize,
  onCardSizeChange,
  onFullscreen,
}: {
  assignment: AssignmentDto;
  expanded: boolean;
  onToggleExpand: () => void;
  cardSize: CatalogCardSize;
  onCardSizeChange: (size: CatalogCardSize) => void;
  onFullscreen: () => void;
}) {
  const counts = assignmentItemCounts(assignment);
  const overdue = isDueOverdue(assignment.dueDate, assignment.status);

  return (
    <Card className="rounded-xl border border-border/80" data-testid={`assignment-card-${assignment.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Link
            href={`/assignment/${assignment.id}`}
            className="min-w-0 flex-1 space-y-2 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`link-assignment-${assignment.id}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="font-semibold text-foreground">{assignment.title}</p>
              <Badge className={cn("border", assignmentStatusTone(assignment.status))}>
                {ASSIGNMENT_STATUS_LABEL[assignment.status]}
              </Badge>
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {assignment.createdByName ? <p>Создатель: {assignment.createdByName}</p> : null}
              {assignment.assigneeName ? <p>Исполнитель: {assignment.assigneeName}</p> : null}
              {assignment.dueDate ? (
                <p className={cn(overdue && "font-medium text-destructive")}>
                  Срок: {assignment.dueDate}
                  {overdue ? " · просрочено" : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span>
                Отгружено{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {counts.shipped} / {counts.total}
                </span>
              </span>
              <span>
                Проблемы{" "}
                <span className="font-semibold tabular-nums text-destructive">{counts.problems}</span>
              </span>
              <span>
                На витрине{" "}
                <span className="font-semibold tabular-nums text-emerald-700">{counts.installed}</span>
              </span>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            data-testid={`button-assignment-expand-${assignment.id}`}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">Показать модели</span>
          </Button>
        </div>

        {expanded ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            <AssignmentItemsCatalog
              assignment={assignment}
              cardSize={cardSize}
              onCardSizeChange={onCardSizeChange}
              onFullscreen={onFullscreen}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-auto px-0 text-xs text-primary hover:bg-transparent"
            onClick={onToggleExpand}
            data-testid={`button-assignment-show-models-${assignment.id}`}
          >
            Показать модели ({counts.total})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function TradePointShowcaseAssignmentsPanel({
  dealerId,
  tradePointId,
}: TradePointShowcaseAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archiveMode, setArchiveMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [catalogCardSize, setCatalogCardSize] = useState<CatalogCardSize>("m");
  const [fullscreenAssignment, setFullscreenAssignment] = useState<AssignmentDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listAssignments({ dealerId, tradePointId });
      setAssignments(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить задания");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [dealerId, tradePointId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterAssignments(assignments, archiveMode, statusFilter),
    [assignments, archiveMode, statusFilter],
  );

  return (
    <div className="space-y-4" data-testid="trade-point-showcase-assignments-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Статус задания</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="min-h-10" data-testid="select-assignment-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="open">Открытые</SelectItem>
              <SelectItem value="submitted">Выполнено менеджером</SelectItem>
              <SelectItem value="verified">Подтверждено</SelectItem>
              <SelectItem value="closed">Закрыто</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/80 px-3 py-2">
          <Switch
            id="assignment-archive-toggle"
            checked={archiveMode}
            onCheckedChange={setArchiveMode}
            data-testid="switch-assignment-archive"
          />
          <Label htmlFor="assignment-archive-toggle" className="cursor-pointer text-sm">
            {archiveMode ? "Архив" : "Активные"}
          </Label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10" data-testid="assignments-loading">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <p
          className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
          data-testid="assignments-empty"
        >
          По этой точке пока нет заданий на отгрузку
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              expanded={expandedId === assignment.id}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === assignment.id ? null : assignment.id))
              }
              cardSize={catalogCardSize}
              onCardSizeChange={setCatalogCardSize}
              onFullscreen={() => setFullscreenAssignment(assignment)}
            />
          ))}
        </div>
      )}

      {fullscreenAssignment ? (
        <AssignmentCatalogFullscreen
          assignment={fullscreenAssignment}
          onClose={() => setFullscreenAssignment(null)}
        />
      ) : null}
    </div>
  );
}
