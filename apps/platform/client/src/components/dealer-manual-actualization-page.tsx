/**
 * Карточка клиента в режиме актуализации: анкета без демо-блоков (для manual и для release при CLEAN_MODE).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { logisticsShipmentDaysTextFromManualFields } from "@/lib/dealer-shipment-days";
import { getClientCategoryLabel } from "@/lib/client-category";
import { mergeTradePointsActiveForActualization, mergeDealerRowWithActualization, mergeLegalEntitiesForActualization } from "@/lib/client-base-actualization-data-merge";
import { commercialTriLabelRu } from "@/lib/dealer-commercial-characteristics";
import {
  mergeActualizationState,
  type ActualizationState,
  type DealerActualizationContact,
} from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import {
  getPrimaryActualizationContact,
  listActiveActualizationContactsForDealer,
  newActualizationContactId,
} from "@/lib/client-base-actualization-contacts-helpers";
import {
  canArchiveDealerDuringActualization,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { DealerActualizationEditDialog } from "@/components/client-base-actualization-dealer-forms";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { DealerClientNextStepSection } from "@/components/dealer-client-next-step-section";
import { useCurrentUser } from "@/hooks/use-current-user";
import { displayUserName } from "@/lib/auth-api";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { DealerTradePointsSection } from "@/components/dealer-trade-points-section";
import { DealerLegalEntitiesSection } from "@/components/dealer-legal-entities-section";
import { EntityActualizationPhotoGallery } from "@/components/entity-actualization-photo-gallery";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import { listActiveDealerPhotos } from "@/lib/client-base-actualization-photos";
import {
  canEditClientNextStep,
  CLIENT_NEXT_STEP_CHANGED_EVENT,
  clientNextStepActionLabel,
  getClientNextStepForDealer,
  loadClientNextStepsStorage,
} from "@/lib/client-next-step-data";
import { cn } from "@/lib/utils";
import {
  formatRussianPhoneInput,
  isValidRussianPhoneLoose,
  RU_PHONE_INVALID_MESSAGE,
  RU_PHONE_PLACEHOLDER,
} from "@/lib/phone-format";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-display-date";

const PASSPORT_KIND_LABELS: Record<string, string> = {
  ip: "ИП",
  ooo: "ООО",
  person: "Физлицо",
  network: "Сеть",
  other: "Другое",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  new: "Новый",
  active: "Активный",
  needs_review: "Требует проверки",
  inactive: "Неактивный",
  archived: "Архив",
};

const TIER_LABELS: Record<string, string> = {
  top150: "ТОП-150",
  top350: "ТОП-350",
  top500: "ТОП-500",
  other: "Прочие",
  none: "Без категории",
};

const CLEAN_CARD_SECTION_IDS = ["passport", "commercial", "responsibles", "logistics", "contacts", "legal", "photos", "tps", "next"] as const;

function cleanCardSectionsLsKey(dealerId: string): string {
  return `tandoor-dealer-clean-card-sections-v1-${dealerId}`;
}

function readCleanCardOpenSections(dealerId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cleanCardSectionsLsKey(dealerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const next = parsed.filter((x): x is string => typeof x === "string" && (CLEAN_CARD_SECTION_IDS as readonly string[]).includes(x));
    return next;
  } catch {
    return null;
  }
}

function writeCleanCardOpenSections(dealerId: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleanCardSectionsLsKey(dealerId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

type SectionStatusKind = "empty" | "partial" | "complete" | "attention";

function SectionStatusBadge(props: { status: SectionStatusKind }): ReactElement {
  const { status } = props;
  const map: Record<SectionStatusKind, { label: string; className: string }> = {
    empty: { label: "Не заполнено", className: "border-border/60 bg-muted/30 text-muted-foreground" },
    partial: { label: "Есть данные", className: "border-primary/30 bg-primary/10 text-foreground" },
    complete: { label: "Заполнено", className: "border-primary/40 bg-primary/15 text-foreground" },
    attention: { label: "Требует внимания", className: "border-border bg-muted text-foreground" },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={cn("h-[1.125rem] shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-normal leading-none", m.className)}>
      {m.label}
    </Badge>
  );
}

function AccordionSectionTrigger(props: { title: string; summary: string; status: SectionStatusKind }): ReactElement {
  const { title, summary, status } = props;
  return (
    <AccordionTrigger className="items-start gap-2 px-3.5 py-3.5 text-left hover:no-underline max-sm:px-3.5 max-sm:py-3.5 [&[data-state=open]]:bg-primary/5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-sm font-semibold leading-tight text-foreground">{title}</span>
          <SectionStatusBadge status={status} />
        </div>
        <p className="line-clamp-2 text-sm font-normal leading-snug text-muted-foreground">{summary}</p>
      </div>
    </AccordionTrigger>
  );
}

function str(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function mergedManualFields(manual: { fields: Record<string, unknown> } | undefined, ov: Record<string, unknown> | undefined): Record<string, unknown> {
  return { ...(manual?.fields ?? {}), ...(ov ?? {}) };
}

function HeroCell({ label, value, testId }: { label: string; value: string | undefined; testId?: string }): ReactElement {
  const v = value?.trim();
  const empty = !v || v === "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn("mt-0.5 text-[13px] leading-snug", empty ? "text-muted-foreground" : "font-medium text-foreground")}
        data-testid={testId}
      >
        {empty ? "Не указано" : v}
      </p>
    </div>
  );
}

export function DealerManualActualizationPage(props: { baseRow: DealerRow; profile: ReleaseDemoProfile }): ReactElement {
  const { baseRow, profile } = props;
  const actx = useClientBaseActualization();
  const { user } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const manual = actx.state.manuallyCreatedDealersById[baseRow.id];
  const ovFields = (actx.state.dealerOverridesById[baseRow.id]?.fields ?? {}) as Record<string, unknown>;
  const f = useMemo(() => mergedManualFields(manual, ovFields), [manual, ovFields]);

  const row = useMemo(() => mergeDealerRowWithActualization(baseRow, actx.state), [baseRow, actx.state]);

  const audit = actx.state.dealerActualizationAuditByDealerId[baseRow.id];
  const contacts = useMemo(() => listActiveActualizationContactsForDealer(actx.state, baseRow.id), [actx.state, baseRow.id]);
  const primary = useMemo(() => getPrimaryActualizationContact(actx.state, baseRow.id), [actx.state, baseRow.id]);

  const seedRef = useRef(false);
  useEffect(() => {
    if (!actx.enabled || seedRef.current) return;
    if (contacts.length > 0) return;
    if (!manual) return;
    const mf = manual.fields as Record<string, unknown>;
    const cn = str(mf.contactPerson);
    const ph = str(mf.phone);
    const em = str(mf.email);
    if (!cn && !ph && !em) return;
    seedRef.current = true;
    const iso = new Date().toISOString();
    const cid = newActualizationContactId(baseRow.id);
    void actx.persist((prev) => {
      const c: DealerActualizationContact = {
        id: cid,
        dealerId: baseRow.id,
        fullName: cn || "Контакт",
        role: "lpr",
        phone: ph ? formatRussianPhoneInput(ph) : "",
        email: em,
        messenger: "",
        comment: "",
        isPrimary: true,
        createdAt: iso,
        updatedAt: iso,
        updatedBy: profile.personaUserId,
        updatedByName: userLabelFromProfile(profile),
      };
      return mergeActualizationState(prev, {
        dealerActualizationContactsById: { ...prev.dealerActualizationContactsById, [cid]: c },
      });
    });
  }, [actx, baseRow.id, contacts.length, manual, profile]);

  const canEdit = canEditDealerDuringActualization(profile, row);
  const canArchive = canArchiveDealerDuringActualization(profile, row);
  const isDealerArchived = Boolean(actx.state.archivedDealersById[baseRow.id]);
  const canArchiveToWorkingList = canArchive && !isDealerArchived;

  const softArchive = useCallback(async () => {
    if (!canArchiveToWorkingList) return;
    setBusy(true);
    const r = await actx.persist((prev) =>
      mergeActualizationState(prev, {
        archivedDealersById: {
          ...prev.archivedDealersById,
          [baseRow.id]: {
            dealerId: baseRow.id,
            archivedAt: new Date().toISOString(),
            archivedBy: profile.personaUserId,
            archivedByName: userLabelFromProfile(profile),
            source: "manual_actualization",
          },
        },
      }),
    );
    setBusy(false);
    if (r.success) {
      toast({ title: "Клиент удалён из рабочей базы" });
      setDeleteOpen(false);
      setLocation("/dealer-base");
    } else {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    }
  }, [actx, baseRow.id, canArchiveToWorkingList, profile, setLocation]);

  const tps = useMemo(() => mergeTradePointsActiveForActualization(row, actx.state), [row, actx.state]);

  const { filledShowcase, needShowcase } = useMemo(() => {
    let filled = 0;
    let need = 0;
    for (const e of tps) {
      const sh = actx.state.tradePointShowcaseActualizationById[e.point.id];
      const s = computePortalSummary(sh);
      if (sh?.hasShowcase === false) continue;
      if (s.totalPortals != null && s.totalPortals > 0 && (s.tandoorTotal ?? 0) > 0) filled += 1;
      else if (s.needsPrimaryInstall) need += 1;
    }
    return { filledShowcase: filled, needShowcase: need };
  }, [tps, actx.state]);

  const passportKind = str(f.passportClientKind);
  const lifecycle = str(f.passportLifecycleStatus);
  const tier = str(f.passportCategoryTier);

  const [openSections, setOpenSections] = useState<string[]>([]);
  const [sectionsHydrated, setSectionsHydrated] = useState(false);
  const [nextStepTick, setNextStepTick] = useState(0);

  useEffect(() => {
    const saved = readCleanCardOpenSections(baseRow.id);
    setOpenSections(saved ?? []);
    setSectionsHydrated(true);
  }, [baseRow.id]);

  useEffect(() => {
    if (!sectionsHydrated) return;
    writeCleanCardOpenSections(baseRow.id, openSections);
  }, [baseRow.id, openSections, sectionsHydrated]);

  useEffect(() => {
    const fn = () => setNextStepTick((n) => n + 1);
    window.addEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
    return () => window.removeEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
  }, []);

  const activeLegals = useMemo(
    () => mergeLegalEntitiesForActualization(row, actx.state).filter((e) => e.status !== "archived"),
    [row, actx.state],
  );

  const nextStepRec = useMemo(
    () => getClientNextStepForDealer(baseRow.id, loadClientNextStepsStorage()),
    [baseRow.id, nextStepTick],
  );

  const sectionMeta = useMemo(() => {
    const dealerPhotosN = listActiveDealerPhotos(actx.state, baseRow.id).length;
    const passportSummaryParts: string[] = [];
    if (passportKind) passportSummaryParts.push(PASSPORT_KIND_LABELS[passportKind] ?? passportKind);
    if (lifecycle) passportSummaryParts.push(LIFECYCLE_LABELS[lifecycle] ?? lifecycle);
    passportSummaryParts.push(tier ? TIER_LABELS[tier] ?? tier : getClientCategoryLabel(row.clientCategory));
    const passportSummary = passportSummaryParts.filter(Boolean).join(" · ") || "Паспорт не заполнен";

    let passportStatus: SectionStatusKind = "empty";
    if (lifecycle === "needs_review") passportStatus = "attention";
    else if (passportKind && lifecycle && (tier || row.clientCategory !== "uncategorized")) passportStatus = "complete";
    else if (passportKind || str(f.inn) || lifecycle || tier) passportStatus = "partial";

    const commercialTri = [row.hasDoorWarehouse, row.hasHardwareWarehouse, row.isTandoorClubMember, row.hasSpecialTerms, row.isCashbackClient];
    let commercialSet = 0;
    for (const v of commercialTri) if (v !== null && v !== undefined) commercialSet += 1;
    let commercialStatus: SectionStatusKind =
      commercialSet === 0 ? "empty" : commercialSet === commercialTri.length ? "complete" : "partial";
    const commercialSummary =
      commercialSet === 0 ? "Коммерческие признаки не отмечены" : `Отмечено ${commercialSet} из ${commercialTri.length} блоков`;

    const hasMgr = Boolean(row.manager?.trim());
    const hasRm = Boolean(row.regionalManager?.trim());
    const hasRop = Boolean(row.ropName?.trim());
    const responsiblesStatus: SectionStatusKind =
      !hasMgr && !hasRm && !hasRop ? "empty" : hasMgr && hasRm ? "complete" : "partial";
    const responsiblesSummary = [hasMgr && `Менеджер: ${row.manager}`, hasRm && `РМ: ${row.regionalManager}`]
      .filter(Boolean)
      .join(" · ") || "Ответственные не указаны";

    const hasCity = Boolean(row.city?.trim());
    const hasAddr = Boolean(row.releaseAddress?.trim());
    const shipmentDaysText = logisticsShipmentDaysTextFromManualFields(f);
    const hasLog = hasCity || hasAddr || Boolean(shipmentDaysText) || Boolean(str(f.routeLabel));
    const logisticsStatus: SectionStatusKind = !hasLog ? "empty" : hasCity && hasAddr ? "complete" : "partial";
    const logisticsSummary =
      [row.city?.trim() || undefined, shipmentDaysText || undefined].filter(Boolean).join(" · ") || "Адрес и логистика не заполнены";

    const contactsStatus: SectionStatusKind =
      contacts.length === 0 ? "empty" : primary && (primary.phone?.trim() || primary.email?.trim()) ? "complete" : "partial";
    const contactsSummary =
      contacts.length === 0 ? "Контакты не добавлены" : `${contacts.length} контакт(ов) · основной: ${primary?.fullName?.trim() || "Не указано"}`;

    const legalStatus: SectionStatusKind = activeLegals.length === 0 ? "empty" : "partial";
    const legalSummary = activeLegals.length === 0 ? "Юрлица не добавлены" : `Активных юрлиц: ${activeLegals.length}`;

    const photosStatus: SectionStatusKind = dealerPhotosN === 0 ? "empty" : "partial";
    const photosSummary = dealerPhotosN === 0 ? "Фото не добавлены" : `${dealerPhotosN} фото в галерее`;

    let tradePointsStatus: SectionStatusKind = "empty";
    if (tps.length === 0) tradePointsStatus = "empty";
    else if (needShowcase > 0) tradePointsStatus = "attention";
    else if (tps.length > 0 && filledShowcase === tps.length && tps.length > 0) tradePointsStatus = "complete";
    else tradePointsStatus = "partial";
    const tradePointsSummary =
      tps.length === 0
        ? "Торговые точки не добавлены"
        : `Точек: ${tps.length} · витрина ок: ${filledShowcase}${needShowcase > 0 ? ` · нужна витрина: ${needShowcase}` : ""}`;

    let nextStatus: SectionStatusKind = nextStepRec ? "partial" : "empty";
    if (nextStepRec?.contactDate?.trim()) nextStatus = "complete";
    const nextSummary = nextStepRec
      ? `${clientNextStepActionLabel(nextStepRec.actionType)}${
          nextStepRec.contactDate?.trim() ? ` · ${formatDisplayDate(nextStepRec.contactDate)}` : ""
        }`
      : "Следующий шаг не зафиксирован";

    return {
      passport: { summary: passportSummary, status: passportStatus },
      commercial: { summary: commercialSummary, status: commercialStatus },
      responsibles: { summary: responsiblesSummary, status: responsiblesStatus },
      logistics: { summary: logisticsSummary, status: logisticsStatus },
      contacts: { summary: contactsSummary, status: contactsStatus },
      legal: { summary: legalSummary, status: legalStatus },
      photos: { summary: photosSummary, status: photosStatus },
      tps: { summary: tradePointsSummary, status: tradePointsStatus },
      next: { summary: nextSummary, status: nextStatus },
    };
  }, [
    activeLegals,
    actx.state,
    baseRow.id,
    contacts,
    filledShowcase,
    f,
    lifecycle,
    needShowcase,
    nextStepRec,
    passportKind,
    primary,
    row,
    tier,
    tps.length,
  ]);

  const allSectionsExpanded =
    CLEAN_CARD_SECTION_IDS.length > 0 && CLEAN_CARD_SECTION_IDS.every((id) => openSections.includes(id));

  const toggleExpandAll = useCallback(() => {
    setOpenSections(allSectionsExpanded ? [] : [...CLEAN_CARD_SECTION_IDS]);
  }, [allSectionsExpanded]);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden bg-muted/15 pb-8 pt-1 sm:pb-10" data-testid="page-dealer-manual-actualization">
      <div className="mx-auto w-full max-w-5xl space-y-3 px-3 sm:space-y-4 sm:px-4 lg:px-6">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost" size="sm" className="h-8 w-fit justify-start gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Link href="/dealer-base">
              <span aria-hidden>←</span> Назад к клиентской базе
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            {canEdit ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 min-w-[7.5rem] bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-[#86B832]"
                data-testid="button-dealer-edit"
                onClick={() => setEditOpen(true)}
              >
                Редактировать
              </Button>
            ) : null}
            {canArchiveToWorkingList ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid={`button-dealer-delete-${baseRow.id}`}
                onClick={() => setDeleteOpen(true)}
              >
                Удалить клиента
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

        <section className="overflow-hidden rounded-xl border border-border border-l-[3px] border-l-primary bg-card shadow-sm">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-stretch sm:gap-4 sm:px-5 sm:py-4">
            <div data-testid="dealer-manual-hero-visual" className="w-full shrink-0 sm:max-w-[15rem]">
              <ShowcaseCoverPhotoSlot kind="dealer" dealer={row} profile={profile} size="hero" rounded="lg" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">{row.name}</h1>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Код</span>
                  <span
                    className="font-mono text-sm font-semibold tabular-nums text-primary"
                    data-testid="text-dealer-internal-code"
                  >
                    {row.releaseCode?.trim() ? row.releaseCode : "Не указано"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 border-t border-border/40 pt-3 sm:grid-cols-2">
                <HeroCell label="Код в 1С" value={row.external1cCode} testId="text-dealer-external-1c-code" />
                <HeroCell label="Основной контакт" value={primary?.fullName} testId="text-dealer-primary-contact" />
                <HeroCell label="Телефон" value={primary?.phone} testId="text-dealer-primary-phone" />
                <HeroCell label="Email" value={primary?.email} testId="text-dealer-primary-email" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Разделы анкеты</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            data-testid="button-dealer-sections-expand-all"
            onClick={toggleExpandAll}
          >
            {allSectionsExpanded ? "Свернуть всё" : "Развернуть всё"}
          </Button>
        </div>

        <Accordion type="multiple" className="space-y-1.5" value={openSections} onValueChange={setOpenSections}>
          <AccordionItem
            value="passport"
            data-testid="section-dealer-passport"
            className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
          >
            <AccordionSectionTrigger title="Паспорт клиента" summary={sectionMeta.passport.summary} status={sectionMeta.passport.status} />
            <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1.5 text-sm sm:px-3.5">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field label="Код клиента" value={row.releaseCode ?? "—"} />
              <Field label="Название" value={row.name} />
              <Field label="Тип клиента" value={passportKind ? (PASSPORT_KIND_LABELS[passportKind] ?? passportKind) : "—"} />
              <Field label="ИНН" value={row.actualizationInn?.trim() || str(f.inn) || "—"} />
              <Field label="Статус" value={lifecycle ? (LIFECYCLE_LABELS[lifecycle] ?? lifecycle) : row.status} />
              <Field label="Категория" value={tier ? (TIER_LABELS[tier] ?? tier) : getClientCategoryLabel(row.clientCategory)} />
              <Field label="Общий комментарий" value={row.comment?.trim() || str(f.comment) || "—"} emphasis className="sm:col-span-2" />
            </div>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" className="mt-2 h-8 px-3 text-xs font-medium" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="commercial"
          data-testid="section-dealer-commercial-characteristics"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger
            title="Коммерческие характеристики"
            summary={sectionMeta.commercial.summary}
            status={sectionMeta.commercial.status}
          />
          <AccordionContent className="border-t border-border/35 space-y-1.5 px-3 pb-2.5 pt-1.5 text-sm sm:px-3.5">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field label="Склад двери" value={commercialTriLabelRu(row.hasDoorWarehouse)} />
              <Field label="Комментарий (склад двери)" value={row.doorWarehouseComment?.trim() || "—"} emphasis className="sm:col-span-2" />
              <Field label="Склад фурнитуры" value={commercialTriLabelRu(row.hasHardwareWarehouse)} />
              <Field label="Комментарий (склад фурнитуры)" value={row.hardwareWarehouseComment?.trim() || "—"} emphasis className="sm:col-span-2" />
              <Field label="Tandoor Club" value={commercialTriLabelRu(row.isTandoorClubMember)} />
              <Field label="Комментарий (Tandoor Club)" value={row.tandoorClubComment?.trim() || "—"} emphasis className="sm:col-span-2" />
              <Field label="Спец. условия" value={commercialTriLabelRu(row.hasSpecialTerms)} />
              <Field label="Комментарий (спец. условия)" value={row.specialTermsComment?.trim() || "—"} emphasis className="sm:col-span-2" />
              <Field label="КЭШБЭК клиент" value={commercialTriLabelRu(row.isCashbackClient)} />
              <Field label="Комментарий (КЭШБЭК)" value={row.cashbackComment?.trim() || "—"} emphasis className="sm:col-span-2" />
              <Field label="Код клиента в 1С" value={row.external1cCode?.trim() || "—"} emphasis className="sm:col-span-2" />
            </div>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" className="mt-2 h-8 px-3 text-xs font-medium" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="responsibles"
          data-testid="section-dealer-responsibles"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Ответственные" summary={sectionMeta.responsibles.summary} status={sectionMeta.responsibles.status} />
          <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1.5 text-sm sm:px-3.5">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field label="Менеджер" value={row.manager || "—"} />
            <Field label="Региональный менеджер" value={row.regionalManager?.trim() || "—"} />
            <Field label="РОП" value={row.ropName?.trim() || "—"} />
            <Field label="Территория / зона" value={str(f.territoryZone) || "—"} />
            <Field label="Кто актуализировал" value={audit?.lastUpdatedByName ?? manual?.createdByName ?? "—"} />
            <Field
              label="Дата последней актуализации"
              value={
                audit?.lastUpdatedAt
                  ? formatDisplayDateTime(audit.lastUpdatedAt)
                  : manual?.createdAt
                    ? formatDisplayDateTime(manual.createdAt)
                    : ""
              }
            />
            </div>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" className="mt-2 h-8 px-3 text-xs font-medium" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="logistics"
          data-testid="section-dealer-logistics"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Адрес и логистика" summary={sectionMeta.logistics.summary} status={sectionMeta.logistics.status} />
          <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1.5 text-sm sm:px-3.5">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <Field label="Город" value={row.city || "—"} />
            <Field label="Адрес" value={row.releaseAddress?.trim() || "—"} emphasis className="sm:col-span-2" />
            <Field label="Дни отгрузки" value={logisticsShipmentDaysTextFromManualFields(f) || "—"} />
            <Field label="Маршрут / направление" value={str(f.routeLabel) || "—"} />
            <Field label="Порядок выгрузки" value={row.distribution > 0 ? String(row.distribution) : "—"} />
            <Field label="Комментарий по логистике" value={str(f.logisticsComment) || "—"} emphasis className="sm:col-span-2" />
            </div>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" className="mt-2 h-8 px-3 text-xs font-medium" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="contacts"
          data-testid="section-dealer-contacts"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Контакты клиента" summary={sectionMeta.contacts.summary} status={sectionMeta.contacts.status} />
          <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1.5 sm:px-3.5">
            <DealerContactsActualizationBlock dealerId={baseRow.id} profile={profile} canEdit={canEdit} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="legal" className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm">
          <AccordionSectionTrigger title="Юридические лица" summary={sectionMeta.legal.summary} status={sectionMeta.legal.status} />
          <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1 text-sm sm:px-3.5">
            <DealerLegalEntitiesSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user ? displayUserName(user) : userLabelFromProfile(profile)}
              embedInAccordion
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="photos"
          data-testid="section-dealer-photos"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Фото клиента" summary={sectionMeta.photos.summary} status={sectionMeta.photos.status} />
          <AccordionContent className="border-t border-border/35 px-3 pb-2.5 pt-1.5 sm:px-3.5">
            <EntityActualizationPhotoGallery
              entityType="dealer"
              entityId={baseRow.id}
              entityName={baseRow.name}
              entitySeed={baseRow.id || baseRow.actualizationInn || undefined}
              canEdit={canEdit}
              profile={profile}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="tps"
          data-testid="section-dealer-trade-points"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Торговые точки" summary={sectionMeta.tps.summary} status={sectionMeta.tps.status} />
          <AccordionContent className="border-t border-border/35 space-y-2 px-3 pb-2.5 pt-1.5 text-sm sm:px-3.5">
            <p className="text-muted-foreground">
              Всего точек: <span className="font-semibold text-foreground">{tps.length}</span>
              {" · "}
              С заполненной витриной: <span className="font-semibold text-foreground">{filledShowcase}</span>
              {" · "}
              Требуют заполнения витрины: <span className="font-semibold text-foreground">{needShowcase}</span>
            </p>
            {tps.length === 0 ? <p className="text-muted-foreground">Торговые точки не добавлены</p> : null}
            <DealerTradePointsSection row={row} profile={profile} sectionDomId="dealer-section-points" />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="next"
          data-testid="section-dealer-next-step"
          className="overflow-hidden rounded-lg border border-border/50 bg-card !border-b-0 shadow-sm"
        >
          <AccordionSectionTrigger title="Следующий шаг и задачи" summary={sectionMeta.next.summary} status={sectionMeta.next.status} />
          <AccordionContent className="border-t border-border/35 space-y-3 px-3 pb-2.5 pt-1.5 sm:px-3.5">
            <DealerClientNextStepSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user ? displayUserName(user) : userLabelFromProfile(profile)}
              onSaved={() => void actx.refresh()}
              allowManualActualizationCard
            />
            <div data-testid="section-dealer-bitrix-tasks">
              <Bitrix24TasksPanel
                scope="dealer"
                dealerId={row.id}
                dealerName={row.name}
                canCreate={canEditClientNextStep(profile, row)}
                actorUserId={user?.id ?? profile.personaUserId}
                actorLabel={user ? displayUserName(user) : userLabelFromProfile(profile)}
                compact
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        </Accordion>
      </div>

      <DealerActualizationEditDialog open={editOpen} onOpenChange={setEditOpen} baseRow={baseRow} profile={profile} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-testid="dialog-dealer-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>Клиент будет скрыт из рабочей клиентской базы и не будет отображаться в списке по умолчанию.</p>
              <p>Данные не удаляются физически: анкета актуализации, контакты и торговые точки остаются в сохранённом состоянии.</p>
              <p>Восстановить клиента можно кнопкой «Восстановить клиента» на карточке, через режим «Показать архив» в клиентской базе или по прямой ссылке.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" data-testid="button-dealer-delete-cancel" disabled={busy} onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" data-testid="button-dealer-delete-confirm" disabled={busy} onClick={() => void softArchive()}>
              {busy ? "Сохранение…" : "Удалить клиента"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  emphasis,
  className,
  testId,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
  testId?: string;
}): ReactElement {
  const trimmed = value.trim();
  const missing = !trimmed || trimmed === "—";
  const display = missing ? "Не указано" : value;
  return (
    <div className={cn("min-w-0", emphasis && "rounded-md border border-border/40 bg-muted/10 px-2.5 py-2", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn("mt-0.5 text-[13px] leading-snug", missing ? "text-muted-foreground" : "text-foreground")}
        data-testid={testId}
      >
        {display}
      </p>
    </div>
  );
}

function DealerContactsActualizationBlock(props: {
  dealerId: string;
  profile: ReleaseDemoProfile;
  canEdit: boolean;
}): ReactElement {
  const { dealerId, profile, canEdit } = props;
  const actx = useClientBaseActualization();
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealerActualizationContact | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("lpr");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [messenger, setMessenger] = useState("");
  const [comment, setComment] = useState("");
  const contactDialogSave = useSectionSaveFeedback();

  const contacts = useMemo(() => {
    void tick;
    return listActiveActualizationContactsForDealer(actx.state, dealerId);
  }, [actx.state, dealerId, tick]);

  const openCreate = () => {
    setEditing(null);
    setFullName("");
    setRole("lpr");
    setPhone("");
    setEmail("");
    setMessenger("");
    setComment("");
    contactDialogSave.markDirty();
    setDialogOpen(true);
  };

  const openEdit = (c: DealerActualizationContact) => {
    setEditing(c);
    setFullName(c.fullName);
    setRole(c.role || "lpr");
    setPhone(formatRussianPhoneInput(c.phone ?? ""));
    setEmail(c.email);
    setMessenger(c.messenger);
    setComment(c.comment);
    contactDialogSave.markDirty();
    setDialogOpen(true);
  };

  const persistContacts = async (updater: (prev: ActualizationState) => ActualizationState): Promise<boolean> => {
    const r = await actx.persist(updater);
    if (r.success) {
      setTick((n) => n + 1);
      return true;
    }
    toast({ title: "Не удалось сохранить", variant: "destructive" });
    return false;
  };

  const onSave = async () => {
    if (!fullName.trim()) {
      toast({ title: "Укажите ФИО контакта", variant: "destructive" });
      return false;
    }
    if (phone.trim() && !isValidRussianPhoneLoose(phone)) {
      toast({ title: RU_PHONE_INVALID_MESSAGE, variant: "destructive" });
      return false;
    }
    const phoneFormatted = phone.trim() ? formatRussianPhoneInput(phone) : "";
    const iso = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const id = editing?.id ?? newActualizationContactId(dealerId);
    const wasPrimary = editing?.isPrimary ?? false;
    const makePrimary = !editing || contacts.length === 0 ? true : wasPrimary;

    return persistContacts((prev) => {
      let nextContacts = { ...prev.dealerActualizationContactsById };
      const list = listActiveActualizationContactsForDealer(prev, dealerId);
      const nextRec: DealerActualizationContact = {
        id,
        dealerId,
        fullName: fullName.trim(),
        role,
        phone: phoneFormatted,
        email: email.trim(),
        messenger: messenger.trim(),
        comment: comment.trim(),
        isPrimary: makePrimary,
        createdAt: editing?.createdAt ?? iso,
        updatedAt: iso,
        updatedBy: uid,
        updatedByName: uname,
      };
      if (makePrimary) {
        for (const c of list) {
          if (c.id === id) continue;
          const cur = nextContacts[c.id];
          if (cur) nextContacts[c.id] = { ...cur, isPrimary: false, updatedAt: iso, updatedBy: uid, updatedByName: uname };
        }
      }
      nextContacts = { ...nextContacts, [id]: nextRec };
      return mergeActualizationState(prev, { dealerActualizationContactsById: nextContacts });
    });
  };

  const onSetPrimary = async (c: DealerActualizationContact) => {
    const ok = await persistContacts((prev) => {
      let next = { ...prev.dealerActualizationContactsById };
      const list = listActiveActualizationContactsForDealer(prev, dealerId);
      const iso = new Date().toISOString();
      for (const x of list) {
        const cur = next[x.id];
        if (!cur) continue;
        next[x.id] = { ...cur, isPrimary: x.id === c.id, updatedAt: iso, updatedBy: profile.personaUserId, updatedByName: userLabelFromProfile(profile) };
      }
      return mergeActualizationState(prev, { dealerActualizationContactsById: next });
    });
    if (ok) toast({ title: "Сохранено" });
  };

  const onArchive = async (c: DealerActualizationContact) => {
    const ok = await persistContacts((prev) => {
      const info = {
        contactId: c.id,
        dealerId,
        archivedAt: new Date().toISOString(),
        archivedBy: profile.personaUserId,
        archivedByName: userLabelFromProfile(profile),
      };
      const nextContacts = { ...prev.dealerActualizationContactsById };
      delete nextContacts[c.id];
      const iso = new Date().toISOString();
      const listAfter = listActiveActualizationContactsForDealer({ ...prev, dealerActualizationContactsById: nextContacts }, dealerId);
      if (c.isPrimary && listAfter[0]) {
        const p0 = nextContacts[listAfter[0].id];
        if (p0) nextContacts[listAfter[0].id] = { ...p0, isPrimary: true, updatedAt: iso, updatedBy: profile.personaUserId, updatedByName: userLabelFromProfile(profile) };
      }
      return mergeActualizationState(prev, {
        dealerActualizationContactsById: nextContacts,
        archivedDealerContactsById: { ...prev.archivedDealerContactsById, [c.id]: info },
      });
    });
    if (ok) toast({ title: "Сохранено" });
  };

  return (
    <div className="space-y-2.5">
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Контакты не указаны</p>
      ) : (
        <ul className="space-y-1.5">
          {contacts.map((c) => {
            const phoneDisp = c.phone?.trim() ? c.phone.trim() : "Не указано";
            const emailDisp = c.email?.trim() ? c.email.trim() : "Не указано";
            return (
              <li
                key={c.id}
                className="rounded-lg border border-border/50 bg-card/40 p-2.5 sm:p-3"
                data-testid={`card-dealer-contact-${c.id}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {c.fullName}
                      {c.isPrimary ? (
                        <Badge
                          variant="outline"
                          className="ml-2 h-[1.125rem] border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-normal leading-none text-foreground"
                        >
                          Основной
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Роль: {c.role}</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      <span className="text-muted-foreground/80">Тел.:</span> {phoneDisp}{" "}
                      <span className="text-muted-foreground/60">·</span>{" "}
                      <span className="text-muted-foreground/80">Email:</span> {emailDisp}
                    </p>
                    {c.messenger?.trim() ? (
                      <p className="text-xs text-muted-foreground">Мессенджер: {c.messenger.trim()}</p>
                    ) : null}
                    {c.comment?.trim() ? (
                      <p className="text-xs leading-snug text-muted-foreground/90">{c.comment.trim()}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs font-medium"
                        data-testid={`button-dealer-contact-edit-${c.id}`}
                        onClick={() => openEdit(c)}
                      >
                        Изменить
                      </Button>
                      {!c.isPrimary ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs font-medium"
                          data-testid={`button-dealer-contact-set-primary-${c.id}`}
                          onClick={() => void onSetPrimary(c)}
                        >
                          Сделать основным
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        data-testid={`button-dealer-contact-delete-${c.id}`}
                        onClick={() => void onArchive(c)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-primary/10"
          data-testid="button-dealer-contact-create"
          onClick={openCreate}
        >
          Добавить контакт
        </Button>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Контакт" : "Новый контакт"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">ФИО</Label>
              <Input
                className="min-h-10"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Роль</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v);
                  contactDialogSave.markDirty();
                }}
              >
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Собственник</SelectItem>
                  <SelectItem value="lpr">ЛПР</SelectItem>
                  <SelectItem value="buyer">Закупщик</SelectItem>
                  <SelectItem value="accountant">Бухгалтер</SelectItem>
                  <SelectItem value="logistics">Логист</SelectItem>
                  <SelectItem value="seller">Продавец</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Телефон</Label>
              <Input
                className="min-h-10"
                value={phone}
                inputMode="tel"
                placeholder={RU_PHONE_PLACEHOLDER}
                onChange={(e) => {
                  setPhone(formatRussianPhoneInput(e.target.value));
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                className="min-h-10"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Мессенджер</Label>
              <Input
                className="min-h-10"
                value={messenger}
                onChange={(e) => {
                  setMessenger(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <SectionSaveButton
              testId="button-dealer-section-save-contacts"
              statusTestId="text-save-status-contacts-dialog"
              phase={contactDialogSave.phase}
              disabled={contactDialogSave.phase === "saving"}
              onSave={() =>
                void contactDialogSave.runSave(async () => {
                  const ok = await onSave();
                  if (ok) setDialogOpen(false);
                  return ok;
                })
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
