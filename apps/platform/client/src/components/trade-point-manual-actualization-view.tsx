/**
 * Карточка ручной торговой точки: анкета актуализации без демо-витрины/матрицы.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  mergeActualizationState,
  type ShowcaseMatrixTask,
  type TradePointShowcaseActualization,
  type TradePointShowcaseSelectedModel,
} from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import { getProductById } from "@/lib/catalog-data";
import {
  computeShowcasePortalOverfill,
  getRequiredShowcaseMatrixDefinitions,
  inferShowcasePortalTypeFromCatalogProduct,
  resolveShowcaseMatrixClientCategory,
} from "@/lib/trade-point-showcase-matrix-required";
import { canEditDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import { nextManualTradePointInternalCode, isManualActualizationTradePointId, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { TradePointShowcaseCatalogPanel } from "@/components/trade-point-showcase-catalog-panel";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import { useCurrentUser } from "@/hooks/use-current-user";

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeSelectedShowcaseModelsForPersist(list: TradePointShowcaseSelectedModel[]): TradePointShowcaseSelectedModel[] {
  return list.map((m) => {
    const p = getProductById(m.productId);
    return {
      ...m,
      productName: (p?.name ?? m.productName).trim(),
      productType: p?.type ?? m.productType,
      portalType: m.portalType ?? (p ? inferShowcasePortalTypeFromCatalogProduct(p) : undefined),
    };
  });
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

function dashNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(n);
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

  const [selectedShowcaseModels, setSelectedShowcaseModels] = useState<TradePointShowcaseSelectedModel[]>(
    () => showcaseRec?.selectedShowcaseModels ?? [],
  );
  const [showcaseMatrixTasks, setShowcaseMatrixTasks] = useState<ShowcaseMatrixTask[]>(() => showcaseRec?.showcaseMatrixTasks ?? []);

  const [showcaseDirty, setShowcaseDirty] = useState(false);
  const [extraDetailsOpen, setExtraDetailsOpen] = useState(false);

  const mainSave = useSectionSaveFeedback();
  const showcaseSave = useSectionSaveFeedback();

  const markShowcaseDirty = useCallback(() => {
    setShowcaseDirty(true);
    showcaseSave.markDirty();
  }, [showcaseSave.markDirty]);

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

  useEffect(() => {
    const sh = showcaseRec ?? emptyShowcase(dealer.id, point.id);
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
    setSelectedShowcaseModels(Array.isArray(sh.selectedShowcaseModels) ? sh.selectedShowcaseModels : []);
    setShowcaseMatrixTasks(Array.isArray(sh.showcaseMatrixTasks) ? sh.showcaseMatrixTasks : []);
    setShowcaseDirty(false);
  }, [showcaseRec, dealer.id, point.id]);

  const dealerMergedFields = useMemo(() => {
    const manualD = actx.state.manuallyCreatedDealersById[dealer.id];
    const ov = (actx.state.dealerOverridesById[dealer.id]?.fields ?? {}) as Record<string, unknown>;
    return { ...((manualD?.fields ?? {}) as Record<string, unknown>), ...ov };
  }, [actx.state.manuallyCreatedDealersById, actx.state.dealerOverridesById, dealer.id]);

  const matrixClientCategory = useMemo(
    () => resolveShowcaseMatrixClientCategory(dealer.clientCategory, dealerMergedFields),
    [dealer.clientCategory, dealerMergedFields],
  );

  const portalCaps = useMemo(
    () => ({
      entrance: numOrNull(entrancePortals) ?? numOrNull(tEnt),
      interior: numOrNull(interiorPortals) ?? numOrNull(tInt),
      total: numOrNull(totalPortals) ?? numOrNull(tTotal),
    }),
    [entrancePortals, interiorPortals, totalPortals, tEnt, tInt, tTotal],
  );

  const selectedProductIds = useMemo(() => new Set(selectedShowcaseModels.map((m) => m.productId)), [selectedShowcaseModels]);

  const missingRequiredModelCount = useMemo(() => {
    if (!matrixClientCategory) return 0;
    const defs = getRequiredShowcaseMatrixDefinitions(matrixClientCategory);
    return defs.filter((d) => !selectedProductIds.has(d.id)).length;
  }, [matrixClientCategory, selectedProductIds]);

  const portalOverfill = useMemo(
    () => hasShowcase === true && computeShowcasePortalOverfill(selectedShowcaseModels, portalCaps, getProductById),
    [hasShowcase, selectedShowcaseModels, portalCaps],
  );

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
        selectedShowcaseModels: normalizeSelectedShowcaseModelsForPersist(selectedShowcaseModels),
        showcaseMatrixTasks,
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
    selectedShowcaseModels,
    showcaseMatrixTasks,
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
          <AccordionContent className="space-y-4 overflow-x-hidden pt-1">
            <div
              className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4"
              data-testid="section-showcase-summary"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  {hasShowcase === null ? (
                    <Badge variant="secondary" className="font-normal">
                      Не заполнено
                    </Badge>
                  ) : hasShowcase === false ? (
                    <Badge variant="outline" className="font-normal">
                      Нет витрины
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-700 font-normal text-white hover:bg-emerald-700">Есть витрина</Badge>
                  )}
                  {hasShowcase === true ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Порталы всего: {dashNum(numOrNull(totalPortals))} · Tandoor: {dashNum(numOrNull(tTotal))} · Свободно / конкуренты:{" "}
                      {dashNum(summary.freeOrCompetitor)} · Дефицит матрицы:{" "}
                      {matrixClientCategory ? missingRequiredModelCount : "—"} · Моделей выбрано: {selectedShowcaseModels.length}
                    </p>
                  ) : hasShowcase === false ? (
                    <p className="text-xs text-muted-foreground">Витрины нет — порталы, сводка и каталог скрыты.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Выберите состояние витрины или отложите заполнение.</p>
                  )}
                </div>
                {canEdit ? (
                  <div className="hidden shrink-0 flex-col items-stretch gap-2 md:flex md:min-w-[220px] md:items-end">
                    <SectionSaveButton
                      testId="button-showcase-save"
                      statusTestId="text-save-status-trade-point-showcase"
                      phase={showcaseSave.phase}
                      onSave={() => void showcaseSave.runSave(persistShowcase)}
                    />
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="text-showcase-save-status"
                      aria-live="polite"
                    >
                      {showcaseSave.phase === "saving"
                        ? "Сохраняем…"
                        : showcaseSave.phase === "success"
                          ? "Сохранено"
                          : showcaseDirty
                            ? "Есть несохранённые изменения"
                            : "Нет несохранённых изменений"}
                    </p>
                  </div>
                ) : null}
              </div>

              {hasShowcase === true ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Порталы всего</p>
                    <p className="text-sm font-semibold tabular-nums">{dashNum(numOrNull(totalPortals))}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tandoor</p>
                    <p className="text-sm font-semibold tabular-nums">{dashNum(numOrNull(tTotal))}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Свободно / конкуренты</p>
                    <p className="text-sm font-semibold tabular-nums">{dashNum(summary.freeOrCompetitor)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Потенциал входные</p>
                    <p className="text-sm font-semibold tabular-nums">{dashNum(summary.entrancePotential)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Потенциал МК</p>
                    <p className="text-sm font-semibold tabular-nums">{dashNum(summary.interiorPotential)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Моделей выбрано</p>
                    <p className="text-sm font-semibold tabular-nums">{selectedShowcaseModels.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Нужно поставить</p>
                    <p
                      className={
                        missingRequiredModelCount > 0
                          ? "text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-100"
                          : "text-sm font-semibold tabular-nums"
                      }
                    >
                      {matrixClientCategory ? missingRequiredModelCount : "—"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {hasShowcase === null && !canEdit ? (
              <p className="text-sm text-muted-foreground">Состояние витрины не заполнено.</p>
            ) : null}

            {hasShowcase === null && canEdit ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="min-h-10 w-full"
                  onClick={() => {
                    setHasShowcase(true);
                    markShowcaseDirty();
                  }}
                >
                  Есть витрина
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 w-full"
                  onClick={() => {
                    setHasShowcase(false);
                    markShowcaseDirty();
                  }}
                >
                  Нет витрины / порталов
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-10 w-full"
                  onClick={() => {
                    setHasShowcase(null);
                    markShowcaseDirty();
                  }}
                >
                  Заполнить позже
                </Button>
              </div>
            ) : null}

            {hasShowcase === false ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">Витрины нет</p>
                <p className="mt-1 text-xs text-muted-foreground">Каталог моделей и расчёт дефицита скрыты, пока не отмечено «Есть витрина».</p>
                {canEdit ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setHasShowcase(true);
                        markShowcaseDirty();
                      }}
                    >
                      Есть витрина
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHasShowcase(null);
                        markShowcaseDirty();
                      }}
                    >
                      Заполнить позже
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasShowcase === true ? (
              <>
                <div className="space-y-4" data-testid="section-showcase-portal-fields">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Основные порталы</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Всего порталов</Label>
                        <Input
                          className="min-h-10"
                          inputMode="numeric"
                          data-testid="input-trade-point-total-portals"
                          value={totalPortals}
                          onChange={(e) => {
                            setTotalPortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Под входные двери</Label>
                        <Input
                          className="min-h-10"
                          inputMode="numeric"
                          data-testid="input-trade-point-entrance-portals"
                          value={entrancePortals}
                          onChange={(e) => {
                            setEntrancePortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Под межкомнатные</Label>
                        <Input
                          className="min-h-10"
                          inputMode="numeric"
                          data-testid="input-trade-point-interior-portals"
                          value={interiorPortals}
                          onChange={(e) => {
                            setInteriorPortals(e.target.value);
                            markShowcaseDirty();
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
                            markShowcaseDirty();
                          }}
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Заполнение</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Порталы Tandoor всего</Label>
                        <Input
                          className="min-h-10"
                          inputMode="numeric"
                          data-testid="input-trade-point-tandoor-total-portals"
                          value={tTotal}
                          onChange={(e) => {
                            setTTotal(e.target.value);
                            markShowcaseDirty();
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
                            markShowcaseDirty();
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
                            markShowcaseDirty();
                          }}
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Конкуренты / свободные порталы</Label>
                        <Input
                          className="min-h-10"
                          inputMode="numeric"
                          value={compPortals}
                          onChange={(e) => {
                            setCompPortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                  <p className="font-semibold text-foreground">Сводка по порталам</p>
                  {!showPortalMathSummary ? (
                    <p className="mt-2 text-xs text-muted-foreground">Заполните порталы, чтобы увидеть потенциал.</p>
                  ) : (
                    <>
                      <p className="mt-2 text-muted-foreground" data-testid="text-trade-point-portal-summary">
                        Всего порталов: {summary.totalPortals ?? "—"} · Занято Tandoor: {summary.tandoorTotal ?? "—"} · Свободно / конкуренты:{" "}
                        {summary.freeOrCompetitor ?? "—"}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Потенциально свободно: входные —{" "}
                        <span data-testid="text-trade-point-entrance-potential">{summary.entrancePotential ?? "—"}</span>, межкомнатные —{" "}
                        <span data-testid="text-trade-point-interior-potential">{summary.interiorPotential ?? "—"}</span>
                        {matrixClientCategory ? (
                          <>
                            {" "}
                            · Дефицит матрицы (обязательные без витрины):{" "}
                            <span className={missingRequiredModelCount > 0 ? "font-medium text-amber-900 dark:text-amber-100" : ""}>
                              {missingRequiredModelCount}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {portalOverfill ? (
                        <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-100">
                          Переполнение: выбранных моделей больше, чем доступных порталов по типам или всего.
                        </p>
                      ) : null}
                      {summary.needsPrimaryInstall ? (
                        <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-100">Требуется первичная установка витрины.</p>
                      ) : null}
                    </>
                  )}
                </div>

                <div data-testid="section-showcase-extra-details">
                  <Collapsible open={extraDetailsOpen} onOpenChange={setExtraDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-between gap-2 sm:w-auto">
                      <span>Дополнительные детали</span>
                      {extraDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Текущее заполнение (текстом)</Label>
                      <Textarea
                        rows={2}
                        value={fillingComment}
                        onChange={(e) => {
                          setFillingComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Комментарий по витрине</Label>
                      <Textarea
                        rows={2}
                        value={showcaseComment}
                        onChange={(e) => {
                          setShowcaseComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Приоритет витрины</Label>
                      <Select
                        value={priority || "__none__"}
                        onValueChange={(v) => {
                          setPriority(v === "__none__" ? "" : v);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      >
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
                    <div className="space-y-1">
                      <Label className="text-xs">Конкуренты (список)</Label>
                      <Textarea
                        rows={2}
                        value={competitorsListed}
                        onChange={(e) => {
                          setCompetitorsListed(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Что поставить в первую очередь</Label>
                      <Textarea
                        rows={2}
                        value={firstNeed}
                        onChange={(e) => {
                          setFirstNeed(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Комментарий для РМ/РОП</Label>
                      <Textarea
                        rows={2}
                        value={rmComment}
                        onChange={(e) => {
                          setRmComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        id="exp-pot"
                        checked={expPot === true}
                        disabled={!canEdit}
                        onCheckedChange={(v) => {
                          setExpPot(v === true ? true : v === false ? false : null);
                          markShowcaseDirty();
                        }}
                      />
                      <Label htmlFor="exp-pot" className="text-sm">
                        Есть потенциал расширения
                      </Label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Доп. порталов можно занять</Label>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        value={addPortals}
                        onChange={(e) => {
                          setAddPortals(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                </div>

                <TradePointShowcaseCatalogPanel
                  tradePointId={point.id}
                  dealerId={dealer.id}
                  matrixClientCategory={matrixClientCategory}
                  canEdit={canEdit}
                  actorUserId={user?.id ?? profile.personaUserId}
                  actorLabel={(user?.name ?? "").trim() || userLabelFromProfile(profile)}
                  selectedShowcaseModels={selectedShowcaseModels}
                  onChangeSelected={setSelectedShowcaseModels}
                  showcaseMatrixTasks={showcaseMatrixTasks}
                  onChangeTasks={setShowcaseMatrixTasks}
                  onMarkDirty={markShowcaseDirty}
                  portalCaps={portalCaps}
                />
              </>
            ) : null}

            {canEdit ? (
              <div className="sticky bottom-0 z-20 -mx-3 mt-4 flex items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-4 md:hidden">
                <p
                  className={
                    showcaseSave.phase === "success"
                      ? "min-w-0 flex-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                      : "min-w-0 flex-1 text-xs text-muted-foreground"
                  }
                  data-testid="text-showcase-save-status-toolbar"
                  aria-live="polite"
                >
                  {showcaseSave.phase === "saving"
                    ? "Сохраняем…"
                    : showcaseSave.phase === "success"
                      ? "Сохранено"
                      : showcaseDirty
                        ? "Есть несохранённые изменения"
                        : "Изменений нет"}
                </p>
                <SectionSaveButton
                  testId="button-showcase-save-bottom"
                  statusTestId="text-save-status-trade-point-showcase-bottom"
                  phase={showcaseSave.phase}
                  onSave={() => void showcaseSave.runSave(persistShowcase)}
                  className="shrink-0"
                />
              </div>
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
