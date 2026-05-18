import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  statusLabelRu,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import { ShowcaseModelPresentationDialog } from "@/components/showcase-model-presentation-dialog";
import { getClientCategoryLabel } from "@/lib/client-category";
import { getShowcaseMatrixDeficitTasksForTradePoint, MATRIX_TASK_STATUS_LABEL } from "@/lib/trade-point-task-data";

function priorityBadgeClass(p: ShowcaseMatrixModelDefinition["basePriority"]) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function statusBadgeClass(s: ShowcaseMatrixStatusId) {
  if (s === "installed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (s === "postponed") return "border-amber-200 bg-amber-50 text-amber-950";
  if (s === "not_relevant") return "border-border bg-muted text-muted-foreground";
  return "border-red-200 bg-red-50 text-red-900";
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

  return (
    <>
      <section
        id="section-trade-point-showcase-matrix"
        data-testid="section-trade-point-showcase-matrix"
        className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Витрина торговой точки</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Что поставить на витрину — {tierLabel} для сегмента «{getClientCategoryLabel(dealer.clientCategory)}». Статусы
            сохраняются в этом браузере.
          </p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((m) => {
            const st = getEffectiveMatrixStatus(dealer.id, point.id, m.id, storage);
            const entry = getEffectiveMatrixEntry(dealer.id, point.id, m.id, storage);
            const commentVal = entry.comment ?? "";
            return (
              <Card
                key={m.id}
                data-testid={`row-trade-point-showcase-model-${m.id}`}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md"
              >
                <div className="flex w-full flex-col sm:flex-row">
                  <button
                    type="button"
                    className="relative w-full shrink-0 sm:w-[120px]"
                    onClick={() => openPresentation(m)}
                  >
                    <img
                      src={m.imageUrl}
                      alt=""
                      data-testid={`image-trade-point-showcase-model-${m.id}`}
                      className="aspect-[4/3] h-full w-full object-cover sm:aspect-auto sm:min-h-[132px]"
                      loading="lazy"
                    />
                  </button>
                  <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
                    <button type="button" className="w-full text-left" onClick={() => openPresentation(m)}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                          className="min-w-0 flex-1 font-semibold leading-snug text-foreground"
                          data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                        >
                          {m.name}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {m.typeLabelRu}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                            data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                          >
                            {priorityLabelRu(m.basePriority)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium", statusBadgeClass(st))}
                            data-testid={`badge-trade-point-showcase-status-${m.id}`}
                          >
                            {statusLabelRu(st)}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.importanceReason}</p>
                    </button>
                  </CardContent>
                </div>
                <CardContent className="space-y-2 border-t border-border px-3 pb-3 pt-0 sm:px-3.5">
                  <div className="flex flex-wrap gap-2">
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
                  <div className="space-y-1.5">
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
              </Card>
            );
          })}
        </div>
      </section>

      <ShowcaseModelPresentationDialog open={presentationOpen} onOpenChange={setPresentationOpen} model={presentationModel} />
    </>
  );
}
