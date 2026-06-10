import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  addDealerLegalEntity,
  allocateNextLegalEntityCodeLocal,
  archiveDealerLegalEntityAsync,
  buildLegalEntityPaymentUpsert,
  canEditDealerLegalEntities,
  DEALER_LEGAL_ENTITIES_EVENT,
  ensureServerLegalEntityId,
  getMergedDealerLegalEntities,
  paymentFieldsToFullApiBody,
  unarchiveDealerLegalEntityAsync,
  type DealerLegalEntityStatus,
  type MergedDealerLegalEntity,
  updateDealerLegalEntity,
} from "@/lib/dealer-legal-entities";
import { apiPatchFull } from "@/lib/dealer-legal-entities-api";
import { refreshDbLegalEntitiesForDealer } from "@/lib/dealer-legal-entities-db-cache";
import {
  EDO_OPERATOR_SUGGESTIONS,
  fetchLegalEntitiesForClient,
  PAYMENT_FORM_OPTIONS,
  type LegalEntityDto,
  type LegalEntityPaymentForm,
  type LegalEntityUpsertFields,
} from "@/lib/legal-entities-payment-api";
import { formatMoney } from "@/lib/sales-manager-kpi-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { LegalEntityContactsSubsection } from "@/components/legal-entity-contacts-subsection";
import { buildLegalEntityNameSuggestions, lookupLegalEntityByInn, type LegalEntityInnLookupResult } from "@/lib/legal-entity-directory";
import { fetchDadataPartiesByInn } from "@/lib/dadata-party-lookup-api";
import { AddressSuggestInput } from "@/components/address-suggest-input";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { mergeLegalEntitiesForActualization } from "@/lib/client-base-actualization-data-merge";
import { mergeActualizationState } from "@/lib/client-base-actualization-state";
import {
  canActualizeClientBase,
  canEditDealerDuringActualization,
  canManageLegalEntitiesDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import {
  allocateNextLegalEntityDisplayCode,
  buildArchivedLegalEntityInfo,
  generateManualLegalEntityStableId,
  restoreLegalEntityFromArchive,
} from "@/lib/client-base-actualization-legal-entities";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/format-display-date";

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
  /** Родитель (Accordion) уже показывает заголовок «Юридические лица» — скрыть дублирующий h3. */
  embedInAccordion?: boolean;
  readOnly?: boolean;
};

const STATUS_LABELS: Record<DealerLegalEntityStatus, string> = {
  main: "Основное",
  additional: "Дополнительное",
  archived: "Архив",
};

const ENTITY_TYPE_VALUES = ["ooo", "ip", "self_employed", "other"] as const;
type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];

const ENTITY_TYPE_LABELS: Record<EntityTypeValue, string> = {
  ooo: "ООО",
  ip: "ИП",
  self_employed: "Самозанятый",
  other: "Другое",
};

type DraftSnapshot = {
  name: string;
  inn: string;
  entityType: EntityTypeValue;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  actualAddress: string;
  comment: string;
  paymentForm: LegalEntityPaymentForm | "";
  paymentDelayDays: string;
  creditLimitRub: string;
  edoEnabled: boolean;
  edoOperator: string;
};

const EMPTY_SNAPSHOT: DraftSnapshot = {
  name: "",
  inn: "",
  entityType: "ooo",
  kpp: "",
  ogrn: "",
  legalAddress: "",
  actualAddress: "",
  comment: "",
  paymentForm: "",
  paymentDelayDays: "",
  creditLimitRub: "",
  edoEnabled: false,
  edoOperator: "",
};

function mergeEntityPaymentFields(
  primary: MergedDealerLegalEntity | LegalEntityDto,
  secondary?: MergedDealerLegalEntity | LegalEntityDto,
): MergedDealerLegalEntity | LegalEntityDto {
  return {
    ...primary,
    paymentForm: primary.paymentForm ?? secondary?.paymentForm ?? null,
    paymentDelayDays: primary.paymentDelayDays ?? secondary?.paymentDelayDays ?? null,
    creditLimitRub: primary.creditLimitRub ?? secondary?.creditLimitRub ?? null,
    edoEnabled: primary.edoEnabled ?? secondary?.edoEnabled ?? null,
    edoOperator: primary.edoOperator ?? secondary?.edoOperator ?? null,
  };
}

function paymentFieldsFromEntity(
  e: MergedDealerLegalEntity | LegalEntityDto | undefined,
  fallback?: MergedDealerLegalEntity | LegalEntityDto | undefined,
): Pick<DraftSnapshot, "paymentForm" | "paymentDelayDays" | "creditLimitRub" | "edoEnabled" | "edoOperator"> {
  const source = e ? mergeEntityPaymentFields(e, fallback) : fallback;
  return {
    paymentForm: source?.paymentForm ?? "",
    paymentDelayDays: source?.paymentDelayDays != null ? String(source.paymentDelayDays) : "",
    creditLimitRub:
      source?.creditLimitRub != null && String(source.creditLimitRub).trim() !== ""
        ? String(source.creditLimitRub)
        : "",
    edoEnabled: source?.edoEnabled === true,
    edoOperator: source?.edoOperator ?? "",
  };
}

function paymentFormLabel(form: LegalEntityPaymentForm | "" | null | undefined): string {
  if (!form) return "Не указано";
  return PAYMENT_FORM_OPTIONS.find((o) => o.value === form)?.label ?? form;
}

function formatEntityPaymentSummary(e: MergedDealerLegalEntity | LegalEntityDto): string | null {
  const parts: string[] = [];
  if (e.paymentForm) parts.push(paymentFormLabel(e.paymentForm));
  if (e.paymentDelayDays != null) parts.push(`отсрочка ${e.paymentDelayDays} дн.`);
  if (e.creditLimitRub != null && String(e.creditLimitRub).trim() !== "") {
    const n = Number(String(e.creditLimitRub).replace(/\s/g, "").replace(",", "."));
    parts.push(Number.isFinite(n) ? `лимит ${formatMoney(n)}` : `лимит ${e.creditLimitRub}`);
  }
  if (e.edoEnabled) parts.push(e.edoOperator?.trim() ? `ЭДО: ${e.edoOperator.trim()}` : "ЭДО");
  return parts.length > 0 ? parts.join(" · ") : null;
}

function normalizeInn(v: string): string {
  return v.replace(/\s+/g, "").trim();
}

function snapshotFromDrafts(params: {
  name: string;
  inn: string;
  entityType: EntityTypeValue;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  actualAddress: string;
  comment: string;
  paymentForm: LegalEntityPaymentForm | "";
  paymentDelayDays: string;
  creditLimitRub: string;
  edoEnabled: boolean;
  edoOperator: string;
}): DraftSnapshot {
  return {
    name: params.name.trim(),
    inn: normalizeInn(params.inn),
    entityType: params.entityType,
    kpp: params.kpp.trim(),
    ogrn: params.ogrn.trim(),
    legalAddress: params.legalAddress.trim(),
    actualAddress: params.actualAddress.trim(),
    comment: params.comment.trim(),
    paymentForm: params.paymentForm,
    paymentDelayDays: params.paymentDelayDays.trim(),
    creditLimitRub: params.creditLimitRub.trim(),
    edoEnabled: params.edoEnabled,
    edoOperator: params.edoOperator.trim(),
  };
}

function snapshotsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
  return (
    a.name === b.name &&
    a.inn === b.inn &&
    a.entityType === b.entityType &&
    a.kpp === b.kpp &&
    a.ogrn === b.ogrn &&
    a.legalAddress === b.legalAddress &&
    a.actualAddress === b.actualAddress &&
    a.comment === b.comment &&
    a.paymentForm === b.paymentForm &&
    a.paymentDelayDays === b.paymentDelayDays &&
    a.creditLimitRub === b.creditLimitRub &&
    a.edoEnabled === b.edoEnabled &&
    a.edoOperator === b.edoOperator
  );
}

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function entityTypeLabel(v: string | undefined): string {
  const t = (v ?? "").trim() as EntityTypeValue;
  return ENTITY_TYPE_LABELS[t] ?? (t ? t : "Не указано");
}

type FieldDirtyKey =
  | "name"
  | "inn"
  | "entityType"
  | "kpp"
  | "ogrn"
  | "legalAddress"
  | "actualAddress"
  | "comment"
  | "paymentForm"
  | "paymentDelayDays"
  | "creditLimitRub"
  | "edoEnabled"
  | "edoOperator";

function DirtyFieldWrap({
  dirty,
  fieldKey,
  label,
  htmlFor,
  required,
  children,
}: {
  dirty: boolean;
  fieldKey: FieldDirtyKey;
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-md transition-colors",
        dirty && "border border-amber-300/60 bg-amber-50/50 p-2 dark:border-amber-800/50 dark:bg-amber-950/25",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor={htmlFor}
          className={cn("text-xs", dirty && "font-medium text-amber-900 dark:text-amber-100")}
        >
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        {dirty ? (
          <Badge
            variant="outline"
            className="h-5 border-amber-400/70 px-1.5 text-[10px] font-normal text-amber-900 dark:text-amber-100"
            data-testid={`badge-legal-entity-field-dirty-${fieldKey}`}
          >
            Изменено
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function DealerLegalEntitiesSection({
  row,
  profile,
  actorUserId,
  actorLabel,
  embedInAccordion = false,
  readOnly = false,
}: Props) {
  const actx = useClientBaseActualization();
  const useAct = actx.enabled && canManageLegalEntitiesDuringActualization(profile, row);
  /** В актуализации — зона как у карточки; без актуализации — прежний LS-режим. */
  const canMutate = useMemo(() => {
    if (readOnly) return false;
    if (actx.enabled) {
      return canActualizeClientBase(profile) && canEditDealerDuringActualization(profile, row);
    }
    return canEditDealerLegalEntities(profile, row);
  }, [actx.enabled, profile, row, readOnly]);

  const [tick, setTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const newEntityIdRef = useRef<string | null>(null);
  const skipInnDupOnceRef = useRef(false);

  const [draftName, setDraftName] = useState("");
  const [draftInn, setDraftInn] = useState("");
  const [draftEntityType, setDraftEntityType] = useState<EntityTypeValue>("ooo");
  const [draftKpp, setDraftKpp] = useState("");
  const [draftOgrn, setDraftOgrn] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftActualAddress, setDraftActualAddress] = useState("");
  const [sameAsLegal, setSameAsLegal] = useState(true);
  const [draftComment, setDraftComment] = useState("");
  const [draftPaymentForm, setDraftPaymentForm] = useState<LegalEntityPaymentForm | "">("");
  const [draftPaymentDelayDays, setDraftPaymentDelayDays] = useState("");
  const [draftCreditLimitRub, setDraftCreditLimitRub] = useState("");
  const [draftEdoEnabled, setDraftEdoEnabled] = useState(false);
  const [draftEdoOperator, setDraftEdoOperator] = useState("");
  const [paymentByEntityId, setPaymentByEntityId] = useState<Record<string, LegalEntityDto>>({});
  const paymentByEntityIdRef = useRef(paymentByEntityId);
  paymentByEntityIdRef.current = paymentByEntityId;
  const [innLookupResults, setInnLookupResults] = useState<LegalEntityInnLookupResult[]>([]);
  const [innLookupNote, setInnLookupNote] = useState("");

  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [innDupInline, setInnDupInline] = useState<{ existingId: string; existingName: string } | null>(null);
  const [unsavedConfirmOpen, setUnsavedConfirmOpen] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<DraftSnapshot | null>(null);
  const [lastSavedInternalCode, setLastSavedInternalCode] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const legalFormSave = useSectionSaveFeedback();

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
    return () => window.removeEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
  }, []);

  useEffect(() => {
    if (useAct) setTick((n) => n + 1);
  }, [useAct, actx.state]);

  useEffect(() => {
    let cancelled = false;
    void fetchLegalEntitiesForClient(row.id)
      .then((items) => {
        if (cancelled) return;
        const map: Record<string, LegalEntityDto> = {};
        for (const it of items) map[it.id] = it;
        setPaymentByEntityId(map);
      })
      .catch(() => {
        if (!cancelled) setPaymentByEntityId({});
      });
    return () => {
      cancelled = true;
    };
  }, [row.id, tick]);

  const merged = useMemo(() => {
    if (useAct) return mergeLegalEntitiesForActualization(row, actx.state);
    return getMergedDealerLegalEntities(row);
  }, [row, tick, useAct, actx.state]);

  const nameSuggestions = useMemo(() => buildLegalEntityNameSuggestions(draftName, row.id), [draftName, row.id, tick]);

  const visible = useMemo(() => {
    const active = merged.filter((e) => e.status !== "archived");
    const arch = merged
      .filter((e) => e.status === "archived")
      .sort((a, b) => {
        const ta = a.updatedAt || a.createdAt || "";
        const tb = b.updatedAt || b.createdAt || "";
        if (ta !== tb) return tb.localeCompare(ta);
        return a.name.localeCompare(b.name, "ru");
      });
    return { active, arch };
  }, [merged]);

  const legalEntityHasOverrides = useCallback(
    (entityId: string) => {
      if (!useAct) return false;
      const raw = actx.state.legalEntityOverridesByDealerId[row.id]?.overridesById?.[entityId];
      return raw != null && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length > 0;
    },
    [useAct, actx.state, row.id],
  );

  const resolveLegalEntityServerId = useCallback(
    (entity: MergedDealerLegalEntity) => ensureServerLegalEntityId(row.id, entity, actorUserId, actorLabel),
    [row.id, actorUserId, actorLabel],
  );

  const findInnDuplicate = useCallback(
    (innRaw: string, excludeId: string | null) => {
      const inn = normalizeInn(innRaw);
      if (!inn) return null as { id: string; name: string } | null;
      for (const e of visible.active) {
        if (excludeId && e.id === excludeId) continue;
        if (normalizeInn(e.inn ?? "") === inn) return { id: e.id, name: e.name };
      }
      return null;
    },
    [visible.active],
  );

  const currentSnapshot = useMemo(
    () =>
      snapshotFromDrafts({
        name: draftName,
        inn: draftInn,
        entityType: draftEntityType,
        kpp: draftKpp,
        ogrn: draftOgrn,
        legalAddress: draftAddress,
        actualAddress: draftActualAddress,
        comment: draftComment,
        paymentForm: draftPaymentForm,
        paymentDelayDays: draftPaymentDelayDays,
        creditLimitRub: draftCreditLimitRub,
        edoEnabled: draftEdoEnabled,
        edoOperator: draftEdoOperator,
      }),
    [
      draftName,
      draftInn,
      draftEntityType,
      draftKpp,
      draftOgrn,
      draftAddress,
      draftActualAddress,
      draftComment,
      draftPaymentForm,
      draftPaymentDelayDays,
      draftCreditLimitRub,
      draftEdoEnabled,
      draftEdoOperator,
    ],
  );

  const isDirty = Boolean(baselineSnapshot && !snapshotsEqual(baselineSnapshot, currentSnapshot));

  useEffect(() => {
    if (!formOpen || !editingId || isDirty) return;
    const e = merged.find((x) => x.id === editingId && (!x.isPassportSeed || useAct));
    if (!e) return;
    const paymentDto = paymentByEntityId[editingId];
    if (!paymentDto) return;

    const et = (e.entityType ?? "ooo") as EntityTypeValue;
    const entityType = (ENTITY_TYPE_VALUES as readonly string[]).includes(et) ? et : "other";
    const payment = paymentFieldsFromEntity(e, paymentDto);

    setDraftPaymentForm(payment.paymentForm);
    setDraftPaymentDelayDays(payment.paymentDelayDays);
    setDraftCreditLimitRub(payment.creditLimitRub);
    setDraftEdoEnabled(payment.edoEnabled);
    setDraftEdoOperator(payment.edoOperator);
    setBaselineSnapshot(
      snapshotFromDrafts({
        name: e.name,
        inn: e.inn ?? "",
        entityType,
        kpp: e.kpp ?? "",
        ogrn: e.ogrn ?? "",
        legalAddress: e.legalAddress ?? "",
        actualAddress: e.actualAddress ?? "",
        comment: e.comment ?? "",
        paymentForm: payment.paymentForm,
        paymentDelayDays: payment.paymentDelayDays,
        creditLimitRub: payment.creditLimitRub,
        edoEnabled: payment.edoEnabled,
        edoOperator: payment.edoOperator,
      }),
    );
  }, [formOpen, editingId, isDirty, merged, paymentByEntityId, useAct]);

  const editingEntity = useMemo(
    () => (editingId ? merged.find((x) => x.id === editingId && (!x.isPassportSeed || useAct)) : undefined),
    [editingId, merged, useAct],
  );

  const displayInternalCode = useMemo(() => {
    if (lastSavedInternalCode?.trim()) return lastSavedInternalCode.trim();
    const fromMerged = (editingEntity?.internalCode ?? "").trim();
    if (fromMerged) return fromMerged;
    return "";
  }, [lastSavedInternalCode, editingEntity?.internalCode]);

  const markFormEdited = useCallback(() => {
    legalFormSave.markDirty();
    setLastSavedInternalCode(null);
    setSaveError(null);
  }, [legalFormSave]);

  const clearDraftFields = useCallback(() => {
    setDraftName("");
    setDraftInn("");
    setDraftEntityType("ooo");
    setDraftKpp("");
    setDraftOgrn("");
    setDraftAddress("");
    setDraftActualAddress("");
    setSameAsLegal(true);
    setDraftComment("");
    setDraftPaymentForm("");
    setDraftPaymentDelayDays("");
    setDraftCreditLimitRub("");
    setDraftEdoEnabled(false);
    setDraftEdoOperator("");
    setInnLookupResults([]);
    setInnLookupNote("");
    setInnDupInline(null);
    setBaselineSnapshot(null);
    newEntityIdRef.current = null;
  }, []);

  const performClose = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    newEntityIdRef.current = null;
    clearDraftFields();
    setLastSavedInternalCode(null);
    setSaveError(null);
    legalFormSave.markDirty();
  }, [clearDraftFields, legalFormSave]);

  const openAddDialog = useCallback(() => {
    clearDraftFields();
    newEntityIdRef.current = generateManualLegalEntityStableId();
    setEditingId(null);
    setFormOpen(true);
    legalFormSave.markDirty();
    queueMicrotask(() => {
      setBaselineSnapshot({ ...EMPTY_SNAPSHOT });
    });
  }, [clearDraftFields, legalFormSave]);

  const loadEntityIntoDraft = useCallback(
    (id: string) => {
      const e = merged.find((x) => x.id === id && (!x.isPassportSeed || useAct));
      if (!e) return;
      setDraftName(e.name);
      setDraftInn(e.inn ?? "");
      const et = (e.entityType ?? "ooo") as EntityTypeValue;
      setDraftEntityType((ENTITY_TYPE_VALUES as readonly string[]).includes(et) ? et : "other");
      setDraftKpp(e.kpp ?? "");
      setDraftOgrn(e.ogrn ?? "");
      setDraftAddress(e.legalAddress ?? "");
      setDraftActualAddress(e.actualAddress ?? "");
      const la = (e.legalAddress ?? "").trim();
      const aa = (e.actualAddress ?? "").trim();
      setSameAsLegal(la === aa);
      setDraftComment(e.comment ?? "");
      const entityType = (ENTITY_TYPE_VALUES as readonly string[]).includes(et) ? et : "other";
      const payment = paymentFieldsFromEntity(e, paymentByEntityIdRef.current[id]);
      setDraftPaymentForm(payment.paymentForm);
      setDraftPaymentDelayDays(payment.paymentDelayDays);
      setDraftCreditLimitRub(payment.creditLimitRub);
      setDraftEdoEnabled(payment.edoEnabled);
      setDraftEdoOperator(payment.edoOperator);
      setEditingId(id);
      newEntityIdRef.current = null;
      setInnDupInline(null);
      setLastSavedInternalCode(null);
      setSaveError(null);
      setFormOpen(true);
      legalFormSave.markDirty();
      queueMicrotask(() => {
        setBaselineSnapshot(
          snapshotFromDrafts({
            name: e.name,
            inn: e.inn ?? "",
            entityType,
            kpp: e.kpp ?? "",
            ogrn: e.ogrn ?? "",
            legalAddress: e.legalAddress ?? "",
            actualAddress: e.actualAddress ?? "",
            comment: e.comment ?? "",
            paymentForm: payment.paymentForm,
            paymentDelayDays: payment.paymentDelayDays,
            creditLimitRub: payment.creditLimitRub,
            edoEnabled: payment.edoEnabled,
            edoOperator: payment.edoOperator,
          }),
        );
      });
    },
    [merged, useAct, legalFormSave],
  );

  const onSave = useCallback(async (): Promise<boolean> => {
    if (!canMutate || !draftName.trim()) {
      toast({ title: "Укажите название юрлица", variant: "destructive" });
      return false;
    }
    if (!normalizeInn(draftInn)) {
      toast({ title: "Укажите ИНН", variant: "destructive" });
      return false;
    }
    if (!draftEntityType) {
      toast({ title: "Выберите тип юрлица", variant: "destructive" });
      return false;
    }

    const targetId = editingId ?? newEntityIdRef.current;
    if (!targetId) {
      toast({ title: "Не удалось определить идентификатор записи", variant: "destructive" });
      return false;
    }

    if (!skipInnDupOnceRef.current) {
      const dup = findInnDuplicate(draftInn, editingId);
      if (dup) {
        setInnDupInline({ existingId: dup.id, existingName: dup.name });
        return false;
      }
    }
    skipInnDupOnceRef.current = false;

    const now = new Date().toISOString();
    const prevEntitySnap = merged.find((x) => x.id === targetId);
    const creditParsed =
      draftCreditLimitRub.trim() === ""
        ? null
        : Number(draftCreditLimitRub.replace(/\s/g, "").replace(",", "."));
    const paymentUpsert: LegalEntityUpsertFields = {
      paymentForm: draftPaymentForm || null,
      paymentDelayDays:
        draftPaymentDelayDays.trim() === ""
          ? null
          : Math.max(0, Math.floor(Number(draftPaymentDelayDays))),
      creditLimitRub: creditParsed != null && !Number.isNaN(creditParsed) ? creditParsed : null,
      edoEnabled: draftEdoEnabled,
      edoOperator: draftEdoEnabled ? draftEdoOperator.trim() || null : null,
    };

    let savedCode = "";

    if (useAct) {
      let internalCodeOut = "";
      const r = await actx.persist((prev) => {
        const cur = prev.legalEntityOverridesByDealerId[row.id] ?? {
          createdById: actorUserId,
          overridesById: {},
          archivedById: {},
        };
        const existingInternal = (prevEntitySnap?.internalCode ?? "").trim();
        const internalCode = existingInternal || allocateNextLegalEntityDisplayCode(prev);
        internalCodeOut = internalCode;

        const statusResolved: DealerLegalEntityStatus =
          prevEntitySnap?.isPassportSeed && prevEntitySnap.status === "main" ? "main" : "additional";

        const payload: Record<string, unknown> = {
          name: draftName.trim(),
          inn: normalizeInn(draftInn),
          entityType: draftEntityType,
          kpp: draftKpp.trim(),
          ogrn: draftOgrn.trim(),
          legalAddress: draftAddress.trim(),
          actualAddress: draftActualAddress.trim(),
          primaryContact: prevEntitySnap?.primaryContact ?? "",
          phone: prevEntitySnap?.phone ?? "",
          email: prevEntitySnap?.email ?? "",
          comment: draftComment.trim(),
          internalCode,
          status: statusResolved,
          updatedAt: now,
          updatedBy: actorUserId,
          updatedByName: actorLabel,
          paymentForm: draftPaymentForm || null,
          paymentDelayDays:
            draftPaymentDelayDays.trim() === ""
              ? null
              : Math.max(0, Math.floor(Number(draftPaymentDelayDays))),
          creditLimitRub: draftCreditLimitRub.trim() || null,
          edoEnabled: draftEdoEnabled,
          edoOperator: draftEdoEnabled ? draftEdoOperator.trim() || null : null,
        };
        if (!editingId) {
          payload.createdAt = now;
        } else if (prevEntitySnap?.createdAt) {
          payload.createdAt = prevEntitySnap.createdAt;
        } else {
          payload.createdAt = now;
        }

        const nextOverrides = { ...cur.overridesById, [targetId]: { ...(cur.overridesById[targetId] as object), ...payload } };
        return mergeActualizationState(prev, {
          legalEntityOverridesByDealerId: {
            ...prev.legalEntityOverridesByDealerId,
            [row.id]: { ...cur, overridesById: nextOverrides },
          },
        });
      });
      if (r.success) {
        savedCode = internalCodeOut.trim();
        setTick((n) => n + 1);
        setEditingId(targetId);
        newEntityIdRef.current = null;
        setBaselineSnapshot(currentSnapshot);
        setLastSavedInternalCode(savedCode);
        setInnDupInline(null);
        setSaveError(null);
        const statusResolved: DealerLegalEntityStatus =
          prevEntitySnap?.isPassportSeed && prevEntitySnap.status === "main" ? "main" : "additional";
        const entityForServer: MergedDealerLegalEntity = {
          id: targetId,
          name: draftName.trim(),
          inn: normalizeInn(draftInn),
          kpp: draftKpp.trim(),
          ogrn: draftOgrn.trim(),
          legalAddress: draftAddress.trim(),
          actualAddress: draftActualAddress.trim(),
          entityType: draftEntityType,
          primaryContact: prevEntitySnap?.primaryContact,
          phone: prevEntitySnap?.phone,
          email: prevEntitySnap?.email,
          comment: draftComment.trim(),
          internalCode: internalCodeOut || prevEntitySnap?.internalCode,
          status: statusResolved,
          paymentForm: paymentUpsert.paymentForm ?? null,
          paymentDelayDays: paymentUpsert.paymentDelayDays ?? null,
          creditLimitRub:
            paymentUpsert.creditLimitRub != null ? String(paymentUpsert.creditLimitRub) : null,
          edoEnabled: paymentUpsert.edoEnabled ?? null,
          edoOperator: paymentUpsert.edoOperator ?? null,
          createdAt: prevEntitySnap?.createdAt ?? now,
          updatedAt: now,
          updatedBy: actorUserId,
          updatedByName: actorLabel,
          isPassportSeed: prevEntitySnap?.isPassportSeed ?? false,
        };
        const serverId = await ensureServerLegalEntityId(row.id, entityForServer, actorUserId, actorLabel);
        if (!serverId) {
          toast({
            title: "Не удалось сохранить платёжные данные",
            description: "Проверьте соединение и попробуйте ещё раз.",
            variant: "destructive",
          });
          return false;
        }
        const patchOk = await apiPatchFull(serverId, {
          name: draftName.trim(),
          inn: normalizeInn(draftInn),
          entityType: draftEntityType,
          kpp: draftKpp.trim(),
          ogrn: draftOgrn.trim(),
          legalAddress: draftAddress.trim(),
          actualAddress: draftActualAddress.trim(),
          comment: draftComment.trim(),
          internalCode: internalCodeOut || prevEntitySnap?.internalCode,
          status: statusResolved,
          ...paymentFieldsToFullApiBody(paymentUpsert),
          updatedByUserId: actorUserId,
          updatedByName: actorLabel,
        });
        if (!patchOk) {
          toast({
            title: "Не удалось сохранить платёжные данные",
            description: "Проверьте соединение и попробуйте ещё раз.",
            variant: "destructive",
          });
          return false;
        }
        await refreshDbLegalEntitiesForDealer(row.id);
        try {
          const items = await fetchLegalEntitiesForClient(row.id);
          const map: Record<string, LegalEntityDto> = {};
          for (const it of items) map[it.id] = it;
          setPaymentByEntityId(map);
        } catch {
          setPaymentByEntityId((prev) => ({
            ...prev,
            [serverId]: {
              ...(prev[serverId] ?? {
                id: serverId,
                clientId: row.id,
                name: draftName.trim(),
                createdAt: now,
                updatedAt: now,
              }),
              ...paymentUpsert,
              paymentForm: paymentUpsert.paymentForm ?? null,
              creditLimitRub:
                paymentUpsert.creditLimitRub != null ? String(paymentUpsert.creditLimitRub) : null,
            } as LegalEntityDto,
          }));
        }
        setTick((n) => n + 1);
        return true;
      }
      setSaveError("Не удалось сохранить");
      toast({
        title: "Не удалось сохранить",
        description: "Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
      return false;
    }

    if (editingId && !editingId.startsWith("passport:")) {
      updateDealerLegalEntity(
        row.id,
        editingId,
        {
          name: draftName,
          inn: draftInn,
          kpp: draftKpp,
          ogrn: draftOgrn,
          legalAddress: draftAddress,
          actualAddress: draftActualAddress,
          entityType: draftEntityType,
          status: "additional",
          comment: draftComment,
          paymentForm: draftPaymentForm || null,
          paymentDelayDays:
            draftPaymentDelayDays.trim() === ""
              ? null
              : Math.max(0, Math.floor(Number(draftPaymentDelayDays))),
          creditLimitRub: draftCreditLimitRub.trim() || null,
          edoEnabled: draftEdoEnabled,
          edoOperator: draftEdoEnabled ? draftEdoOperator.trim() || null : null,
        },
        actorUserId,
        actorLabel,
        paymentUpsert,
      );
      const code = (merged.find((x) => x.id === editingId)?.internalCode ?? "").trim();
      savedCode = code;
    } else {
      const newId = addDealerLegalEntity(
        row.id,
        {
          name: draftName,
          inn: draftInn,
          kpp: draftKpp,
          ogrn: draftOgrn,
          legalAddress: draftAddress,
          actualAddress: draftActualAddress,
          entityType: draftEntityType,
          internalCode: allocateNextLegalEntityCodeLocal(),
          status: "additional",
          comment: draftComment,
          paymentForm: draftPaymentForm || null,
          paymentDelayDays:
            draftPaymentDelayDays.trim() === ""
              ? null
              : Math.max(0, Math.floor(Number(draftPaymentDelayDays))),
          creditLimitRub: draftCreditLimitRub.trim() || null,
          edoEnabled: draftEdoEnabled,
          edoOperator: draftEdoEnabled ? draftEdoOperator.trim() || null : null,
          updatedBy: actorUserId,
          updatedByName: actorLabel,
        },
        paymentUpsert,
      );
      if (newId) {
        setEditingId(newId);
        const list = getMergedDealerLegalEntities(row);
        const created = list.find((x) => x.id === newId);
        savedCode = (created?.internalCode ?? "").trim();
      }
    }
    newEntityIdRef.current = null;
    setTick((n) => n + 1);
    setBaselineSnapshot(currentSnapshot);
    setLastSavedInternalCode(savedCode || displayInternalCode);
    setInnDupInline(null);
    setSaveError(null);
    return true;
  }, [
    canMutate,
    useAct,
    actx,
    draftName,
    draftInn,
    draftEntityType,
    draftKpp,
    draftOgrn,
    draftAddress,
    draftActualAddress,
    draftComment,
    draftPaymentForm,
    draftPaymentDelayDays,
    draftCreditLimitRub,
    draftEdoEnabled,
    draftEdoOperator,
    editingId,
    row.id,
    actorUserId,
    actorLabel,
    merged,
    findInnDuplicate,
    currentSnapshot,
    displayInternalCode,
  ]);

  const requestCloseForm = useCallback(() => {
    if (isDirty) {
      setUnsavedConfirmOpen(true);
      return;
    }
    performClose();
  }, [isDirty, performClose]);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      requestCloseForm();
    },
    [requestCloseForm],
  );

  const onCancelForm = useCallback(() => {
    requestCloseForm();
  }, [requestCloseForm]);

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget || !canMutate) return;
    const entity = merged.find((e) => e.id === archiveTarget.id);
    if (!entity) {
      setArchiveTarget(null);
      return;
    }

    const ok = await archiveDealerLegalEntityAsync(row.id, entity, actorUserId, actorLabel);
    if (!ok) {
      toast({
        title: "Не удалось архивировать. Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
      setArchiveTarget(null);
      return;
    }

    if (useAct) {
      await actx.persist((prev) =>
        mergeActualizationState(prev, {
          archivedLegalEntitiesById: {
            ...prev.archivedLegalEntitiesById,
            [entity.id]: buildArchivedLegalEntityInfo({
              legalEntityId: entity.id,
              dealerId: row.id,
              archivedBy: actorUserId,
              archivedByName: actorLabel,
              source: "manual_actualization",
            }),
          },
        }),
      );
    }

    await refreshDbLegalEntitiesForDealer(row.id);
    setTick((n) => n + 1);
    toast({ title: "Юрлицо в архиве" });
    setArchiveTarget(null);
  }, [archiveTarget, canMutate, useAct, actx, merged, row.id, actorUserId, actorLabel]);

  const onRestore = useCallback(
    async (legalEntityId: string) => {
      if (!canMutate) return;
      const entity = merged.find((e) => e.id === legalEntityId);
      if (!entity) return;

      const ok = await unarchiveDealerLegalEntityAsync(row.id, entity, actorUserId, actorLabel);
      if (!ok) {
        if (useAct) {
          const r = await actx.persist((prev) => restoreLegalEntityFromArchive(prev, row.id, legalEntityId));
          if (r.success) {
            toast({ title: "Юрлицо восстановлено" });
            setTick((n) => n + 1);
            return;
          }
        }
        toast({
          title: "Не удалось восстановить. Проверьте соединение и попробуйте ещё раз.",
          variant: "destructive",
        });
        return;
      }

      if (useAct) {
        await actx.persist((prev) => restoreLegalEntityFromArchive(prev, row.id, legalEntityId));
      }
      await refreshDbLegalEntitiesForDealer(row.id);
      setTick((n) => n + 1);
      toast({ title: "Юрлицо восстановлено" });
    },
    [canMutate, merged, row.id, actorUserId, actorLabel, useAct, actx],
  );

  const dirtyFlags = useMemo(() => {
    if (!baselineSnapshot) {
      return {
        name: false,
        inn: false,
        entityType: false,
        kpp: false,
        ogrn: false,
        legalAddress: false,
        actualAddress: false,
        comment: false,
      } as Record<FieldDirtyKey, boolean>;
    }
    const b = baselineSnapshot;
    const c = currentSnapshot;
    return {
      name: b.name !== c.name,
      inn: b.inn !== c.inn,
      entityType: b.entityType !== c.entityType,
      kpp: b.kpp !== c.kpp,
      ogrn: b.ogrn !== c.ogrn,
      legalAddress: b.legalAddress !== c.legalAddress,
      actualAddress: b.actualAddress !== c.actualAddress,
      comment: b.comment !== c.comment,
      paymentForm: b.paymentForm !== c.paymentForm,
      paymentDelayDays: b.paymentDelayDays !== c.paymentDelayDays,
      creditLimitRub: b.creditLimitRub !== c.creditLimitRub,
      edoEnabled: b.edoEnabled !== c.edoEnabled,
      edoOperator: b.edoOperator !== c.edoOperator,
    };
  }, [baselineSnapshot, currentSnapshot]);

  const saveStatusText = useMemo(() => {
    if (saveError) return saveError;
    if (legalFormSave.phase === "saving") return "Сохраняем…";
    if (legalFormSave.phase === "success") return "Сохранено";
    if (lastSavedInternalCode && !isDirty) return "Юрлицо сохранено";
    if (!isDirty) return "Изменений нет";
    return "Есть несохранённые изменения";
  }, [saveError, legalFormSave.phase, lastSavedInternalCode, isDirty]);

  const saveNameOk = Boolean(draftName.trim() || (editingId && editingEntity?.name?.trim()));
  const saveInnOk = Boolean(
    normalizeInn(draftInn) || (editingId && normalizeInn(editingEntity?.inn ?? "")),
  );
  const saveValidationBlocked = !saveNameOk || !saveInnOk;

  const saveDisabled =
    saveValidationBlocked ||
    !isDirty ||
    legalFormSave.phase === "saving" ||
    legalFormSave.phase === "success";

  const showDoneCta = Boolean(lastSavedInternalCode && !isDirty && legalFormSave.phase !== "saving");

  const formHeaderMode = editingId ? "Редактирование юрлица" : "Новое юрлицо";
  const sourceBadge = editingEntity?.isPassportSeed ? (
    <Badge variant="secondary" className="text-[10px] font-normal">
      Из базы
    </Badge>
  ) : editingId || newEntityIdRef.current ? (
    <Badge variant="outline" className="text-[10px] font-normal">
      Добавлено вручную
    </Badge>
  ) : null;

  return (
    <section id="dealer-section-legal-entities" data-testid="section-dealer-legal-entities" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
      <div
        className={
          embedInAccordion
            ? "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
            : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        {!embedInAccordion ? (
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Юридические лица</h3>
        ) : null}
        {canMutate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9 w-full font-semibold sm:w-auto"
            data-testid="button-legal-entity-add"
            onClick={() => {
              if (formOpen && !editingId) {
                requestCloseForm();
              } else {
                openAddDialog();
              }
            }}
          >
            {formOpen && !editingId ? "Закрыть форму" : "Добавить юрлицо"}
          </Button>
        ) : null}
      </div>

      <Dialog open={formOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent
          data-testid="dialog-legal-entity-form"
          hideCloseButton
          className={cn(
            "flex max-h-[100dvh] w-[calc(100vw-1rem)] max-w-[860px] min-w-0 flex-col gap-0 overflow-hidden rounded-none border p-0 sm:rounded-lg",
            "max-sm:h-[100dvh] max-sm:max-h-[100dvh]",
            "sm:max-h-[85vh]",
          )}
        >
          <DialogHeader className="sticky top-0 z-10 shrink-0 space-y-2 border-b bg-background/95 px-4 pb-3 pt-4 text-left backdrop-blur sm:px-5">
            <div className="flex items-start justify-between gap-2 pr-10">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">{formHeaderMode}</DialogTitle>
                <DialogDescription className="text-left text-xs leading-snug text-muted-foreground sm:text-sm">
                  Заполните данные юрлица, которое относится к этому клиенту.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 shrink-0"
                aria-label="Закрыть"
                onClick={() => onDialogOpenChange(false)}
              >
                <span className="text-lg leading-none">×</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Код:</span>
              {displayInternalCode ? (
                <span className="font-mono text-foreground" data-testid={editingId ? `text-legal-entity-code-${editingId}` : undefined}>
                  {displayInternalCode}
                </span>
              ) : (
                <span className="italic text-muted-foreground">будет создан после сохранения</span>
              )}
              {sourceBadge}
            </div>
            {lastSavedInternalCode && !isDirty && legalFormSave.phase !== "saving" ? (
              <div
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50"
                role="status"
              >
                <span className="font-medium">Юрлицо сохранено.</span>{" "}
                {displayInternalCode ? (
                  <>
                    Код: <span className="font-mono">{displayInternalCode}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
            {innDupInline ? (
              <Alert className="mb-4 border-amber-300/70 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30" role="alert">
                <AlertTitle className="text-sm">Юрлицо с таким ИНН уже есть у клиента</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="text-xs text-muted-foreground">«{innDupInline.existingName}»</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const id = innDupInline.existingId;
                        setInnDupInline(null);
                        loadEntityIntoDraft(id);
                      }}
                    >
                      Открыть существующее
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        skipInnDupOnceRef.current = true;
                        setInnDupInline(null);
                        void legalFormSave.runSave(onSave);
                      }}
                    >
                      Создать всё равно
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-6">
              <section data-testid="section-legal-entity-form-main" className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Основные данные</p>
                <DirtyFieldWrap dirty={dirtyFlags.name} fieldKey="name" label="Название юрлица / ИП" htmlFor="le-name" required>
                  <Input
                    id="le-name"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      markFormEdited();
                    }}
                    disabled={!canMutate}
                    className="min-h-10 w-full min-w-0"
                    data-testid="input-legal-entity-name"
                  />
                  {nameSuggestions.length > 0 && canMutate ? (
                    <div
                      className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2"
                      data-testid="section-legal-entity-suggestions"
                    >
                      {nameSuggestions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-start justify-between gap-2 rounded border border-transparent px-1 py-0.5 hover:bg-card"
                        >
                          <div className="min-w-0" data-testid={`row-legal-entity-suggestion-${s.id}`}>
                            <p className="truncate text-xs font-medium text-foreground">{s.name}</p>
                            {s.inn ? <p className="text-[10px] text-muted-foreground">ИНН {s.inn}</p> : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 shrink-0 px-2 text-[10px]"
                            data-testid={`button-legal-entity-suggestion-apply-${s.id}`}
                            onClick={() => {
                              setDraftName(s.name);
                              if (s.inn) setDraftInn(s.inn);
                              if (s.kpp) setDraftKpp(s.kpp);
                              if (s.legalAddress?.trim()) {
                                setDraftAddress(s.legalAddress.trim());
                                if (sameAsLegal) setDraftActualAddress(s.legalAddress.trim());
                              }
                              markFormEdited();
                            }}
                          >
                            Применить
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </DirtyFieldWrap>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DirtyFieldWrap dirty={dirtyFlags.entityType} fieldKey="entityType" label="Тип" required>
                    <Select
                      value={draftEntityType}
                      onValueChange={(v) => {
                        setDraftEntityType(v as EntityTypeValue);
                        markFormEdited();
                      }}
                      disabled={!canMutate}
                    >
                      <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-legal-entity-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ENTITY_TYPE_LABELS) as EntityTypeValue[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {ENTITY_TYPE_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DirtyFieldWrap>

                  <DirtyFieldWrap dirty={dirtyFlags.inn} fieldKey="inn" label="ИНН" htmlFor="le-inn" required>
                    <div className="flex flex-col gap-2 sm:flex-col">
                      <Input
                        id="le-inn"
                        value={draftInn}
                        onChange={(e) => {
                          setDraftInn(e.target.value);
                          setInnLookupResults([]);
                          setInnLookupNote("");
                          setInnDupInline(null);
                          markFormEdited();
                        }}
                        disabled={!canMutate}
                        className="min-h-10 w-full min-w-0"
                        data-testid="input-legal-entity-inn"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full shrink-0 text-xs sm:w-auto sm:self-start"
                        disabled={!canMutate}
                        data-testid="button-legal-entity-inn-lookup"
                        onClick={() => {
                          void (async () => {
                            const res = lookupLegalEntityByInn(draftInn);
                            if (!res.ok) {
                              toast({ title: "ИНН", description: res.error, variant: "destructive" });
                              setInnLookupResults([]);
                              setInnLookupNote("");
                              return;
                            }
                            let merged = [...res.results];
                            const dadata = await fetchDadataPartiesByInn(draftInn);
                            if (dadata.success && dadata.items.length > 0) {
                              for (const d of dadata.items) {
                                const dup = merged.some(
                                  (m) => normalizeInn(m.inn) === normalizeInn(d.inn) && m.name.trim() === d.name.trim(),
                                );
                                if (!dup) merged.push(d);
                              }
                            }
                            setInnLookupResults(merged);
                            setInnLookupNote(
                              merged.length === 0
                                ? "По локальной базе и DaData данные не найдены. Проверьте ИНН или подключение DaData в настройках окружения."
                                : "",
                            );
                          })();
                        }}
                      >
                        Найти по ИНН
                      </Button>
                    </div>
                    {innLookupNote ? <p className="text-[11px] leading-snug text-muted-foreground">{innLookupNote}</p> : null}
                    {innLookupResults.length > 0 ? (
                      <div className="space-y-1 rounded-md border border-border/70 bg-muted/15 p-2" data-testid="section-legal-entity-inn-results">
                        {innLookupResults.map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-col gap-2 rounded px-1 py-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                            data-testid={`row-legal-entity-inn-result-${r.id}`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">{r.name}</p>
                              <p className="text-[10px] text-muted-foreground">{r.source}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 shrink-0 text-[10px]"
                              data-testid={`button-legal-entity-inn-result-apply-${r.id}`}
                              onClick={() => {
                                setDraftName((prev) => (prev.trim() ? prev : r.name));
                                setDraftInn(r.inn);
                                setDraftKpp((k) => (k.trim() ? k : r.kpp ?? ""));
                                if (r.ogrn?.trim()) setDraftOgrn((o) => (o.trim() ? o : r.ogrn ?? ""));
                                if (r.legalAddress?.trim()) {
                                  const addr = r.legalAddress.trim();
                                  setDraftAddress(addr);
                                  if (sameAsLegal) setDraftActualAddress(addr);
                                }
                                markFormEdited();
                              }}
                            >
                              Применить
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </DirtyFieldWrap>

                  <DirtyFieldWrap dirty={dirtyFlags.kpp} fieldKey="kpp" label="КПП" htmlFor="le-kpp">
                    <Input
                      id="le-kpp"
                      value={draftKpp}
                      onChange={(e) => {
                        setDraftKpp(e.target.value);
                        markFormEdited();
                      }}
                      disabled={!canMutate}
                      className="min-h-10 w-full min-w-0"
                      data-testid="input-legal-entity-kpp"
                    />
                  </DirtyFieldWrap>

                  <DirtyFieldWrap dirty={dirtyFlags.ogrn} fieldKey="ogrn" label="ОГРН / ОГРНИП" htmlFor="le-ogrn">
                    <Input
                      id="le-ogrn"
                      value={draftOgrn}
                      onChange={(e) => {
                        setDraftOgrn(e.target.value);
                        markFormEdited();
                      }}
                      disabled={!canMutate}
                      className="min-h-10 w-full min-w-0"
                      data-testid="input-legal-entity-ogrn"
                    />
                  </DirtyFieldWrap>
                </div>
              </section>

              <section data-testid="section-legal-entity-form-addresses" className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Адреса</p>
                <DirtyFieldWrap dirty={dirtyFlags.legalAddress} fieldKey="legalAddress" label="Юридический адрес">
                  <AddressSuggestInput
                    key={`le-legal-${editingId ?? newEntityIdRef.current ?? "new"}`}
                    value={draftAddress}
                    onChange={(v) => {
                      setDraftAddress(v);
                      if (sameAsLegal) setDraftActualAddress(v);
                      markFormEdited();
                    }}
                    disabled={!canMutate}
                    rows={3}
                    testId="input-legal-entity-legal-address-suggest"
                  />
                </DirtyFieldWrap>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="le-same-addr"
                    checked={sameAsLegal}
                    disabled={!canMutate}
                    onCheckedChange={(c) => {
                      const on = c === true;
                      setSameAsLegal(on);
                      if (on) setDraftActualAddress(draftAddress);
                      markFormEdited();
                    }}
                  />
                  <Label htmlFor="le-same-addr" className="cursor-pointer text-xs font-normal leading-snug text-muted-foreground">
                    Фактический адрес совпадает с юридическим
                  </Label>
                </div>
                <DirtyFieldWrap dirty={dirtyFlags.actualAddress} fieldKey="actualAddress" label="Фактический адрес">
                  <AddressSuggestInput
                    key={`le-actual-${editingId ?? newEntityIdRef.current ?? "new"}`}
                    value={draftActualAddress}
                    onChange={(v) => {
                      setDraftActualAddress(v);
                      setSameAsLegal(false);
                      markFormEdited();
                    }}
                    disabled={!canMutate || sameAsLegal}
                    rows={3}
                    testId="input-legal-entity-actual-address-suggest"
                  />
                </DirtyFieldWrap>
              </section>

              <section
                data-testid="section-legal-entity-form-payment"
                className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Платёжные условия</p>
                <DirtyFieldWrap dirty={dirtyFlags.paymentForm} fieldKey="paymentForm" label="Форма оплаты">
                  <RadioGroup
                    value={draftPaymentForm === "" ? "unset" : draftPaymentForm}
                    onValueChange={(v) => {
                      setDraftPaymentForm(v === "unset" ? "" : (v as LegalEntityPaymentForm));
                      markFormEdited();
                    }}
                    className="flex flex-wrap gap-3 text-xs"
                    disabled={!canMutate}
                  >
                    {PAYMENT_FORM_OPTIONS.map((opt) => (
                      <label key={opt.value || "unset"} className="inline-flex items-center gap-1.5">
                        <RadioGroupItem value={opt.value === "" ? "unset" : opt.value} disabled={!canMutate} />
                        {opt.label}
                      </label>
                    ))}
                  </RadioGroup>
                </DirtyFieldWrap>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DirtyFieldWrap
                    dirty={dirtyFlags.paymentDelayDays}
                    fieldKey="paymentDelayDays"
                    label="Отсрочка (дней)"
                    htmlFor="le-payment-delay"
                  >
                    <Input
                      id="le-payment-delay"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={draftPaymentDelayDays}
                      disabled={!canMutate}
                      onChange={(e) => {
                        setDraftPaymentDelayDays(e.target.value);
                        markFormEdited();
                      }}
                      className="min-h-10 w-full min-w-0"
                      data-testid="input-legal-entity-payment-delay"
                    />
                  </DirtyFieldWrap>
                  <DirtyFieldWrap
                    dirty={dirtyFlags.creditLimitRub}
                    fieldKey="creditLimitRub"
                    label="Кредитный лимит (₽)"
                    htmlFor="le-credit-limit"
                  >
                    <Input
                      id="le-credit-limit"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={draftCreditLimitRub}
                      disabled={!canMutate}
                      onChange={(e) => {
                        setDraftCreditLimitRub(e.target.value);
                        markFormEdited();
                      }}
                      className="min-h-10 w-full min-w-0"
                      data-testid="input-legal-entity-credit-limit"
                    />
                    {draftCreditLimitRub.trim() &&
                    !Number.isNaN(Number(draftCreditLimitRub.replace(/\s/g, "").replace(",", "."))) ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(Number(draftCreditLimitRub.replace(/\s/g, "").replace(",", ".")))}
                      </p>
                    ) : null}
                  </DirtyFieldWrap>
                </div>
                <div className="space-y-2">
                  <DirtyFieldWrap dirty={dirtyFlags.edoEnabled} fieldKey="edoEnabled" label="ЭДО">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={draftEdoEnabled}
                        disabled={!canMutate}
                        onCheckedChange={(c) => {
                          setDraftEdoEnabled(c === true);
                          if (c !== true) setDraftEdoOperator("");
                          markFormEdited();
                        }}
                      />
                      ЭДО включён
                    </label>
                  </DirtyFieldWrap>
                  {draftEdoEnabled ? (
                    <DirtyFieldWrap
                      dirty={dirtyFlags.edoOperator}
                      fieldKey="edoOperator"
                      label="Оператор ЭДО"
                      htmlFor="le-edo-operator"
                    >
                      <Input
                        id="le-edo-operator"
                        list="le-edo-operator-suggestions"
                        value={draftEdoOperator}
                        disabled={!canMutate}
                        placeholder="Диадок, СБИС, Контур…"
                        onChange={(e) => {
                          setDraftEdoOperator(e.target.value);
                          markFormEdited();
                        }}
                        className="min-h-10 w-full min-w-0"
                        data-testid="input-legal-entity-edo-operator"
                      />
                      <datalist id="le-edo-operator-suggestions">
                        {EDO_OPERATOR_SUGGESTIONS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </DirtyFieldWrap>
                  ) : null}
                </div>
              </section>

              <section data-testid="section-legal-entity-form-comment" className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Комментарий</p>
                <DirtyFieldWrap dirty={dirtyFlags.comment} fieldKey="comment" label="Комментарий менеджера" htmlFor="le-comment">
                  <Textarea
                    id="le-comment"
                    value={draftComment}
                    onChange={(e) => {
                      setDraftComment(e.target.value);
                      markFormEdited();
                    }}
                    disabled={!canMutate}
                    rows={3}
                    className="min-h-[72px] w-full min-w-0 resize-y text-sm"
                    data-testid="textarea-legal-entity-comment"
                  />
                </DirtyFieldWrap>
              </section>
            </div>
          </div>

          {canMutate ? (
            <DialogFooter
              data-testid="footer-legal-entity-form-actions"
              className="sticky bottom-0 z-10 shrink-0 flex-col gap-3 border-t bg-background/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p
                  className={cn(
                    "text-xs font-medium sm:text-sm",
                    saveError ? "text-destructive" : "",
                    !saveError && legalFormSave.phase === "success" ? "text-emerald-700 dark:text-emerald-400" : "",
                    !saveError && legalFormSave.phase !== "success" && lastSavedInternalCode && !isDirty ? "text-emerald-700 dark:text-emerald-400" : "",
                    !saveError && isDirty ? "text-amber-800 dark:text-amber-200" : "",
                    !saveError && !isDirty && !lastSavedInternalCode && legalFormSave.phase === "idle" ? "text-muted-foreground" : "",
                  )}
                  data-testid="text-legal-entity-form-save-status"
                >
                  {saveStatusText}
                </p>
                {isDirty && saveValidationBlocked ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Заполните обязательные поля: название и ИНН.
                  </p>
                ) : null}
                <span className="sr-only" data-testid="text-save-status-legal-entities" aria-live="polite">
                  {legalFormSave.phase}
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                {showDoneCta ? (
                  <Button
                    type="button"
                    variant="default"
                    className="min-h-9 font-semibold"
                    data-testid="button-legal-entity-form-done"
                    onClick={() => performClose()}
                  >
                    Готово
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="min-h-9 font-semibold" onClick={onCancelForm}>
                  Отмена
                </Button>
                <SectionSaveButton
                  testId="button-legal-entity-save"
                  phase={legalFormSave.phase}
                  disabled={saveDisabled}
                  onSave={() => void legalFormSave.runSave(onSave)}
                />
              </div>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsavedConfirmOpen} onOpenChange={setUnsavedConfirmOpen}>
        <AlertDialogContent data-testid="dialog-legal-entity-unsaved-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Есть несохранённые изменения. Закрыть без сохранения?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Вернуться</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnsavedConfirmOpen(false);
                performClose();
              }}
            >
              Закрыть без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {visible.active.length === 0 && visible.arch.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-legal-entities-empty-state">
          Юридические лица не добавлены.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.active.map((e) => {
            const paymentSummary = formatEntityPaymentSummary(mergeEntityPaymentFields(e, paymentByEntityId[e.id]));
            const updatedLabel = formatDisplayDate(e.updatedAt);
            const manualBadge =
              e.isPassportSeed && legalEntityHasOverrides(e.id) ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Изменено вручную
                </Badge>
              ) : !e.isPassportSeed ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  Добавлено вручную
                </Badge>
              ) : null;
            const sourceBadgeCard = e.isPassportSeed ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Из базы
              </Badge>
            ) : null;

            return (
              <Card
                key={e.id}
                data-testid={`card-legal-entity-${e.id}`}
                className="overflow-hidden rounded-lg border border-border/70 bg-muted/10 shadow-xs"
              >
                <CardContent className="space-y-2 p-3 pt-3 sm:p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-snug text-foreground">{e.name}</p>
                        {sourceBadgeCard}
                        {manualBadge}
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {entityTypeLabel(e.entityType)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      </div>
                      {isFilled(e.internalCode) ? (
                        <p className="text-xs text-muted-foreground">
                          Код:{" "}
                          <span className="font-mono font-medium text-foreground" data-testid={`text-legal-entity-code-${e.id}`}>
                            {e.internalCode}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">Код будет назначен после сохранения</p>
                      )}
                      {isFilled(e.inn) ? (
                        <p className="text-xs text-muted-foreground">
                          ИНН {e.inn}
                          {isFilled(e.kpp) ? ` · КПП ${e.kpp}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">ИНН не указан</p>
                      )}
                      {isFilled(e.ogrn) ? <p className="text-xs text-muted-foreground">ОГРН / ОГРНИП {e.ogrn}</p> : null}
                      {isFilled(e.kpp) && !isFilled(e.inn) ? (
                        <p className="text-xs text-muted-foreground">КПП {e.kpp}</p>
                      ) : null}
                      {isFilled(e.legalAddress) ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">Юридический адрес: {e.legalAddress}</p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">Адрес не указан</p>
                      )}
                      {isFilled(e.actualAddress) && (e.actualAddress ?? "").trim() !== (e.legalAddress ?? "").trim() ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">Фактический адрес: {e.actualAddress}</p>
                      ) : null}
                      {updatedLabel !== "Не указано" ? (
                        <p className="text-[11px] text-muted-foreground">Обновлено: {updatedLabel}</p>
                      ) : null}
                      {isFilled(e.comment) ? <p className="text-xs text-foreground">{e.comment}</p> : null}
                      {paymentSummary ? (
                        <p className="text-xs text-muted-foreground" data-testid={`text-legal-entity-payment-${e.id}`}>
                          Платёжные условия: {paymentSummary}
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">Платёжные условия не указаны</p>
                      )}
                      <LegalEntityContactsSubsection
                        row={row}
                        legalEntityId={e.id}
                        legalEntityName={e.name}
                        profile={profile}
                        canEdit={canEditDealerLegalEntities(profile, row)}
                        entityArchived={false}
                        seedContact={{
                          fullName: e.primaryContact,
                          phone: e.phone,
                          email: e.email,
                        }}
                        resolveServerLegalEntityId={() => resolveLegalEntityServerId(e)}
                      />
                    </div>
                    {canMutate ? (
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 px-2 text-xs font-semibold"
                          data-testid={`button-legal-entity-edit-${e.id}`}
                          onClick={() => loadEntityIntoDraft(e.id)}
                        >
                          Редактировать
                        </Button>
                        {e.status !== "archived" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-8 border-destructive/25 px-2 text-xs font-medium text-destructive hover:bg-destructive/[0.05]"
                            data-testid={`button-legal-entity-delete-${e.id}`}
                            onClick={() => setArchiveTarget({ id: e.id, name: e.name })}
                          >
                            В архив
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {visible.arch.length > 0 ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-8 px-2 text-xs font-semibold text-muted-foreground"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? "Скрыть архив" : `Архив (${visible.arch.length})`}
              </Button>
              {showArchived ? (
                <div className="mt-2 space-y-2 opacity-90">
                  {visible.arch.map((e) => (
                    <Card key={e.id} data-testid={`card-legal-entity-${e.id}`} className="border-dashed border-border/80 bg-muted/5">
                      <CardContent className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-muted-foreground">{e.name}</p>
                          <Badge variant="outline" className="text-[10px]">
                            Архив
                          </Badge>
                        </div>
                        {canMutate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 min-h-8 text-xs"
                            data-testid={`button-legal-entity-restore-${e.id}`}
                            onClick={() => void onRestore(e.id)}
                          >
                            Восстановить
                          </Button>
                        ) : null}
                        {canMutate && !e.isPassportSeed ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 min-h-8 text-xs"
                            data-testid={`button-legal-entity-edit-${e.id}`}
                            onClick={() => loadEntityIntoDraft(e.id)}
                          >
                            Редактировать
                          </Button>
                        ) : null}
                        <LegalEntityContactsSubsection
                          row={row}
                          legalEntityId={e.id}
                          legalEntityName={e.name}
                          profile={profile}
                          canEdit={canEditDealerLegalEntities(profile, row)}
                          entityArchived={true}
                          seedContact={{
                            fullName: e.primaryContact,
                            phone: e.phone,
                            email: e.email,
                          }}
                          resolveServerLegalEntityId={() => resolveLegalEntityServerId(e)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <AlertDialog open={archiveTarget != null} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent data-testid="dialog-legal-entity-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать юрлицо?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Юрлицо будет перемещено в архив и скрыто из рабочего списка. Данные сохраняются, юрлицо можно восстановить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-legal-entity-delete-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction data-testid="button-legal-entity-delete-confirm" onClick={() => void confirmArchive()}>
              В архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
