import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDisplayDate } from "@/lib/format-datetime";
import {
  listIncomingAssignments,
  listOutgoingAssignments,
  type AssignmentStatus,
} from "@/lib/showcase-assignments-api";
import {
  assignmentToUnifiedTask,
  filterUnifiedTasksByStatus,
  type TaskDirection,
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

function TaskCard({ task }: { task: UnifiedTask }) {
  const overdue = isDueOverdue(task.dueDate, task.status);

  return (
    <Link
      href={task.href}
      className="block rounded-xl outline-none ring-offset-background transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`link-task-inbox-${task.entityId}`}
    >
      <Card className="rounded-xl border border-border/80 shadow-xs">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-start gap-2">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-foreground">
              {task.title}
            </p>
            <Badge className={cn("shrink-0 border", assignmentStatusTone(task.status))}>
              {ASSIGNMENT_STATUS_LABEL[task.status]}
            </Badge>
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
        </CardContent>
      </Card>
    </Link>
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

function TaskListEmpty({ direction }: { direction: TaskDirection }) {
  const isIncoming = direction === "incoming";
  return (
    <Card className="rounded-xl border border-dashed border-border/80" data-testid={`tasks-inbox-empty-${direction}`}>
      <CardContent className="space-y-2 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          {isIncoming ? "Нет входящих задач" : "Нет исходящих задач"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isIncoming
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
}: {
  value: TaskStatusFilter;
  onChange: (next: TaskStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="tasks-inbox-status-filter">
      {STATUS_FILTER_OPTIONS.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id ? "default" : "outline"}
          className="min-h-9"
          onClick={() => onChange(opt.id)}
          data-testid={`button-tasks-inbox-filter-${opt.id}`}
        >
          {opt.label}
        </Button>
      ))}
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
}: {
  direction: TaskDirection;
  tasks: UnifiedTask[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  statusFilter: TaskStatusFilter;
  onStatusFilterChange: (next: TaskStatusFilter) => void;
}) {
  const filtered = useMemo(
    () => filterUnifiedTasksByStatus(tasks, statusFilter),
    [tasks, statusFilter],
  );

  return (
    <div className="space-y-4">
      <StatusFilterChips value={statusFilter} onChange={onStatusFilterChange} />
      {isLoading ? <TaskListSkeleton /> : null}
      {!isLoading && isError ? (
        <TaskListError message={errorMessage ?? "Не удалось загрузить задачи"} />
      ) : null}
      {!isLoading && !isError && filtered.length === 0 ? <TaskListEmpty direction={direction} /> : null}
      {!isLoading && !isError && filtered.length > 0 ? (
        <ul className="space-y-3" data-testid={`tasks-inbox-list-${direction}`}>
          {filtered.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function TasksInboxPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { toast } = useToast();
  const [tab, setTab] = useState<TaskDirection>("incoming");
  const [incomingStatusFilter, setIncomingStatusFilter] = useState<TaskStatusFilter>("all");
  const [outgoingStatusFilter, setOutgoingStatusFilter] = useState<TaskStatusFilter>("all");

  const incomingQ = useQuery({
    queryKey: ["tasks-inbox", "incoming"],
    queryFn: listIncomingAssignments,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const outgoingQ = useQuery({
    queryKey: ["tasks-inbox", "outgoing", user?.id ?? ""],
    queryFn: () => listOutgoingAssignments(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

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
          />
        </TabsContent>

        <TabsContent value="outgoing" className="mt-0">
          <TaskDirectionPanel
            direction="outgoing"
            tasks={outgoingTasks}
            isLoading={outgoingQ.isLoading}
            isError={outgoingQ.isError}
            errorMessage={outgoingQ.error instanceof Error ? outgoingQ.error.message : undefined}
            statusFilter={outgoingStatusFilter}
            onStatusFilterChange={setOutgoingStatusFilter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
