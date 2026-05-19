import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, MessageSquare, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  getShowcaseMatrixModelsForTradePoint,
  matrixTierForClientCategory,
  priorityLabelRu,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import {
  canEditTradePointShowcaseMatrix,
  canViewTradePointShowcaseMatrix,
  getEffectiveMatrixEntry,
  getEffectiveMatrixStatus,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
  SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY,
  statusLabelRu,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import { ShowcaseModelPresentationDialog } from "@/components/showcase-model-presentation-dialog";
import { getClientCategoryLabel } from "@/lib/client-category";
import { getShowcaseMatrixDeficitTasksForTradePoint, MATRIX_TASK_STATUS_LABEL } from "@/lib/trade-point-task-data";

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

type Props = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
};

export function TradePointShowcaseMatrixSection({ dealer, point, profile, actorUserId, actorName }: Props) {
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

  const tierLabel = useMemo(() => {
    const t = matrixTierForClientCategory(dealer.clientCategory);
    if (t === "expanded") return "расширенная матрица";
    if (t === "medium") return "средняя матрица";
    if (t === "base") return "базовая матрица";
    return "стартовая матрица";
  }, [dealer.clientCategory]);

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
        ? "grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : viewMode === "mini"
          ? "grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          : "flex flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card";

  return (
    <>
      <section
        id="section-trade-point-showcase-matrix"
        data-testid="section-trade-point-showcase-matrix"
        className="scroll-mt-28 space-y-3 overflow-x-hidden min-w-0 sm:scroll-mt-32"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Витрина торговой точки</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Что поставить на витрину — {tierLabel} для сегмента «{getClientCategoryLabel(dealer.clientCategory)}». Статусы
              сохраняются в этом браузере.
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
          </p>

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

        {deficitTasks.length > 0 ? (
          <div className="rounded-xl border border-border/80 bg-muted/15 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Задачи по матрице витрины</p>
            <ul className="mt-2 space-y-2">
              {deficitTasks.slice(0, 6).map((t) => (
                <li key={t.taskId} className="flex gap-2 text-sm">
                  {t.showcaseMatrixImageSrc ? (
                    <img
                      src={t.showcaseMatrixImageSrc}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {MATRIX_TASK_STATUS_LABEL[t.status]} · срок {t.dueDate}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
                      "grid min-w-0 grid-cols-1 items-center gap-2 px-2 py-2 sm:grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] sm:gap-3 sm:px-3",
                      matrixCardShellClass(st),
                      st === "not_relevant" && "opacity-80",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left font-semibold leading-snug text-foreground hover:underline sm:col-span-1"
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
                    <div className="flex flex-wrap gap-1 sm:justify-end">
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

              const isLarge = viewMode === "large";
              const isMini = viewMode === "mini";
              const isCompact = viewMode === "compact";

              const imgClass = isLarge
                ? "aspect-[4/3] h-full w-full object-cover sm:aspect-auto sm:min-h-[152px] sm:w-[148px]"
                : isMini
                  ? "aspect-[4/3] h-16 w-full object-cover"
                  : "aspect-square h-20 w-full shrink-0 object-cover min-[380px]:h-full min-[380px]:w-24 min-[380px]:min-h-[5rem]";

              const cardPad = isMini ? "p-1.5" : isCompact ? "p-2" : "p-3 sm:p-3.5";
              const rounded = isMini ? "rounded-xl" : "rounded-2xl";

              return (
                <Card
                  key={m.id}
                  data-testid={`row-trade-point-showcase-model-${m.id}`}
                  className={cn("overflow-hidden shadow-md", rounded, matrixCardShellClass(st), st === "not_relevant" && "opacity-[0.88]")}
                >
                  <div
                    className={cn(
                      "flex w-full min-w-0",
                      isLarge ? "flex-col sm:flex-row" : isMini ? "flex-col" : "flex-col min-[380px]:flex-row min-[380px]:items-stretch",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "relative shrink-0 overflow-hidden text-left",
                        isLarge ? "w-full sm:w-[148px]" : isMini ? "w-full" : "w-full min-[380px]:w-24",
                      )}
                      onClick={() => openPresentation(m)}
                    >
                      <img
                        src={m.imageUrl}
                        alt=""
                        data-testid={`image-trade-point-showcase-model-${m.id}`}
                        className={cn(imgClass)}
                        loading="lazy"
                      />
                    </button>
                    <CardContent className={cn("flex min-w-0 flex-1 flex-col gap-2", cardPad)}>
                      <button type="button" className="w-full min-w-0 text-left" onClick={() => openPresentation(m)}>
                        <div className={cn("flex flex-col gap-1.5", !isMini && "min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between")}>
                          <p
                            className={cn(
                              "min-w-0 font-semibold leading-snug text-foreground",
                              isMini ? "line-clamp-2 text-[11px]" : "line-clamp-3 text-sm min-[380px]:text-sm",
                              isLarge && "text-base",
                            )}
                            data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                          >
                            {m.name}
                          </p>
                          <div
                            className={cn(
                              "flex min-w-0 gap-1",
                              isMini ? "flex-col items-start" : "flex-nowrap items-center overflow-x-auto pb-0.5",
                            )}
                          >
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
                              className={cn(
                                "shrink-0 font-medium",
                                isMini ? "text-[11px] px-2 py-0.5" : "text-[10px]",
                                statusBadgeClass(st),
                              )}
                              data-testid={`badge-trade-point-showcase-status-${m.id}`}
                            >
                              {statusLabelRu(st)}
                            </Badge>
                          </div>
                        </div>
                        {isLarge ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.importanceReason}</p> : null}
                      </button>

                      {isMini ? (
                        <div className="mt-auto flex flex-col gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 w-full px-2 text-[10px] font-semibold"
                            data-testid={`button-trade-point-showcase-mark-installed-${m.id}`}
                            onClick={() => persist(m, "installed", commentVal)}
                          >
                            На витрине
                          </Button>
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full gap-1 text-[10px]"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                                Ещё
                                <ChevronDown className="h-3 w-3 opacity-70" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1.5 space-y-1.5 rounded-md border border-border/70 bg-background/80 p-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full text-[10px]"
                                data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                                onClick={() => openPresentation(m)}
                              >
                                Презентация
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-full text-[10px]"
                                data-testid={`button-trade-point-showcase-postpone-${m.id}`}
                                onClick={() => persist(m, "postponed", commentVal)}
                              >
                                Отложить
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-full text-[10px] text-muted-foreground"
                                onClick={() => persist(m, "not_relevant", commentVal)}
                              >
                                Не актуально
                              </Button>
                              <div className="space-y-1 pt-0.5">
                                <Label className="text-[10px] text-muted-foreground" htmlFor={`showcase-cmt-mini-${m.id}`}>
                                  Комментарий
                                </Label>
                                <Textarea
                                  id={`showcase-cmt-mini-${m.id}`}
                                  rows={2}
                                  className="min-h-[44px] resize-y text-[11px]"
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
                                <Button asChild variant="ghost" size="sm" className="h-auto px-0 py-0 text-[10px] font-semibold text-primary underline-offset-2 hover:underline">
                                  <Link href={`/catalog/${m.id}`}>Каталог</Link>
                                </Button>
                              ) : null}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn("font-semibold", isCompact ? "h-8 flex-1 text-[11px] sm:flex-none" : "min-h-9 flex-1 sm:flex-none")}
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
                                  className={cn("font-semibold", isCompact ? "h-8 flex-1 text-[11px] sm:flex-none" : "min-h-9 flex-1 sm:flex-none")}
                                  data-testid={`button-trade-point-showcase-mark-installed-${m.id}`}
                                  onClick={() => persist(m, "installed", commentVal)}
                                >
                                  Стоит на витрине
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={cn("font-semibold", isCompact ? "h-8 flex-1 text-[11px] sm:flex-none" : "min-h-9 flex-1 sm:flex-none")}
                                  data-testid={`button-trade-point-showcase-postpone-${m.id}`}
                                  onClick={() => persist(m, "postponed", commentVal)}
                                >
                                  Отложить
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "text-muted-foreground",
                                    isCompact ? "h-8 flex-1 text-[11px] sm:flex-none" : "min-h-9 flex-1 sm:flex-none",
                                  )}
                                  onClick={() => persist(m, "not_relevant", commentVal)}
                                >
                                  Не актуально
                                </Button>
                              </>
                            ) : null}
                          </div>

                          {isLarge ? (
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
                          ) : (
                            <Collapsible className="space-y-1">
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  Подробнее
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-2">
                                <p className="text-xs leading-relaxed text-muted-foreground">{m.importanceReason}</p>
                                {canEdit ? (
                                  <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                                    <Link href={`/catalog/${m.id}`}>Открыть в каталоге</Link>
                                  </Button>
                                ) : null}
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {!isLarge ? (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Комментарий
                                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-2">
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground" htmlFor={`showcase-cmt-${m.id}`}>
                                    Комментарий менеджера
                                  </Label>
                                  <Textarea
                                    id={`showcase-cmt-${m.id}`}
                                    rows={2}
                                    className="min-h-[48px] resize-y text-sm"
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
                              </CollapsibleContent>
                            </Collapsible>
                          ) : null}

                          {isLarge && canEdit ? (
                            <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                              <Link href={`/catalog/${m.id}`}>Открыть в каталоге</Link>
                            </Button>
                          ) : null}
                        </>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ShowcaseModelPresentationDialog open={presentationOpen} onOpenChange={setPresentationOpen} model={presentationModel} />
    </>
  );
}
