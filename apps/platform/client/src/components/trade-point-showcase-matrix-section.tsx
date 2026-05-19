import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, MoreHorizontal, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getProductById, tradePointShowcaseStatusForProduct, type CatalogProduct } from "@/lib/catalog-data";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  getShowcaseMatrixModelsForTradePoint,
  priorityLabelRu,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import {
  canEditTradePointShowcaseMatrix,
  canViewTradePointShowcaseMatrix,
  computeTradePointShowcaseMatrixStats,
  getEffectiveMatrixEntry,
  getEffectiveMatrixStatus,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
  SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY,
  statusLabelRu,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import type { ShowcaseTask } from "@/lib/showcase-distribution-data";
import type { TradePointMatrixSummary } from "@/lib/trade-point-matrix-data";
import type { MatrixTask, MatrixTaskRecommendation } from "@/lib/trade-point-task-data";
import {
  getShowcaseMatrixDeficitTasksForTradePoint,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
} from "@/lib/trade-point-task-data";
import { ShowcaseModelPresentationDialog } from "@/components/showcase-model-presentation-dialog";

export type ShowcaseMatrixViewMode = "large" | "compact" | "mini" | "list";

type ShowcaseMatrixQuickFilterId = "needed" | "installed" | "postponed" | "not_relevant" | "all";

function readViewModeFromStorage(): ShowcaseMatrixViewMode {
  if (typeof window === "undefined") return "compact";
  try {
    const raw = window.localStorage.getItem(SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY);
    if (raw === "large" || raw === "compact" || raw === "mini" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "compact";
}

function priorityBadgeClass(p: ShowcaseMatrixModelDefinition["basePriority"]) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function statusBadgeClass(s: ShowcaseMatrixStatusId) {
  if (s === "installed") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (s === "postponed") return "border-slate-300 bg-slate-100 text-slate-800";
  if (s === "not_relevant") return "border-border bg-muted/80 text-muted-foreground";
  return "border-amber-500/80 bg-amber-100 text-amber-950 ring-1 ring-amber-400/50";
}

function matrixCardShellClass(st: ShowcaseMatrixStatusId): string {
  if (st === "need_install") {
    return "border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-50/40 shadow-md ring-1 ring-amber-300/40";
  }
  if (st === "installed") {
    return "border border-emerald-200/90 bg-card shadow-sm";
  }
  if (st === "postponed") {
    return "border border-slate-200 bg-slate-50/60 shadow-sm";
  }
  return "border border-dashed border-border/80 bg-muted/20 opacity-[0.92] shadow-sm";
}

function modelMatchesQuickFilter(st: ShowcaseMatrixStatusId, f: ShowcaseMatrixQuickFilterId): boolean {
  if (f === "all") return true;
  if (f === "needed") return st === "need_install";
  if (f === "installed") return st === "installed";
  if (f === "postponed") return st === "postponed";
  return st === "not_relevant";
}

function recPriorityBadgeClass(p: MatrixTaskRecommendation["priority"]) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

/** Фото двери целиком: фиксированная рамка + object-contain + нейтральный фон. */
function ModelDoorPhotoFrame({
  src,
  alt,
  frameClass,
  imgTestId,
}: {
  src: string;
  alt?: string;
  frameClass: string;
  imgTestId?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted/50",
        frameClass,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ""}
          data-testid={imgTestId}
          className="max-h-full max-w-full object-contain object-center p-1"
          loading="lazy"
        />
      ) : (
        <span className="text-[9px] text-muted-foreground">Нет фото</span>
      )}
    </div>
  );
}

export type TradePointShowcasePageBundle = {
  matrixSummary: TradePointMatrixSummary;
  showcaseComment: string;
  distribution: DealerTradePoint["distribution"];
  distributionConclusion: string;
  tpProducts: CatalogProduct[];
  showcaseTasksOpen: ShowcaseTask[];
  openTasksCount: number;
  recommendations: MatrixTaskRecommendation[];
  createdTaskByProductId: Map<string, MatrixTask>;
  onCreateMatrixTask: (rec: MatrixTaskRecommendation) => void;
  onScrollToMatrixTask: (taskId: string) => void;
  matrixTasksSlot: ReactNode;
  tasksLinkHref: string;
};

type Props = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  page: TradePointShowcasePageBundle;
};

export function TradePointShowcaseMatrixSection({ dealer, point, profile, actorUserId, actorName, page }: Props) {
  const canView = useMemo(() => canViewTradePointShowcaseMatrix(profile, dealer), [profile, dealer]);
  const canEdit = useMemo(() => canEditTradePointShowcaseMatrix(profile, dealer), [profile, dealer]);

  const [bump, setBump] = useState(0);
  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  const storage = useMemo(() => {
    void bump;
    return loadShowcaseMatrixStorage();
  }, [bump]);

  const models = useMemo(
    () => getShowcaseMatrixModelsForTradePoint(dealer.id, point.id, dealer.clientCategory),
    [dealer.id, dealer.clientCategory, point.id],
  );

  const deficitTasks = useMemo(() => {
    void bump;
    return getShowcaseMatrixDeficitTasksForTradePoint(dealer.id, point.id);
  }, [bump, dealer.id, point.id]);

  const matrixCompletionPct = useMemo(
    () => computeTradePointShowcaseMatrixStats(dealer, point, storage).completionPct,
    [dealer, point, storage],
  );

  const priorityNeedModels = useMemo(() => {
    const pr: Record<ShowcaseMatrixModelDefinition["basePriority"], number> = { high: 0, medium: 1, low: 2 };
    return models
      .filter((m) => getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage) === "need_install")
      .sort((a, b) => pr[a.basePriority] - pr[b.basePriority] || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [models, storage, dealer.id, point.id]);

  const statusCounts = useMemo(() => {
    const acc: Record<ShowcaseMatrixStatusId, number> = {
      need_install: 0,
      installed: 0,
      postponed: 0,
      not_relevant: 0,
    };
    for (const m of models) {
      const st = getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage);
      acc[st] += 1;
    }
    return acc;
  }, [models, storage, dealer.id, point.id]);

  const [userQuickFilter, setUserQuickFilter] = useState<ShowcaseMatrixQuickFilterId | null>(null);
  const autoQuickFilter: ShowcaseMatrixQuickFilterId = statusCounts.need_install > 0 ? "needed" : "all";
  const activeQuickFilter = userQuickFilter ?? autoQuickFilter;

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const st = getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage);
      return modelMatchesQuickFilter(st, activeQuickFilter);
    });
  }, [models, storage, dealer.id, point.id, activeQuickFilter]);

  const [viewMode, setViewMode] = useState<ShowcaseMatrixViewMode>("compact");
  const [viewHydrated, setViewHydrated] = useState(false);

  useEffect(() => {
    setViewMode(readViewModeFromStorage());
    setViewHydrated(true);
  }, []);

  useEffect(() => {
    if (!viewHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode, viewHydrated]);

  const [presentationModel, setPresentationModel] = useState<ShowcaseMatrixModelDefinition | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);
  /** Локальное раскрытие деталей карточки (компакт/мини), без localStorage. */
  const [matrixCardDetailsOpenById, setMatrixCardDetailsOpenById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMatrixCardDetailsOpenById({});
  }, [viewMode]);

  const openPresentation = useCallback((m: ShowcaseMatrixModelDefinition) => {
    setPresentationModel(m);
    setPresentationOpen(true);
  }, []);

  const persist = useCallback(
    (model: ShowcaseMatrixModelDefinition, status: ShowcaseMatrixStatusId, comment: string) => {
      upsertShowcaseMatrixModelState({
        dealerId: dealer.id,
        tradePointId: point.id,
        model,
        status,
        comment,
        actorUserId,
        actorName,
      });
    },
    [actorName, actorUserId, dealer.id, point.id],
  );

  if (!canView) return null;

  const gridClass =
    viewMode === "large"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
      : viewMode === "compact"
        ? "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        : viewMode === "mini"
          ? "grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          : "flex flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card";

  return (
    <>
      <section
        id="section-trade-point-showcase-matrix"
        data-testid="section-trade-point-showcase-matrix"
        className="scroll-mt-28 space-y-4 overflow-x-hidden min-w-0 sm:scroll-mt-32"
      >
        <div
          data-testid="section-trade-point-showcase-unified"
          className="space-y-4 rounded-2xl border border-border/80 bg-muted/10 p-3 sm:p-4"
        >
          <div data-testid="section-trade-point-showcase" className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Витрина торговой точки</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Что стоит, что нужно поставить и какие задачи есть по этой точке. Статусы матрицы сохраняются в этом браузере.
              </p>
            </div>

            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                Нужно поставить:{" "}
                <span data-testid="text-showcase-matrix-needed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.need_install}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                На витрине:{" "}
                <span data-testid="text-showcase-matrix-installed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.installed}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Отложено:{" "}
                <span data-testid="text-showcase-matrix-postponed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.postponed}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Не актуально:{" "}
                <span data-testid="text-showcase-matrix-not-relevant-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.not_relevant}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Выполнение:{" "}
                <span className="font-semibold tabular-nums text-foreground">{matrixCompletionPct}%</span>
              </span>
              {page.openTasksCount > 0 ? (
                <>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <span>
                    Открытых задач:{" "}
                    <span className="font-semibold tabular-nums text-foreground">{page.openTasksCount}</span>
                  </span>
                </>
              ) : null}
            </p>

            <div
              id="section-trade-point-showcase-focus"
              data-testid="section-trade-point-showcase-focus"
              className="rounded-xl border border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/80 px-3 py-2.5 sm:px-4"
            >
              {priorityNeedModels.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/90">В первую очередь поставить</p>
                  <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {priorityNeedModels.map((m) => (
                      <li key={m.id} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-200/90 bg-background/70 px-2 py-1.5 sm:min-w-[200px] sm:flex-none">
                        <ModelDoorPhotoFrame src={m.imageUrl} alt="" frameClass="h-11 w-9 sm:h-12 sm:w-10" />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-foreground hover:underline"
                          onClick={() => openPresentation(m)}
                        >
                          {m.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm font-medium text-emerald-900">Матрица витрины выполнена по статусам «нужно поставить».</p>
              )}
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={activeQuickFilter === "needed" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-filter-needed"
                  onClick={() => setUserQuickFilter("needed")}
                >
                  Нужно поставить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeQuickFilter === "installed" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-filter-installed"
                  onClick={() => setUserQuickFilter("installed")}
                >
                  На витрине
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeQuickFilter === "postponed" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-filter-postponed"
                  onClick={() => setUserQuickFilter("postponed")}
                >
                  Отложено
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeQuickFilter === "not_relevant" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-filter-not-relevant"
                  onClick={() => setUserQuickFilter("not_relevant")}
                >
                  Не актуально
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeQuickFilter === "all" ? "secondary" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-filter-all"
                  onClick={() => setUserQuickFilter("all")}
                >
                  Все
                </Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "large" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-view-large"
                  onClick={() => setViewMode("large")}
                >
                  Крупно
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "compact" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-view-compact"
                  onClick={() => setViewMode("compact")}
                >
                  Компактно
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "mini" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-view-mini"
                  onClick={() => setViewMode("mini")}
                >
                  Мини
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  data-testid="button-showcase-matrix-view-list"
                  onClick={() => setViewMode("list")}
                >
                  Список
                </Button>
              </div>
            </div>
          </div>

          <div data-testid="section-trade-point-showcase-recommended-tasks" className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Задачи по матрице</p>
            {deficitTasks.length === 0 && page.recommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет открытых рекомендаций по дефициту матрицы витрины.</p>
            ) : (
              <div className="space-y-2">
                {deficitTasks.length > 0 ? (
                  <ul className="space-y-2">
                    {deficitTasks.slice(0, 6).map((t) => (
                      <li key={t.taskId} className="flex gap-2 rounded-lg border border-border/70 bg-card/80 px-2 py-2 text-sm">
                        <ModelDoorPhotoFrame
                          src={t.showcaseMatrixImageSrc ?? ""}
                          alt=""
                          frameClass="h-12 w-10 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug text-foreground">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {MATRIX_TASK_STATUS_LABEL[t.status]} · срок {t.dueDate}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {page.recommendations.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {page.recommendations.slice(0, 6).map((rec) => {
                      const created = page.createdTaskByProductId.get(rec.productId);
                      const img = getProductById(rec.productId)?.image ?? "";
                      return (
                        <div key={rec.taskId} className="flex gap-2 rounded-lg border border-border/80 bg-card p-2 shadow-sm">
                          <ModelDoorPhotoFrame src={img} alt="" frameClass="h-14 w-11 shrink-0" />
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex flex-wrap items-start justify-between gap-1">
                              <p className="min-w-0 font-semibold leading-snug text-foreground">{rec.title}</p>
                              <Badge variant="outline" className={cn("shrink-0 text-[10px] font-medium", recPriorityBadgeClass(rec.priority))}>
                                {MATRIX_TASK_PRIORITY_LABEL[rec.priority]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {MATRIX_TASK_TYPE_LABEL[rec.type]} · Зона {rec.zone} · Срок {rec.dueDate}
                            </p>
                            {created ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 w-full text-xs"
                                data-testid={`button-focus-recommended-matrix-task-${rec.taskId}`}
                                onClick={() => page.onScrollToMatrixTask(created.taskId)}
                              >
                                {MATRIX_TASK_STATUS_LABEL[created.status]} · открыть
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="h-8 w-full text-xs font-semibold"
                                data-testid={`button-create-matrix-task-recommended-${rec.taskId}`}
                                onClick={() => page.onCreateMatrixTask(rec)}
                              >
                                Создать задачу
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Матрица моделей</p>

        {filteredModels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            <p>Нет моделей в выбранном фильтре.</p>
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setUserQuickFilter("all")}>
              Показать все
            </Button>
          </div>
        ) : (
          <div className={cn(gridClass, viewMode === "list" && "divide-y divide-border/80")}>
            {filteredModels.map((m) => {
              const st = getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage);
              const entry = getEffectiveMatrixEntry(dealer.id, point.id, m.id, storage);
              const commentVal = entry.comment ?? "";

              if (viewMode === "list") {
                return (
                  <div
                    key={m.id}
                    data-testid={`row-trade-point-showcase-model-${m.id}`}
                    className={cn(
                      "flex min-w-0 flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-3",
                      matrixCardShellClass(st),
                      st === "not_relevant" && "opacity-80",
                    )}
                  >
                    <button type="button" className="shrink-0 self-start sm:self-center" onClick={() => openPresentation(m)}>
                      <ModelDoorPhotoFrame
                        src={m.imageUrl}
                        alt=""
                        frameClass="h-12 w-10 sm:h-11 sm:w-9"
                        imgTestId={`image-trade-point-showcase-model-${m.id}`}
                      />
                    </button>
                    <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                      <button
                        type="button"
                        className="min-w-0 text-left font-semibold leading-snug text-foreground hover:underline"
                        data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                        onClick={() => openPresentation(m)}
                      >
                        {m.name}
                      </button>
                      <Badge variant="outline" className="w-fit shrink-0 border-border bg-muted/40 text-[10px] font-medium">
                        {m.typeLabelRu}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("w-fit shrink-0 text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                        data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                      >
                        {priorityLabelRu(m.basePriority)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("w-fit shrink-0 text-[10px] font-medium", statusBadgeClass(st))}
                        data-testid={`badge-trade-point-showcase-status-${m.id}`}
                      >
                        {statusLabelRu(st)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:ml-auto sm:shrink-0 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px]"
                        data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                        onClick={() => openPresentation(m)}
                      >
                        Презентация
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 text-[11px]"
                            data-testid={`button-trade-point-showcase-mark-installed-${m.id}`}
                            onClick={() => persist(m, "installed", commentVal)}
                          >
                            Витрина
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[11px]"
                            data-testid={`button-trade-point-showcase-postpone-${m.id}`}
                            onClick={() => persist(m, "postponed", commentVal)}
                          >
                            Отложить
                          </Button>
                          <Collapsible className="w-full min-w-0 sm:w-auto">
                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[11px] text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                                Ещё
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 w-full space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full justify-start text-[11px] text-muted-foreground"
                                onClick={() => persist(m, "not_relevant", commentVal)}
                              >
                                Не актуально
                              </Button>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground" htmlFor={`showcase-cmt-list-${m.id}`}>
                                  Комментарий
                                </Label>
                                <Textarea
                                  id={`showcase-cmt-list-${m.id}`}
                                  rows={2}
                                  className="min-h-[48px] resize-y text-xs"
                                  data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                                  readOnly={!canEdit}
                                  value={commentVal}
                                  onChange={(e) => {
                                    if (!canEdit) return;
                                    upsertShowcaseMatrixModelState({
                                      dealerId: dealer.id,
                                      tradePointId: point.id,
                                      model: m,
                                      status: st,
                                      comment: e.target.value,
                                      actorUserId,
                                      actorName,
                                    });
                                  }}
                                />
                              </div>
                              {canEdit ? (
                                <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                                  <Link href={`/catalog/${m.id}`}>Каталог</Link>
                                </Button>
                              ) : null}
                            </CollapsibleContent>
                          </Collapsible>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const isMini = viewMode === "mini";
              const isCompact = viewMode === "compact";
              const detailsOpen = !!matrixCardDetailsOpenById[m.id];

              if (isCompact || isMini) {
                const densityPhotoClass = isMini
                  ? "min-h-[6.25rem] w-full bg-neutral-50 sm:min-h-[6.75rem]"
                  : "min-h-[10.5rem] w-full bg-neutral-50 sm:min-h-[11.5rem]";
                const densityPad = isMini ? "p-1.5" : "p-2.5";
                const densityRounded = isMini ? "rounded-xl" : "rounded-2xl";
                const detailsTriggerLabel = isMini ? "Ещё" : "Подробнее";
                const titleClass = cn(
                  "min-w-0 max-w-full break-words font-semibold leading-snug text-foreground line-clamp-2",
                  isMini ? "text-[11px]" : "text-sm",
                );

                return (
                  <Card
                    key={m.id}
                    data-testid={`row-trade-point-showcase-model-${m.id}`}
                    className={cn(
                      "min-w-0 overflow-hidden shadow-md",
                      densityRounded,
                      matrixCardShellClass(st),
                      st === "not_relevant" && "opacity-[0.88]",
                    )}
                  >
                    <div className="flex w-full min-w-0 flex-col">
                      <button type="button" className="relative w-full shrink-0 text-left" onClick={() => openPresentation(m)}>
                        <ModelDoorPhotoFrame
                          src={m.imageUrl}
                          alt=""
                          frameClass={densityPhotoClass}
                          imgTestId={`image-trade-point-showcase-model-${m.id}`}
                        />
                      </button>
                      <CardContent className={cn("flex min-w-0 flex-col gap-2", densityPad)}>
                        <div className="min-w-0 space-y-1.5">
                          <p className={titleClass} data-testid={`text-trade-point-showcase-model-title-${m.id}`}>
                            {m.name}
                          </p>
                          {isCompact ? (
                            <div className="flex min-w-0 flex-wrap gap-1">
                              <Badge variant="outline" className="max-w-full shrink-0 text-[10px] font-medium">
                                {m.typeLabelRu}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn("max-w-full shrink-0 text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                                data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                              >
                                {priorityLabelRu(m.basePriority)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn("max-w-full shrink-0 text-[10px] font-medium", statusBadgeClass(st))}
                                data-testid={`badge-trade-point-showcase-status-${m.id}`}
                              >
                                {statusLabelRu(st)}
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "max-w-full text-[10px] font-semibold",
                                  st === "need_install"
                                    ? "border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-300/50"
                                    : st === "installed"
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                      : statusBadgeClass(st),
                                )}
                                data-testid={`badge-trade-point-showcase-status-${m.id}`}
                              >
                                {statusLabelRu(st)}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {canEdit ? (
                          <Button
                            type="button"
                            variant={st === "need_install" ? "default" : "secondary"}
                            size="sm"
                            className={cn(
                              "h-9 w-full text-xs",
                              st === "need_install" && "font-semibold shadow-sm ring-1 ring-amber-400/55",
                              st === "installed" && "border border-emerald-200/90 bg-emerald-50/80 font-medium text-emerald-950 hover:bg-emerald-50",
                            )}
                            data-testid={`button-trade-point-showcase-mark-installed-${m.id}`}
                            onClick={() => persist(m, "installed", commentVal)}
                          >
                            На витрине
                          </Button>
                        ) : null}

                        <Collapsible
                          open={detailsOpen}
                          onOpenChange={(open) =>
                            setMatrixCardDetailsOpenById((prev) => ({
                              ...prev,
                              [m.id]: open,
                            }))
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn("h-8 w-full gap-1 text-xs", isMini && "h-7 text-[11px]")}
                              data-testid={`button-showcase-matrix-card-details-${m.id}`}
                            >
                              {isMini ? <MoreHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
                              {detailsTriggerLabel}
                              <ChevronDown
                                className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", detailsOpen && "rotate-180")}
                                aria-hidden
                              />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <section
                              data-testid={`section-showcase-matrix-card-details-${m.id}`}
                              className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/20 p-2"
                            >
                              {isMini ? (
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-[10px] font-medium">
                                    {m.typeLabelRu}
                                  </Badge>
                                  <Badge variant="outline" className={cn("text-[10px] font-medium", priorityBadgeClass(m.basePriority))}>
                                    {priorityLabelRu(m.basePriority)}
                                  </Badge>
                                </div>
                              ) : null}
                              <p className="text-xs leading-relaxed text-muted-foreground break-words">{m.importanceReason}</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-full text-xs"
                                data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                                onClick={() => openPresentation(m)}
                              >
                                Презентация
                              </Button>
                              {canEdit ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full text-xs"
                                    data-testid={`button-trade-point-showcase-postpone-${m.id}`}
                                    onClick={() => persist(m, "postponed", commentVal)}
                                  >
                                    Отложить
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-full text-xs text-muted-foreground"
                                    onClick={() => persist(m, "not_relevant", commentVal)}
                                  >
                                    Не актуально
                                  </Button>
                                </>
                              ) : null}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground" htmlFor={`showcase-cmt-density-${m.id}`}>
                                  Комментарий менеджера
                                </Label>
                                <Textarea
                                  id={`showcase-cmt-density-${m.id}`}
                                  rows={2}
                                  className={cn("min-h-[48px] resize-y", isMini ? "text-[11px]" : "text-xs")}
                                  data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                                  readOnly={!canEdit}
                                  value={commentVal}
                                  onChange={(e) => {
                                    if (!canEdit) return;
                                    upsertShowcaseMatrixModelState({
                                      dealerId: dealer.id,
                                      tradePointId: point.id,
                                      model: m,
                                      status: st,
                                      comment: e.target.value,
                                      actorUserId,
                                      actorName,
                                    });
                                  }}
                                />
                              </div>
                              {canEdit ? (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                                >
                                  <Link href={`/catalog/${m.id}`}>Открыть в каталоге</Link>
                                </Button>
                              ) : null}
                            </section>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </div>
                  </Card>
                );
              }

              const photoFrameClass = "min-h-[168px] w-full sm:min-h-[180px] sm:w-[172px]";
              const cardPad = "p-3 sm:p-3.5";
              const rounded = "rounded-2xl";

              return (
                <Card
                  key={m.id}
                  data-testid={`row-trade-point-showcase-model-${m.id}`}
                  className={cn("overflow-hidden shadow-md", rounded, matrixCardShellClass(st), st === "not_relevant" && "opacity-[0.88]")}
                >
                  <div className="flex w-full min-w-0 flex-col sm:flex-row">
                    <button type="button" className="relative w-full shrink-0 text-left sm:w-[172px]" onClick={() => openPresentation(m)}>
                      <ModelDoorPhotoFrame
                        src={m.imageUrl}
                        alt=""
                        frameClass={photoFrameClass}
                        imgTestId={`image-trade-point-showcase-model-${m.id}`}
                      />
                    </button>
                    <CardContent className={cn("flex min-w-0 flex-1 flex-col gap-2", cardPad)}>
                      <button type="button" className="w-full min-w-0 text-left" onClick={() => openPresentation(m)}>
                        <div className="flex flex-col gap-1.5 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                          <p
                            className="min-w-0 text-base font-semibold leading-snug text-foreground"
                            data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                          >
                            {m.name}
                          </p>
                          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5">
                            <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                              {m.typeLabelRu}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                              data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                            >
                              {priorityLabelRu(m.basePriority)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 text-[10px] font-medium", statusBadgeClass(st))}
                              data-testid={`badge-trade-point-showcase-status-${m.id}`}
                            >
                              {statusLabelRu(st)}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.importanceReason}</p>
                      </button>

                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 flex-1 font-semibold sm:flex-none"
                          data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                          onClick={() => openPresentation(m)}
                        >
                          Презентация
                        </Button>
                        {canEdit ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="min-h-9 flex-1 font-semibold sm:flex-none"
                              data-testid={`button-trade-point-showcase-mark-installed-${m.id}`}
                              onClick={() => persist(m, "installed", commentVal)}
                            >
                              Стоит на витрине
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-9 flex-1 font-semibold sm:flex-none"
                              data-testid={`button-trade-point-showcase-postpone-${m.id}`}
                              onClick={() => persist(m, "postponed", commentVal)}
                            >
                              Отложить
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="min-h-9 flex-1 text-muted-foreground sm:flex-none"
                              onClick={() => persist(m, "not_relevant", commentVal)}
                            >
                              Не актуально
                            </Button>
                          </>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 border-t border-border/60 pt-2">
                        <Label className="text-xs text-muted-foreground" htmlFor={`showcase-cmt-${m.id}`}>
                          Комментарий менеджера
                        </Label>
                        <Textarea
                          id={`showcase-cmt-${m.id}`}
                          rows={2}
                          className="min-h-[52px] resize-y text-sm"
                          data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                          readOnly={!canEdit}
                          value={commentVal}
                          onChange={(e) => {
                            if (!canEdit) return;
                            upsertShowcaseMatrixModelState({
                              dealerId: dealer.id,
                              tradePointId: point.id,
                              model: m,
                              status: st,
                              comment: e.target.value,
                              actorUserId,
                              actorName,
                            });
                          }}
                        />
                      </div>

                      {canEdit ? (
                        <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                          <Link href={`/catalog/${m.id}`}>Открыть в каталоге</Link>
                        </Button>
                      ) : null}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
          </div>

          <Separator className="bg-border/60" />

          <div
            id="section-trade-point-showcase-current-state"
            data-testid="section-trade-point-showcase-current-state"
            className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Текущее состояние витрины</p>
            <div className="rounded-lg border border-border/70 bg-card/90 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Статус витрины: </span>
                  <span className="font-medium text-foreground">{point.showcaseStatus}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Что нужно добавить: </span>
                  <span className="font-medium text-foreground">{point.showcaseNeeds}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Оборудование: </span>
                  <span className="font-medium text-foreground">{point.equipment}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Комментарий: </span>
                  <span className="font-medium text-foreground">{page.showcaseComment}</span>
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Должно быть</p>
                  <p className="text-base font-bold tabular-nums">{page.matrixSummary.totalRequired}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-semibold uppercase text-emerald-900/80">На витрине</p>
                  <p className="text-base font-bold tabular-nums text-emerald-900">{page.matrixSummary.totalPresent}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-semibold uppercase text-red-900/80">Отсутствует</p>
                  <p className="text-base font-bold tabular-nums text-red-900">{page.matrixSummary.totalMissing}</p>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-center">
                  <p className="text-[10px] font-semibold uppercase text-primary/80">Зона A</p>
                  <p className="text-base font-bold tabular-nums text-primary">{page.matrixSummary.zoneA}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Ближайшее действие: </span>
                {dealer.nextAction}
              </p>
            </div>
          </div>

          <div
            id="section-trade-point-showcase-distribution"
            data-testid="section-trade-point-showcase-distribution"
            className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
          >
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-between text-xs sm:w-auto">
                  <span className="flex items-center gap-2">
                    <PieChart className="h-4 w-4" aria-hidden />
                    Дистрибуция на точке
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent
                className="mt-2 space-y-2 rounded-lg border border-border/70 bg-card/80 p-3"
                data-testid="section-trade-point-distribution"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "МК", pct: page.distribution.mk },
                    { label: "ВХ", pct: page.distribution.vh },
                    { label: "Общее", pct: page.distribution.total },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-border/80 bg-muted/20 px-2 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{item.label}</p>
                        <span className="text-sm font-bold tabular-nums">{item.pct}%</span>
                      </div>
                      <Progress value={item.pct} className="mt-1.5 h-2 bg-muted" />
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-foreground">{page.distributionConclusion}</p>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="space-y-2" data-testid="section-trade-point-products">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Модели на витрине</p>
            <div className="space-y-2">
              {page.tpProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/90 px-3 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold leading-snug">{p.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{p.article}</p>
                    <Badge variant="outline" className="mt-1 w-fit border-border bg-muted/50 text-[10px] font-medium">
                      {tradePointShowcaseStatusForProduct(p)}
                    </Badge>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs" data-testid={`button-open-product-${p.id}`}>
                    <Link href={`/catalog/${p.id}`}>Открыть</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div
            id="section-trade-point-showcase-open-tasks"
            data-testid="section-trade-point-showcase-open-tasks"
            className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Открытые задачи</p>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs" data-testid="button-open-all-tasks">
                <Link href={page.tasksLinkHref}>Все задачи</Link>
              </Button>
            </div>
            {point.tasks.some((t) => t.status !== "Закрыта") ? (
              <ul className="space-y-1.5 rounded-lg border border-border/70 bg-card/80 p-2 text-sm">
                {point.tasks
                  .filter((t) => t.status !== "Закрыта")
                  .map((t, idx) => (
                    <li key={`${point.id}-tp-task-${idx}`} className="leading-snug">
                      <span className="font-medium text-foreground">{t.title}</span>
                      <span className="text-muted-foreground"> · {t.status} · до {t.due}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
            {page.showcaseTasksOpen.length > 0 ? (
              <ul className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2 text-sm">
                {page.showcaseTasksOpen.map((t) => (
                  <li key={t.taskId} className="leading-snug text-foreground">
                    {t.title}
                  </li>
                ))}
              </ul>
            ) : null}
            {page.matrixTasksSlot}
          </div>
        </div>
      </section>

      <ShowcaseModelPresentationDialog open={presentationOpen} onOpenChange={setPresentationOpen} model={presentationModel} />
    </>
  );
}
