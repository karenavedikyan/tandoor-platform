import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionSaveButton } from "@/components/section-save-button";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import {
  mergeActualizationState,
  type TradePointShowcaseActualization,
} from "@/lib/client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function emptyShowcase(dealerId: string, tradePointId: string): TradePointShowcaseActualization {
  const iso = new Date().toISOString();
  return {
    tradePointId,
    dealerId,
    hasShowcase: null,
    totalPortals: null,
    entrancePortals: null,
    interiorPortals: null,
    showcaseAreaSqm: null,
    showcaseComment: "",
    tandoorTotalPortals: null,
    tandoorEntrancePortals: null,
    tandoorInteriorPortals: null,
    competitorPortals: null,
    competitorsListed: "",
    fillingComment: "",
    hasExpansionPotential: null,
    additionalPortalsPotential: null,
    showcasePriority: "",
    firstPriorityNeed: "",
    rmRopComment: "",
    updatedAt: iso,
    updatedBy: "",
    updatedByName: "",
  };
}

export type TradePointShowcaseParamsSectionProps = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  /** можно ли редактировать; если false — поля только для чтения */
  canEdit: boolean;
};

export function TradePointShowcaseParamsSection({
  dealer,
  point,
  profile,
  canEdit,
}: TradePointShowcaseParamsSectionProps): ReactElement {
  const actx = useClientBaseActualization();
  const rec = actx.state.tradePointShowcaseActualizationById[point.id];
  const isInitialLoading = actx.loading && rec === undefined;
  const save = useSectionSaveFeedback();

  const [hasShowcase, setHasShowcase] = useState<boolean | null>(rec?.hasShowcase ?? null);
  const [area, setArea] = useState(rec?.showcaseAreaSqm != null ? String(rec.showcaseAreaSqm) : "");
  const [showcaseComment, setShowcaseComment] = useState(rec?.showcaseComment ?? "");
  const [expPot, setExpPot] = useState<boolean | null>(rec?.hasExpansionPotential ?? null);
  const [addPortals, setAddPortals] = useState(
    rec?.additionalPortalsPotential != null ? String(rec.additionalPortalsPotential) : "",
  );
  const [priority, setPriority] = useState(rec?.showcasePriority || "");
  const [firstNeed, setFirstNeed] = useState(rec?.firstPriorityNeed ?? "");
  const [rmComment, setRmComment] = useState(rec?.rmRopComment ?? "");

  const markDirty = useCallback(() => {
    save.markDirty();
  }, [save.markDirty]);

  useEffect(() => {
    if (save.isDirty || save.phase === "saving") return;
    const sh = rec ?? emptyShowcase(dealer.id, point.id);
    setHasShowcase(sh.hasShowcase);
    setArea(sh.showcaseAreaSqm != null ? String(sh.showcaseAreaSqm) : "");
    setShowcaseComment(sh.showcaseComment ?? "");
    setExpPot(sh.hasExpansionPotential);
    setAddPortals(sh.additionalPortalsPotential != null ? String(sh.additionalPortalsPotential) : "");
    setPriority(sh.showcasePriority || "");
    setFirstNeed(sh.firstPriorityNeed ?? "");
    setRmComment(sh.rmRopComment ?? "");
  }, [rec, dealer.id, point.id, save.isDirty, save.phase]);

  const persist = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    const iso = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const r = await actx.persist((prev) => {
      const prevRec = prev.tradePointShowcaseActualizationById[point.id] ?? emptyShowcase(dealer.id, point.id);
      const patch: TradePointShowcaseActualization = {
        ...prevRec,
        hasShowcase,
        showcaseAreaSqm: numOrNull(area),
        showcaseComment: showcaseComment.trim(),
        hasExpansionPotential: expPot,
        additionalPortalsPotential: numOrNull(addPortals),
        showcasePriority: priority,
        firstPriorityNeed: firstNeed.trim(),
        rmRopComment: rmComment.trim(),
        updatedAt: iso,
        updatedBy: uid,
        updatedByName: uname,
      };
      return mergeActualizationState(prev, {
        tradePointShowcaseActualizationById: { ...prev.tradePointShowcaseActualizationById, [point.id]: patch },
      });
    });
    if (!r.success) {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
      return false;
    }
    return true;
  }, [
    actx,
    canEdit,
    dealer.id,
    point.id,
    hasShowcase,
    area,
    showcaseComment,
    expPot,
    addPortals,
    priority,
    firstNeed,
    rmComment,
    profile.personaUserId,
  ]);

  const readOnlyLabel = (value: string | null | undefined, empty = "Не указано") =>
    value?.trim() ? value.trim() : empty;

  const saveFooter = canEdit ? (
    <div className="flex flex-col gap-1 pt-1">
      <SectionSaveButton
        testId="button-showcase-params-save"
        phase={save.phase}
        onSave={() => void save.runSave(persist)}
      />
      <p
        className="text-[10px] leading-snug text-muted-foreground"
        data-testid="text-showcase-params-save-status"
        aria-live="polite"
      >
        {save.phase === "saving"
          ? "Сохраняем…"
          : save.phase === "success"
            ? "Сохранено"
            : save.isDirty
              ? "Есть несохранённые изменения"
              : "Нет несохранённых изменений"}
      </p>
    </div>
  ) : null;

  if (isInitialLoading) {
    return (
      <div
        className="rounded-lg border border-border/50 bg-card p-2.5 sm:p-3"
        data-testid="section-trade-point-showcase-params"
      >
        <h3 className="text-sm font-semibold leading-tight text-foreground">Параметры витрины</h3>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="text-showcase-params-loading">
          Загрузка параметров витрины…
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border/50 bg-card p-2.5 sm:p-3"
      data-testid="section-trade-point-showcase-params"
    >
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-semibold leading-tight text-foreground">Параметры витрины</h3>
        {rec?.updatedAt?.trim() ? (
          <p className="text-[10px] text-muted-foreground/90">
            Обновлено: {formatDisplayDateTime(rec.updatedAt)}
          </p>
        ) : null}
      </div>

      <div className="mt-2 space-y-2">
        {hasShowcase === null && !canEdit ? (
          <p className="text-sm text-muted-foreground">Состояние витрины не заполнено.</p>
        ) : null}

        {hasShowcase === null && canEdit ? (
          <div className="grid gap-1.5 sm:grid-cols-3">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-8 w-full bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
              onClick={() => {
                setHasShowcase(true);
                markDirty();
              }}
            >
              Есть витрина
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs font-medium"
              onClick={() => {
                setHasShowcase(false);
                markDirty();
              }}
            >
              Нет витрины / порталов
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs font-medium"
              onClick={() => {
                setHasShowcase(null);
                markDirty();
              }}
            >
              Заполнить позже
            </Button>
          </div>
        ) : null}

        {hasShowcase === false ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">Витрины нет</p>
            {canEdit ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-8 bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
                  onClick={() => {
                    setHasShowcase(true);
                    markDirty();
                  }}
                >
                  Есть витрина
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-medium"
                  onClick={() => {
                    setHasShowcase(null);
                    markDirty();
                  }}
                >
                  Заполнить позже
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Отмечено: витрины нет.</p>
            )}
          </div>
        ) : null}

        {hasShowcase === true ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Площадь витрины, м²
              </Label>
              {canEdit ? (
                <Input
                  className="min-h-9"
                  inputMode="decimal"
                  data-testid="input-trade-point-showcase-area"
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    markDirty();
                  }}
                />
              ) : (
                <p className="min-h-9 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground">
                  {readOnlyLabel(area)}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Приоритет витрины
              </Label>
              {canEdit ? (
                <Select
                  value={priority || "__none__"}
                  onValueChange={(v) => {
                    setPriority(v === "__none__" ? "" : v);
                    markDirty();
                  }}
                >
                  <SelectTrigger className="min-h-9">
                    <SelectValue placeholder="Не выбран" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не выбран</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="medium">Средний</SelectItem>
                    <SelectItem value="low">Низкий</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="min-h-9 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground">
                  {priority === "high"
                    ? "Высокий"
                    : priority === "medium"
                      ? "Средний"
                      : priority === "low"
                        ? "Низкий"
                        : "Не выбран"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              {canEdit ? (
                <Checkbox
                  id={`exp-pot-${point.id}`}
                  checked={expPot === true}
                  onCheckedChange={(v) => {
                    setExpPot(v === true ? true : v === false ? false : null);
                    markDirty();
                  }}
                />
              ) : (
                <Checkbox id={`exp-pot-ro-${point.id}`} checked={expPot === true} disabled />
              )}
              <Label
                htmlFor={canEdit ? `exp-pot-${point.id}` : `exp-pot-ro-${point.id}`}
                className="text-xs font-normal text-muted-foreground"
              >
                Есть потенциал расширения
              </Label>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Что поставить в первую очередь
              </Label>
              {canEdit ? (
                <Textarea
                  rows={2}
                  className="min-h-[4rem] resize-y"
                  value={firstNeed}
                  onChange={(e) => {
                    setFirstNeed(e.target.value);
                    markDirty();
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground">
                  {readOnlyLabel(firstNeed)}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Комментарий для РМ/РОП
              </Label>
              {canEdit ? (
                <Textarea
                  rows={2}
                  className="min-h-[4rem] resize-y"
                  value={rmComment}
                  onChange={(e) => {
                    setRmComment(e.target.value);
                    markDirty();
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground">
                  {readOnlyLabel(rmComment)}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Комментарий по витрине
              </Label>
              {canEdit ? (
                <Textarea
                  rows={2}
                  className="min-h-[4rem] resize-y"
                  value={showcaseComment}
                  onChange={(e) => {
                    setShowcaseComment(e.target.value);
                    markDirty();
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-foreground">
                  {readOnlyLabel(showcaseComment, "—")}
                </p>
              )}
            </div>

            {canEdit ? (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-8 text-xs font-medium")}
                  onClick={() => {
                    setHasShowcase(false);
                    markDirty();
                  }}
                >
                  Отметить «Нет витрины»
                </Button>
              </div>
            ) : null}

            {saveFooter ? <div className="sm:col-span-2">{saveFooter}</div> : null}
          </div>
        ) : null}

        {hasShowcase !== true ? saveFooter : null}
      </div>
    </div>
  );
}
