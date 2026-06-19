/**
 * Карточка ручной торговой точки: анкета актуализации без демо-витрины/матрицы.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useTradePointReadOnly } from "@/lib/trade-point-read-only-context";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  mergeActualizationState,
  normalizeHasShowcase,
  type TradePointShowcaseActualization,
} from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import { resolveTradePointMatrixModels } from "@/lib/trade-point-matrix-resolver";
import {
  computeTradePointShowcaseMatrixStats,
  loadShowcaseMatrixStorage,
} from "@/lib/trade-point-showcase-matrix-storage";
import {
  canArchiveTradePointDuringActualization,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { getClientCategoryLabel } from "@/lib/client-category";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { nextManualTradePointInternalCode, isManualActualizationTradePointId, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { mapActualizationTpFieldsToOverrides, saveTradePointFields } from "@/lib/use-dealer-field-saver";
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
import { listActiveTradePointPhotos } from "@/lib/client-base-actualization-photos";
import { getProductById } from "@/lib/catalog-data";
import {
  countSelectedByType,
  getShowcaseTypeCapacity,
  type ShowcaseTypeKey,
} from "@/lib/showcase-type-capacity";
import { useDealerTpOverridesHydration } from "@/hooks/use-dealer-tp-overrides-hydration";
import { hydrateTradePointOverridesForEntity } from "@/lib/dealer-overrides-sync";
import { DEALER_TRADE_POINTS_EVENT, getTradePointEdit } from "@/lib/dealer-trade-points-overrides";
import { useTradePointOverride } from "@/lib/dealer-overrides-runtime";
import { TradePointResponsiblesSection } from "@/components/trade-point-responsibles-section";

function emptyShowcase(dealerId: string, tradePointId: string): TradePointShowcaseActualization {
  const iso = new Date().toISOString();
  return {
    tradePointId,
    dealerId,
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: null,
    interiorPortals: null,
    hardwareSections: null,
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

/** Состояние аккордеона → только то, что пользователь раскрыл сам (без временного авто-showcase из URL). */
function accordionNextToUserSections(
  accordionNext: string[],
  prevUser: string[],
  autoShowcaseActive: boolean,
): string[] {
  const showcaseInAccordion = accordionNext.includes("showcase");
  let showcasePinned = prevUser.includes("showcase");
  if (!showcaseInAccordion) {
    showcasePinned = false;
  } else if (!showcasePinned && !autoShowcaseActive) {
    showcasePinned = true;
  }
  const withoutShowcase = accordionNext.filter((id) => id !== "showcase");
  return showcasePinned ? [...withoutShowcase, "showcase"] : withoutShowcase;
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
  const { hydrationVersion } = useDealerTpOverridesHydration({ dealerId: dealer.id, tpId: point.id });
  const tpOverride = useTradePointOverride(point.id);
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
  const hasShowcase = normalizeHasShowcase(showcaseRec?.hasShowcase);

  const [name, setName] = useState(point.name);
  const [formatKind, setFormatKind] = useState(readField("formatKind") || "store");
  const [tpStatus, setTpStatus] = useState(readField("tpStatusKind") || "working");
  const [city, setCity] = useState(point.city);
  const [address, setAddress] = useState(point.address);
  const [contactName, setContactName] = useState(point.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(() => formatRussianPhoneInput(point.contactPhone ?? ""));
  const [tpComment, setTpComment] = useState(point.tpComment ?? "");

  const mainSave = useSectionSaveFeedback();

  const skipMainFormHydrate = mainSave.isDirty || mainSave.phase === "saving";

  useEffect(() => {
    if (skipMainFormHydrate) return;
    const mf = (manualRec?.fields ?? {}) as Record<string, unknown>;
    const rf = (k: string) => (typeof mf[k] === "string" ? (mf[k] as string).trim() : "");
    const edit = getTradePointEdit(dealer.id, point.id);
    const hydratedComment = edit?.comment ?? tpOverride?.comment ?? point.tpComment ?? "";
    setName(point.name);
    setCity(point.city);
    setAddress(point.address);
    setContactName(point.contactName ?? "");
    setContactPhone(formatRussianPhoneInput(point.contactPhone ?? ""));
    setTpComment(hydratedComment);
    setFormatKind(rf("formatKind") || "store");
    setTpStatus(rf("tpStatusKind") || "working");
  }, [point, manualRec, dealer.id, tpOverride, hydrationVersion, skipMainFormHydrate]);

  useEffect(() => {
    const syncComment = () => {
      if (mainSave.isDirty || mainSave.phase === "saving") return;
      const edit = getTradePointEdit(dealer.id, point.id);
      const hydratedComment = edit?.comment ?? tpOverride?.comment;
      if (hydratedComment != null) setTpComment(hydratedComment);
    };
    window.addEventListener(DEALER_TRADE_POINTS_EVENT, syncComment);
    return () => window.removeEventListener(DEALER_TRADE_POINTS_EVENT, syncComment);
  }, [dealer.id, point.id, tpOverride, mainSave.isDirty, mainSave.phase]);

  const templateModelsCount = useMemo(
    () =>
      resolveTradePointMatrixModels({
        dealerId: dealer.id,
        tradePointId: point.id,
        clientCategory: dealer.clientCategory,
        region: dealer.region,
        city: point.city,
      }).length,
    [dealer.id, point.id, dealer.clientCategory, dealer.region, point.city],
  );

  const matrixStats = useMemo(() => {
    const storage = loadShowcaseMatrixStorage();
    return computeTradePointShowcaseMatrixStats(dealer, point, storage);
  }, [dealer, point, actx.state.updatedAt]);

  const summary = useMemo(() => {
    const row = showcaseRec ?? emptyShowcase(dealer.id, point.id);
    return computePortalSummary(row);
  }, [showcaseRec, dealer.id, point.id]);

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
    const dbFields = mapActualizationTpFieldsToOverrides(nextFields);
    const strictResult = await saveTradePointFields(point.id, dbFields, dealer.id, {
      fieldLabel: "Торговая точка",
      source: "trade-point-manual-actualization",
    });
    if (!r.success && !strictResult.ok) {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
      return false;
    }
    await hydrateTradePointOverridesForEntity({ dealerId: dealer.id, tpId: point.id });
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

  const openMatrixTasks = useMemo(
    () =>
      (showcaseRec?.showcaseMatrixTasks ?? []).filter((t) => t.tradePointId === point.id && t.status === "new"),
    [showcaseRec?.showcaseMatrixTasks, point.id],
  );
  const showTasksSection = openMatrixTasks.length > 0;

  const orderedSectionIds = useMemo(() => {
    const head = ["passport", "address_format", "responsibles", "photos", "showcase"] as const;
    const tail = ["comments", "bitrix"] as const;
    return [...head, ...(showTasksSection ? (["tasks"] as const) : []), ...tail] as string[];
  }, [showTasksSection]);

  const [userOpenSections, setUserOpenSections] = useState<string[]>([]);
  const [sectionsHydrated, setSectionsHydrated] = useState(false);
  const [showcaseAutoOpen, setShowcaseAutoOpen] = useState(false);

  useEffect(() => {
    const saved = readTpCleanOpenSections(point.id, true);
    setUserOpenSections(saved ?? []);
    setShowcaseAutoOpen(false);
    setSectionsHydrated(true);
  }, [point.id]);

  useEffect(() => {
    if (!sectionsHydrated) return;
    writeTpCleanOpenSections(point.id, userOpenSections);
  }, [point.id, userOpenSections, sectionsHydrated]);

  useEffect(() => {
    if (!showTasksSection && userOpenSections.includes("tasks")) {
      setUserOpenSections((prev) => prev.filter((id) => id !== "tasks"));
    }
  }, [showTasksSection, userOpenSections]);

  const routeQs = useRouteSearchParams();

  useEffect(() => {
    if (!sectionsHydrated) return;
    if (routeQs.get("tradePointShowcase") !== "1") return;
    setShowcaseAutoOpen(true);
    requestAnimationFrame(() => {
      document
        .querySelector('[data-testid="section-trade-point-showcase-portals"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [routeQs, sectionsHydrated, point.id]);

  const openSections = useMemo(() => {
    if (showcaseAutoOpen && !userOpenSections.includes("showcase")) {
      return [...userOpenSections, "showcase"];
    }
    return userOpenSections;
  }, [userOpenSections, showcaseAutoOpen]);

  const onAccordionValueChange = useCallback(
    (next: string[]) => {
      const allowed = new Set<string>([...TP_CLEAN_SECTION_BASE, ...(showTasksSection ? ["tasks"] : [])]);
      const filtered = next.filter((id) => allowed.has(id));
      const showcaseWasAutoOnly = showcaseAutoOpen && !userOpenSections.includes("showcase");
      const showcaseInNext = filtered.includes("showcase");
      setUserOpenSections((prev) => accordionNextToUserSections(filtered, prev, showcaseAutoOpen));
      if (showcaseWasAutoOnly && showcaseInNext) {
        setShowcaseAutoOpen(true);
      } else {
        setShowcaseAutoOpen(false);
      }
    },
    [showTasksSection, showcaseAutoOpen, userOpenSections],
  );

  const allSectionsExpanded =
    orderedSectionIds.length > 0 && orderedSectionIds.every((id) => openSections.includes(id));

  const toggleExpandAll = useCallback(() => {
    setShowcaseAutoOpen(false);
    setUserOpenSections(allSectionsExpanded ? [] : [...orderedSectionIds]);
  }, [allSectionsExpanded, orderedSectionIds]);

  const expandPassportAndAddress = useCallback(() => {
    setShowcaseAutoOpen(false);
    setUserOpenSections((prev) => Array.from(new Set([...prev, "passport", "address_format"])));
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
    if (hasShowcase === false) return "Без витрины";
    const deficit = templateModelsCount > 0 ? String(matrixStats.missing) : "Не указано";
    return [
      "Есть витрина",
      `порталы ${dashNum(showcaseRec?.totalPortals)}`,
      `Tandoor ${dashNum(showcaseRec?.tandoorTotalPortals)}`,
      `фурнитура ${dashNum(showcaseRec?.hardwareSections)}`,
      `своб./конк. ${dashNum(summary.freeOrCompetitor)}`,
      `пот. ${dashNum(summary.entrancePotential)}/${dashNum(summary.interiorPotential)}`,
      `дефицит ${deficit}`,
      `матрица ${matrixStats.installed}/${matrixStats.total}`,
    ].join(" · ");
  }, [
    hasShowcase,
    showcaseRec?.totalPortals,
    showcaseRec?.tandoorTotalPortals,
    showcaseRec?.hardwareSections,
    summary.freeOrCompetitor,
    summary.entrancePotential,
    summary.interiorPotential,
    templateModelsCount,
    matrixStats.missing,
    matrixStats.installed,
    matrixStats.total,
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

    const respSummary = "Менеджер, региональный менеджер и роп";
    const hasMgr = Boolean(dealer.manager?.trim());
    const hasRm = Boolean(dealer.regionalManager?.trim());
    const responsiblesStatus: TpSectionStatusKind =
      !hasMgr && !hasRm ? "empty" : hasMgr && hasRm ? "complete" : "partial";

    const tpPhotoCount = listActiveTradePointPhotos(actx.state, point.id).length;
    const photosSummary = tpPhotoCount === 0 ? "Фото не добавлены" : `${tpPhotoCount} фото`;
    const photosStatus: TpSectionStatusKind = tpPhotoCount === 0 ? "empty" : "partial";

    let showcaseStatusMeta: TpSectionStatusKind = "partial";
    const selectedModels = showcaseRec?.selectedShowcaseModels ?? [];
    const needsCapacityAttention = (["entrance", "interior", "hardware"] as ShowcaseTypeKey[]).some(
      (type) =>
        countSelectedByType(selectedModels, type, getProductById) > 0 &&
        getShowcaseTypeCapacity(showcaseRec, type) == null,
    );
    if (hasShowcase === false) showcaseStatusMeta = "no_showcase";
    else if (
      summary.needsPrimaryInstall ||
      needsCapacityAttention ||
      (templateModelsCount > 0 && matrixStats.missing > 0)
    ) {
      showcaseStatusMeta = "attention";
    } else if (
      hasShowcase === true &&
      templateModelsCount > 0 &&
      matrixStats.missing === 0 &&
      matrixStats.total > 0
    ) {
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
    dealer.manager,
    dealer.regionalManager,
    showcaseTriggerSummary,
    hasShowcase,
    showcaseRec,
    summary.needsPrimaryInstall,
    templateModelsCount,
    matrixStats.missing,
    matrixStats.total,
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
          scope="dealer-tp-overrides"
          dealerId={dealer.id}
          tpId={point.id}
          compact
          isLoading={actx.loading}
          meta={actx.meta}
          syncStatus={actx.syncStatus}
          onRetry={() => void actx.refresh()}
        />

        <section className="overflow-hidden rounded-xl border border-border border-l-[3px] border-l-primary bg-card shadow-sm">
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
                {hasShowcase === false ? (
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
                {hasShowcase === true && templateModelsCount > 0 && matrixStats.missing > 0 ? (
                  <Badge
                    variant="outline"
                    className="h-[1.125rem] border-primary/50 bg-card px-1.5 py-0 text-[10px] font-normal leading-none text-foreground"
                  >
                    Есть дефицит
                  </Badge>
                ) : null}
                {hasShowcase === true ? (
                  <Badge variant="outline" className="h-[1.125rem] border-border bg-card px-1.5 py-0 text-[10px] font-normal leading-none text-muted-foreground">
                    Порталы: {showcaseRec?.totalPortals != null && showcaseRec.totalPortals >= 0 ? showcaseRec.totalPortals : "Не указано"}
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
          <AccordionContent className="border-t border-border/40 px-2.5 pb-2.5 pt-1.5 sm:px-3">
            <TradePointResponsiblesSection tradePointId={point.id} currentUserRole={user?.role} />
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
            <DistributionTradePointMatrixEntry
              dealer={dealer}
              point={point}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorName={user ? displayUserName(user) : userLabelFromProfile(profile)}
            />
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
                Полный список и отметки статуса — во вкладке «Задачи» внутри раздела «Витрина и порталы» (матрица размещения).
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
