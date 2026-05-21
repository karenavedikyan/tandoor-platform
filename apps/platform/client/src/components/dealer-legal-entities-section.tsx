import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  addDealerLegalEntity,
  archiveDealerLegalEntity,
  allocateNextLegalEntityCodeLocal,
  canEditDealerLegalEntities,
  DEALER_LEGAL_ENTITIES_EVENT,
  getMergedDealerLegalEntities,
  type DealerLegalEntityStatus,
  updateDealerLegalEntity,
} from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { LegalEntityContactsSubsection } from "@/components/legal-entity-contacts-subsection";
import { buildLegalEntityNameSuggestions, lookupLegalEntityByInn } from "@/lib/legal-entity-directory";
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

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
  /** Родитель (Accordion) уже показывает заголовок «Юридические лица» — скрыть дублирующий h3. */
  embedInAccordion?: boolean;
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

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function normalizeInn(v: string): string {
  return v.replace(/\s+/g, "").trim();
}

function entityTypeLabel(v: string | undefined): string {
  const t = (v ?? "").trim() as EntityTypeValue;
  return ENTITY_TYPE_LABELS[t] ?? (t ? t : "—");
}

export function DealerLegalEntitiesSection({ row, profile, actorUserId, actorLabel, embedInAccordion = false }: Props) {
  const actx = useClientBaseActualization();
  const useAct = actx.enabled && canManageLegalEntitiesDuringActualization(profile, row);
  /** В актуализации — зона как у карточки; без актуализации — прежний LS-режим. */
  const canMutate = useMemo(() => {
    if (actx.enabled) {
      return canActualizeClientBase(profile) && canEditDealerDuringActualization(profile, row);
    }
    return canEditDealerLegalEntities(profile, row);
  }, [actx.enabled, profile, row]);

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
  const [draftPrimaryContact, setDraftPrimaryContact] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftComment, setDraftComment] = useState("");
  const [innLookupResults, setInnLookupResults] = useState<
    { id: string; name: string; inn: string; kpp?: string; legalAddress?: string; source: string }[]
  >([]);
  const [innLookupNote, setInnLookupNote] = useState("");

  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [innDupModal, setInnDupModal] = useState<{ inn: string; existingId: string; existingName: string } | null>(null);

  const legalFormSave = useSectionSaveFeedback();

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
    return () => window.removeEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
  }, []);

  useEffect(() => {
    if (useAct) setTick((n) => n + 1);
  }, [useAct, actx.state]);

  const merged = useMemo(() => {
    if (useAct) return mergeLegalEntitiesForActualization(row, actx.state);
    return getMergedDealerLegalEntities(row);
  }, [row, tick, useAct, actx.state]);

  const nameSuggestions = useMemo(() => buildLegalEntityNameSuggestions(draftName, row.id), [draftName, row.id, tick]);

  const visible = useMemo(() => {
    const active = merged.filter((e) => e.status !== "archived");
    const arch = merged.filter((e) => e.status === "archived");
    return { active, arch };
  }, [merged]);

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

  const resetDraft = useCallback(() => {
    setDraftName("");
    setDraftInn("");
    setDraftEntityType("ooo");
    setDraftKpp("");
    setDraftOgrn("");
    setDraftAddress("");
    setDraftActualAddress("");
    setDraftPrimaryContact("");
    setDraftPhone("");
    setDraftEmail("");
    setDraftComment("");
    setInnLookupResults([]);
    setInnLookupNote("");
    newEntityIdRef.current = null;
    legalFormSave.markDirty();
  }, [legalFormSave]);

  const openAddDialog = useCallback(() => {
    resetDraft();
    newEntityIdRef.current = generateManualLegalEntityStableId();
    setEditingId(null);
    setFormOpen(true);
    legalFormSave.markDirty();
  }, [resetDraft, legalFormSave]);

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
      setDraftPrimaryContact(e.primaryContact ?? "");
      setDraftPhone(e.phone ?? "");
      setDraftEmail(e.email ?? "");
      setDraftComment(e.comment ?? "");
      setEditingId(id);
      newEntityIdRef.current = null;
      setFormOpen(true);
      legalFormSave.markDirty();
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
        setInnDupModal({ inn: normalizeInn(draftInn), existingId: dup.id, existingName: dup.name });
        return false;
      }
    }
    skipInnDupOnceRef.current = false;

    const now = new Date().toISOString();
    const prevEntitySnap = merged.find((x) => x.id === targetId);

    if (useAct) {
      const r = await actx.persist((prev) => {
        const cur = prev.legalEntityOverridesByDealerId[row.id] ?? {
          createdById: actorUserId,
          overridesById: {},
          archivedById: {},
        };
        const existingInternal = (prevEntitySnap?.internalCode ?? "").trim();
        const internalCode = existingInternal || allocateNextLegalEntityDisplayCode(prev);

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
          primaryContact: draftPrimaryContact.trim(),
          phone: draftPhone.trim(),
          email: draftEmail.trim(),
          comment: draftComment.trim(),
          internalCode,
          status: statusResolved,
          updatedAt: now,
          updatedBy: actorUserId,
          updatedByName: actorLabel,
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
        setTick((n) => n + 1);
        setEditingId(null);
        newEntityIdRef.current = null;
        setFormOpen(false);
        resetDraft();
        return true;
      }
      toast({
        title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
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
          primaryContact: draftPrimaryContact,
          phone: draftPhone,
          email: draftEmail,
          status: "additional",
          comment: draftComment,
        },
        actorUserId,
        actorLabel,
      );
    } else {
      addDealerLegalEntity(row.id, {
        name: draftName,
        inn: draftInn,
        kpp: draftKpp,
        ogrn: draftOgrn,
        legalAddress: draftAddress,
        actualAddress: draftActualAddress,
        entityType: draftEntityType,
        primaryContact: draftPrimaryContact,
        phone: draftPhone,
        email: draftEmail,
        internalCode: allocateNextLegalEntityCodeLocal(),
        status: "additional",
        comment: draftComment,
        updatedBy: actorUserId,
        updatedByName: actorLabel,
      });
    }
    setTick((n) => n + 1);
    setEditingId(null);
    newEntityIdRef.current = null;
    setFormOpen(false);
    resetDraft();
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
    draftPrimaryContact,
    draftPhone,
    draftEmail,
    draftComment,
    editingId,
    row.id,
    actorUserId,
    actorLabel,
    resetDraft,
    merged,
    findInnDuplicate,
    merged,
  ]);

  const onCancelForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    newEntityIdRef.current = null;
    resetDraft();
  }, [resetDraft]);

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget || !canMutate) return;
    const eid = archiveTarget.id;
    if (useAct) {
      const r = await actx.persist((prev) =>
        mergeActualizationState(prev, {
          archivedLegalEntitiesById: {
            ...prev.archivedLegalEntitiesById,
            [eid]: buildArchivedLegalEntityInfo({
              legalEntityId: eid,
              dealerId: row.id,
              archivedBy: actorUserId,
              archivedByName: actorLabel,
              source: "manual_actualization",
            }),
          },
        }),
      );
      if (r.success) {
        toast({ title: "Юрлицо скрыто из рабочей карточки" });
        setTick((n) => n + 1);
      } else {
        toast({ title: "Не удалось сохранить", variant: "destructive" });
      }
    } else {
      archiveDealerLegalEntity(row.id, eid, actorUserId, actorLabel);
      setTick((n) => n + 1);
      toast({ title: "В архиве" });
    }
    setArchiveTarget(null);
  }, [archiveTarget, canMutate, useAct, actx, row.id, actorUserId, actorLabel]);

  const onRestore = useCallback(
    async (legalEntityId: string) => {
      if (!useAct || !canMutate) return;
      const r = await actx.persist((prev) => restoreLegalEntityFromArchive(prev, row.id, legalEntityId));
      if (r.success) {
        toast({ title: "Юрлицо восстановлено в рабочем списке" });
        setTick((n) => n + 1);
      } else {
        toast({ title: "Не удалось сохранить", variant: "destructive" });
      }
    },
    [useAct, canMutate, actx, row.id],
  );

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
                setFormOpen(false);
                onCancelForm();
              } else {
                openAddDialog();
              }
            }}
          >
            {formOpen && !editingId ? "Закрыть форму" : "Добавить юрлицо"}
          </Button>
        ) : null}
      </div>

      <Dialog open={formOpen} onOpenChange={(o) => !o && onCancelForm()}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg" data-testid="dialog-legal-entity-form">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактирование юрлица" : "Новое юрлицо"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editingId ? (
              <p className="text-xs text-muted-foreground">
                Код юрлица:{" "}
                <span className="font-mono font-medium text-foreground" data-testid={`text-legal-entity-code-${editingId}`}>
                  {(merged.find((x) => x.id === editingId)?.internalCode ?? "—").trim() || "—"}
                </span>
              </p>
            ) : newEntityIdRef.current ? (
              <p className="text-xs text-muted-foreground">
                После сохранения будет назначен код вида <span className="font-mono">TND-LE-······</span>
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Название юрлица / ИП <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  legalFormSave.markDirty();
                }}
                disabled={!canMutate}
                className="min-h-10"
                data-testid="input-legal-entity-name"
              />
              {nameSuggestions.length > 0 && canMutate ? (
                <div
                  className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2"
                  data-testid="section-legal-entity-suggestions"
                >
                  {nameSuggestions.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-2 rounded border border-transparent px-1 py-0.5 hover:bg-card">
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
                          if (s.legalAddress) setDraftAddress(s.legalAddress);
                          legalFormSave.markDirty();
                        }}
                      >
                        Применить
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Тип <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={draftEntityType}
                  onValueChange={(v) => {
                    setDraftEntityType(v as EntityTypeValue);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                >
                  <SelectTrigger className="min-h-10" data-testid="select-legal-entity-type">
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
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">
                  ИНН <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={draftInn}
                    onChange={(e) => {
                      setDraftInn(e.target.value);
                      setInnLookupResults([]);
                      setInnLookupNote("");
                      legalFormSave.markDirty();
                    }}
                    disabled={!canMutate}
                    className="min-h-10 sm:flex-1"
                    data-testid="input-legal-entity-inn"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 shrink-0 text-xs"
                    disabled={!canMutate}
                    data-testid="button-legal-entity-inn-lookup"
                    onClick={() => {
                      const res = lookupLegalEntityByInn(draftInn);
                      if (!res.ok) {
                        toast({ title: "ИНН", description: res.error, variant: "destructive" });
                        setInnLookupResults([]);
                        setInnLookupNote("");
                        return;
                      }
                      setInnLookupResults(res.results);
                      setInnLookupNote(
                        res.results.length === 0
                          ? "По локальной базе данные не найдены. Для автозаполнения из внешних источников нужно подключить сервис проверки ИНН."
                          : "",
                      );
                    }}
                  >
                    Найти по ИНН
                  </Button>
                </div>
                {innLookupNote ? <p className="text-[11px] leading-snug text-muted-foreground">{innLookupNote}</p> : null}
                {innLookupResults.length > 0 ? (
                  <div className="space-y-1 rounded-md border border-border/70 bg-muted/15 p-2" data-testid="section-legal-entity-inn-results">
                    {innLookupResults.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded px-1 py-1" data-testid={`row-legal-entity-inn-result-${r.id}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.source}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-[10px]"
                          data-testid={`button-legal-entity-inn-result-apply-${r.id}`}
                          onClick={() => {
                            setDraftName((prev) => (prev.trim() ? prev : r.name));
                            setDraftInn(r.inn);
                            setDraftKpp((k) => (k.trim() ? k : r.kpp ?? ""));
                            setDraftAddress((a) => (a.trim() ? a : r.legalAddress ?? ""));
                            legalFormSave.markDirty();
                          }}
                        >
                          Применить
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">КПП</Label>
                <Input
                  value={draftKpp}
                  onChange={(e) => {
                    setDraftKpp(e.target.value);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                  className="min-h-10"
                  data-testid="input-legal-entity-kpp"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ОГРН / ОГРНИП</Label>
                <Input
                  value={draftOgrn}
                  onChange={(e) => {
                    setDraftOgrn(e.target.value);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                  className="min-h-10"
                  data-testid="input-legal-entity-ogrn"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Юридический адрес</Label>
              <Textarea
                value={draftAddress}
                onChange={(e) => {
                  setDraftAddress(e.target.value);
                  legalFormSave.markDirty();
                }}
                disabled={!canMutate}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="input-legal-entity-legal-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Фактический адрес</Label>
              <Textarea
                value={draftActualAddress}
                onChange={(e) => {
                  setDraftActualAddress(e.target.value);
                  legalFormSave.markDirty();
                }}
                disabled={!canMutate}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="input-legal-entity-actual-address"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Основной контакт</Label>
                <Input
                  value={draftPrimaryContact}
                  onChange={(e) => {
                    setDraftPrimaryContact(e.target.value);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                  className="min-h-10"
                  data-testid="input-legal-entity-contact"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={draftPhone}
                  onChange={(e) => {
                    setDraftPhone(e.target.value);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                  className="min-h-10"
                  data-testid="input-legal-entity-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={draftEmail}
                  onChange={(e) => {
                    setDraftEmail(e.target.value);
                    legalFormSave.markDirty();
                  }}
                  disabled={!canMutate}
                  className="min-h-10"
                  data-testid="input-legal-entity-email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                value={draftComment}
                onChange={(e) => {
                  setDraftComment(e.target.value);
                  legalFormSave.markDirty();
                }}
                disabled={!canMutate}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-legal-entity-comment"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {canMutate ? (
              <>
                {useAct ? (
                  <SectionSaveButton
                    testId="button-legal-entity-save"
                    statusTestId="text-save-status-legal-entities"
                    phase={legalFormSave.phase}
                    disabled={!draftName.trim() || !normalizeInn(draftInn)}
                    onSave={() => void legalFormSave.runSave(onSave)}
                  />
                ) : (
                  <Button
                    type="button"
                    className="min-h-9 font-semibold"
                    data-testid="button-legal-entity-save"
                    disabled={!draftName.trim() || !normalizeInn(draftInn)}
                    onClick={() => void onSave()}
                  >
                    Сохранить
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={onCancelForm}>
                  Отмена
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {visible.active.length === 0 && visible.arch.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-legal-entities-empty-state">
          Юридические лица не добавлены.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.active.map((e) => (
            <Card
              key={e.id}
              data-testid={`card-legal-entity-${e.id}`}
              className="overflow-hidden rounded-lg border border-border/70 bg-muted/10 shadow-xs"
            >
              <CardContent className="space-y-2 p-3 pt-3 sm:p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug text-foreground">{e.name}</p>
                      {e.isPassportSeed ? (
                        <Badge variant="outline" className="text-[10px]">
                          Из данных релиза
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="text-[10px]">
                        {entityTypeLabel(e.entityType)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {STATUS_LABELS[e.status]}
                      </Badge>
                    </div>
                    {isFilled(e.internalCode) ? (
                      <p className="text-xs text-muted-foreground">
                        Код юрлица:{" "}
                        <span className="font-mono font-medium text-foreground" data-testid={`text-legal-entity-code-${e.id}`}>
                          {e.internalCode}
                        </span>
                      </p>
                    ) : null}
                    {isFilled(e.inn) ? (
                      <p className="text-xs text-muted-foreground">
                        ИНН {e.inn}
                        {isFilled(e.kpp) ? ` · КПП ${e.kpp}` : ""}
                      </p>
                    ) : isFilled(e.kpp) ? (
                      <p className="text-xs text-muted-foreground">КПП {e.kpp}</p>
                    ) : null}
                    {isFilled(e.ogrn) ? <p className="text-xs text-muted-foreground">ОГРН {e.ogrn}</p> : null}
                    {isFilled(e.primaryContact) || isFilled(e.phone) || isFilled(e.email) ? (
                      <p className="text-xs text-muted-foreground">
                        {isFilled(e.primaryContact) ? <span>Контакт: {e.primaryContact}. </span> : null}
                        {isFilled(e.phone) ? <span>Тел.: {e.phone}. </span> : null}
                        {isFilled(e.email) ? <span>{e.email}</span> : null}
                      </p>
                    ) : null}
                    {isFilled(e.actualAddress) ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">Факт. адрес: {e.actualAddress}</p>
                    ) : null}
                    {isFilled(e.legalAddress) ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">Юр. адрес: {e.legalAddress}</p>
                    ) : null}
                    {isFilled(e.comment) ? <p className="text-xs text-foreground">{e.comment}</p> : null}
                    <LegalEntityContactsSubsection
                      row={row}
                      legalEntityId={e.id}
                      legalEntityName={e.name}
                      profile={profile}
                      canEdit={canEditDealerLegalEntities(profile, row)}
                      entityArchived={false}
                    />
                  </div>
                  {canMutate && (!e.isPassportSeed || useAct) ? (
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
                          variant="secondary"
                          size="sm"
                          className="min-h-9 px-2 text-xs font-semibold"
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
          ))}

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
                        {canMutate && useAct ? (
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
                        {canMutate && !useAct && !e.isPassportSeed ? (
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
            <AlertDialogTitle>Скрыть юрлицо из карточки?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Юрлицо будет скрыто из рабочей карточки клиента. Данные не удаляются физически и могут быть восстановлены позднее.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-legal-entity-delete-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction data-testid="button-legal-entity-delete-confirm" onClick={() => void confirmArchive()}>
              Скрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={innDupModal != null} onOpenChange={(o) => !o && setInnDupModal(null)}>
        <AlertDialogContent data-testid="dialog-legal-entity-inn-duplicate">
          <AlertDialogHeader>
            <AlertDialogTitle>ИНН уже используется</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              У этого клиента уже есть активное юрлицо с ИНН {innDupModal?.inn}: «{innDupModal?.existingName}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (!innDupModal) return;
                const id = innDupModal.existingId;
                setInnDupModal(null);
                loadEntityIntoDraft(id);
              }}
            >
              Открыть существующее
            </Button>
            <Button
              type="button"
              variant="default"
              className="w-full sm:w-auto"
              onClick={() => {
                skipInnDupOnceRef.current = true;
                setInnDupModal(null);
                void legalFormSave.runSave(onSave);
              }}
            >
              Всё равно создать
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
