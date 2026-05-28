/**
 * Карточка ручной торговой точки: анкета актуализации без демо-витрины/матрицы.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArchiveInArchiveBadge } from "@/components/archive-record-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useTradePointReadOnly } from "@/lib/trade-point-read-only-context";
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
import {
  canArchiveTradePointDuringActualization,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { getClientCategoryLabel } from "@/lib/client-category";
import { nextManualTradePointInternalCode, isManualActualizationTradePointId, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { TradePointShowcaseCatalogPanel } from "@/components/trade-point-showcase-catalog-panel";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { EntityActualizationPhotoGallery } from "@/components/entity-actualization-photo-gallery";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import { displayUserName } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  formatRussianPhoneInput,
  isValidRussianPhoneLoose,
  RU_PHONE_INVALID_MESSAGE,
  RU_PHONE_PLACEHOLDER,
} from "@/lib/phone-format";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { listActiveTradePointPhotos } from "@/lib/client-base-actualization-photos";

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
  if (n == null || !Number.isFinite(n)) return "Не указано";
  return String(n);
}

function TpHeroCell({
  label,
  value,
  mono,
  testId,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
  testId?: string;
}): ReactElement {
  const v = value?.trim();
  const empty = !v || v === "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[13px] leading-snug",
          empty ? "text-muted-foreground" : "font-medium text-foreground",
          !empty && mono && "font-mono tabular-nums text-primary",
        )}
        data-testid={testId}
      >
        {empty ? "Не указано" : v}
      </p>
    </div>
  );
}

const TP_CLEAN_SECTION_BASE = ["passport", "address_format", "responsibles", "photos", "showcase", "comments", "bitrix"] as const;

function tpCleanSectionsLsKey(tradePointId: string): string {
  return `tandoor-trade-point-clean-card-sections-v1-${tradePointId}`;
}

function isTpCleanSectionId(id: string, includeTasks: boolean): boolean {
  if ((TP_CLEAN_SECTION_BASE as readonly string[]).includes(id)) return true;
  return includeTasks && id === "tasks";
}

function readTpCleanOpenSections(tradePointId: string, includeTasks: boolean): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tpCleanSectionsLsKey(tradePointId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === "string" && isTpCleanSectionId(x, includeTasks));
  } catch {
    return null;
  }
}

function writeTpCleanOpenSections(tradePointId: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tpCleanSectionsLsKey(tradePointId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

type TpSectionStatusKind = "empty" | "partial" | "complete" | "attention" | "no_showcase" | "needs_fill";

function TradePointSectionStatusBadge(props: { status: TpSectionStatusKind }): ReactElement {
  const { status } = props;
  const map: Record<TpSectionStatusKind, { label: string; className: string }> = {
    empty: { label: "Не заполнено", className: "border-border/60 bg-muted/30 text-muted-foreground" },
    partial: { label: "Есть данные", className: "border-primary/30 bg-primary/10 text-foreground" },
    complete: { label: "Заполнено", className: "border-primary/40 bg-primary/15 text-foreground" },
    attention: { label: "Требует внимания", className: "border-border bg-muted text-foreground" },
    no_showcase: { label: "Нет витрины", className: "border-border/60 text-muted-foreground" },
    needs_fill: { label: "Нужно заполнить", className: "border-border bg-muted/80 text-foreground" },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={cn("h-[1.125rem] shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-normal leading-none", m.className)}>
      {m.label}
    </Badge>
  );
}

function TpAccordionSectionTrigger(props: { title: string; summary: string; status: TpSectionStatusKind }): ReactElement {
  const { title, summary, status } = props;
  return (
    <AccordionTrigger className="items-start gap-2 px-3 py-3 text-left hover:no-underline max-sm:px-3 max-sm:py-3 [&[data-state=open]]:bg-primary/5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-sm font-semibold leading-tight text-foreground">{title}</span>
          <TradePointSectionStatusBadge status={status} />
        </div>
        <p className="line-clamp-2 text-sm font-normal leading-snug text-muted-foreground">{summary}</p>
      </div>
    </AccordionTrigger>
  );
}

function formatKindLabel(kind: string): string {
  if (kind === "store") return "Магазин";
  if (kind === "warehouse") return "Склад";
  if (kind === "showroom") return "Шоурум";
  if (kind === "office") return "Офис";
  return "Другое";
}

function tpStatusKindLabel(kind: string): string {
  if (kind === "working") return "Работает";
  if (kind === "closed") return "Закрыта";
  if (kind === "seasonal") return "Сезонная";
  return "Требует проверки";
}

export function TradePointManualActualizationView(props: {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  /** Точка в архиве — поля только для чтения */
  isArchived?: boolean;
  onRequestArchive?: () => void;
  readOnly?: boolean;
  embeddedInSheet?: boolean;
}): ReactElement {
  const { dealer, point, profile, isArchived = false, onRequestArchive, readOnly: readOnlyProp, embeddedInSheet } = props;
  const actx = useClientBaseActualization();
  const readOnlyFromCtx = useTradePointReadOnly();
  const readOnly = readOnlyProp === true || readOnlyFromCtx;
  const { user } = useCurrentUser();
  const canEditBase = canEditDealerDuringActualization(profile, dealer);
  const canEditUi = canEditBase && !isArchived && !readOnly;

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
  const [contactPhone, setContactPhone] = useState(() => formatRussianPhoneInput(point.contactPhone ?? ""));
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
    setContactPhone(formatRussianPhoneInput(point.contactPhone ?? ""));
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
    if (!canEditUi) return false;
    if (contactPhone.trim() && !isValidRussianPhoneLoose(contactPhone)) {
      toast({ title: RU_PHONE_INVALID_MESSAGE, variant: "destructive" });
      return false;
    }
    const contactPhoneFormatted = contactPhone.trim() ? formatRussianPhoneInput(contactPhone) : "";
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
      contactPhone: contactPhoneFormatted,
      comment: tpComment.trim(),
    };
    const r = await actx.persist((prev) => {
      if (isManualActualizationTradePointId(point.id)) {
        const rec = prev.manuallyCreatedTradePointsById[point.id];
        if (!rec) return prev;
        const mergedFields = { ...(rec.fields as Record<string, unknown>), ...nextFields };
        let nextManual = {
          ...rec,
          fields: mergedFields,
          updatedAt: iso,
          updatedBy: uid,
          updatedByName: uname,
        };
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
    canEditUi,
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
    if (!canEditUi) return false;
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
    canEditUi,
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

  const inheritedRm = dealer.regionalManager?.trim() || "Не указано";
  const inheritedMgr = dealer.manager?.trim() || "Не указано";
  const inheritedRop = dealer.ropName?.trim() || "Не указано";

  const openMatrixTasks = useMemo(
    () => showcaseMatrixTasks.filter((t) => t.tradePointId === point.id && t.status === "new"),
    [showcaseMatrixTasks, point.id],
  );
  const showTasksSection = openMatrixTasks.length > 0;

  const orderedSectionIds = useMemo(() => {
    const head = ["passport", "address_format", "responsibles", "photos", "showcase"] as const;
    const tail = ["comments", "bitrix"] as const;
    return [...head, ...(showTasksSection ? (["tasks"] as const) : []), ...tail] as string[];
  }, [showTasksSection]);

  const [openSections, setOpenSections] = useState<string[]>([]);
  const [sectionsHydrated, setSectionsHydrated] = useState(false);

  useEffect(() => {
    const saved = readTpCleanOpenSections(point.id, true);
    setOpenSections(saved ?? []);
    setSectionsHydrated(true);
  }, [point.id]);

  useEffect(() => {
    if (!sectionsHydrated) return;
    writeTpCleanOpenSections(point.id, openSections);
  }, [point.id, openSections, sectionsHydrated]);

  useEffect(() => {
    if (!showTasksSection && openSections.includes("tasks")) {
      setOpenSections((prev) => prev.filter((id) => id !== "tasks"));
    }
  }, [showTasksSection, openSections]);

  const onAccordionValueChange = useCallback(
    (next: string[]) => {
      const allowed = new Set<string>([...TP_CLEAN_SECTION_BASE, ...(showTasksSection ? ["tasks"] : [])]);
      setOpenSections(next.filter((id) => allowed.has(id)));
    },
    [showTasksSection],
  );

  const allSectionsExpanded =
    orderedSectionIds.length > 0 && orderedSectionIds.every((id) => openSections.includes(id));

  const toggleExpandAll = useCallback(() => {
    setOpenSections(allSectionsExpanded ? [] : [...orderedSectionIds]);
  }, [allSectionsExpanded, orderedSectionIds]);

  const expandPassportAndAddress = useCallback(() => {
    setOpenSections((prev) => Array.from(new Set([...prev, "passport", "address_format"])));
  }, []);

  const heroContact = useMemo(() => {
    const n = contactName.trim();
    const p = contactPhone.trim();
    if (n && p) return `${n} · ${p}`;
    if (p) return p;
    if (n) return n;
    return "";
  }, [contactName, contactPhone]);

  const showcaseTriggerSummary = useMemo(() => {
    if (hasShowcase === null) return "Состояние витрины не выбрано";
    if (hasShowcase === false) return "Без витрины";
    const deficit = matrixClientCategory ? String(missingRequiredModelCount) : "Не указано";
    return [
      "Есть витрина",
      `порталы ${dashNum(numOrNull(totalPortals))}`,
      `Tandoor ${dashNum(numOrNull(tTotal))}`,
      `своб./конк. ${dashNum(summary.freeOrCompetitor)}`,
      `пот. ${dashNum(summary.entrancePotential)}/${dashNum(summary.interiorPotential)}`,
      `дефицит ${deficit}`,
      `моделей ${selectedShowcaseModels.length}`,
    ].join(" · ");
  }, [
    hasShowcase,
    totalPortals,
    tTotal,
    summary.freeOrCompetitor,
    summary.entrancePotential,
    summary.interiorPotential,
    matrixClientCategory,
    missingRequiredModelCount,
    selectedShowcaseModels.length,
  ]);

  const sectionMeta = useMemo(() => {
    const passportFilled = Boolean(name.trim()) && Boolean(formatKind) && Boolean(tpStatus);
    const passportSummary = [name.trim() || "Не указано", formatKindLabel(formatKind), tpStatusKindLabel(tpStatus)].join(" · ");
    let passportStatus: TpSectionStatusKind = "empty";
    if (passportFilled) passportStatus = tpStatus === "needs_review" ? "attention" : "complete";
    else if (name.trim() || formatKind || tpStatus) passportStatus = "partial";

    const cityOk = Boolean(city.trim());
    const addrOk = Boolean(address.trim());
    const addressSummary = [city.trim() || "Не указано", (address.trim() || "Не указано").slice(0, 80)].join(" · ");
    let addressStatus: TpSectionStatusKind = "empty";
    if (cityOk && addrOk) addressStatus = contactName.trim() || contactPhone.trim() ? "complete" : "partial";
    else if (cityOk || addrOk) addressStatus = "partial";

    const respSummary = `Менеджер: ${inheritedMgr} · РМ: ${inheritedRm}`;
    const hasMgr = Boolean(dealer.manager?.trim());
    const hasRm = Boolean(dealer.regionalManager?.trim());
    const responsiblesStatus: TpSectionStatusKind =
      !hasMgr && !hasRm ? "empty" : hasMgr && hasRm ? "complete" : "partial";

    const tpPhotoCount = listActiveTradePointPhotos(actx.state, point.id).length;
    const photosSummary = tpPhotoCount === 0 ? "Фото не добавлены" : `${tpPhotoCount} фото`;
    const photosStatus: TpSectionStatusKind = tpPhotoCount === 0 ? "empty" : "partial";

    let showcaseStatusMeta: TpSectionStatusKind = "needs_fill";
    if (hasShowcase === false) showcaseStatusMeta = "no_showcase";
    else if (hasShowcase === null) showcaseStatusMeta = "needs_fill";
    else if (summary.needsPrimaryInstall || portalOverfill || (matrixClientCategory && missingRequiredModelCount > 0)) {
      showcaseStatusMeta = "attention";
    } else if (numOrNull(totalPortals) != null && numOrNull(tTotal) != null && matrixClientCategory && missingRequiredModelCount === 0) {
      showcaseStatusMeta = "complete";
    } else {
      showcaseStatusMeta = "partial";
    }

    const tasksSummary =
      openMatrixTasks.length === 0 ? "Нет открытых задач" : `Открытых задач по витрине: ${openMatrixTasks.length}`;
    const tasksStatus: TpSectionStatusKind = openMatrixTasks.length === 0 ? "complete" : "attention";

    const cmt = tpComment.trim();
    const commentsSummary = cmt ? `${cmt.slice(0, 100)}${cmt.length > 100 ? "…" : ""}` : "Комментарий не заполнен";
    const commentsStatus: TpSectionStatusKind = cmt ? "complete" : "empty";

    const bitrixSummary = "Задачи Bitrix24 по точке";
    const bitrixStatus: TpSectionStatusKind = "partial";

    return {
      passport: { summary: passportSummary, status: passportStatus },
      address: { summary: addressSummary, status: addressStatus },
      responsibles: { summary: respSummary, status: responsiblesStatus },
      photos: { summary: photosSummary, status: photosStatus },
      showcase: { summary: showcaseTriggerSummary, status: showcaseStatusMeta },
      tasks: { summary: tasksSummary, status: tasksStatus },
      comments: { summary: commentsSummary, status: commentsStatus },
      bitrix: { summary: bitrixSummary, status: bitrixStatus },
    };
  }, [
    actx.state,
    point.id,
    name,
    formatKind,
    tpStatus,
    city,
    address,
    contactName,
    contactPhone,
    inheritedMgr,
    inheritedRm,
    dealer.manager,
    dealer.regionalManager,
    showcaseTriggerSummary,
    hasShowcase,
    summary.needsPrimaryInstall,
    portalOverfill,
    matrixClientCategory,
    missingRequiredModelCount,
    totalPortals,
    tTotal,
    openMatrixTasks.length,
    tpComment,
  ]);

  const canShowArchive =
    Boolean(onRequestArchive) && canArchiveTradePointDuringActualization(profile, dealer, point) && !isArchived;

  return (
    <div
      className="min-w-0 max-w-full overflow-x-hidden bg-muted/15 pb-8 pt-1 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-10"
      data-testid="page-trade-point-manual-actualization"
    >
      <div className="mx-auto w-full max-w-5xl space-y-3 px-3 sm:space-y-4 sm:px-4 lg:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 w-fit justify-start gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Link href="/dealer-base">
              <span aria-hidden>←</span> Назад
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-8 px-2.5 text-xs font-medium">
              <Link href={`/dealers/${dealer.id}`}>К клиенту</Link>
            </Button>
            {canEditUi ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 min-w-[7.5rem] bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
                data-testid="button-trade-point-edit"
                onClick={expandPassportAndAddress}
              >
                Редактировать
              </Button>
            ) : null}
            {canShowArchive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid={`button-trade-point-archive-${point.id}`}
                onClick={() => onRequestArchive?.()}
              >
                Удалить
              </Button>
            ) : null}
          </div>
        </div>

        <ClientBaseActualizationSyncStatus
          compact
          isLoading={actx.loading}
          meta={actx.meta}
          syncStatus={actx.syncStatus}
          onRetry={() => void actx.refresh()}
        />

        <section
          className={cn(
            "overflow-hidden rounded-xl border border-border border-l-[3px] border-l-primary bg-card shadow-sm",
            isArchived && "bg-muted/30",
          )}
        >
          <div className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-4 sm:py-4">
            <div className="w-full shrink-0 sm:max-w-[15rem]" data-testid="trade-point-manual-hero-visual">
              <ShowcaseCoverPhotoSlot
                kind="trade_point"
                dealer={dealer}
                tradePoint={point}
                profile={profile}
                size="hero"
                rounded="xl"
                className="w-full"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
                      {name.trim() || point.name}
                    </h1>
                    {isArchived ? (
                      <ArchiveInArchiveBadge size="header" testId="badge-trade-point-manual-header-archived" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Торговая точка</p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Код ТТ</p>
                  <p
                    className="font-mono text-sm font-semibold tabular-nums text-primary"
                    data-testid={`text-trade-point-internal-code-${point.id}`}
                  >
                    {getTradePointDisplayCodeForActualization(point)}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                <TpHeroCell label="Клиент" value={dealer.name} />
                <TpHeroCell label="Код клиента" value={dealer.releaseCode?.trim()} mono testId="text-trade-point-hero-dealer-code" />
                <TpHeroCell label="Город" value={city.trim()} />
                <TpHeroCell
                  label="Формат / категория"
                  value={`${formatKindLabel(formatKind)} · ${getClientCategoryLabel(dealer.clientCategory)}`}
                />
                <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Адрес</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground">
                    {address.trim() ? address.trim() : "Не указано"}
                  </p>
                </div>
                <TpHeroCell label="Контакт" value={heroContact || undefined} />
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5">
                {isArchived ? <ArchiveInArchiveBadge testId={`badge-trade-point-archived-status-${point.id}`} /> : null}
                {hasShowcase === null ? (
                  <Badge
                    variant="outline"
                    className="h-[1.125rem] border-border bg-muted/50 px-1.5 py-0 text-[10px] font-normal leading-none text-muted-foreground"
                  >
                    Витрина не заполнена
                  </Badge>
                ) : hasShowcase === false ? (
                  <Badge variant="outline" className="h-[1.125rem] px-1.5 py-0 text-[10px] font-normal leading-none text-muted-foreground">
                    Нет витрины
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-[1.125rem] border-primary/40 bg-primary/10 px-1.5 py-0 text-[10px] font-normal leading-none text-foreground"
                  >
                    Есть витрина
                  </Badge>
                )}
                {hasShowcase === true && matrixClientCategory && missingRequiredModelCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="h-[1.125rem] border-primary/50 bg-card px-1.5 py-0 text-[10px] font-normal leading-none text-foreground"
                  >
                    Есть дефицит
                  </Badge>
                ) : null}
                {hasShowcase === true ? (
                  <Badge variant="outline" className="h-[1.125rem] border-border bg-card px-1.5 py-0 text-[10px] font-normal leading-none text-muted-foreground">
                    Порталы: {numOrNull(totalPortals) != null && numOrNull(totalPortals)! >= 0 ? numOrNull(totalPortals) : "Не указано"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Разделы анкеты</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            data-testid="button-trade-point-sections-expand-all"
            onClick={toggleExpandAll}
          >
            {allSectionsExpanded ? "Свернуть всё" : "Развернуть всё"}
          </Button>
        </div>

        <Accordion type="multiple" className="space-y-1.5" value={openSections} onValueChange={onAccordionValueChange}>
        <AccordionItem value="passport" data-testid="section-trade-point-passport" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Паспорт торговой точки" summary={sectionMeta.passport.summary} status={sectionMeta.passport.status} />
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 text-sm sm:px-3">
            <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Название</Label>
              <Input className="min-h-9" value={name} onChange={(e) => { setName(e.target.value); mainSave.markDirty(); }} disabled={!canEditUi} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Формат</Label>
              <Select value={formatKind} onValueChange={(v) => { setFormatKind(v); mainSave.markDirty(); }} disabled={!canEditUi}>
                <SelectTrigger className="min-h-9">
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
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Статус</Label>
              <Select value={tpStatus} onValueChange={(v) => { setTpStatus(v); mainSave.markDirty(); }} disabled={!canEditUi}>
                <SelectTrigger className="min-h-9">
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
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="address_format" data-testid="section-trade-point-address-format" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Адрес и формат" summary={sectionMeta.address.summary} status={sectionMeta.address.status} />
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 text-sm sm:px-3">
            <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Город</Label>
              <Input className="min-h-9" value={city} onChange={(e) => { setCity(e.target.value); mainSave.markDirty(); }} disabled={!canEditUi} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Адрес</Label>
              <Textarea rows={2} className="min-h-[4rem] resize-y" value={address} onChange={(e) => { setAddress(e.target.value); mainSave.markDirty(); }} disabled={!canEditUi} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Контакт точки</Label>
              <Input className="min-h-9" value={contactName} onChange={(e) => { setContactName(e.target.value); mainSave.markDirty(); }} disabled={!canEditUi} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Телефон точки</Label>
              <Input
                className="min-h-9"
                value={contactPhone}
                inputMode="tel"
                placeholder={RU_PHONE_PLACEHOLDER}
                data-testid="input-trade-point-phone"
                onChange={(e) => {
                  setContactPhone(formatRussianPhoneInput(e.target.value));
                  mainSave.markDirty();
                }}
                disabled={!canEditUi}
              />
            </div>
            {canEditUi ? (
              <div className="sm:col-span-2">
                <SectionSaveButton
                  testId="button-trade-point-section-save-main"
                  statusTestId="text-save-status-trade-point-main-view"
                  phase={mainSave.phase}
                  onSave={() => void mainSave.runSave(persistMain)}
                />
              </div>
            ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="responsibles" data-testid="section-trade-point-responsibles" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Ответственные" summary={sectionMeta.responsibles.summary} status={sectionMeta.responsibles.status} />
          <AccordionContent className="space-y-1.5 border-t border-border/40 px-2.5 pb-2.5 pt-1.5 text-sm text-muted-foreground sm:px-3">
            <p className="leading-snug">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Менеджер</span>
              <span className="mt-0.5 block text-[13px] font-medium text-foreground">{inheritedMgr}</span>
              <span className="text-[10px] text-muted-foreground/80">с карточки клиента</span>
            </p>
            <p className="leading-snug">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Региональный менеджер</span>
              <span className="mt-0.5 block text-[13px] font-medium text-foreground">{inheritedRm}</span>
              <span className="text-[10px] text-muted-foreground/80">с карточки клиента</span>
            </p>
            <p className="leading-snug">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">РОП</span>
              <span className="mt-0.5 block text-[13px] font-medium text-foreground">{inheritedRop}</span>
              <span className="text-[10px] text-muted-foreground/80">с карточки клиента</span>
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="photos" data-testid="section-trade-point-photos" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Фото торговой точки" summary={sectionMeta.photos.summary} status={sectionMeta.photos.status} />
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 sm:px-3">
            <EntityActualizationPhotoGallery entityType="trade_point" entityId={point.id} canEdit={canEditUi} profile={profile} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="showcase" data-testid="section-trade-point-showcase-portals" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Витрина и порталы" summary={sectionMeta.showcase.summary} status={sectionMeta.showcase.status} />
          <AccordionContent className="space-y-2 overflow-x-hidden border-t border-border/40 px-2.5 pb-2.5 pt-1.5 sm:px-3">
            <div className="rounded-lg border border-border/50 bg-muted/10 p-2.5 sm:p-3" data-testid="section-showcase-summary">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  {hasShowcase === true ? (
                    <p className="text-sm leading-snug text-muted-foreground">
                      Порталы всего: {dashNum(numOrNull(totalPortals))} · Tandoor: {dashNum(numOrNull(tTotal))} · Свободно / конкуренты:{" "}
                      {dashNum(summary.freeOrCompetitor)} · Дефицит матрицы:{" "}
                      {matrixClientCategory ? String(missingRequiredModelCount) : "Не указано"} · Моделей выбрано: {selectedShowcaseModels.length}
                    </p>
                  ) : hasShowcase === false ? (
                    <p className="text-sm leading-snug text-muted-foreground">Витрины нет — порталы, сводка и каталог скрыты.</p>
                  ) : (
                    <p className="text-sm leading-snug text-muted-foreground">Выберите состояние витрины или отложите заполнение.</p>
                  )}
                  {showcaseRec?.updatedAt?.trim() ? (
                    <p className="text-[10px] text-muted-foreground/90">
                      Обновлено витрины: {formatDisplayDateTime(showcaseRec.updatedAt)}
                    </p>
                  ) : null}
                </div>
                {canEditUi ? (
                  <div className="hidden shrink-0 flex-col items-stretch gap-1.5 md:flex md:min-w-[200px] md:items-end">
                    <SectionSaveButton
                      testId="button-showcase-save"
                      statusTestId="text-save-status-trade-point-showcase"
                      phase={showcaseSave.phase}
                      onSave={() => void showcaseSave.runSave(persistShowcase)}
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground" data-testid="text-showcase-save-status" aria-live="polite">
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
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Порталы всего</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{dashNum(numOrNull(totalPortals))}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tandoor</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{dashNum(numOrNull(tTotal))}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Свободно / конкуренты</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{dashNum(summary.freeOrCompetitor)}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Потенциал входные</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{dashNum(summary.entrancePotential)}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Потенциал МК</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{dashNum(summary.interiorPotential)}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Моделей выбрано</p>
                    <p className="text-[13px] font-semibold tabular-nums leading-snug text-foreground">{selectedShowcaseModels.length}</p>
                  </div>
                  <div className="rounded-md border border-border/40 px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Нужно поставить</p>
                    <p
                      className={
                        missingRequiredModelCount > 0
                          ? "text-[13px] font-semibold tabular-nums leading-snug text-foreground"
                          : "text-[13px] font-semibold tabular-nums leading-snug text-foreground"
                      }
                    >
                      {matrixClientCategory ? missingRequiredModelCount : "Не указано"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {hasShowcase === null && !canEditUi ? (
              <p className="text-sm text-muted-foreground">Состояние витрины не заполнено.</p>
            ) : null}

            {hasShowcase === null && canEditUi ? (
              <div className="grid gap-1.5 sm:grid-cols-3">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-8 w-full bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
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
                  className="h-8 w-full text-xs font-medium"
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
                  variant="outline"
                  className="h-8 w-full text-xs font-medium"
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
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center">
                <p className="text-sm font-semibold text-foreground">Витрины нет</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Каталог моделей и расчёт дефицита скрыты, пока не отмечено «Есть витрина».
                </p>
                {canEditUi ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-8 bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
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
                      className="h-8 text-xs font-medium"
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
                <div className="space-y-2" data-testid="section-showcase-portal-fields">
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Основные порталы</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Всего порталов</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-total-portals"
                          value={totalPortals}
                          onChange={(e) => {
                            setTotalPortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Под входные двери</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-entrance-portals"
                          value={entrancePortals}
                          onChange={(e) => {
                            setEntrancePortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Под межкомнатные</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-interior-portals"
                          value={interiorPortals}
                          onChange={(e) => {
                            setInteriorPortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Площадь витрины, м²</Label>
                        <Input
                          className="min-h-9"
                          inputMode="decimal"
                          data-testid="input-trade-point-showcase-area"
                          value={area}
                          onChange={(e) => {
                            setArea(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Заполнение</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Порталы Tandoor всего</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-tandoor-total-portals"
                          value={tTotal}
                          onChange={(e) => {
                            setTTotal(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tandoor входные</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-tandoor-entrance-portals"
                          value={tEnt}
                          onChange={(e) => {
                            setTEnt(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tandoor межкомнатные</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          data-testid="input-trade-point-tandoor-interior-portals"
                          value={tInt}
                          onChange={(e) => {
                            setTInt(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Конкуренты / свободные порталы</Label>
                        <Input
                          className="min-h-9"
                          inputMode="numeric"
                          value={compPortals}
                          onChange={(e) => {
                            setCompPortals(e.target.value);
                            markShowcaseDirty();
                          }}
                          disabled={!canEditUi}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border/40 bg-muted/10 p-2.5 text-sm">
                  <p className="text-xs font-semibold text-foreground">Сводка по порталам</p>
                  {!showPortalMathSummary ? (
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">Заполните порталы, чтобы увидеть потенциал.</p>
                  ) : (
                    <>
                      <p className="mt-1.5 text-xs leading-snug text-muted-foreground" data-testid="text-trade-point-portal-summary">
                        Всего порталов: {summary.totalPortals != null ? summary.totalPortals : "Не указано"} · Занято Tandoor:{" "}
                        {summary.tandoorTotal != null ? summary.tandoorTotal : "Не указано"} · Свободно / конкуренты:{" "}
                        {summary.freeOrCompetitor != null ? summary.freeOrCompetitor : "Не указано"}
                      </p>
                      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                        Потенциально свободно: входные —{" "}
                        <span data-testid="text-trade-point-entrance-potential">
                          {summary.entrancePotential != null ? summary.entrancePotential : "Не указано"}
                        </span>
                        , межкомнатные —{" "}
                        <span data-testid="text-trade-point-interior-potential">
                          {summary.interiorPotential != null ? summary.interiorPotential : "Не указано"}
                        </span>
                        {matrixClientCategory ? (
                          <>
                            {" "}
                            · Дефицит матрицы (обязательные без витрины):{" "}
                            <span className={missingRequiredModelCount > 0 ? "font-medium text-foreground" : ""}>
                              {missingRequiredModelCount}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {portalOverfill ? (
                        <p className="mt-2 text-xs font-medium text-foreground">
                          Переполнение: выбранных моделей больше, чем доступных порталов по типам или всего.
                        </p>
                      ) : null}
                      {summary.needsPrimaryInstall ? (
                        <p className="mt-2 text-xs font-medium text-foreground">Требуется первичная установка витрины.</p>
                      ) : null}
                    </>
                  )}
                </div>

                <div data-testid="section-showcase-extra-details">
                  <Collapsible open={extraDetailsOpen} onOpenChange={setExtraDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-between gap-2 text-xs font-medium sm:w-auto">
                      <span>Дополнительные детали</span>
                      {extraDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Текущее заполнение (текстом)</Label>
                      <Textarea
                        rows={2}
                        value={fillingComment}
                        onChange={(e) => {
                          setFillingComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Комментарий по витрине</Label>
                      <Textarea
                        rows={2}
                        value={showcaseComment}
                        onChange={(e) => {
                          setShowcaseComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Приоритет витрины</Label>
                      <Select
                        value={priority || "__none__"}
                        onValueChange={(v) => {
                          setPriority(v === "__none__" ? "" : v);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
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
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Конкуренты (список)</Label>
                      <Textarea
                        rows={2}
                        value={competitorsListed}
                        onChange={(e) => {
                          setCompetitorsListed(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Что поставить в первую очередь</Label>
                      <Textarea
                        rows={2}
                        value={firstNeed}
                        onChange={(e) => {
                          setFirstNeed(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Комментарий для РМ/РОП</Label>
                      <Textarea
                        rows={2}
                        value={rmComment}
                        onChange={(e) => {
                          setRmComment(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        id="exp-pot"
                        checked={expPot === true}
                        disabled={!canEditUi}
                        onCheckedChange={(v) => {
                          setExpPot(v === true ? true : v === false ? false : null);
                          markShowcaseDirty();
                        }}
                      />
                      <Label htmlFor="exp-pot" className="text-xs font-normal text-muted-foreground">
                        Есть потенциал расширения
                      </Label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Доп. порталов можно занять</Label>
                      <Input
                        className="min-h-9"
                        inputMode="numeric"
                        value={addPortals}
                        onChange={(e) => {
                          setAddPortals(e.target.value);
                          markShowcaseDirty();
                        }}
                        disabled={!canEditUi}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                </div>

                <TradePointShowcaseCatalogPanel
                  tradePointId={point.id}
                  dealerId={dealer.id}
                  matrixClientCategory={matrixClientCategory}
                  canEdit={canEditUi}
                  actorUserId={user?.id ?? profile.personaUserId}
                  actorLabel={user ? displayUserName(user) : userLabelFromProfile(profile)}
                  selectedShowcaseModels={selectedShowcaseModels}
                  onChangeSelected={setSelectedShowcaseModels}
                  showcaseMatrixTasks={showcaseMatrixTasks}
                  onChangeTasks={setShowcaseMatrixTasks}
                  onMarkDirty={markShowcaseDirty}
                  portalCaps={portalCaps}
                />
              </>
            ) : null}

            {canEditUi ? (
              <div className="sticky bottom-0 z-20 -mx-2.5 mt-3 flex items-center justify-between gap-2 border-t border-border/60 bg-background/95 px-2.5 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-3 md:hidden">
                <p
                  className={
                    showcaseSave.phase === "success"
                      ? "min-w-0 flex-1 text-xs font-medium text-primary"
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

        {showTasksSection ? (
          <AccordionItem
            value="tasks"
            data-testid="section-trade-point-showcase-tasks-summary"
            className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs"
          >
            <TpAccordionSectionTrigger
              title="Задачи по витрине"
              summary={sectionMeta.tasks.summary}
              status={sectionMeta.tasks.status}
            />
            <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 sm:px-3">
              <p className="text-xs leading-snug text-muted-foreground">
                Полный список и отметки статуса — во вкладке «Задачи» внутри раздела «Витрина и порталы» (каталог моделей).
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs leading-snug text-foreground">
                {openMatrixTasks.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex gap-1.5">
                    <span className="text-muted-foreground">•</span>
                    <span className="min-w-0 break-words">{t.productName.trim() || t.productId}</span>
                  </li>
                ))}
              </ul>
              {openMatrixTasks.length > 8 ? (
                <p className="text-xs text-muted-foreground">И ещё {openMatrixTasks.length - 8}…</p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ) : null}

        <AccordionItem value="comments" data-testid="section-trade-point-comments" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Комментарии" summary={sectionMeta.comments.summary} status={sectionMeta.comments.status} />
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 text-sm sm:px-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Комментарий по точке</Label>
              <Textarea rows={3} className="min-h-[5rem] resize-y text-sm" value={tpComment} onChange={(e) => { setTpComment(e.target.value); mainSave.markDirty(); }} disabled={!canEditUi} />
            </div>
            {canEditUi ? (
              <div className="mt-2">
                <SectionSaveButton
                  testId="button-trade-point-section-save-comments"
                  statusTestId="text-save-status-trade-point-main-view"
                  phase={mainSave.phase}
                  onSave={() => void mainSave.runSave(persistMain)}
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bitrix" data-testid="section-trade-point-bitrix" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-xs">
          <TpAccordionSectionTrigger title="Bitrix24" summary={sectionMeta.bitrix.summary} status={sectionMeta.bitrix.status} />
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 sm:px-3">
            <Bitrix24TasksPanel
              scope="trade_point"
              dealerId={dealer.id}
              dealerName={dealer.name}
              tradePointId={point.id}
              tradePointName={point.name}
              canCreate={canEditClientNextStep(profile, dealer)}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user ? displayUserName(user) : userLabelFromProfile(profile)}
              compact
            />
          </AccordionContent>
        </AccordionItem>
        </Accordion>

      </div>
    </div>
  );
}
