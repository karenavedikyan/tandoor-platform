import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
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
import { TradePointPhotoBlock } from "@/components/trade-point-photo-block";
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
import { generateStableManualTradePointId } from "@/lib/client-base-actualization-stable-ids";
import {
  canArchiveTradePointDuringActualization,
  canCreateTradePointDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { toast } from "@/hooks/use-toast";

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

export function DealerTradePointsSection({ row, sectionDomId, profile }: Props) {
  const actx = useClientBaseActualization();
  const useAct = actx.enabled && canCreateTradePointDuringActualization(profile, row);
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
  const [addSaving, setAddSaving] = useState(false);
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
  const [editSaving, setEditSaving] = useState(false);

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

  const showcaseOpen = useMemo(() => openShowcaseTasksCount(row, mergedActive.length), [row, mergedActive.length, tpBump]);

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

  const onAddSave = useCallback(async () => {
    setAddError("");
    if (useAct) {
      if (addSaving) return;
      if (!addName.trim() || !addCity.trim() || !addAddress.trim() || !addContactName.trim() || !addContactPhone.trim()) {
        setAddError("Заполните название, город, адрес, контактное лицо и телефон.");
        return;
      }
      const id = draftTpIdRef.current ?? generateStableManualTradePointId(row.id);
      draftTpIdRef.current = id;
      const now = new Date().toISOString();
      setAddSaving(true);
      const r = await actx.persist((prev) => {
        const existing = prev.manuallyCreatedTradePointsById[id];
        const rec = {
          id,
          dealerId: row.id,
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
      setAddSaving(false);
      if (r.success) {
        toast({ title: "Сохранено" });
        setAddOpen(false);
        resetAddForm();
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
      }
      return;
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
      return;
    }
    setTpBump((n) => n + 1);
    setAddOpen(false);
    resetAddForm();
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
    addSaving,
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
      setEditOpen(true);
    },
    [],
  );

  const onEditSave = useCallback(async () => {
    if (!useAct || !editId) return;
    if (!editName.trim() || !editCity.trim() || !editAddress.trim()) {
      toast({ title: "Заполните название, город и адрес", variant: "destructive" });
      return;
    }
    setEditSaving(true);
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
    const r = await actx.persist((prev) =>
      mergeActualizationState(prev, {
        tradePointOverridesById: { ...prev.tradePointOverridesById, [editId]: ov },
      }),
    );
    setEditSaving(false);
    if (r.success) {
      toast({ title: "Сохранено" });
      setEditOpen(false);
      setEditId(null);
    } else {
      toast({
        title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
        variant: "destructive",
      });
    }
  }, [useAct, editId, editName, editCity, editAddress, editFormat, editContactName, editContactPhone, editComment, actx, row.id, profile]);

  const onArchive = useCallback(
    async (tp: DealerTradePoint) => {
      if (!useAct || !canArchiveTradePointDuringActualization(profile, row, tp)) return;
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
    },
    [useAct, actx, row.id, profile],
  );

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
                setAddOpen(true);
              }}
            >
              Добавить торговую точку
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">Торговые точки не указаны.</p>
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
                  onChange={(e) => setAddName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => setAddCity(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тип / формат</Label>
                <Input value={addFormat} onChange={(e) => setAddFormat(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => setAddContactName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => setAddContactPhone(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid={useAct ? "button-trade-point-create-submit" : "button-dealer-trade-point-save"}
                disabled={useAct && addSaving}
                onClick={() => void onAddSave()}
              >
                {useAct && addSaving ? "Сохранение…" : "Сохранить"}
              </Button>
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
                  onChange={(e) => setAddName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => setAddCity(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тип / формат</Label>
                <Input value={addFormat} onChange={(e) => setAddFormat(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => setAddContactName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => setAddContactPhone(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid={useAct ? "button-trade-point-create-submit" : "button-dealer-trade-point-save"}
                disabled={useAct && addSaving}
                onClick={() => void onAddSave()}
              >
                {useAct && addSaving ? "Сохранение…" : "Сохранить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  const limit = expanded || listToShow.length <= 3 ? listToShow.length : Math.min(3, listToShow.length);
  const slice = listToShow.slice(0, limit);

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

      <div className="space-y-2">
        {slice.map((entry) => {
          const { point: tp, isManual, isEdited, isArchived } = entry;
          const contact = tradePointContact(tp, row, mergedActive.length);
          const showBadge = isFilled(tp.showcaseStatus);
          const isVirtual = isVirtualDefaultTradePointId(row.id, tp.id);
          const rowTestId = isVirtual ? "row-dealer-trade-point-default" : `row-dealer-trade-point-${tp.id}`;
          const openButtonTestId = isVirtual
            ? "button-dealer-open-default-trade-point"
            : `button-dealer-trade-point-open-${tp.id}`;
          return (
            <Card
              key={tp.id}
              data-testid={rowTestId}
              className="rounded-xl border border-border/70 bg-card shadow-xs"
            >
              <CardContent className="space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
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
                    <p
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
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
                    <TradePointPhotoBlock dealerId={row.id} tradePointId={tp.id} canEdit={canEdit} className="max-w-md" />
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                    {showBadge ? (
                      <Badge
                        variant="outline"
                        className={cn("w-full justify-center text-[10px] font-semibold sm:w-auto")}
                        data-testid={`badge-dealer-trade-point-showcase-status-${tp.id}`}
                      >
                        Витрина: {tp.showcaseStatus}
                      </Badge>
                    ) : null}
                    {showcaseOpen != null && showcaseOpen > 0 ? (
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
                        className="min-h-10 w-full font-semibold sm:w-auto"
                        data-testid={`button-trade-point-restore-${tp.id}`}
                        onClick={() => void onRestoreTradePoint(tp)}
                      >
                        Восстановить ТТ
                      </Button>
                    ) : null}
                    {useAct && canEdit && !isVirtual && !isArchived ? (
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10 w-full font-semibold sm:w-auto"
                          data-testid={`button-trade-point-edit-${tp.id}`}
                          onClick={() => openEdit(tp)}
                        >
                          Редактировать
                        </Button>
                        {canArchiveTradePointDuringActualization(profile, row, tp) ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="min-h-10 w-full font-semibold sm:w-auto"
                            data-testid={`button-trade-point-archive-${tp.id}`}
                            onClick={() => void onArchive(tp)}
                          >
                            Архивировать ТТ
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="min-h-10 w-full font-semibold sm:w-auto"
                      data-testid={openButtonTestId}
                    >
                      <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>
                        {isVirtual ? "Открыть основную точку" : "Открыть точку"}
                      </Link>
                    </Button>
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
                onChange={(e) => setAddName(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input
                value={addCity}
                onChange={(e) => setAddCity(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-city"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <Textarea
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-trade-point-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип / формат</Label>
              <Input value={addFormat} onChange={(e) => setAddFormat(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <Input
                value={addContactName}
                onChange={(e) => setAddContactName(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input
                value={addContactPhone}
                onChange={(e) => setAddContactPhone(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                value={addComment}
                onChange={(e) => setAddComment(e.target.value)}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-trade-point-comment"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid={useAct ? "button-trade-point-create-submit" : "button-dealer-trade-point-save"}
              disabled={useAct && addSaving}
              onClick={() => void onAddSave()}
            >
              {useAct && addSaving ? "Сохранение…" : "Сохранить"}
            </Button>
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
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип / формат</Label>
              <Input value={editFormat} onChange={(e) => setEditFormat(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <Textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} className="min-h-[52px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={2} className="min-h-[52px]" />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border bg-background pt-3">
            <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="min-h-10 w-full font-semibold sm:w-auto"
              disabled={editSaving}
              onClick={() => void onEditSave()}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
