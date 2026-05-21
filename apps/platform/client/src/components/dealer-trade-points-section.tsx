import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import { AddressSuggestInput } from "@/components/address-suggest-input";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  addManualTradePoint,
  canEditDealerTradePoints,
  DEALER_TRADE_POINTS_EVENT,
  getEffectiveDealerTradePoints,
  getManualTradePoints,
  getMergedDealerTradePoints,
  isVirtualDefaultTradePointId,
} from "@/lib/dealer-trade-points-overrides";
import { getShowcaseTasksForDealerDisplay, loadShowcaseStorage, userLabelFromProfile } from "@/lib/showcase-distribution-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { mergeTradePointsActiveForActualization, mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import { mergeActualizationState } from "@/lib/client-base-actualization-state";
import { generateStableManualTradePointId, nextManualTradePointInternalCode, isManualActualizationTradePointId, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import {
  canArchiveTradePointDuringActualization,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { CLIENT_BASE_ACTUALIZATION_CLEAN_MODE } from "@/lib/client-base-actualization-config";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  row: DealerRow;
  /** Для навигации по карточке дилера (IntersectionObserver). */
  sectionDomId?: string;
  profile: ReleaseDemoProfile;
};

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function tradePointContact(tp: DealerTradePoint, dealer: DealerRow, mergedActiveCount: number): string {
  const name = tp.contactName?.trim();
  const phone = tp.contactPhone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  if (phone && isFilled(phone)) return phone;
  if (name && isFilled(name)) return name;
  if (mergedActiveCount === 1 && isFilled(dealer.contacts.phone)) return dealer.contacts.phone.trim();
  return "";
}

function openShowcaseTasksCount(dealer: DealerRow, mergedActiveCount: number): number | undefined {
  if (mergedActiveCount !== 1) return undefined;
  const storage = loadShowcaseStorage();
  const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
  return tasks.filter((t) => t.status !== "done").length;
}

/** Подписи кнопки архивации: ручная ТТ — «удалить», релизная — «в архив». */
function tradePointArchiveActionLabels(isManual: boolean): { action: string; confirm: string } {
  return isManual
    ? { action: "Удалить ТТ", confirm: "Удалить ТТ" }
    : { action: "В архив", confirm: "В архив" };
}

export function DealerTradePointsSection({ row, sectionDomId, profile }: Props) {
  const actx = useClientBaseActualization();
  const useAct = actx.enabled && canEditDealerDuringActualization(profile, row);
  const hideSyntheticTpChrome = actx.enabled && CLIENT_BASE_ACTUALIZATION_CLEAN_MODE;
  const canEdit = canEditDealerTradePoints(profile, row);
  const [tpBump, setTpBump] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addFormat, setAddFormat] = useState("Розница / салон");
  const [addContactName, setAddContactName] = useState("");
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addComment, setAddComment] = useState("");
  const [addError, setAddError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editFormat, setEditFormat] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editComment, setEditComment] = useState("");
  const [selectedBulkArchiveTpIds, setSelectedBulkArchiveTpIds] = useState<Set<string>>(() => new Set());
  const [bulkArchiveTpDialogOpen, setBulkArchiveTpDialogOpen] = useState(false);
  const [bulkArchiveTpBusy, setBulkArchiveTpBusy] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{
    tp: DealerTradePoint;
    isManual: boolean;
  } | null>(null);
  const [singleDeleteBusy, setSingleDeleteBusy] = useState(false);
  const addTpSave = useSectionSaveFeedback();
  const editTpSave = useSectionSaveFeedback();

  useEffect(() => {
    const fn = () => setTpBump((n) => n + 1);
    window.addEventListener(DEALER_TRADE_POINTS_EVENT, fn);
    return () => window.removeEventListener(DEALER_TRADE_POINTS_EVENT, fn);
  }, []);

  useEffect(() => {
    if (useAct) setTpBump((n) => n + 1);
  }, [useAct, actx.state]);

  const rawMergedActive = useMemo(() => getMergedDealerTradePoints(row, { includeArchived: false }), [row, tpBump]);
  const mergedActive = useMemo(() => {
    if (useAct) return mergeTradePointsActiveForActualization(row, actx.state);
    return getEffectiveDealerTradePoints(row, { includeArchived: false });
  }, [useAct, actx.state, row, tpBump]);
  const mergedArchived = useMemo(() => {
    if (useAct) return mergeTradePointsForActualization(row, actx.state).filter((m) => m.isArchived);
    return getMergedDealerTradePoints(row, { includeArchived: true }).filter((m) => m.isArchived);
  }, [useAct, actx.state, row, tpBump]);
  const mergedArchivedCount = useMemo(() => {
    if (useAct) return mergeTradePointsForActualization(row, actx.state).filter((m) => m.isArchived).length;
    return getMergedDealerTradePoints(row, { includeArchived: true }).filter((m) => m.isArchived).length;
  }, [useAct, actx.state, row, tpBump]);
  const archivedCount = mergedArchivedCount;
  const archivedList = mergedArchived;
  const hasSeeds = row.tradePoints.length > 0;
  const hasManualStored = getManualTradePoints(row.id).length > 0;
  const hasAnyTradePointEver = useMemo(() => {
    if (useAct) {
      return mergeTradePointsForActualization(row, actx.state).some((m) => !isVirtualDefaultTradePointId(row.id, m.point.id));
    }
    return hasSeeds || hasManualStored;
  }, [useAct, actx.state, row, hasSeeds, hasManualStored]);
  const isUsingVirtualDefault = useMemo(() => {
    if (useAct) {
      const a = mergeTradePointsActiveForActualization(row, actx.state);
      return a.length === 1 && isVirtualDefaultTradePointId(row.id, a[0].point.id);
    }
    return rawMergedActive.length === 0;
  }, [useAct, actx.state, row, rawMergedActive.length]);

  const showcaseOpen = useMemo(() => {
    if (hideSyntheticTpChrome) return undefined;
    return openShowcaseTasksCount(row, mergedActive.length);
  }, [hideSyntheticTpChrome, row, mergedActive.length, tpBump]);

  const resetAddForm = useCallback(() => {
    setAddName("");
    setAddCity("");
    setAddAddress("");
    setAddFormat("Розница / салон");
    setAddContactName("");
    setAddContactPhone("");
    setAddComment("");
    setAddError("");
  }, []);

  const prevAddOpenRef = useRef(false);
  const draftTpIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (addOpen && !prevAddOpenRef.current) {
      draftTpIdRef.current = generateStableManualTradePointId(row.id);
    }
    if (!addOpen) {
      draftTpIdRef.current = null;
    }
    prevAddOpenRef.current = addOpen;
  }, [addOpen, row.id]);

  const onAddSave = useCallback(async (): Promise<boolean> => {
    setAddError("");
    if (useAct) {
      if (!addName.trim() || !addCity.trim() || !addAddress.trim() || !addContactName.trim() || !addContactPhone.trim()) {
        setAddError("Заполните название, город, адрес, контактное лицо и телефон.");
        return false;
      }
      const id = draftTpIdRef.current ?? generateStableManualTradePointId(row.id);
      draftTpIdRef.current = id;
      const now = new Date().toISOString();
      const r = await actx.persist((prev) => {
        const existing = prev.manuallyCreatedTradePointsById[id];
        const internalCode = nextManualTradePointInternalCode(prev);
        const rec = {
          id,
          dealerId: row.id,
          internalCode,
          fields: {
            name: addName.trim(),
            city: addCity.trim(),
            address: addAddress.trim(),
            format: addFormat.trim(),
            contactName: addContactName.trim(),
            contactPhone: addContactPhone.trim(),
            comment: addComment.trim(),
          },
          createdAt: existing?.createdAt ?? now,
          createdBy: existing?.createdBy ?? profile.personaUserId,
          createdByName: existing?.createdByName ?? userLabelFromProfile(profile),
          source: "manual_actualization" as const,
        };
        return mergeActualizationState(prev, {
          manuallyCreatedTradePointsById: { ...prev.manuallyCreatedTradePointsById, [id]: rec },
        });
      });
      if (r.success) {
        setAddOpen(false);
        resetAddForm();
        return true;
      } else {
        const extra =
          r.syncStatus === "local_fallback" || r.storageMode === "local_fallback"
            ? " Данные могли сохраниться только на этом устройстве."
            : "";
        toast({
          title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
          description: extra.trim() || undefined,
          variant: "destructive",
        });
        return false;
      }
    }
    const id = addManualTradePoint(
      row.id,
      {
        name: addName,
        city: addCity,
        address: addAddress,
        contactName: addContactName,
        contactPhone: addContactPhone,
        comment: addComment,
      },
      profile,
    );
    if (!id) {
      setAddError("Заполните название, город, адрес, контактное лицо и телефон.");
      return false;
    }
    setTpBump((n) => n + 1);
    setAddOpen(false);
    resetAddForm();
    return true;
  }, [
    useAct,
    actx,
    addName,
    addCity,
    addAddress,
    addFormat,
    addContactName,
    addContactPhone,
    addComment,
    profile,
    row.id,
    resetAddForm,
    useAct,
    actx,
  ]);

  const openEdit = useCallback(
    (tp: DealerTradePoint) => {
      setEditId(tp.id);
      setEditName(tp.name);
      setEditCity(tp.city);
      setEditAddress(tp.address);
      setEditFormat(tp.format);
      setEditContactName(tp.contactName ?? "");
      setEditContactPhone(tp.contactPhone ?? "");
      setEditComment(tp.tpComment ?? "");
      editTpSave.markDirty();
      setEditOpen(true);
    },
    [],
  );

  const onEditSave = useCallback(async (): Promise<boolean> => {
    if (!useAct || !editId) return false;
    if (!editName.trim() || !editCity.trim() || !editAddress.trim()) {
      toast({ title: "Заполните название, город и адрес", variant: "destructive" });
      return false;
    }
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      name: editName.trim(),
      city: editCity.trim(),
      address: editAddress.trim(),
      format: editFormat.trim(),
      contactName: editContactName.trim(),
      contactPhone: editContactPhone.trim(),
      comment: editComment.trim(),
    };
    const ov = {
      tradePointId: editId,
      dealerId: row.id,
      fields,
      updatedAt: now,
      updatedBy: profile.personaUserId,
      updatedByName: userLabelFromProfile(profile),
      source: "manual_actualization" as const,
    };
    const r = await actx.persist((prev) => {
      let next = mergeActualizationState(prev, {
        tradePointOverridesById: { ...prev.tradePointOverridesById, [editId]: ov },
      });
      const manual = next.manuallyCreatedTradePointsById[editId];
      if (manual && manual.dealerId === row.id && isManualActualizationTradePointId(editId)) {
        const ic = (manual.internalCode ?? "").trim();
        if (!/^TND-TP-\d{6}$/i.test(ic)) {
          const code = nextManualTradePointInternalCode(next);
          next = mergeActualizationState(next, {
            manuallyCreatedTradePointsById: {
              ...next.manuallyCreatedTradePointsById,
              [editId]: { ...manual, internalCode: code },
            },
          });
        }
      }
      return next;
    });
    if (r.success) {
      setEditOpen(false);
      setEditId(null);
      return true;
    }
    toast({
      title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
      variant: "destructive",
    });
    return false;
  }, [useAct, editId, editName, editCity, editAddress, editFormat, editContactName, editContactPhone, editComment, actx, row.id, profile]);

  const onArchive = useCallback(
    async (tp: DealerTradePoint): Promise<boolean> => {
      if (!useAct || !canArchiveTradePointDuringActualization(profile, row, tp)) return false;
      const now = new Date().toISOString();
      const info = {
        tradePointId: tp.id,
        dealerId: row.id,
        archivedAt: now,
        archivedBy: profile.personaUserId,
        archivedByName: userLabelFromProfile(profile),
        source: "manual_actualization" as const,
      };
      const r = await actx.persist((prev) =>
        mergeActualizationState(prev, {
          archivedTradePointsById: { ...prev.archivedTradePointsById, [tp.id]: info },
        }),
      );
      if (r.success) toast({ title: "Точка архивирована" });
      else
        toast({
          title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
          variant: "destructive",
        });
      return r.success;
    },
    [useAct, actx, row.id, profile],
  );

  const confirmSingleArchiveTradePoint = useCallback(async () => {
    if (!singleDeleteTarget) return;
    setSingleDeleteBusy(true);
    const ok = await onArchive(singleDeleteTarget.tp);
    setSingleDeleteBusy(false);
    if (ok) setSingleDeleteTarget(null);
  }, [singleDeleteTarget, onArchive]);

  const onRestoreTradePoint = useCallback(
    async (tp: DealerTradePoint) => {
      if (!useAct) return;
      const r = await actx.persist((prev) => {
        const { [tp.id]: _removed, ...rest } = prev.archivedTradePointsById;
        return mergeActualizationState(prev, { archivedTradePointsById: rest });
      });
      if (r.success) toast({ title: "Точка восстановлена" });
      else
        toast({
          title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
          variant: "destructive",
        });
    },
    [useAct, actx],
  );

  const listToShow = showArchived ? archivedList : mergedActive;
  const hasArchived = archivedCount > 0;
  void hasAnyTradePointEver;

  const tpListLimit = useMemo(() => {
    if (expanded || listToShow.length <= 3) return listToShow.length;
    return Math.min(3, listToShow.length);
  }, [expanded, listToShow]);

  const tpListSlice = useMemo(() => listToShow.slice(0, tpListLimit), [listToShow, tpListLimit]);

  const archivableTradePointIdsFull = useMemo(() => {
    if (!useAct || !canEdit || showArchived) return new Set<string>();
    const s = new Set<string>();
    for (const entry of mergedActive) {
      const tp = entry.point;
      if (isVirtualDefaultTradePointId(row.id, tp.id)) continue;
      if (!canArchiveTradePointDuringActualization(profile, row, tp)) continue;
      s.add(tp.id);
    }
    return s;
  }, [useAct, canEdit, showArchived, mergedActive, profile, row]);

  const archivableTradePointIdsInSlice = useMemo(() => {
    const s = new Set<string>();
    for (const entry of tpListSlice) {
      if (archivableTradePointIdsFull.has(entry.point.id)) s.add(entry.point.id);
    }
    return s;
  }, [tpListSlice, archivableTradePointIdsFull]);

  useEffect(() => {
    setSelectedBulkArchiveTpIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (archivableTradePointIdsFull.has(id)) n.add(id);
        else changed = true;
      });
      if (!changed && n.size === prev.size) return prev;
      return n;
    });
  }, [archivableTradePointIdsFull]);

  const toggleBulkArchiveTp = useCallback((tradePointId: string, checked: boolean) => {
    setSelectedBulkArchiveTpIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tradePointId);
      else next.delete(tradePointId);
      return next;
    });
  }, []);

  const allVisibleArchiveTpSelected = useMemo(() => {
    if (archivableTradePointIdsInSlice.size === 0) return false;
    for (const id of Array.from(archivableTradePointIdsInSlice)) {
      if (!selectedBulkArchiveTpIds.has(id)) return false;
    }
    return true;
  }, [archivableTradePointIdsInSlice, selectedBulkArchiveTpIds]);

  const someVisibleArchiveTpSelected = useMemo(() => {
    for (const id of Array.from(archivableTradePointIdsInSlice)) {
      if (selectedBulkArchiveTpIds.has(id)) return true;
    }
    return false;
  }, [archivableTradePointIdsInSlice, selectedBulkArchiveTpIds]);

  const bulkArchiveTpDialogCount = useMemo(() => {
    let n = 0;
    for (const id of Array.from(selectedBulkArchiveTpIds)) {
      if (archivableTradePointIdsFull.has(id)) n += 1;
    }
    return n;
  }, [selectedBulkArchiveTpIds, archivableTradePointIdsFull]);

  const confirmBulkArchiveTradePoints = useCallback(async () => {
    const ids = Array.from(selectedBulkArchiveTpIds).filter((id) => archivableTradePointIdsFull.has(id));
    if (ids.length === 0) {
      setBulkArchiveTpDialogOpen(false);
      return;
    }
    setBulkArchiveTpBusy(true);
    const now = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const r = await actx.persist((prev) => {
      const nextArch = { ...prev.archivedTradePointsById };
      for (const id of ids) {
        nextArch[id] = {
          tradePointId: id,
          dealerId: row.id,
          archivedAt: now,
          archivedBy: uid,
          archivedByName: uname,
          source: "manual_actualization" as const,
        };
      }
      return mergeActualizationState(prev, { archivedTradePointsById: nextArch });
    });
    setBulkArchiveTpBusy(false);
    if (r.success) {
      toast({ title: "Торговые точки удалены из рабочей карточки" });
      setSelectedBulkArchiveTpIds(new Set());
      setBulkArchiveTpDialogOpen(false);
    } else {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    }
  }, [selectedBulkArchiveTpIds, archivableTradePointIdsFull, actx, profile, row.id]);

  if (mergedActive.length === 0 && !showArchived && !hasAnyTradePointEver) {
    return (
      <section
        id={sectionDomId}
        data-testid="section-dealer-trade-points"
        className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-trade-point-create"
              onClick={() => {
                resetAddForm();
                addTpSave.markDirty();
                setAddOpen(true);
              }}
            >
              Добавить торговую точку
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">Торговые точки не добавлены.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-trade-point-create">
            <DialogHeader>
              <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Название ТТ</Label>
                <Input
                  value={addName}
                  onChange={(e) => {
                    setAddName(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => {
                    setAddCity(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <AddressSuggestInput
                  value={addAddress}
                  onChange={(v) => {
                    setAddAddress(v);
                    addTpSave.markDirty();
                  }}
                  disabled={!canEdit}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-trade-point-address-suggest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тип / формат</Label>
                <Input value={addFormat} onChange={(e) => {
                    setAddFormat(e.target.value);
                    addTpSave.markDirty();
                  }} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => {
                    setAddContactName(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => {
                    setAddContactPhone(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => {
                    setAddComment(e.target.value);
                    addTpSave.markDirty();
                  }}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {useAct ? (
                <SectionSaveButton
                  testId="button-trade-point-section-save-main"
                  statusTestId="text-save-status-trade-point-main"
                  phase={addTpSave.phase}
                  onSave={() => void addTpSave.runSave(onAddSave)}
                />
              ) : (
                <Button
                  type="button"
                  className="min-h-10 w-full font-semibold sm:w-auto"
                  data-testid="button-dealer-trade-point-save"
                  onClick={() => void onAddSave()}
                >
                  Сохранить
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  if (mergedActive.length === 0 && !showArchived && hasAnyTradePointEver) {
    return (
      <section id={sectionDomId} data-testid="section-dealer-trade-points" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {hasArchived ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 w-full text-xs font-semibold text-muted-foreground sm:w-auto"
                data-testid="button-dealer-trade-points-show-archived"
                onClick={() => setShowArchived(true)}
              >
                Показать архивные
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 w-full font-semibold sm:w-auto"
                data-testid="button-trade-point-create"
                onClick={() => {
                  resetAddForm();
                  setAddOpen(true);
                }}
              >
                Добавить торговую точку
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Активных торговых точек нет.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-trade-point-create">
            <DialogHeader>
              <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Название ТТ</Label>
                <Input
                  value={addName}
                  onChange={(e) => {
                    setAddName(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => {
                    setAddCity(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <AddressSuggestInput
                  value={addAddress}
                  onChange={(v) => {
                    setAddAddress(v);
                    addTpSave.markDirty();
                  }}
                  disabled={!canEdit}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-trade-point-address-suggest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тип / формат</Label>
                <Input value={addFormat} onChange={(e) => {
                    setAddFormat(e.target.value);
                    addTpSave.markDirty();
                  }} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => {
                    setAddContactName(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => {
                    setAddContactPhone(e.target.value);
                    addTpSave.markDirty();
                  }}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => {
                    setAddComment(e.target.value);
                    addTpSave.markDirty();
                  }}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {useAct ? (
                <SectionSaveButton
                  testId="button-trade-point-section-save-main"
                  statusTestId="text-save-status-trade-point-main"
                  phase={addTpSave.phase}
                  onSave={() => void addTpSave.runSave(onAddSave)}
                />
              ) : (
                <Button
                  type="button"
                  className="min-h-10 w-full font-semibold sm:w-auto"
                  data-testid="button-dealer-trade-point-save"
                  onClick={() => void onAddSave()}
                >
                  Сохранить
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section id={sectionDomId} data-testid="section-dealer-trade-points" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {hasArchived ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 w-full text-xs font-semibold text-muted-foreground sm:w-auto"
              data-testid="button-dealer-trade-points-show-archived"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Скрыть архивные" : "Показать архивные"}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-trade-point-create"
              onClick={() => {
                resetAddForm();
                addTpSave.markDirty();
                setAddOpen(true);
              }}
            >
              Добавить торговую точку
            </Button>
          ) : null}
        </div>
      </div>

      {isUsingVirtualDefault ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="text-dealer-trade-points-virtual-default-hint"
        >
          Точки не заведены отдельно — работаем как с одной основной торговой точкой.
        </p>
      ) : null}

      {useAct && canEdit && !showArchived && archivableTradePointIdsFull.size > 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="text-trade-point-bulk-selection-hint">
          Выберите одну или несколько точек, чтобы удалить их из рабочей карточки.
        </p>
      ) : null}

      {useAct &&
      canEdit &&
      !showArchived &&
      archivableTradePointIdsFull.size > 0 &&
      selectedBulkArchiveTpIds.size > 0 ? (
        <div
          className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border/60 bg-muted/15 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="panel-trade-point-bulk-actions"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-xs font-semibold text-foreground" data-testid="text-trade-point-bulk-selected-count">
              Выбрано точек: {selectedBulkArchiveTpIds.size}
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trade-point-bulk-select-all-visible"
                checked={
                  allVisibleArchiveTpSelected ? true : someVisibleArchiveTpSelected ? "indeterminate" : false
                }
                onCheckedChange={(v) => {
                  if (v === true) {
                    setSelectedBulkArchiveTpIds(new Set(archivableTradePointIdsInSlice));
                  } else {
                    setSelectedBulkArchiveTpIds(new Set());
                  }
                }}
                className="size-6 shrink-0 touch-manipulation sm:size-5"
                data-testid="checkbox-trade-point-select-all-visible"
              />
              <Label htmlFor="trade-point-bulk-select-all-visible" className="cursor-pointer text-sm text-muted-foreground">
                Все на экране
              </Label>
            </div>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs font-medium sm:w-auto"
              data-testid="button-trade-point-bulk-clear-selection"
              onClick={() => setSelectedBulkArchiveTpIds(new Set())}
            >
              Снять выбор
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full border-destructive/35 text-xs font-medium text-destructive hover:bg-destructive/[0.06] sm:w-auto"
              data-testid="button-trade-point-bulk-archive"
              onClick={() => setBulkArchiveTpDialogOpen(true)}
            >
              Удалить / в архив
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {tpListSlice.map((entry) => {
          const { point: tp, isManual, isEdited, isArchived } = entry;
          const contact = tradePointContact(tp, row, mergedActive.length);
          const showBadge = isFilled(tp.showcaseStatus);
          const isVirtual = isVirtualDefaultTradePointId(row.id, tp.id);
          const rowTestId = isVirtual ? "row-dealer-trade-point-default" : `row-dealer-trade-point-${tp.id}`;
          const openButtonTestId = isVirtual
            ? "button-dealer-open-default-trade-point"
            : `button-dealer-trade-point-open-${tp.id}`;
          const canArchiveThisTp =
            useAct && canEdit && !isVirtual && !isArchived && canArchiveTradePointDuringActualization(profile, row, tp);
          return (
            <Card
              key={tp.id}
              data-testid={rowTestId}
              className="rounded-lg border border-border/60 bg-card shadow-xs"
            >
              <CardContent className="space-y-2 p-3 sm:p-3.5">
                {showArchived && isArchived ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium"
                    data-testid={`badge-trade-point-archived-status-${tp.id}`}
                  >
                    В архиве
                  </Badge>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {archivableTradePointIdsFull.has(tp.id) ? (
                        <Checkbox
                          checked={selectedBulkArchiveTpIds.has(tp.id)}
                          onCheckedChange={(v) => toggleBulkArchiveTp(tp.id, v === true)}
                          className="size-6 shrink-0 touch-manipulation sm:size-5"
                          data-testid={`checkbox-trade-point-select-${tp.id}`}
                          aria-label={`Выбрать торговую точку ${tp.name} для архивации`}
                        />
                      ) : null}
                      <ShowcaseCoverPhotoSlot
                        kind="trade_point"
                        dealer={row}
                        tradePoint={tp}
                        profile={profile}
                        size="branch"
                        rounded="md"
                        className="shrink-0"
                      />
                      <p className="text-sm font-semibold leading-snug text-foreground">{tp.name}</p>
                      {isVirtual ? (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          data-testid="badge-dealer-trade-point-virtual-default"
                        >
                          Основная (по дилеру)
                        </Badge>
                      ) : null}
                      {isManual ? (
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-dealer-trade-point-manual-${tp.id}`}>
                          Добавлена вручную
                        </Badge>
                      ) : null}
                      {isEdited ? (
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-dealer-trade-point-edited-${tp.id}`}>
                          Изменена
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{tp.city}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-trade-point-internal-code-${tp.id}`}>
                      Код ТТ: {getTradePointDisplayCodeForActualization(tp)}
                    </p>
                    <p
                      className="flex items-start gap-1.5 text-xs leading-snug text-foreground"
                      data-testid={`text-dealer-trade-point-address-${tp.id}`}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{tp.address}</span>
                    </p>
                    {contact ? (
                      <p className="text-xs text-muted-foreground" data-testid={`text-dealer-trade-point-contact-${tp.id}`}>
                        {contact}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:max-w-[14rem] sm:items-stretch">
                    {!hideSyntheticTpChrome && showBadge ? (
                      <Badge
                        variant="outline"
                        className={cn("w-full justify-center text-[10px] font-semibold sm:w-auto")}
                        data-testid={`badge-dealer-trade-point-showcase-status-${tp.id}`}
                      >
                        Витрина: {tp.showcaseStatus}
                      </Badge>
                    ) : null}
                    {!hideSyntheticTpChrome && showcaseOpen != null && showcaseOpen > 0 ? (
                      <p className="text-center text-[11px] text-muted-foreground sm:text-right">
                        Открытых задач по витрине:{" "}
                        <span className="font-semibold tabular-nums text-foreground">{showcaseOpen}</span>
                      </p>
                    ) : null}
                    {useAct && canEdit && !isVirtual && isArchived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs font-medium sm:w-auto"
                        data-testid={`button-trade-point-restore-${tp.id}`}
                        onClick={() => void onRestoreTradePoint(tp)}
                      >
                        Восстановить ТТ
                      </Button>
                    ) : null}
                    <div className="mt-1 flex flex-col gap-1.5 border-t border-border/40 pt-2 sm:mt-0 sm:border-t-0 sm:pt-0">
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                        className={cn(
                          "h-8 w-full px-2 text-xs font-semibold",
                          hideSyntheticTpChrome && "bg-emerald-700 text-white hover:bg-emerald-800",
                        )}
                        data-testid={openButtonTestId}
                      >
                        <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>
                          {isVirtual ? "Открыть основную точку" : "Открыть точку"}
                        </Link>
                      </Button>
                      {useAct && canEdit && !isVirtual && !isArchived ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full px-2 text-xs font-medium"
                          data-testid={`button-trade-point-edit-${tp.id}`}
                          onClick={() => openEdit(tp)}
                        >
                          Редактировать
                        </Button>
                      ) : null}
                      {canArchiveThisTp ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="inline-flex h-8 w-full items-center justify-center gap-1 border-destructive/30 px-2 text-xs font-medium text-destructive hover:bg-destructive/[0.06] sm:justify-start"
                          data-testid={`button-trade-point-delete-${tp.id}`}
                          onClick={() => setSingleDeleteTarget({ tp, isManual })}
                          title={tradePointArchiveActionLabels(isManual).action}
                          aria-label={tradePointArchiveActionLabels(isManual).action}
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="max-sm:sr-only">{tradePointArchiveActionLabels(isManual).action}</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {listToShow.length > 3 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!expanded ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-show-all"
              onClick={() => setExpanded(true)}
            >
              Показать все точки
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-collapse"
              onClick={() => setExpanded(false)}
            >
              Свернуть
            </Button>
          )}
        </div>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-trade-point-create">
          <DialogHeader>
            <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Название ТТ</Label>
              <Input
                value={addName}
                onChange={(e) => {
                    setAddName(e.target.value);
                    addTpSave.markDirty();
                  }}
                className="min-h-10"
                data-testid="input-dealer-trade-point-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input
                value={addCity}
                onChange={(e) => {
                    setAddCity(e.target.value);
                    addTpSave.markDirty();
                  }}
                className="min-h-10"
                data-testid="input-dealer-trade-point-city"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <AddressSuggestInput
                value={addAddress}
                onChange={(v) => {
                    setAddAddress(v);
                    addTpSave.markDirty();
                  }}
                disabled={!canEdit}
                rows={2}
                className="[&_textarea]:min-h-[52px]"
                testId="input-dealer-trade-point-address-suggest"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип / формат</Label>
              <Input value={addFormat} onChange={(e) => {
                    setAddFormat(e.target.value);
                    addTpSave.markDirty();
                  }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <Input
                value={addContactName}
                onChange={(e) => {
                    setAddContactName(e.target.value);
                    addTpSave.markDirty();
                  }}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input
                value={addContactPhone}
                onChange={(e) => {
                    setAddContactPhone(e.target.value);
                    addTpSave.markDirty();
                  }}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                value={addComment}
                onChange={(e) => {
                    setAddComment(e.target.value);
                    addTpSave.markDirty();
                  }}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-trade-point-comment"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {useAct ? (
              <SectionSaveButton
                testId="button-trade-point-section-save-main"
                statusTestId="text-save-status-trade-point-main"
                phase={addTpSave.phase}
                onSave={() => void addTpSave.runSave(onAddSave)}
              />
            ) : (
              <Button
                type="button"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-trade-point-save"
                onClick={() => void onAddSave()}
              >
                Сохранить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto pb-24 sm:max-w-md" data-testid="dialog-trade-point-edit">
          <DialogHeader>
            <DialogTitle className="text-base">Редактирование торговой точки</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Название</Label>
              <Input value={editName} onChange={(e) => { setEditName(e.target.value); editTpSave.markDirty(); }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип / формат</Label>
              <Input value={editFormat} onChange={(e) => { setEditFormat(e.target.value); editTpSave.markDirty(); }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input value={editCity} onChange={(e) => { setEditCity(e.target.value); editTpSave.markDirty(); }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <AddressSuggestInput
                key={editId ?? "tp-edit"}
                value={editAddress}
                onChange={(v) => {
                  setEditAddress(v);
                  editTpSave.markDirty();
                }}
                disabled={!canEdit}
                rows={2}
                className="[&_textarea]:min-h-[52px]"
                testId="input-dealer-trade-point-address-suggest"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <Input value={editContactName} onChange={(e) => { setEditContactName(e.target.value); editTpSave.markDirty(); }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input value={editContactPhone} onChange={(e) => { setEditContactPhone(e.target.value); editTpSave.markDirty(); }} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea value={editComment} onChange={(e) => { setEditComment(e.target.value); editTpSave.markDirty(); }} rows={2} className="min-h-[52px]" />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border bg-background pt-3">
            <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            {useAct ? (
              <SectionSaveButton
                testId="button-trade-point-section-save-main"
                statusTestId="text-save-status-trade-point-edit"
                phase={editTpSave.phase}
                onSave={() => void editTpSave.runSave(onEditSave)}
              />
            ) : (
              <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" onClick={() => void onEditSave()}>
                Сохранить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={bulkArchiveTpDialogOpen}
        onOpenChange={(open) => {
          if (bulkArchiveTpBusy) return;
          setBulkArchiveTpDialogOpen(open);
        }}
      >
        <AlertDialogContent data-testid="dialog-trade-point-bulk-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные торговые точки?</AlertDialogTitle>
            <AlertDialogDescription>
              Торговые точки будут скрыты из рабочей карточки клиента (архив). Данные не удаляются физически, их можно
              восстановить из архива.
              <span className="mt-2 block font-medium text-foreground">Выбрано точек: {bulkArchiveTpDialogCount}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-trade-point-bulk-archive-cancel"
              >
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-trade-point-bulk-archive-confirm"
              disabled={bulkArchiveTpBusy || bulkArchiveTpDialogCount === 0}
              onClick={() => void confirmBulkArchiveTradePoints()}
            >
              {bulkArchiveTpBusy ? "Сохранение…" : "Удалить ТТ"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!singleDeleteTarget}
        onOpenChange={(open) => {
          if (singleDeleteBusy) return;
          if (!open) setSingleDeleteTarget(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-trade-point-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить торговую точку?</AlertDialogTitle>
            <AlertDialogDescription>
              Торговая точка будет скрыта из карточки клиента. Данные не удаляются физически, её можно восстановить из
              архива.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-trade-point-delete-cancel"
                disabled={singleDeleteBusy}
              >
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant={singleDeleteTarget?.isManual ? "destructive" : "outline"}
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-trade-point-delete-confirm"
              disabled={singleDeleteBusy || !singleDeleteTarget}
              onClick={() => void confirmSingleArchiveTradePoint()}
            >
              {singleDeleteBusy
                ? "Сохранение…"
                : singleDeleteTarget
                  ? tradePointArchiveActionLabels(singleDeleteTarget.isManual).confirm
                  : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
