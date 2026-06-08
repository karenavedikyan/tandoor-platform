import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DistributionFullscreenEntry } from "@/components/distribution/distribution-fullscreen-entry";
import { TradePointShowcaseParamsSection } from "@/components/trade-point-showcase-params-section";
import {
  MatrixTasksSlot,
  type MatrixTaskFilterId,
} from "@/components/trade-point-matrix-tasks-slot";
import { Card, CardContent } from "@/components/ui/card";
import { TradePointShowcaseMatrixSection } from "@/components/trade-point-showcase-matrix-section";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { formatRelativeTime } from "@/lib/format-datetime";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  filterMatrix,
  getTradePointMatrix,
  summarizeMatrix,
  type MatrixFilterId,
} from "@/lib/trade-point-matrix-data";
import {
  buildRecommendedMatrixTasks,
  invalidateMatrixTasksCache,
  type MatrixTask,
  type MatrixTaskRecommendation,
} from "@/lib/trade-point-task-data";
import { getShowcaseMatrixModelsForTradePoint } from "@/lib/trade-point-showcase-matrix-models";
import {
  canEditTradePointShowcaseMatrix,
  SHOWCASE_MATRIX_CHANGED_EVENT,
} from "@/lib/trade-point-showcase-matrix-storage";
import {
  getShowcaseTasksForDealerDisplay,
  loadShowcaseStorage,
  SHOWCASE_STORAGE_EVENT,
} from "@/lib/showcase-distribution-data";
import { cn } from "@/lib/utils";

export function freshnessLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) return "нет данных";
  return `обновлено ${formatRelativeTime(lastUpdatedAt)}`;
}

export function coverageBadgeClass(pct: number): string {
  if (pct >= 100) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (pct >= 50) return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
}

function distributionConclusion(d: DealerTradePoint["distribution"]) {
  if (d.total >= 70) return "Показатели в комфортной зоне, поддерживаем текущий уровень.";
  if (d.total >= 50) return "Есть резерв по ВХ и полноте линейки на точке.";
  return "Нужны меры по усилению дистрибуции и контролю выкладки.";
}

type DistributionTradePointMatrixEntryProps = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  onBackToList?: () => void;
};

export function DistributionTradePointMatrixEntry({
  dealer,
  point,
  profile,
  actorUserId,
  actorName,
  onBackToList,
}: DistributionTradePointMatrixEntryProps) {
  const templateModelsCount = useMemo(
    () =>
      getShowcaseMatrixModelsForTradePoint(dealer.id, point.id, dealer.clientCategory).length,
    [dealer.id, point.id, dealer.clientCategory],
  );

  const canEdit = useMemo(
    () => canEditTradePointShowcaseMatrix(profile, dealer),
    [profile, dealer],
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [showcaseBump, setShowcaseBump] = useState(0);
  const [matrixBump, setMatrixBump] = useState(0);

  const matrixItems = useMemo(() => getTradePointMatrix(dealer.id, point.id), [dealer.id, point.id]);
  const matrixSummary = useMemo(() => summarizeMatrix(matrixItems), [matrixItems]);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilterId>("all");
  const filteredMatrix = useMemo(() => filterMatrix(matrixItems, matrixFilter), [matrixItems, matrixFilter]);

  const dist = point.distribution;
  const conclusion = useMemo(() => distributionConclusion(dist), [dist]);
  const showcaseComment = useMemo(
    () =>
      dealer.hasProblem
        ? "Есть вопросы по витрине — согласовать с РМ план работ."
        : "Состояние в норме для текущего цикла.",
    [dealer.hasProblem],
  );

  const recommendations = useMemo(
    () => buildRecommendedMatrixTasks(dealer.id, point.id, point.name, matrixItems),
    [dealer.id, point.id, point.name, matrixItems, matrixBump],
  );
  const recommendationByProductId = useMemo(() => {
    const map = new Map<string, MatrixTaskRecommendation>();
    for (const r of recommendations) map.set(r.productId, r);
    return map;
  }, [recommendations]);

  const [createdTasks, setCreatedTasks] = useState<MatrixTask[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [matrixTaskFilter, setMatrixTaskFilter] = useState<MatrixTaskFilterId>("all");

  useEffect(() => {
    const fn = () => setShowcaseBump((n) => n + 1);
    window.addEventListener(SHOWCASE_STORAGE_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_STORAGE_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => {
      setMatrixBump((n) => n + 1);
      invalidateMatrixTasksCache();
    };
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    setCreatedTasks([]);
    setExpandedTaskIds(new Set());
    setMatrixTaskFilter("all");
    setMatrixFilter("all");
  }, [dealer.id, point.id]);

  const createdTaskByProductId = useMemo(() => {
    const map = new Map<string, MatrixTask>();
    for (const t of createdTasks) map.set(t.productId, t);
    return map;
  }, [createdTasks]);

  const handleCreateTask = useCallback((rec: MatrixTaskRecommendation) => {
    setCreatedTasks((prev) => {
      if (prev.some((t) => t.taskId === rec.taskId)) return prev;
      const created: MatrixTask = { ...rec, recommended: false } as MatrixTask;
      return [...prev, created];
    });
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(rec.taskId);
      return next;
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`card-matrix-task-${rec.taskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleScrollToTask = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`card-matrix-task-${taskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const filteredCreatedTasks = useMemo(() => {
    if (matrixTaskFilter === "all") return createdTasks;
    if (matrixTaskFilter === "high") return createdTasks.filter((t) => t.priority === "high");
    return createdTasks.filter((t) => t.status === matrixTaskFilter);
  }, [createdTasks, matrixTaskFilter]);

  const showcaseTasksOpen = useMemo(() => {
    const storage = loadShowcaseStorage();
    const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
    return tasks.filter((t) => t.status !== "done").slice(0, 8);
  }, [dealer, showcaseBump]);

  const openShowcaseTasksCount = useMemo(() => {
    const pointOpen = point.tasks.filter((t) => t.status !== "Закрыта").length;
    return pointOpen + showcaseTasksOpen.length;
  }, [point.tasks, showcaseTasksOpen]);

  const showcaseTasksLinkHref = useMemo(() => buildHashPath("/tasks", { dealerId: dealer.id }), [dealer.id]);

  const showcasePage = useMemo(
    () => ({
      matrixSummary,
      showcaseComment,
      distribution: dist,
      distributionConclusion: conclusion,
      productMatrixFiltered: filteredMatrix,
      productMatrixFilter: matrixFilter,
      onProductMatrixFilterChange: setMatrixFilter,
      recommendationByProductId,
      showcaseTasksOpen,
      openTasksCount: openShowcaseTasksCount,
      recommendations,
      createdTaskByProductId,
      onCreateMatrixTask: handleCreateTask,
      onScrollToMatrixTask: handleScrollToTask,
      tasksLinkHref: showcaseTasksLinkHref,
      matrixTasksSlot: (
        <MatrixTasksSlot
          createdTasks={createdTasks}
          matrixTaskFilter={matrixTaskFilter}
          onFilterChange={setMatrixTaskFilter}
          expandedTaskIds={expandedTaskIds}
          onToggleTask={handleToggleTask}
          filteredCreatedTasks={filteredCreatedTasks}
        />
      ),
    }),
    [
      matrixSummary,
      showcaseComment,
      dist,
      conclusion,
      filteredMatrix,
      matrixFilter,
      recommendationByProductId,
      showcaseTasksOpen,
      openShowcaseTasksCount,
      recommendations,
      createdTaskByProductId,
      handleCreateTask,
      handleScrollToTask,
      showcaseTasksLinkHref,
      createdTasks,
      matrixTaskFilter,
      expandedTaskIds,
      handleToggleTask,
      filteredCreatedTasks,
    ],
  );

  return (
    <div className="space-y-3">
      <Collapsible open={paramsOpen} onOpenChange={setParamsOpen} className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-sm font-semibold"
            data-testid="button-showcase-params-accordion"
          >
            Параметры витрины
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", paramsOpen && "rotate-180")}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TradePointShowcaseParamsSection dealer={dealer} point={point} profile={profile} canEdit={canEdit} />
        </CollapsibleContent>
      </Collapsible>
      {templateModelsCount === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Активная матрица не назначена</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Для этой торговой точки нет чек-листа моделей. Выберите другую точку или назначьте матрицу в
              справочнике.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TradePointShowcaseMatrixSection
            dealer={dealer}
            point={point}
            profile={profile}
            actorUserId={actorUserId}
            actorName={actorName}
            page={showcasePage}
            density="compact"
            statusFilterActionSlot={
              canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full justify-center gap-1.5 bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                  data-testid="button-distribution-entry-fullscreen"
                  onClick={() => setFullscreenOpen(true)}
                >
                  <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
                  Внести дистрибуцию
                </Button>
              ) : null
            }
          />
          {fullscreenOpen && canEdit ? (
            <DistributionFullscreenEntry
              dealer={dealer}
              point={point}
              profile={profile}
              actorUserId={actorUserId}
              actorName={actorName}
              onClose={() => setFullscreenOpen(false)}
              onBackToList={
                onBackToList
                  ? () => {
                      setFullscreenOpen(false);
                      onBackToList();
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}
