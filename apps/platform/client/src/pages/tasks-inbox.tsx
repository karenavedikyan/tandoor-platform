import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Bell, ClipboardList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EditOutgoingTaskDialog } from "@/components/tasks/edit-outgoing-task-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDate } from "@/lib/format-datetime";
import {
  archiveAssignments,
  deleteAssignments,
  listIncomingAssignments,
  listOutgoingAssignments,
  remindAssignees,
  unarchiveAssignments,
  type AssignmentStatus,
} from "@/lib/showcase-assignments-api";
import {
  applyTaskFilters,
  assignmentToUnifiedTask,
  filterUnifiedTasksByStatus,
  type TaskDirection,
  type TaskFilters,
  type TaskStatusFilter,
  type UnifiedTask,
} from "@/lib/tasks-inbox-model";
import { cn } from "@/lib/utils";

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  open: "Открыто",
  in_progress: "В работе",
  submitted: "На проверке",
  verified: "Подтверждено",
  closed: "Закрыто",
};

const STATUS_FILTER_OPTIONS: { id: TaskStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "open", label: "Открытые" },
  { id: "submitted", label: "На проверке" },
  { id: "completed", label: "Завершённые" },
];

const OUTGOING_MANAGE_ROLES = new Set(["admin", "director", "rop", "regional_manager"]);
const CREATE_TASK_ROLES = OUTGOING_MANAGE_ROLES;

function assignmentStatusTone(status: AssignmentStatus): string {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "closed") return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300";
  if (status === "submitted") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

function isDueOverdue(dueDate: string | null, status: AssignmentStatus): boolean {
  if (!dueDate || status === "verified" || status === "closed") return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function counterpartyLabel(task: UnifiedTask): string {
  if (task.direction === "incoming") {
    return task.counterpartyName ? `От: ${task.counterpartyName}` : "От: —";
  }
  return task.counterpartyName ? `Исполнитель: ${task.counterpartyName}` : "Исполнитель: не назначен";
}

function canManageOutgoingTask(userRole: string | undefined, userId: string | undefined, task: UnifiedTask): boolean {
  if (!userRole || !userId) return false;
  if (userRole === "admin" || userRole === "director") return true;
  return task.createdById === userId;
}

function canEditOutgoingTask(userRole: string | undefined, userId: string | undefined, task: UnifiedTask): boolean {
  if (task.status === "verified" || task.status === "closed") return false;
  return canManageOutgoingTask(userRole, userId, task);
}

type TaskCardProps = {
  task: UnifiedTask;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  onEdit?: (task: UnifiedTask) => void;
  canEdit?: boolean;
};

function TaskCard({ task, selectable, selected, onToggleSelect, onEdit, canEdit }: TaskCardProps) {
  const overdue = isDueOverdue(task.dueDate, task.status);

  return (
    <Card className="rounded-xl border border-border/80 shadow-xs">
      <CardContent className="flex gap-2 p-4">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onToggleSelect?.(task.entityId, v === true)}
            className="mt-1 shrink-0"
            data-testid={`checkbox-task-select-${task.entityId}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <Link
            href={task.href}
            className="block rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`link-task-inbox-${task.entityId}`}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-foreground">
                  {task.title}
                </p>
                <Badge className={cn("shrink-0 border", assignmentStatusTone(task.status))}>
                  {ASSIGNMENT_STATUS_LABEL[task.status]}
                </Badge>
                {task.isArchived ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    В архиве
                  </Badge>
                ) : null}
              </div>
              {task.progressLabel ? (
                <p className="text-sm text-muted-foreground">{task.progressLabel}</p>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {task.dueDate ? (
                  <span className={cn(overdue && "font-medium text-destructive")}>
                    Срок: {formatDisplayDate(task.dueDate)}
                    {overdue ? " · просрочено" : ""}
                  </span>
                ) : null}
                <span className="break-words">{counterpartyLabel(task)}</span>
              </div>
            </div>
          </Link>
        </div>
        {canEdit && onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(task);
            }}
            data-testid={`button-task-edit-${task.entityId}`}
            aria-label="Редактировать"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3" data-testid="tasks-inbox-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

function TaskListEmpty({ direction, archived }: { direction: TaskDirection; archived?: boolean }) {
  const isIncoming = direction === "incoming";
  return (
    <Card className="rounded-xl border border-dashed border-border/80" data-testid={`tasks-inbox-empty-${direction}`}>
      <CardContent className="space-y-2 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          {archived
            ? "В архиве нет задач"
            : isIncoming
              ? "Нет входящих задач"
              : "Нет исходящих задач"}
        </p>
        <p className="text-sm text-muted-foreground">
          {archived
            ? "Архивированные задания появятся здесь."
            : isIncoming
              ? "Задания на отгрузку, где вы исполнитель, появятся здесь."
              : "Задания, которые вы создали, появятся здесь."}
        </p>
      </CardContent>
    </Card>
  );
}

function TaskListError({ message }: { message: string }) {
  return (
    <Card className="rounded-xl border border-destructive/40 bg-destructive/5" data-testid="tasks-inbox-error">
      <CardContent className="px-4 py-6 text-center text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}

function StatusFilterChips({
  value,
  onChange,
  archivedOnly,
  onArchivedToggle,
  showArchiveToggle,
}: {
  value: TaskStatusFilter;
  onChange: (next: TaskStatusFilter) => void;
  archivedOnly: boolean;
  onArchivedToggle: () => void;
  showArchiveToggle?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="tasks-inbox-status-filter">
      {STATUS_FILTER_OPTIONS.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id && !archivedOnly ? "default" : "outline"}
          className="min-h-9"
          onClick={() => onChange(opt.id)}
          data-testid={`button-tasks-inbox-filter-${opt.id}`}
        >
          {opt.label}
        </Button>
      ))}
      {showArchiveToggle ? (
        <Button
          type="button"
          size="sm"
          variant={archivedOnly ? "default" : "outline"}
          className="min-h-9 gap-1"
          onClick={onArchivedToggle}
          data-testid="button-tasks-inbox-filter-archive"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden />
          Архив
        </Button>
      ) : null}
    </div>
  );
}

function AdvancedFiltersPanel({
  filters,
  onChange,
  expanded,
  onToggle,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={onToggle}
        data-testid="button-tasks-inbox-filters-toggle"
      >
        {expanded ? "Скрыть фильтры" : "Фильтры"}
      </Button>
      {expanded ? (
        <div
          className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2"
          data-testid="panel-tasks-inbox-filters"
        >
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="filter-task-text" className="text-xs">
              Поиск
            </Label>
            <Input
              id="filter-task-text"
              value={filters.text ?? ""}
              onChange={(e) => onChange({ ...filters, text: e.target.value })}
              placeholder="Заголовок, контрагент…"
              data-testid="input-tasks-inbox-filter-text"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-task-assignee" className="text-xs">
              Исполнитель
            </Label>
            <Input
              id="filter-task-assignee"
              value={filters.assignee ?? ""}
              onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
              data-testid="input-tasks-inbox-filter-assignee"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={filters.overdueOnly === true}
                onCheckedChange={(v) => onChange({ ...filters, overdueOnly: v === true })}
                data-testid="checkbox-tasks-inbox-filter-overdue"
              />
              Только просроченные
            </label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-task-due-from" className="text-xs">
              Срок от
            </Label>
            <Input
              id="filter-task-due-from"
              type="date"
              value={filters.dueFrom ?? ""}
              onChange={(e) => onChange({ ...filters, dueFrom: e.target.value || undefined })}
              data-testid="input-tasks-inbox-filter-due-from"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-task-due-to" className="text-xs">
              Срок до
            </Label>
            <Input
              id="filter-task-due-to"
              type="date"
              value={filters.dueTo ?? ""}
              onChange={(e) => onChange({ ...filters, dueTo: e.target.value || undefined })}
              data-testid="input-tasks-inbox-filter-due-to"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BulkActionsBar({
  count,
  archivedOnly,
  onArchive,
  onUnarchive,
  onRemind,
  onDelete,
  onClear,
  busy,
}: {
  count: number;
  archivedOnly: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onRemind: () => void;
  onDelete: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  if (count === 0) return null;
  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur"
      data-testid="bar-tasks-inbox-bulk-actions"
    >
      <span className="px-2 text-sm font-medium">Выбрано: {count}</span>
      {archivedOnly ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onUnarchive} data-testid="button-tasks-bulk-unarchive">
          Вернуть из архива
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onArchive} data-testid="button-tasks-bulk-archive">
          <Archive className="mr-1 h-3.5 w-3.5" />
          Архивировать
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRemind} data-testid="button-tasks-bulk-remind">
        <Bell className="mr-1 h-3.5 w-3.5" />
        Напомнить
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive"
        disabled={busy}
        onClick={onDelete}
        data-testid="button-tasks-bulk-delete"
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Удалить
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClear} data-testid="button-tasks-bulk-clear">
        Снять выделение
      </Button>
    </div>
  );
}

function TaskDirectionPanel({
  direction,
  tasks,
  isLoading,
  isError,
  errorMessage,
  statusFilter,
  onStatusFilterChange,
  archivedOnly,
  onArchivedToggle,
  showArchiveToggle,
  showBulkActions,
  userRole,
  userId,
  onInvalidate,
}: {
  direction: TaskDirection;
  tasks: UnifiedTask[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  statusFilter: TaskStatusFilter;
  onStatusFilterChange: (next: TaskStatusFilter) => void;
  archivedOnly: boolean;
  onArchivedToggle: () => void;
  showArchiveToggle?: boolean;
  showBulkActions?: boolean;
  userRole?: string;
  userId?: string;
  onInvalidate: () => void;
}) {
  const { toast } = useToast();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editTask, setEditTask] = useState<UnifiedTask | null>(null);

  const filtered = useMemo(() => {
    const byStatus = filterUnifiedTasksByStatus(tasks, statusFilter);
    return applyTaskFilters(byStatus, taskFilters);
  }, [tasks, statusFilter, taskFilters]);

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runBulk = async (action: "archive" | "unarchive" | "remind" | "delete") => {
    if (selectedList.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      if (action === "archive") {
        const r = await archiveAssignments(selectedList);
        toast({ title: `Архивировано: ${r.archived}`, description: r.skipped > 0 ? `Пропущено: ${r.skipped}` : undefined });
      } else if (action === "unarchive") {
        const r = await unarchiveAssignments(selectedList);
        toast({ title: `Восстановлено: ${r.unarchived}`, description: r.skipped > 0 ? `Пропущено: ${r.skipped}` : undefined });
      } else if (action === "remind") {
        const r = await remindAssignees(selectedList);
        toast({ title: `Напоминаний: ${r.reminded}`, description: r.skipped > 0 ? `Пропущено: ${r.skipped}` : undefined });
      } else {
        const r = await deleteAssignments(selectedList);
        toast({ title: `Удалено: ${r.deleted}`, description: r.skipped > 0 ? `Пропущено: ${r.skipped}` : undefined });
      }
      clearSelection();
      onInvalidate();
    } catch (err) {
      toast({
        title: "Не удалось выполнить действие",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <StatusFilterChips
          value={statusFilter}
          onChange={onStatusFilterChange}
          archivedOnly={archivedOnly}
          onArchivedToggle={onArchivedToggle}
          showArchiveToggle={showArchiveToggle}
        />
      </div>
      <AdvancedFiltersPanel
        filters={taskFilters}
        onChange={setTaskFilters}
        expanded={filtersExpanded}
        onToggle={() => setFiltersExpanded((v) => !v)}
      />
      {showBulkActions ? (
        <BulkActionsBar
          count={selectedIds.size}
          archivedOnly={archivedOnly}
          onArchive={() => void runBulk("archive")}
          onUnarchive={() => void runBulk("unarchive")}
          onRemind={() => void runBulk("remind")}
          onDelete={() => setDeleteConfirmOpen(true)}
          onClear={clearSelection}
          busy={bulkBusy}
        />
      ) : null}
      {isLoading ? <TaskListSkeleton /> : null}
      {!isLoading && isError ? (
        <TaskListError message={errorMessage ?? "Не удалось загрузить задачи"} />
      ) : null}
      {!isLoading && !isError && filtered.length === 0 ? (
        <TaskListEmpty direction={direction} archived={archivedOnly} />
      ) : null}
      {!isLoading && !isError && filtered.length > 0 ? (
        <ul className="space-y-3" data-testid={`tasks-inbox-list-${direction}`}>
          {filtered.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                selectable={showBulkActions}
                selected={selectedIds.has(task.entityId)}
                onToggleSelect={toggleSelect}
                canEdit={direction === "outgoing" && canEditOutgoingTask(userRole, userId, task)}
                onEdit={direction === "outgoing" ? setEditTask : undefined}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <EditOutgoingTaskDialog
        open={editTask != null}
        task={editTask}
        onOpenChange={(o) => !o && setEditTask(null)}
        onSaved={() => {
          toast({ title: "Задание обновлено" });
          onInvalidate();
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-tasks-bulk-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачи безвозвратно</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить {selectedIds.size} {selectedIds.size === 1 ? "задачу" : "задач"} безвозвратно. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void runBulk("delete")}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TasksInboxPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TaskDirection>("incoming");
  const [incomingStatusFilter, setIncomingStatusFilter] = useState<TaskStatusFilter>("all");
  const [outgoingStatusFilter, setOutgoingStatusFilter] = useState<TaskStatusFilter>("all");
  const [outgoingArchivedOnly, setOutgoingArchivedOnly] = useState(false);

  const canCreateTask = Boolean(user?.role && CREATE_TASK_ROLES.has(user.role));

  const incomingQ = useQuery({
    queryKey: ["tasks-inbox", "incoming"],
    queryFn: listIncomingAssignments,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const outgoingQ = useQuery({
    queryKey: ["tasks-inbox", "outgoing", user?.id ?? "", outgoingArchivedOnly ? "archived" : "active"],
    queryFn: () =>
      listOutgoingAssignments(user!.id, outgoingArchivedOnly ? { archivedOnly: true } : undefined),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const invalidateIncoming = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tasks-inbox", "incoming"] });
  }, [queryClient]);

  const invalidateOutgoing = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tasks-inbox", "outgoing"] });
  }, [queryClient]);

  useEffect(() => {
    if (incomingQ.isError) {
      toast({
        title: "Не удалось загрузить входящие задачи",
        description: incomingQ.error instanceof Error ? incomingQ.error.message : undefined,
        variant: "destructive",
      });
    }
  }, [incomingQ.isError, incomingQ.error, toast]);

  useEffect(() => {
    if (outgoingQ.isError) {
      toast({
        title: "Не удалось загрузить исходящие задачи",
        description: outgoingQ.error instanceof Error ? outgoingQ.error.message : undefined,
        variant: "destructive",
      });
    }
  }, [outgoingQ.isError, outgoingQ.error, toast]);

  const incomingTasks = useMemo(() => {
    if (!user?.id || !incomingQ.data) return [];
    return incomingQ.data.map((dto) => assignmentToUnifiedTask(dto, "incoming", user.id));
  }, [incomingQ.data, user?.id]);

  const outgoingTasks = useMemo(() => {
    if (!user?.id || !outgoingQ.data) return [];
    return outgoingQ.data.map((dto) => assignmentToUnifiedTask(dto, "outgoing", user.id));
  }, [outgoingQ.data, user?.id]);

  if (userLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4" data-testid="page-tasks-inbox">
        <Skeleton className="h-8 w-40" />
        <TaskListSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4 sm:py-6" data-testid="page-tasks-inbox">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Задачи</h1>
        <p className="text-sm text-muted-foreground">Задания на отгрузку и другие задачи в одном месте.</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TaskDirection)}
        className="space-y-4"
        data-testid="tasks-inbox-tabs"
      >
        <TabsList className="grid h-auto min-h-10 w-full grid-cols-2 gap-1 p-0.5">
          <TabsTrigger value="incoming" className="min-h-10 gap-2 text-sm" data-testid="tab-tasks-inbox-incoming">
            Входящие
            <Badge variant="secondary" className="tabular-nums">
              {incomingQ.isLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : incomingTasks.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="min-h-10 gap-2 text-sm" data-testid="tab-tasks-inbox-outgoing">
            Исходящие
            <Badge variant="secondary" className="tabular-nums">
              {outgoingQ.isLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : outgoingTasks.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-0">
          <TaskDirectionPanel
            direction="incoming"
            tasks={incomingTasks}
            isLoading={incomingQ.isLoading}
            isError={incomingQ.isError}
            errorMessage={incomingQ.error instanceof Error ? incomingQ.error.message : undefined}
            statusFilter={incomingStatusFilter}
            onStatusFilterChange={setIncomingStatusFilter}
            archivedOnly={false}
            onArchivedToggle={() => {}}
            onInvalidate={invalidateIncoming}
          />
        </TabsContent>

        <TabsContent value="outgoing" className="mt-0 space-y-3">
          {canCreateTask ? (
            <Button
              type="button"
              className="min-h-10 w-full gap-1 sm:w-auto"
              onClick={() => window.location.assign(buildBrowserHashAppHref("/dealer-base", { taskSelect: 1 }))}
              data-testid="button-tasks-inbox-create"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Создать задачу
            </Button>
          ) : null}
          <TaskDirectionPanel
            direction="outgoing"
            tasks={outgoingTasks}
            isLoading={outgoingQ.isLoading}
            isError={outgoingQ.isError}
            errorMessage={outgoingQ.error instanceof Error ? outgoingQ.error.message : undefined}
            statusFilter={outgoingStatusFilter}
            onStatusFilterChange={setOutgoingStatusFilter}
            archivedOnly={outgoingArchivedOnly}
            onArchivedToggle={() => setOutgoingArchivedOnly((v) => !v)}
            showArchiveToggle
            showBulkActions={Boolean(user?.role && OUTGOING_MANAGE_ROLES.has(user.role))}
            userRole={user?.role}
            userId={user?.id}
            onInvalidate={invalidateOutgoing}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
}
