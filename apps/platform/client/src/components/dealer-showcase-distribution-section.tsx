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

  const tasksHref = useMemo(
    () =>
      buildHashPath("/tasks"),
    [],
  );

  return (
    <section
      id="dealer-section-showcase-distribution"
      data-testid="section-dealer-showcase-distribution"
      className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Витрина и дистрибуция</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            План и факт по ключевым категориям выкладки и задачи на точке. Изменения в этом разделе сохраняются в браузере до закрытия вкладки.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-10 shrink-0 self-start border-border bg-card">
          <Link href={tasksHref} data-testid="link-dealer-showcase-open-tasks">
            Все задачи по витрине
          </Link>
        </Button>
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">Режим просмотра: выполнение и смена статусов недоступны.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
          data-testid="card-showcase-kpi-completion"
        >
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Выполнение витрины
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{kpis.completionPct}%</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
          data-testid="card-showcase-kpi-deficit"
        >
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Дефицит всего
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{kpis.deficitTotal}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
          data-testid="card-showcase-kpi-open-tasks"
        >
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Открытые задачи
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{kpis.openTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
          data-testid="card-showcase-kpi-critical-zones"
        >
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Критичные зоны
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{kpis.criticalZones}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Категории</CardTitle>
          <CardDescription>План / факт / дефицит по витрине</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-4 pt-0">
          {rows.map((r) => (
            <div
              key={r.categoryId}
              data-testid={`row-showcase-category-${r.categoryId}`}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 font-medium text-foreground">{SHOWCASE_CATEGORY_LABEL[r.categoryId]}</div>
              <div className="flex flex-wrap gap-2 text-sm tabular-nums text-muted-foreground">
                <span>
                  План <span className="font-semibold text-foreground">{r.targetCount}</span>
                </span>
                <span>
                  Факт <span className="font-semibold text-foreground">{r.actualCount}</span>
                </span>
                <span>
                  Дефицит <span className="font-semibold text-foreground">{r.deficitCount}</span>
                </span>
                <Badge variant="outline" className={cn("font-medium", rowStatusTone(r.status))}>
                  {rowStatusLabel(r.status)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Задачи по витрине</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных задач по дефициту — витрина закрыта по плану.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tasks.map((t) => (
              <Card
                key={t.taskId}
                data-testid={`card-showcase-task-${t.taskId}`}
                className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
              >
                <CardHeader className="space-y-2 pb-2 pt-4">
                  <CardTitle className="text-base leading-snug">{t.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-medium">
                      {TASK_STATUS_LABEL[t.status]}
                    </Badge>
                    <Badge variant="outline" className="border-border bg-muted/50 font-medium">
                      {PRIORITY_LABEL[t.priority]}
                    </Badge>
                    <Badge variant="outline" className="border-border bg-muted/50 font-medium tabular-nums">
                      Срок {t.dueDate}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  {t.status === "done" && t.completedAt ? (
                    <p className="text-xs text-muted-foreground">Завершено {t.completedAt}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    disabled={!canWorkflow || t.status === "done" || t.status === "in_progress"}
                    data-testid={`button-showcase-task-start-${t.taskId}`}
                    onClick={() => {
                      applyShowcaseTaskStatus(t.taskId, "in_progress", actorLabel);
                      bump();
                    }}
                  >
                    В работу
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-9"
                    disabled={!canComplete || t.status === "done"}
                    data-testid={`button-showcase-task-complete-${t.taskId}`}
                    onClick={() => openComplete(t)}
                  >
                    Выполнить
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-9"
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
                    className="min-h-9"
                    disabled={!canWorkflow || t.status === "done"}
                    data-testid={`button-showcase-task-postpone-${t.taskId}`}
                    onClick={() => {
                      applyShowcaseTaskStatus(t.taskId, "postponed", actorLabel);
                      bump();
                    }}
                  >
                    Отложить
                  </Button>
                </CardContent>
              </Card>
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
