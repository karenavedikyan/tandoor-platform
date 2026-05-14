import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  applyShowcaseTaskCompleteSafe,
  applyShowcaseTaskStatus,
  canCompleteShowcaseTask,
  canViewShowcaseDistribution,
  canWorkflowShowcaseTask,
  getShowcaseKpis,
  getShowcaseTasksForDealerDisplay,
  isShowcaseReadOnly,
  loadShowcaseStorage,
  mergeDistributionWithOverrides,
  SHOWCASE_CATEGORY_LABEL,
  type ShowcaseCompleteResultKind,
  type ShowcaseDistributionRow,
  type ShowcaseTask,
  type ShowcaseTaskStatus,
  showcaseCompleteResultLabel,
  userLabelFromProfile,
} from "@/lib/showcase-distribution-data";
import { cn } from "@/lib/utils";

const TASK_STATUS_LABEL: Record<ShowcaseTaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  postponed: "Отложена",
  needs_rop: "Нужна помощь РОПа",
};

const PRIORITY_LABEL = { high: "Высокий", medium: "Средний", low: "Низкий" } as const;

function rowStatusTone(s: ShowcaseDistributionRow["status"]) {
  if (s === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (s === "attention") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-red-200 bg-red-50 text-red-900";
}

function rowStatusLabel(s: ShowcaseDistributionRow["status"]) {
  if (s === "ok") return "Ок";
  if (s === "attention") return "Внимание";
  return "Критично";
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  onApplied: () => void;
};

export function DealerShowcaseDistributionSection({ row, profile, onApplied }: Props) {
  const canView = canViewShowcaseDistribution(profile, row);
  if (!canView) return null;

  const readOnly = isShowcaseReadOnly(profile);
  const canWorkflow = canWorkflowShowcaseTask(profile, row);
  const canComplete = canCompleteShowcaseTask(profile, row);

  const [tick, setTick] = useState(0);
  const bump = useCallback(() => {
    setTick((n) => n + 1);
    onApplied();
  }, [onApplied]);

  const storage = useMemo(() => loadShowcaseStorage(), [tick]);
  const rows = useMemo(() => mergeDistributionWithOverrides(row, storage), [row, storage]);
  const tasks = useMemo(() => getShowcaseTasksForDealerDisplay(row, storage), [row, storage]);
  const kpis = useMemo(() => getShowcaseKpis(rows, tasks), [rows, tasks]);

  const [completeTask, setCompleteTask] = useState<ShowcaseTask | null>(null);
  const [actualInput, setActualInput] = useState("");
  const [resultKind, setResultKind] = useState<ShowcaseCompleteResultKind>("added_models");
  const [comment, setComment] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextText, setNextText] = useState("");

  const actorLabel = userLabelFromProfile(profile);

  const openComplete = (t: ShowcaseTask) => {
    setCompleteTask(t);
    setActualInput(String(t.actualCount));
    setResultKind("added_models");
    setComment("");
    setNextDate("");
    setNextText("");
  };

  const submitComplete = () => {
    if (!completeTask || !canComplete) return;
    const n = parseInt(actualInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    applyShowcaseTaskCompleteSafe(row, {
      taskId: completeTask.taskId,
      categoryId: completeTask.categoryId,
      newActualCount: n,
      resultKind,
      comment: comment.trim() || "—",
      nextActionDate: nextDate.trim() || "—",
      nextActionText: nextText.trim() || "—",
      actorUserId: profile.personaUserId,
      actorLabel,
    });
    setCompleteTask(null);
    bump();
  };

  const tasksHref = useMemo(() => buildHashPath("/tasks", { dealerId: row.id }), [row.id]);

  return (
    <section
      id="dealer-section-showcase-distribution"
      data-testid="section-dealer-showcase-distribution"
      className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Витрина и задачи</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            План и факт по категориям и открытые задачи. Данные раздела сохраняются до закрытия вкладки.
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {kpis.openTasks > 0
              ? "Есть открытые задачи — завершите их после фактической выкладки образцов."
              : "Открытых задач по витрине нет."}
          </p>
        </div>
        <Link
          href={tasksHref}
          className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          data-testid="link-dealer-showcase-open-tasks"
        >
          Задачи клиента
        </Link>
      </div>

      {readOnly ? (
        <p className="text-xs text-muted-foreground">Режим просмотра: выполнение и смена статусов недоступны.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 shadow-xs"
          data-testid="card-showcase-kpi-completion"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Выполнение</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.completionPct}%</p>
        </div>
        <div
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 shadow-xs"
          data-testid="card-showcase-kpi-deficit"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дефицит</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.deficitTotal}</p>
        </div>
        <div
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 shadow-xs"
          data-testid="card-showcase-kpi-open-tasks"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Открытые задачи</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.openTasks}</p>
        </div>
        <div
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 shadow-xs"
          data-testid="card-showcase-kpi-critical-zones"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Критичные зоны</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.criticalZones}</p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
        <CardHeader className="space-y-0.5 p-3 pb-2">
          <CardTitle className="text-sm">Категории</CardTitle>
          <CardDescription className="text-xs">План / факт / дефицит</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3 pt-0">
          {rows.map((r) => (
            <div
              key={r.categoryId}
              data-testid={`row-showcase-category-${r.categoryId}`}
              className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/15 px-2.5 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm font-medium text-foreground">{SHOWCASE_CATEGORY_LABEL[r.categoryId]}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground sm:text-sm">
                <span>
                  План <span className="font-semibold text-foreground">{r.targetCount}</span>
                </span>
                <span>
                  Факт <span className="font-semibold text-foreground">{r.actualCount}</span>
                </span>
                <span>
                  Деф. <span className="font-semibold text-foreground">{r.deficitCount}</span>
                </span>
                <Badge variant="outline" className={cn("text-xs font-medium", rowStatusTone(r.status))}>
                  {rowStatusLabel(r.status)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Открытые задачи</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных задач по дефициту.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.taskId}
                data-testid={`card-showcase-task-${t.taskId}`}
                className="min-w-0 rounded-lg border border-border/70 bg-card p-3 shadow-xs"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs font-medium">
                        {TASK_STATUS_LABEL[t.status]}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-muted/40 text-xs font-medium">
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-muted/40 text-xs tabular-nums">
                        Срок {t.dueDate}
                      </Badge>
                    </div>
                    {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                    {t.status === "done" && t.completedAt ? (
                      <p className="text-[11px] text-muted-foreground">Завершено {t.completedAt}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[min(100%,14rem)] sm:flex-col sm:items-stretch">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
                      disabled={!canComplete || t.status === "done"}
                      data-testid={`button-showcase-task-complete-${t.taskId}`}
                      onClick={() => openComplete(t)}
                    >
                      Выполнить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
                      disabled={!canWorkflow || t.status === "done"}
                      data-testid={`button-showcase-task-postpone-${t.taskId}`}
                      onClick={() => {
                        applyShowcaseTaskStatus(t.taskId, "postponed", actorLabel);
                        bump();
                      }}
                    >
                      Отложить
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
                      disabled={!canWorkflow || t.status === "done"}
                      data-testid={`button-showcase-task-needs-rop-${t.taskId}`}
                      onClick={() => {
                        applyShowcaseTaskStatus(t.taskId, "needs_rop", actorLabel);
                        bump();
                      }}
                    >
                      Нужна помощь РОПа
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-8 flex-1 text-xs sm:flex-none"
                      disabled={!canWorkflow || t.status === "done" || t.status === "in_progress"}
                      data-testid={`button-showcase-task-start-${t.taskId}`}
                      onClick={() => {
                        applyShowcaseTaskStatus(t.taskId, "in_progress", actorLabel);
                        bump();
                      }}
                    >
                      В работу
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={completeTask != null} onOpenChange={(o) => !o && setCompleteTask(null)}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-md"
          data-testid={completeTask ? `form-showcase-task-complete-${completeTask.taskId}` : "form-showcase-task-complete"}
        >
          <DialogHeader>
            <DialogTitle>Завершение задачи</DialogTitle>
          </DialogHeader>
          {completeTask ? (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor={`input-showcase-actual-count-${completeTask.taskId}`}>Новый факт (кол-во позиций)</Label>
                <Input
                  id={`input-showcase-actual-count-${completeTask.taskId}`}
                  inputMode="numeric"
                  value={actualInput}
                  onChange={(e) => setActualInput(e.target.value)}
                  data-testid={`input-showcase-actual-count-${completeTask.taskId}`}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label>Результат</Label>
                <Select value={resultKind} onValueChange={(v) => setResultKind(v as ShowcaseCompleteResultKind)}>
                  <SelectTrigger data-testid={`select-showcase-result-kind-${completeTask.taskId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "added_models",
                        "agreed_installation",
                        "updated_samples",
                        "photo_report",
                        "client_refused",
                      ] as ShowcaseCompleteResultKind[]
                    ).map((k) => (
                      <SelectItem key={k} value={k}>
                        {showcaseCompleteResultLabel(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`textarea-showcase-result-comment-${completeTask.taskId}`}>Комментарий</Label>
                <Textarea
                  id={`textarea-showcase-result-comment-${completeTask.taskId}`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  data-testid={`textarea-showcase-result-comment-${completeTask.taskId}`}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`input-showcase-next-action-date-${completeTask.taskId}`}>Следующее действие — дата</Label>
                <Input
                  id={`input-showcase-next-action-date-${completeTask.taskId}`}
                  placeholder="ДД.ММ.ГГГГ"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  data-testid={`input-showcase-next-action-date-${completeTask.taskId}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`textarea-showcase-next-action-text-${completeTask.taskId}`}>Следующее действие — текст</Label>
                <Textarea
                  id={`textarea-showcase-next-action-text-${completeTask.taskId}`}
                  value={nextText}
                  onChange={(e) => setNextText(e.target.value)}
                  data-testid={`textarea-showcase-next-action-text-${completeTask.taskId}`}
                  rows={2}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCompleteTask(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={submitComplete} disabled={!canComplete}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
