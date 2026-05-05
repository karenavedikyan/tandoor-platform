import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRightCircle, CheckCircle2, ListTodo, Target } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { SalesTaskListItem, SalesTaskStatusUpdateResponse } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { apiRequest } from "@/lib/queryClient";
import { salesTaskStatusLabel, salesTaskTypeLabel, taskPriorityLabel } from "@/lib/labels";

const doneStatusPayload = { status: "done" as const };

function statusClass(status: string): string {
  if (status === "done") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "overdue") return "bg-rose-100 text-rose-800 border-rose-200";
  if (status === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "waiting_dealer") return "bg-sky-100 text-sky-800 border-sky-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function priorityClass(priority: string): string {
  if (priority === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (priority === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function SalesTasksPage() {
  const { toast } = useToast();
  const tasksQuery = useQuery<SalesTaskListItem[]>({
    queryKey: ["/api/sales/tasks"],
  });

  const statusMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/sales/tasks/${taskId}/status`,
        doneStatusPayload,
      );
      return (await response.json()) as SalesTaskStatusUpdateResponse;
    },
    onSuccess: () => {
      toast({ title: "Статус задачи обновлен" });
      void tasksQuery.refetch();
    },
  });

  if (tasksQuery.isLoading) {
    return (
      <section className="space-y-4" data-testid="page-sales-tasks">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-44 w-full" />
      </section>
    );
  }

  if (tasksQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-sales-tasks">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить задачи отдела продаж</AlertTitle>
        <AlertDescription>
          {tasksQuery.error instanceof Error ? tasksQuery.error.message : "Неожиданная ошибка"}
        </AlertDescription>
      </Alert>
    );
  }

  const tasks = tasksQuery.data ?? [];
  const summary = {
    total: tasks.length,
    new: tasks.filter((task) => task.taskStatus === "new").length,
    inProgress: tasks.filter((task) => task.taskStatus === "in_progress").length,
    waitingDealer: tasks.filter((task) => task.taskStatus === "waiting_dealer").length,
    overdue: tasks.filter((task) => task.taskStatus === "overdue").length,
    done: tasks.filter((task) => task.taskStatus === "done").length,
  };

  return (
    <section className="space-y-6" data-testid="page-sales-tasks">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Задачи отдела продаж</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Единый список задач менеджеров и ассистентов по дилерам, витринам, заказам и дальнейшему контролю.
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-sales-tasks-summary">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">KPI задач</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Всего задач</p>
            <p className="mt-1 text-xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Новые</p>
            <p className="mt-1 text-xl font-semibold">{summary.new}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">В работе</p>
            <p className="mt-1 text-xl font-semibold">{summary.inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Ожидают дилера</p>
            <p className="mt-1 text-xl font-semibold">{summary.waitingDealer}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Просрочены</p>
            <p className="mt-1 text-xl font-semibold">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Выполнены</p>
            <p className="mt-1 text-xl font-semibold">{summary.done}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="list-sales-tasks">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Список задач</CardTitle>
          <CardDescription>Задачи по дилерам, торговым точкам и целям по витринам.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Нет задач отдела продаж.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-sales-task-${task.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold" data-testid={`text-sales-task-title-${task.id}`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {task.dealer.name}
                      {task.tradePoint ? ` · ${task.tradePoint.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClass(task.taskStatus)}>
                      {salesTaskStatusLabel(task.taskStatus)}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(task.priority)}>
                      {taskPriorityLabel(task.priority)}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{task.description}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    <span className="text-muted-foreground">Ответственный:</span>{" "}
                    {task.assignedTo
                      ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                      : "Не назначен"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Тип:</span>{" "}
                    {salesTaskTypeLabel(task.taskType)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Срок:</span> {formatDate(task.dueDate)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Связь с целью:</span>{" "}
                    {task.showcaseGoalId ? `#${task.showcaseGoalId}` : "Нет"}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {task.showcaseGoalId ? (
                    <Button
                      asChild
                      variant="outline"
                      className="justify-between rounded-xl"
                      data-testid={`button-open-task-goal-${task.id}`}
                    >
                      <Link href={`/sales/showcase-goals/${task.showcaseGoalId}`}>
                        Открыть цель
                        <ArrowRightCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    variant="outline"
                    className="justify-between rounded-xl"
                    data-testid={`button-complete-sales-task-${task.id}`}
                    disabled={statusMutation.isPending || task.taskStatus === "done"}
                    onClick={() => statusMutation.mutate(task.id)}
                  >
                    Закрыть задачу
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-sales-responsibility-map"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Распределение ответственности</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            менеджер продаж: согласование с дилером, коммерческие условия, заказ;
          </p>
          <p className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            ассистент продаж: документы, POSM, подготовка материалов;
          </p>
          <p>региональный менеджер: проверка факта в ТТ;</p>
          <p>руководитель: контроль статусов и просрочек.</p>
        </CardContent>
      </Card>
    </section>
  );
}
