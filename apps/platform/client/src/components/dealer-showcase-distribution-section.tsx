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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useShowcaseDistributionState } from "@/hooks/use-showcase-distribution-state";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  canCompleteShowcaseTask,
  canViewShowcaseDistribution,
  canWorkflowShowcaseTask,
  getShowcaseKpis,
  getShowcaseTasksForDealerDisplay,
  isShowcaseReadOnly,
  mergeDistributionWithOverrides,
  SHOWCASE_CATEGORY_LABEL,
  type ShowcaseCompleteResultKind,
  type ShowcaseDistributionRow,
  type ShowcaseStorageV1Dto,
  type ShowcaseTask,
  type ShowcaseTaskStatus,
  showcaseCompleteResultLabel,
  showcaseOverrideStorageKey,
  userLabelFromProfile,
} from "@/lib/showcase-distribution-data";
import {
  postShowcaseRecommendation,
  postShowcaseTaskComplete,
  postShowcaseTaskStatus,
  postShowcaseDistributionImport,
} from "@/lib/showcase-distribution-api";
import {
  clearLegacyShowcaseStorage,
  readLegacyShowcaseStorage,
} from "@/lib/showcase-distribution-import-legacy";
import {
  getDistributionSnapshotForCard,
  getOutdatedShowcaseBundle,
  getShowcaseRecommendationItems,
} from "@/lib/dealer-card-release-signals";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShowcaseCategoryListMode = "all" | "deficit" | "critical";

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
  categoryListMode?: ShowcaseCategoryListMode;
  onCategoryListModeChange?: (mode: ShowcaseCategoryListMode) => void;
  distributionSnapshotStale?: boolean;
  distributionSnapshotLabel?: string;
  onPlanShowcaseCheck?: () => void;
  showcaseState?: ShowcaseStorageV1Dto | null;
  showcaseLoading?: boolean;
  onShowcaseRefresh?: () => Promise<void>;
};

function scrollToAnchor(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function DealerShowcaseDistributionSection({
  row,
  profile,
  onApplied,
  categoryListMode: categoryListModeProp,
  onCategoryListModeChange,
  distributionSnapshotStale,
  distributionSnapshotLabel,
  onPlanShowcaseCheck,
  showcaseState: showcaseStateProp,
  showcaseLoading: showcaseLoadingProp,
  onShowcaseRefresh,
}: Props) {
  const { toast } = useToast();
  const canView = canViewShowcaseDistribution(profile, row);
  const hookState = useShowcaseDistributionState(canView && showcaseStateProp === undefined ? row.id : "");
  const storage = showcaseStateProp ?? hookState.state;
  const loading = showcaseLoadingProp ?? (showcaseStateProp === undefined ? hookState.loading : false);
  const refresh = onShowcaseRefresh ?? hookState.refresh;

  if (!canView) return null;

  const readOnly = isShowcaseReadOnly(profile);
  const canWorkflow = canWorkflowShowcaseTask(profile, row);
  const canComplete = canCompleteShowcaseTask(profile, row);

  const [internalListMode, setInternalListMode] = useState<ShowcaseCategoryListMode>("all");
  const categoryListMode = categoryListModeProp ?? internalListMode;
  const setCategoryListMode = onCategoryListModeChange ?? setInternalListMode;

  const [categoryExpanded, setCategoryExpanded] = useState<Record<string, boolean>>({});
  const [taskExpanded, setTaskExpanded] = useState<Record<string, boolean>>({});
  const [outdatedOpen, setOutdatedOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [importing, setImporting] = useState(false);
  const legacyDraft = useMemo(() => readLegacyShowcaseStorage(), []);

  const emptyStorage: ShowcaseStorageV1Dto = useMemo(
    () => ({ overrides: {}, taskUpdates: {}, historyByDealer: {}, recommendationTaskEntries: {} }),
    [],
  );
  const resolvedStorage = storage ?? emptyStorage;

  const rows = useMemo(() => mergeDistributionWithOverrides(row, resolvedStorage), [row, resolvedStorage]);
  const tasks = useMemo(() => getShowcaseTasksForDealerDisplay(row, resolvedStorage), [row, resolvedStorage]);
  const kpis = useMemo(() => getShowcaseKpis(rows, tasks), [rows, tasks]);

  const displayedCategoryRows = useMemo(() => {
    if (categoryListMode === "deficit") return rows.filter((r) => r.deficitCount > 0);
    if (categoryListMode === "critical") return rows.filter((r) => r.status === "critical");
    return rows;
  }, [rows, categoryListMode]);

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

  const submitComplete = async () => {
    if (!completeTask || !canComplete || mutating) return;
    const n = parseInt(actualInput, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setMutating(true);
    try {
      await postShowcaseTaskComplete({
        taskId: completeTask.taskId,
        dealerId: row.id,
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
      await refresh();
      onApplied();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось сохранить, попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setMutating(false);
    }
  };

  const changeTaskStatus = async (task: ShowcaseTask, status: ShowcaseTaskStatus) => {
    if (mutating) return;
    setMutating(true);
    try {
      await postShowcaseTaskStatus(task.taskId, status, row.id, task.categoryId);
      await refresh();
      onApplied();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось сохранить, попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setMutating(false);
    }
  };

  const tasksHref = useMemo(() => buildHashPath("/tasks", { dealerId: row.id }), [row.id]);

  if (loading) {
    return (
      <section id="dealer-section-showcase-distribution" className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </section>
    );
  }

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
            План и факт по категориям и открытые задачи. Данные сохраняются в базе.
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

      {legacyDraft ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={importing}
            data-testid="button-import-legacy-showcase-storage"
            onClick={async () => {
              setImporting(true);
              try {
                await postShowcaseDistributionImport(legacyDraft);
                clearLegacyShowcaseStorage();
                await refresh();
                onApplied();
                toast({ title: "Данные перенесены" });
              } catch (e) {
                toast({
                  title: e instanceof Error ? e.message : "Не удалось перенести данные.",
                  variant: "destructive",
                });
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? "Перенос…" : "Перенести черновики в БД"}
          </Button>
        </div>
      ) : null}

      {readOnly ? (
        <p className="text-xs text-muted-foreground">Режим просмотра: выполнение и смена статусов недоступны.</p>
      ) : null}

      {distributionSnapshotLabel && distributionSnapshotLabel !== "—" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 text-xs sm:text-sm">
          <span className="text-muted-foreground">Дата среза дистрибуции:</span>
          <span data-testid="text-dealer-distribution-snapshot-date" className="font-semibold tabular-nums text-foreground">
            {distributionSnapshotLabel}
          </span>
          {distributionSnapshotStale ? (
            <Badge data-testid="badge-dealer-distribution-snapshot-stale" variant="destructive" className="text-[10px] font-semibold">
              Старше 2 мес.
            </Badge>
          ) : null}
          {distributionSnapshotStale && onPlanShowcaseCheck ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs font-semibold"
              data-testid="button-dealer-plan-showcase-check"
              onClick={onPlanShowcaseCheck}
            >
              Запланировать проверку витрины
            </Button>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const outdated = getOutdatedShowcaseBundle(row);
        if (!outdated) return null;
        return (
          <section
            data-testid="section-dealer-outdated-showcase"
            className="overflow-hidden rounded-lg border border-amber-200/70 bg-amber-50/30"
          >
            <button
              type="button"
              data-testid="button-dealer-outdated-showcase-toggle"
              className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-amber-50/60"
              onClick={() => setOutdatedOpen((v) => !v)}
            >
              Неактуальная витрина
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", outdatedOpen && "rotate-180")} aria-hidden />
            </button>
            {outdatedOpen ? (
              <div className="space-y-2 border-t border-amber-200/50 px-2.5 py-2 text-xs sm:text-sm">
                <p className="text-muted-foreground">{outdated.summaryReason}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Выведенные модели</p>
                <ul className="space-y-1.5">
                  {outdated.withdrawn.map((m) => (
                    <li
                      key={m.modelId}
                      data-testid={`row-dealer-outdated-model-${m.modelId}`}
                      className="rounded-md border border-border/60 bg-card/80 px-2 py-1.5"
                    >
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="text-muted-foreground"> · {SHOWCASE_CATEGORY_LABEL[m.categoryId]}</span>
                      <span className="block text-muted-foreground">{m.reason}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">К ротации</p>
                <ul className="space-y-1.5">
                  {outdated.rotation.map((m) => (
                    <li
                      key={m.modelId}
                      data-testid={`row-dealer-rotation-model-${m.modelId}`}
                      className="rounded-md border border-border/60 bg-card/80 px-2 py-1.5"
                    >
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="text-muted-foreground"> · {SHOWCASE_CATEGORY_LABEL[m.categoryId]}</span>
                      <span className="block text-muted-foreground">{m.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })()}

      {(() => {
        const recommendations = getShowcaseRecommendationItems(row);
        if (recommendations.length === 0) return null;
        const addedRec = new Set((resolvedStorage.recommendationTaskEntries?.[row.id] ?? []).map((x) => x.modelId));
        return (
          <section data-testid="section-dealer-showcase-recommendations" className="rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
            <h3 className="text-sm font-semibold text-foreground">Рекомендуем выставить</h3>
            <ul className="mt-2 space-y-2">
              {recommendations.map((item) => (
                <li
                  key={item.modelId}
                  data-testid={`row-dealer-recommended-model-${item.modelId}`}
                  className="rounded-md border border-border/60 bg-card/90 p-2 text-xs sm:text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-muted-foreground">
                        {item.bucket === "top20" ? "ТОП 20" : "Новинка"} · {SHOWCASE_CATEGORY_LABEL[item.categoryId]}
                      </p>
                      <p className="mt-1 text-muted-foreground">{item.reason}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 shrink-0 text-xs font-semibold"
                      disabled={readOnly || addedRec.has(item.modelId)}
                      data-testid={`button-dealer-add-recommendation-task-${item.modelId}`}
                      onClick={async () => {
                        if (mutating) return;
                        setMutating(true);
                        try {
                          const r = await postShowcaseRecommendation({
                            dealerId: row.id,
                            modelId: item.modelId,
                            modelLabel: item.name,
                            categoryId: item.categoryId,
                            bucket: item.bucket,
                            reason: item.reason,
                          });
                          if (!r.ok) {
                            toast({ title: r.reason ?? "Уже добавлена.", variant: "destructive" });
                            return;
                          }
                          await refresh();
                          onApplied();
                        } catch (e) {
                          toast({
                            title: e instanceof Error ? e.message : "Не удалось сохранить, попробуйте ещё раз.",
                            variant: "destructive",
                          });
                        } finally {
                          setMutating(false);
                        }
                      }}
                    >
                      {addedRec.has(item.modelId) ? "В задачах" : "Добавить в задачи по витрине"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {categoryListMode !== "all" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 px-2.5 py-2 text-xs text-amber-950">
          <span>
            {categoryListMode === "deficit" ? "Показаны категории с дефицитом." : "Показаны критичные категории."}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs font-semibold" onClick={() => setCategoryListMode("all")}>
            Показать все
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-xs transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-showcase-kpi-completion"
          onClick={() => {
            setCategoryListMode("all");
            scrollToAnchor("dealer-showcase-categories-anchor");
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Выполнение</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.completionPct}%</p>
          <p className="mt-1 text-[10px] font-medium text-primary">К категориям →</p>
        </button>
        <button
          type="button"
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-xs transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-showcase-kpi-deficit"
          onClick={() => {
            setCategoryListMode("deficit");
            scrollToAnchor("dealer-showcase-categories-anchor");
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дефицит</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.deficitTotal}</p>
          <p className="mt-1 text-[10px] font-medium text-primary">Открыть →</p>
        </button>
        <button
          type="button"
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-xs transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-showcase-kpi-open-tasks"
          onClick={() => scrollToAnchor("dealer-showcase-tasks-anchor")}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Открытые задачи</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.openTasks}</p>
          <p className="mt-1 text-[10px] font-medium text-primary">К списку →</p>
        </button>
        <button
          type="button"
          className="min-w-0 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-left shadow-xs transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-showcase-kpi-critical"
          onClick={() => {
            setCategoryListMode("critical");
            scrollToAnchor("dealer-showcase-categories-anchor");
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Критичные зоны</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{kpis.criticalZones}</p>
          <p className="mt-1 text-[10px] font-medium text-primary">Открыть →</p>
        </button>
      </div>

      <Card id="dealer-showcase-categories-anchor" className="scroll-mt-28 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs sm:scroll-mt-32">
        <CardHeader className="space-y-0.5 p-3 pb-2">
          <CardTitle className="text-sm">Категории</CardTitle>
          <CardDescription className="text-xs">План / факт / дефицит</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3 pt-0">
          {displayedCategoryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет категорий в текущем фильтре.</p>
          ) : (
            displayedCategoryRows.map((r) => {
              const catKey = r.categoryId;
              const isCatOpen = categoryExpanded[catKey] ?? false;
              const ov = resolvedStorage.overrides[showcaseOverrideStorageKey(row.id, r.categoryId)];
              const catTasks = tasks.filter((t) => t.categoryId === r.categoryId);
              return (
                <div
                  key={r.categoryId}
                  data-testid={`row-showcase-category-${r.categoryId}`}
                  className={cn(
                    "overflow-hidden rounded-md border border-border/60 bg-muted/15",
                    categoryListMode === "deficit" && r.deficitCount > 0 && "ring-2 ring-amber-300/70",
                    categoryListMode === "critical" && r.status === "critical" && "ring-2 ring-red-300/70",
                  )}
                >
                  <button
                    type="button"
                    data-testid={`button-showcase-category-toggle-${r.categoryId}`}
                    className="flex w-full items-start gap-2 px-2.5 py-2 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setCategoryExpanded((m) => ({
                        ...m,
                        [catKey]: !isCatOpen,
                      }))
                    }
                  >
                    <ChevronRight
                      className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", isCatOpen && "rotate-90")}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{SHOWCASE_CATEGORY_LABEL[r.categoryId]}</span>
                        <span className="text-[10px] font-medium text-primary">{isCatOpen ? "Свернуть" : "Открыть"}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground sm:text-sm">
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
                  </button>
                  {isCatOpen ? (
                    <div
                      data-testid={`section-showcase-category-details-${r.categoryId}`}
                      className="space-y-2 border-t border-border/60 bg-card/60 px-3 py-2 text-sm"
                    >
                      <div className="grid gap-1 text-xs sm:grid-cols-2 sm:text-sm">
                        <p>
                          <span className="text-muted-foreground">План:</span>{" "}
                          <span className="font-semibold tabular-nums text-foreground">{r.targetCount}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Факт:</span>{" "}
                          <span className="font-semibold tabular-nums text-foreground">{r.actualCount}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Дефицит:</span>{" "}
                          <span className="font-semibold tabular-nums text-foreground">{r.deficitCount}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Статус:</span>{" "}
                          <span className="font-medium text-foreground">{rowStatusLabel(r.status)}</span>
                        </p>
                      </div>
                      {ov ? (
                        <p className="text-xs text-muted-foreground">
                          Последнее изменение: {new Date(ov.updatedAt).toLocaleString("ru-RU")} · {ov.updatedBy}
                          {ov.comment ? ` · ${ov.comment}` : ""}
                        </p>
                      ) : null}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Связанные задачи</p>
                        {catTasks.length === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">Нет задач по этой категории.</p>
                        ) : (
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-foreground">
                            {catTasks.map((t) => (
                              <li key={t.taskId}>
                                {t.title} · {TASK_STATUS_LABEL[t.status]}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div id="dealer-showcase-tasks-anchor" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Открытые задачи</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных задач по дефициту.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const isTaskOpen = taskExpanded[t.taskId] ?? false;
              return (
                <div
                  key={t.taskId}
                  data-testid={`card-showcase-task-${t.taskId}`}
                  className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs"
                >
                  <button
                    type="button"
                    data-testid={`button-showcase-task-toggle-${t.taskId}`}
                    className="flex w-full items-start justify-between gap-2 p-3 text-left transition hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setTaskExpanded((m) => ({
                        ...m,
                        [t.taskId]: !isTaskOpen,
                      }))
                    }
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
                      {!isTaskOpen ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs font-medium">
                            {TASK_STATUS_LABEL[t.status]}
                          </Badge>
                          <Badge variant="outline" className="border-border bg-muted/40 text-xs tabular-nums">
                            Срок {t.dueDate}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 pt-0.5 text-[10px] font-medium text-primary">{isTaskOpen ? "Свернуть" : "Открыть"}</span>
                  </button>
                  {isTaskOpen ? (
                    <div
                      data-testid={`section-showcase-task-details-${t.taskId}`}
                      className="space-y-3 border-t border-border/60 px-3 pb-3 pt-2"
                    >
                      {t.description ? <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p> : null}
                      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-foreground">Срок:</span> {t.dueDate}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Ответственный:</span> {row.manager}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Статус:</span> {TASK_STATUS_LABEL[t.status]}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Приоритет:</span> {PRIORITY_LABEL[t.priority]}
                        </p>
                      </div>
                      {t.status === "done" && t.completedAt ? (
                        <p className="text-[11px] text-muted-foreground">Завершено {t.completedAt}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-9 flex-1 text-xs font-semibold sm:flex-none"
                          disabled={!canComplete || t.status === "done"}
                          data-testid={`button-showcase-task-complete-${t.taskId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openComplete(t);
                          }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            void changeTaskStatus(t, "postponed");
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
                          onClick={(e) => {
                            e.stopPropagation();
                            void changeTaskStatus(t, "needs_rop");
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
                          onClick={(e) => {
                            e.stopPropagation();
                            void changeTaskStatus(t, "in_progress");
                          }}
                        >
                          В работу
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
