/**
 * Карточка ручной торговой точки: анкета актуализации без демо-витрины/матрицы.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { mergeActualizationState, type TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import { canEditDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import { nextManualTradePointInternalCode, isManualActualizationTradePointId, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import { useCurrentUser } from "@/hooks/use-current-user";

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

export function TradePointManualActualizationView(props: {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
}): ReactElement {
  const { dealer, point, profile } = props;
  const actx = useClientBaseActualization();
  const { user } = useCurrentUser();
  const canEdit = canEditDealerDuringActualization(profile, dealer);

  const manualRec = actx.state.manuallyCreatedTradePointsById[point.id];
  const fields = (manualRec?.fields ?? {}) as Record<string, unknown>;
  const readField = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string).trim() : "");

  const showcaseRec = actx.state.tradePointShowcaseActualizationById[point.id];

  const [name, setName] = useState(point.name);
  const [formatKind, setFormatKind] = useState(readField("formatKind") || "store");
  const [tpStatus, setTpStatus] = useState(readField("tpStatusKind") || "working");
  const [city, setCity] = useState(point.city);
  const [address, setAddress] = useState(point.address);
  const [contactName, setContactName] = useState(point.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(point.contactPhone ?? "");
  const [tpComment, setTpComment] = useState(point.tpComment ?? "");

  const [hasShowcase, setHasShowcase] = useState<boolean | null>(showcaseRec?.hasShowcase ?? null);
  const [totalPortals, setTotalPortals] = useState(showcaseRec?.totalPortals != null ? String(showcaseRec.totalPortals) : "");
  const [entrancePortals, setEntrancePortals] = useState(showcaseRec?.entrancePortals != null ? String(showcaseRec.entrancePortals) : "");
  const [interiorPortals, setInteriorPortals] = useState(showcaseRec?.interiorPortals != null ? String(showcaseRec.interiorPortals) : "");
  const [area, setArea] = useState(showcaseRec?.showcaseAreaSqm != null ? String(showcaseRec.showcaseAreaSqm) : "");
  const [showcaseComment, setShowcaseComment] = useState(showcaseRec?.showcaseComment ?? "");

  const [tTotal, setTTotal] = useState(showcaseRec?.tandoorTotalPortals != null ? String(showcaseRec.tandoorTotalPortals) : "");
  const [tEnt, setTEnt] = useState(showcaseRec?.tandoorEntrancePortals != null ? String(showcaseRec.tandoorEntrancePortals) : "");
  const [tInt, setTInt] = useState(showcaseRec?.tandoorInteriorPortals != null ? String(showcaseRec.tandoorInteriorPortals) : "");
  const [compPortals, setCompPortals] = useState(showcaseRec?.competitorPortals != null ? String(showcaseRec.competitorPortals) : "");
  const [competitorsListed, setCompetitorsListed] = useState(showcaseRec?.competitorsListed ?? "");
  const [fillingComment, setFillingComment] = useState(showcaseRec?.fillingComment ?? "");

  const [expPot, setExpPot] = useState<boolean | null>(showcaseRec?.hasExpansionPotential ?? null);
  const [addPortals, setAddPortals] = useState(
    showcaseRec?.additionalPortalsPotential != null ? String(showcaseRec.additionalPortalsPotential) : "",
  );
  const [priority, setPriority] = useState(showcaseRec?.showcasePriority || "");
  const [firstNeed, setFirstNeed] = useState(showcaseRec?.firstPriorityNeed ?? "");
  const [rmComment, setRmComment] = useState(showcaseRec?.rmRopComment ?? "");

  const mainSave = useSectionSaveFeedback();
  const showcaseSave = useSectionSaveFeedback();

  useEffect(() => {
    const mf = (manualRec?.fields ?? {}) as Record<string, unknown>;
    const rf = (k: string) => (typeof mf[k] === "string" ? (mf[k] as string).trim() : "");
    setName(point.name);
    setCity(point.city);
    setAddress(point.address);
    setContactName(point.contactName ?? "");
    setContactPhone(point.contactPhone ?? "");
    setTpComment(point.tpComment ?? "");
    setFormatKind(rf("formatKind") || "store");
    setTpStatus(rf("tpStatusKind") || "working");
  }, [point, manualRec]);

  const showcaseUpdatedAt = showcaseRec?.updatedAt;
  useEffect(() => {
    const sh = actx.state.tradePointShowcaseActualizationById[point.id] ?? emptyShowcase(dealer.id, point.id);
    setHasShowcase(sh.hasShowcase);
    setTotalPortals(sh.totalPortals != null ? String(sh.totalPortals) : "");
    setEntrancePortals(sh.entrancePortals != null ? String(sh.entrancePortals) : "");
    setInteriorPortals(sh.interiorPortals != null ? String(sh.interiorPortals) : "");
    setArea(sh.showcaseAreaSqm != null ? String(sh.showcaseAreaSqm) : "");
    setShowcaseComment(sh.showcaseComment ?? "");
    setTTotal(sh.tandoorTotalPortals != null ? String(sh.tandoorTotalPortals) : "");
    setTEnt(sh.tandoorEntrancePortals != null ? String(sh.tandoorEntrancePortals) : "");
    setTInt(sh.tandoorInteriorPortals != null ? String(sh.tandoorInteriorPortals) : "");
    setCompPortals(sh.competitorPortals != null ? String(sh.competitorPortals) : "");
    setCompetitorsListed(sh.competitorsListed ?? "");
    setFillingComment(sh.fillingComment ?? "");
    setExpPot(sh.hasExpansionPotential);
    setAddPortals(sh.additionalPortalsPotential != null ? String(sh.additionalPortalsPotential) : "");
    setPriority(sh.showcasePriority || "");
    setFirstNeed(sh.firstPriorityNeed ?? "");
    setRmComment(sh.rmRopComment ?? "");
  }, [actx.state.tradePointShowcaseActualizationById, dealer.id, point.id, showcaseUpdatedAt]);

  const summary = useMemo(() => {
    const row: TradePointShowcaseActualization = {
      ...(showcaseRec ?? ({} as TradePointShowcaseActualization)),
      tradePointId: point.id,
      dealerId: dealer.id,
      hasShowcase,
      totalPortals: numOrNull(totalPortals),
      entrancePortals: numOrNull(entrancePortals),
      interiorPortals: numOrNull(interiorPortals),
      tandoorTotalPortals: numOrNull(tTotal),
      tandoorEntrancePortals: numOrNull(tEnt),
      tandoorInteriorPortals: numOrNull(tInt),
    };
    return computePortalSummary(row);
  }, [
    showcaseRec,
    dealer.id,
    point.id,
    hasShowcase,
    totalPortals,
    entrancePortals,
    interiorPortals,
    tTotal,
    tEnt,
    tInt,
  ]);

  /** Не показывать расчёт дефицита/потенциала, пока менеджер не ввёл числовые параметры витрины. */
  const showPortalMathSummary =
    hasShowcase === true &&
    (numOrNull(totalPortals) != null ||
      numOrNull(entrancePortals) != null ||
      numOrNull(interiorPortals) != null ||
      numOrNull(area) != null ||
      numOrNull(tTotal) != null ||
      numOrNull(tEnt) != null ||
      numOrNull(tInt) != null);

  const persistMain = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    const iso = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const formatStr =
      formatKind === "store"
        ? "Магазин"
        : formatKind === "warehouse"
          ? "Склад"
          : formatKind === "showroom"
            ? "Шоурум"
            : formatKind === "office"
              ? "Офис"
              : "Другое";
    const statusStr =
      tpStatus === "working"
        ? "Работает"
        : tpStatus === "closed"
          ? "Закрыта"
          : tpStatus === "seasonal"
            ? "Сезонная"
            : "Требует проверки";
    const nextFields: Record<string, unknown> = {
      name: name.trim(),
      city: city.trim(),
      address: address.trim(),
      formatKind,
      tpStatusKind: tpStatus,
      format: formatStr,
      status: statusStr,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      comment: tpComment.trim(),
    };
    const r = await actx.persist((prev) => {
      if (isManualActualizationTradePointId(point.id)) {
        const rec = prev.manuallyCreatedTradePointsById[point.id];
        if (!rec) return prev;
        const mergedFields = { ...(rec.fields as Record<string, unknown>), ...nextFields };
        let nextManual = { ...rec, fields: mergedFields };
        const ic = (nextManual.internalCode ?? "").trim();
        if (!/^TND-TP-\d{6}$/i.test(ic)) {
          nextManual = { ...nextManual, internalCode: nextManualTradePointInternalCode(prev) };
        }
        return mergeActualizationState(prev, {
          manuallyCreatedTradePointsById: { ...prev.manuallyCreatedTradePointsById, [point.id]: nextManual },
        });
      }
      const ov = {
        tradePointId: point.id,
        dealerId: dealer.id,
        fields: nextFields,
        updatedAt: iso,
        updatedBy: uid,
        updatedByName: uname,
        source: "manual_actualization" as const,
      };
      return mergeActualizationState(prev, {
        tradePointOverridesById: { ...prev.tradePointOverridesById, [point.id]: ov },
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
    name,
    city,
    address,
    formatKind,
    tpStatus,
    contactName,
    contactPhone,
    tpComment,
    profile.personaUserId,
  ]);

  const persistShowcase = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    const iso = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const r = await actx.persist((prev) => {
      const sh: TradePointShowcaseActualization = {
        tradePointId: point.id,
        dealerId: dealer.id,
        hasShowcase,
        totalPortals: numOrNull(totalPortals),
        entrancePortals: numOrNull(entrancePortals),
        interiorPortals: numOrNull(interiorPortals),
        showcaseAreaSqm: numOrNull(area),
        showcaseComment: showcaseComment.trim(),
        tandoorTotalPortals: numOrNull(tTotal),
        tandoorEntrancePortals: numOrNull(tEnt),
        tandoorInteriorPortals: numOrNull(tInt),
        competitorPortals: numOrNull(compPortals),
        competitorsListed: competitorsListed.trim(),
        fillingComment: fillingComment.trim(),
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
        tradePointShowcaseActualizationById: { ...prev.tradePointShowcaseActualizationById, [point.id]: sh },
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
    totalPortals,
    entrancePortals,
    interiorPortals,
    area,
    showcaseComment,
    tTotal,
    tEnt,
    tInt,
    compPortals,
    competitorsListed,
    fillingComment,
    expPot,
    addPortals,
    priority,
    firstNeed,
    rmComment,
    profile.personaUserId,
  ]);

  const inheritedRm = dealer.regionalManager?.trim() || "—";
  const inheritedMgr = dealer.manager?.trim() || "—";
  const inheritedRop = dealer.ropName?.trim() || "—";

  return (
    <div className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] space-y-4 sm:space-y-6" data-testid="page-trade-point-manual-actualization">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link href={`/dealers/${dealer.id}`}>Назад к клиенту</Link>
        </Button>
        <Button asChild variant="secondary" className="min-h-11 w-full sm:w-auto">
          <Link href="/dealer-base">К клиентской базе</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{point.name}</CardTitle>
          <p className="text-xs text-muted-foreground">Клиент: {dealer.name}</p>
          <p className="text-xs text-muted-foreground" data-testid={`text-trade-point-internal-code-${point.id}`}>
            Код ТТ: {getTradePointDisplayCodeForActualization(point)}
          </p>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={["passport", "showcase"]} className="rounded-2xl border border-border/80 bg-card px-3 sm:px-4">
        <AccordionItem value="passport" data-testid="section-trade-point-passport">
          <AccordionTrigger className="text-left text-sm font-semibold">Паспорт торговой точки</AccordionTrigger>
          <AccordionContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Название</Label>
              <Input className="min-h-10" value={name} onChange={(e) => { setName(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Формат</Label>
              <Select value={formatKind} onValueChange={(v) => { setFormatKind(v); mainSave.markDirty(); }} disabled={!canEdit}>
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Магазин</SelectItem>
                  <SelectItem value="warehouse">Склад</SelectItem>
                  <SelectItem value="showroom">Шоурум</SelectItem>
                  <SelectItem value="office">Офис</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Статус</Label>
              <Select value={tpStatus} onValueChange={(v) => { setTpStatus(v); mainSave.markDirty(); }} disabled={!canEdit}>
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Работает</SelectItem>
                  <SelectItem value="closed">Закрыта</SelectItem>
                  <SelectItem value="seasonal">Сезонная</SelectItem>
                  <SelectItem value="needs_review">Требует проверки</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Город</Label>
              <Input className="min-h-10" value={city} onChange={(e) => { setCity(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Адрес</Label>
              <Textarea rows={2} value={address} onChange={(e) => { setAddress(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Контакт точки</Label>
              <Input className="min-h-10" value={contactName} onChange={(e) => { setContactName(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Телефон точки</Label>
              <Input className="min-h-10" value={contactPhone} onChange={(e) => { setContactPhone(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Комментарий</Label>
              <Textarea rows={2} value={tpComment} onChange={(e) => { setTpComment(e.target.value); mainSave.markDirty(); }} disabled={!canEdit} />
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <SectionSaveButton
                  testId="button-trade-point-section-save-main"
                  statusTestId="text-save-status-trade-point-main-view"
                  phase={mainSave.phase}
                  onSave={() => void mainSave.runSave(persistMain)}
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="responsibles" data-testid="section-trade-point-responsibles">
          <AccordionTrigger className="text-left text-sm font-semibold">Ответственные по точке</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Менеджер:</span> {inheritedMgr}{" "}
              <span className="text-xs">(унаследовано от клиента)</span>
            </p>
            <p>
              <span className="font-medium text-foreground">Региональный менеджер:</span> {inheritedRm}{" "}
              <span className="text-xs">(унаследовано от клиента)</span>
            </p>
            <p>
              <span className="font-medium text-foreground">РОП:</span> {inheritedRop}{" "}
              <span className="text-xs">(унаследовано от клиента)</span>
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="showcase" data-testid="section-trade-point-showcase-portals">
          <AccordionTrigger className="text-left text-sm font-semibold">Витрина и порталы</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {hasShowcase === false ? (
              <p className="text-sm text-muted-foreground">Витрина / порталы: нет. Поля дефицита и сводка по порталам не применяются.</p>
            ) : hasShowcase === null ? (
              <p className="text-sm text-muted-foreground">Параметры витрины не заполнены.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Витрина / порталы: да.</p>
            )}
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {hasShowcase !== true ? (
                  <Button type="button" size="sm" variant="default" onClick={() => { setHasShowcase(true); showcaseSave.markDirty(); }}>
                    Заполнить витрину
                  </Button>
                ) : null}
                {hasShowcase !== false ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setHasShowcase(false); showcaseSave.markDirty(); }}>
                    Нет витрины / порталов
                  </Button>
                ) : null}
                {hasShowcase != null ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setHasShowcase(null); showcaseSave.markDirty(); }}>
                    Сбросить выбор
                  </Button>
                ) : null}
              </div>
            ) : null}
            {hasShowcase === true ? (
              <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Всего порталов</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-total-portals"
                        value={totalPortals}
                        onChange={(e) => {
                          setTotalPortals(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Площадь витрины, м²</Label>
                      <Input
                        className="min-h-10"
                        inputMode="decimal"
                        data-testid="input-trade-point-showcase-area"
                        value={area}
                        onChange={(e) => {
                          setArea(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Порталы под входные двери</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-entrance-portals"
                        value={entrancePortals}
                        onChange={(e) => {
                          setEntrancePortals(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Порталы под межкомнатные</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-interior-portals"
                        value={interiorPortals}
                        onChange={(e) => {
                          setInteriorPortals(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Комментарий по витрине</Label>
                      <Textarea rows={2} value={showcaseComment} onChange={(e) => { setShowcaseComment(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Текущее заполнение</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Занято Tandoor всего</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-tandoor-total-portals"
                        value={tTotal}
                        onChange={(e) => {
                          setTTotal(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tandoor входные</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-tandoor-entrance-portals"
                        value={tEnt}
                        onChange={(e) => {
                          setTEnt(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tandoor межкомнатные</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        data-testid="input-trade-point-tandoor-interior-portals"
                        value={tInt}
                        onChange={(e) => {
                          setTInt(e.target.value);
                          showcaseSave.markDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Занято конкурентами (порталов)</Label>
                      <Input className="min-h-10" inputMode="numeric" value={compPortals} onChange={(e) => { setCompPortals(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Какие конкуренты</Label>
                      <Textarea rows={2} value={competitorsListed} onChange={(e) => { setCompetitorsListed(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Что стоит сейчас</Label>
                      <Textarea rows={2} value={fillingComment} onChange={(e) => { setFillingComment(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Потенциал</p>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Checkbox id="exp-pot" checked={expPot === true} disabled={!canEdit} onCheckedChange={(v) => { setExpPot(v === true ? true : v === false ? false : null); showcaseSave.markDirty(); }} />
                      <Label htmlFor="exp-pot" className="text-sm">
                        Есть потенциал расширения
                      </Label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Доп. порталов можно занять</Label>
                      <Input className="min-h-10" inputMode="numeric" value={addPortals} onChange={(e) => { setAddPortals(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Приоритет витрины</Label>
                      <Select value={priority || "__none__"} onValueChange={(v) => { setPriority(v === "__none__" ? "" : v); showcaseSave.markDirty(); }} disabled={!canEdit}>
                        <SelectTrigger className="min-h-10">
                          <SelectValue placeholder="Не выбран" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Не выбран</SelectItem>
                          <SelectItem value="high">Высокий</SelectItem>
                          <SelectItem value="medium">Средний</SelectItem>
                          <SelectItem value="low">Низкий</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Что поставить в первую очередь</Label>
                      <Textarea rows={2} value={firstNeed} onChange={(e) => { setFirstNeed(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Комментарий для РМ/РОП</Label>
                      <Textarea rows={2} value={rmComment} onChange={(e) => { setRmComment(e.target.value); showcaseSave.markDirty(); }} disabled={!canEdit} />
                    </div>

                    {showPortalMathSummary ? (
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm sm:col-span-2">
                        <p className="font-semibold text-foreground">Сводка</p>
                        <p className="mt-1 text-muted-foreground" data-testid="text-trade-point-portal-summary">
                          Всего порталов: {summary.totalPortals ?? "—"} · Занято Tandoor: {summary.tandoorTotal ?? "—"} · Свободно / конкуренты:{" "}
                          {summary.freeOrCompetitor ?? "—"}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          <span data-testid="text-trade-point-entrance-potential">Потенциал входные: {summary.entrancePotential ?? "—"}</span>
                          {" · "}
                          <span data-testid="text-trade-point-interior-potential">Потенциал МК: {summary.interiorPotential ?? "—"}</span>
                        </p>
                        {summary.needsPrimaryInstall ? (
                          <p className="mt-2 text-amber-800">Требуется первичная установка витрины.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
            ) : null}
            {canEdit ? (
              <SectionSaveButton
                testId="button-trade-point-section-save-showcase"
                statusTestId="text-save-status-trade-point-showcase"
                phase={showcaseSave.phase}
                onSave={() => void showcaseSave.runSave(persistShowcase)}
              />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div data-testid="section-trade-point-bitrix">
        <Bitrix24TasksPanel
          scope="trade_point"
          dealerId={dealer.id}
          dealerName={dealer.name}
          tradePointId={point.id}
          tradePointName={point.name}
          canCreate={canEditClientNextStep(profile, dealer)}
          actorUserId={user?.id ?? profile.personaUserId}
          actorLabel={user?.name ?? userLabelFromProfile(profile)}
          compact
        />
      </div>
    </div>
  );
}
