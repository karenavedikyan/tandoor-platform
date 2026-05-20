/**
 * Диалоги актуализации: редактирование и создание клиента (сохранение в ActualizationState + API).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DealerRow, DealerStatus } from "@/lib/dealer-base-mock-data";
import { DEALER_SHIPMENT_DAY_LABELS, DEALER_SHIPMENT_DAY_ORDER, type DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { getDealerUnloadingOrder } from "@/lib/dealer-unloading-order-storage";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { getAllSalesManagers, getSalesUserById, getTeamManagers, type SalesUser } from "@/lib/sales-control-data";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { toast } from "@/hooks/use-toast";
import { getClientCategoryOptions } from "@/lib/client-category";
import type { ClientCategoryId } from "@/lib/client-category";
import {
  findInnDuplicateInActualization,
  findNameCityDuplicateInActualization,
  generateStableManualDealerId,
  nextManualDealerInternalCode,
  isManualActualizationDealerId,
} from "@/lib/client-base-actualization-stable-ids";
import {
  mergeActualizationState,
  type DealerActualizationOverride,
  type DealerActualizationContact,
  type ManualDealer,
} from "@/lib/client-base-actualization-state";
import { newActualizationContactId } from "@/lib/client-base-actualization-contacts-helpers";

function isoNow(): string {
  return new Date().toISOString();
}

export type DealerActualizationEditDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseRow: DealerRow;
  profile: ReleaseDemoProfile;
};

export function DealerActualizationEditDialog(props: DealerActualizationEditDialogProps): ReactElement {
  const { open, onOpenChange, baseRow, profile } = props;
  const { persist, state } = useClientBaseActualization();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manager, setManager] = useState("");
  const [regionalManager, setRegionalManager] = useState("");
  const [ropName, setRopName] = useState("");
  const [shipmentDayId, setShipmentDayId] = useState<DealerShipmentDayId | "">("");
  const [unloadingOrder, setUnloadingOrder] = useState("");
  const [comment, setComment] = useState("");
  const [passportClientKind, setPassportClientKind] = useState("other");
  const [passportLifecycleStatus, setPassportLifecycleStatus] = useState("new");
  const [passportCategoryTier, setPassportCategoryTier] = useState("none");
  const [territoryZone, setTerritoryZone] = useState("");
  const [logisticsComment, setLogisticsComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(baseRow.name ?? "");
    setInn(baseRow.actualizationInn ?? "");
    setCity(baseRow.city ?? "");
    setAddress(baseRow.releaseAddress ?? "");
    setPhone(baseRow.contacts?.phone ?? "");
    setEmail(baseRow.contacts?.email ?? "");
    setManager(baseRow.manager ?? "");
    setRegionalManager(baseRow.regionalManager ?? "");
    setRopName(baseRow.ropName ?? "");
    setComment(baseRow.comment ?? "");
    const uo = state.unloadingOrderByDealerId?.[baseRow.id] ?? getDealerUnloadingOrder(baseRow.id);
    setUnloadingOrder(uo != null ? String(uo) : "");
    const f = state.dealerOverridesById[baseRow.id]?.fields as Record<string, unknown> | undefined;
    const mf = state.manuallyCreatedDealersById[baseRow.id]?.fields as Record<string, unknown> | undefined;
    const merged = { ...(mf ?? {}), ...(f ?? {}) };
    const sd = merged.shipmentDayId ?? f?.shipmentDayId;
    setShipmentDayId(
      sd === "monday" || sd === "tuesday" || sd === "wednesday" || sd === "thursday" || sd === "friday" || sd === "saturday"
        ? (sd as DealerShipmentDayId)
        : "",
    );
    const pk = typeof merged.passportClientKind === "string" ? merged.passportClientKind : "";
    setPassportClientKind(pk || "other");
    const ls = typeof merged.passportLifecycleStatus === "string" ? merged.passportLifecycleStatus : "";
    setPassportLifecycleStatus(ls || "new");
    const ct = typeof merged.passportCategoryTier === "string" ? merged.passportCategoryTier : "";
    setPassportCategoryTier(ct || "none");
    setTerritoryZone(typeof merged.territoryZone === "string" ? merged.territoryZone : "");
    setLogisticsComment(typeof merged.logisticsComment === "string" ? merged.logisticsComment : "");
  }, [open, baseRow, state]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      toast({ title: "Заполните название клиента", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const uid = profile.personaUserId;
      const uname = userLabelFromProfile(profile);
      const uoNum = unloadingOrder.trim() ? Math.floor(Number(unloadingOrder.trim())) : NaN;
      const fields: Record<string, unknown> = {
        dealerName: name.trim(),
        inn: inn.trim() || undefined,
        city: city.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        manager: manager.trim(),
        regionalManager: regionalManager.trim(),
        ropName: ropName.trim(),
        comment: comment.trim(),
        shipmentDayId: shipmentDayId || undefined,
        unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
        passportClientKind,
        passportLifecycleStatus,
        passportCategoryTier,
        territoryZone: territoryZone.trim() || undefined,
        logisticsComment: logisticsComment.trim() || undefined,
      };
      const ov: DealerActualizationOverride = {
        dealerId: baseRow.id,
        fields,
        updatedAt: isoNow(),
        updatedBy: uid,
        updatedByName: uname,
        source: "manual_actualization",
      };
      const r = await persist((prev) => {
        let next = mergeActualizationState(prev, {
          dealerOverridesById: { ...prev.dealerOverridesById, [baseRow.id]: ov },
        });
        if (Number.isFinite(uoNum) && uoNum > 0) {
          next = mergeActualizationState(next, {
            unloadingOrderByDealerId: { ...(next.unloadingOrderByDealerId ?? {}), [baseRow.id]: uoNum },
          });
        } else {
          const map = { ...(next.unloadingOrderByDealerId ?? {}) };
          delete map[baseRow.id];
          next = mergeActualizationState(next, { unloadingOrderByDealerId: map });
        }
        const iso = isoNow();
        next = mergeActualizationState(next, {
          dealerActualizationAuditByDealerId: {
            ...next.dealerActualizationAuditByDealerId,
            [baseRow.id]: { lastUpdatedAt: iso, lastUpdatedBy: uid, lastUpdatedByName: uname },
          },
        });
        if (isManualActualizationDealerId(baseRow.id)) {
          const m = next.manuallyCreatedDealersById[baseRow.id];
          if (m) {
            const prevF = (m.fields ?? {}) as Record<string, unknown>;
            const shipmentLabel = shipmentDayId ? DEALER_SHIPMENT_DAY_LABELS[shipmentDayId] : "";
            const mergedFields: Record<string, unknown> = {
              ...prevF,
              name: name.trim(),
              inn: inn.trim(),
              city: city.trim(),
              address: address.trim(),
              phone: phone.trim(),
              email: email.trim(),
              manager: manager.trim(),
              regionalManager: regionalManager.trim(),
              ropName: ropName.trim(),
              comment: comment.trim(),
              shipmentDayId: shipmentDayId || undefined,
              shipmentDayLabel: shipmentLabel || undefined,
              passportClientKind,
              passportLifecycleStatus,
              passportCategoryTier,
              territoryZone: territoryZone.trim(),
              logisticsComment: logisticsComment.trim(),
              unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
            };
            next = mergeActualizationState(next, {
              manuallyCreatedDealersById: {
                ...next.manuallyCreatedDealersById,
                [baseRow.id]: { ...m, fields: mergedFields },
              },
            });
          }
        }
        return next;
      });
      if (r.success) {
        toast({ title: "Сохранено" });
        onOpenChange(false);
      } else {
        const extra =
          r.syncStatus === "local_fallback" || r.storageMode === "local_fallback"
            ? " Данные могли сохраниться только на этом устройстве."
            : "";
        toast({
          title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
          description: extra.trim() || "Проверьте статус синхронизации.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    name,
    inn,
    city,
    address,
    phone,
    email,
    manager,
    regionalManager,
    ropName,
    comment,
    shipmentDayId,
    unloadingOrder,
    passportClientKind,
    passportLifecycleStatus,
    passportCategoryTier,
    territoryZone,
    logisticsComment,
    baseRow.id,
    persist,
    onOpenChange,
    profile,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto pb-24 sm:max-w-lg" data-testid="dialog-dealer-edit">
        <DialogHeader>
          <DialogTitle className="text-base">Редактирование клиента</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Название клиента <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ИНН</Label>
            <Input value={inn} onChange={(e) => setInn(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Город / населённый пункт</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Адрес</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="min-h-[52px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ответственный менеджер</Label>
            <Input value={manager} onChange={(e) => setManager(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ответственный региональный менеджер</Label>
            <Input value={regionalManager} onChange={(e) => setRegionalManager(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ответственный РОП</Label>
            <Input value={ropName} onChange={(e) => setRopName(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">День отгрузки</Label>
            <Select
              value={shipmentDayId || "__none__"}
              onValueChange={(v) => setShipmentDayId(v === "__none__" ? "" : (v as DealerShipmentDayId))}
            >
              <SelectTrigger className="min-h-10">
                <SelectValue placeholder="Не выбран" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не выбран</SelectItem>
                {DEALER_SHIPMENT_DAY_ORDER.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DEALER_SHIPMENT_DAY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Порядок выгрузки (число)</Label>
            <Input inputMode="numeric" value={unloadingOrder} onChange={(e) => setUnloadingOrder(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Паспорт актуализации</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Тип клиента</Label>
              <Select value={passportClientKind} onValueChange={setPassportClientKind}>
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">ИП</SelectItem>
                  <SelectItem value="ooo">ООО</SelectItem>
                  <SelectItem value="person">Физлицо</SelectItem>
                  <SelectItem value="network">Сеть</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Статус (актуализация)</Label>
              <Select value={passportLifecycleStatus} onValueChange={setPassportLifecycleStatus}>
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Новый</SelectItem>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="needs_review">Требует проверки</SelectItem>
                  <SelectItem value="inactive">Неактивный</SelectItem>
                  <SelectItem value="archived">Архив</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Категория (ТОП)</Label>
              <Select value={passportCategoryTier} onValueChange={setPassportCategoryTier}>
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top150">ТОП-150</SelectItem>
                  <SelectItem value="top350">ТОП-350</SelectItem>
                  <SelectItem value="top500">ТОП-500</SelectItem>
                  <SelectItem value="other">Прочие</SelectItem>
                  <SelectItem value="none">Без категории</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Территория / зона</Label>
              <Input value={territoryZone} onChange={(e) => setTerritoryZone(e.target.value)} className="min-h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий по логистике</Label>
              <Textarea rows={2} value={logisticsComment} onChange={(e) => setLogisticsComment(e.target.value)} className="min-h-[52px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Комментарий / заметка</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="min-h-[52px]" />
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 border-t border-border bg-background pt-3">
          <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-save" disabled={saving} onClick={() => void onSave()}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type DealerActualizationCreateDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: ReleaseDemoProfile;
  mergedDealerRows: DealerRow[];
  onCreated: (id: string) => void;
};

const DEALER_STATUS_OPTIONS: DealerStatus[] = ["активный", "потенциальный", "приостановлен", "требует внимания"];

export function DealerActualizationCreateDialog(props: DealerActualizationCreateDialogProps): ReactElement {
  const { open, onOpenChange, profile, mergedDealerRows, onCreated } = props;
  const { persist, state } = useClientBaseActualization();
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const draftDealerIdRef = useRef<string | null>(null);
  const draftInternalCodeRef = useRef<string | null>(null);
  const draftLegalEntityIdRef = useRef<string | null>(null);
  const wasOpenForMintRef = useRef(false);
  const wasOpenForFormRef = useRef(false);

  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [clientCategory, setClientCategory] = useState<ClientCategoryId>("lead");
  const [status, setStatus] = useState<DealerStatus>("активный");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [shipmentDayId, setShipmentDayId] = useState<DealerShipmentDayId | "">("");
  const [routeLabel, setRouteLabel] = useState("");
  const [unloadingOrder, setUnloadingOrder] = useState("");
  const [managerUserId, setManagerUserId] = useState(profile.personaUserId);
  const [regionalManager, setRegionalManager] = useState("");
  const [ropName, setRopName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [legalName, setLegalName] = useState("");
  const [legalInn, setLegalInn] = useState("");
  const [legalKpp, setLegalKpp] = useState("");
  const [legalOgrn, setLegalOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [legalActualAddress, setLegalActualAddress] = useState("");

  const [innDupOpen, setInnDupOpen] = useState(false);
  const [innDupMatch, setInnDupMatch] = useState<{ dealerId: string; name: string } | null>(null);
  const [nameCityWarnOpen, setNameCityWarnOpen] = useState(false);
  const [nameCityDup, setNameCityDup] = useState<{ dealerId: string; name: string } | null>(null);

  useEffect(() => {
    if (open && !wasOpenForMintRef.current) {
      draftDealerIdRef.current = generateStableManualDealerId();
      draftInternalCodeRef.current = nextManualDealerInternalCode(state);
      draftLegalEntityIdRef.current = `manual-le-${draftDealerIdRef.current}-${Math.random().toString(36).slice(2, 8)}`;
      wasOpenForMintRef.current = true;
    }
    if (!open) {
      draftDealerIdRef.current = null;
      draftInternalCodeRef.current = null;
      draftLegalEntityIdRef.current = null;
      setInnDupOpen(false);
      setInnDupMatch(null);
      setNameCityWarnOpen(false);
      setNameCityDup(null);
      wasOpenForMintRef.current = false;
      wasOpenForFormRef.current = false;
    }
  }, [open, state]);

  useEffect(() => {
    if (!open) return;
    if (wasOpenForFormRef.current) return;
    wasOpenForFormRef.current = true;
    setManagerUserId(profile.personaUserId);
    setName("");
    setInn("");
    setClientCategory("lead");
    setStatus("активный");
    setCity("");
    setAddress("");
    setShipmentDayId("");
    setRouteLabel("");
    setUnloadingOrder("");
    setRegionalManager("");
    setRopName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setComment("");
    setLegalName("");
    setLegalInn("");
    setLegalKpp("");
    setLegalOgrn("");
    setLegalAddress("");
    setLegalActualAddress("");
  }, [open, profile.personaUserId]);

  const categoryOptions = useMemo(() => getClientCategoryOptions().filter((o) => o.value !== "all"), []);

  const managerOptions: SalesUser[] = useMemo(() => {
    const self = getSalesUserById(profile.personaUserId);
    if (profile.role === "sales_manager" && self) return [self];
    if (profile.role === "team_lead" && self?.teamId) return getTeamManagers(self.teamId);
    return getAllSalesManagers();
  }, [profile]);

  const runPersist = useCallback(async () => {
    if (saveLockRef.current) return;
    if (!name.trim() || !city.trim()) {
      toast({ title: "Заполните обязательные поля", description: "Название и город.", variant: "destructive" });
      return;
    }
    const mgr = getSalesUserById(managerUserId);
    if (!mgr) {
      toast({ title: "Выберите ответственного менеджера", variant: "destructive" });
      return;
    }
    const id = draftDealerIdRef.current;
    const internalCode = draftInternalCodeRef.current;
    if (!id || !internalCode) {
      draftDealerIdRef.current = generateStableManualDealerId();
      draftInternalCodeRef.current = nextManualDealerInternalCode(state);
      draftLegalEntityIdRef.current = `manual-le-${draftDealerIdRef.current}-${Math.random().toString(36).slice(2, 8)}`;
      toast({ title: "Повторите сохранение", variant: "destructive" });
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    const uoNum = unloadingOrder.trim() ? Math.floor(Number(unloadingOrder.trim())) : NaN;
    const shipmentLabel = shipmentDayId ? DEALER_SHIPMENT_DAY_LABELS[shipmentDayId] : "";
    const fields: Record<string, unknown> = {
      name: name.trim(),
      inn: inn.trim(),
      city: city.trim(),
      address: address.trim(),
      clientCategory,
      status,
      clientTypeLabel: categoryOptions.find((c) => c.value === clientCategory)?.label,
      manager: mgr.name,
      managerUserId: mgr.id,
      releaseManagerId: mgr.id,
      releaseTeamId: mgr.teamId,
      regionalManager: regionalManager.trim(),
      ropName: ropName.trim(),
      shipmentDayId: shipmentDayId || undefined,
      shipmentDayLabel: shipmentLabel || undefined,
      routeLabel: routeLabel.trim() || undefined,
      unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
      comment: comment.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
    };

    const r = await persist((prev) => {
      const existing = prev.manuallyCreatedDealersById[id];
      const manual: ManualDealer = {
        id,
        internalCode,
        fields,
        createdAt: existing?.createdAt ?? isoNow(),
        createdBy: existing?.createdBy ?? profile.personaUserId,
        createdByName: existing?.createdByName ?? userLabelFromProfile(profile),
        source: "manual_actualization",
      };
      let next = mergeActualizationState(prev, {
        manuallyCreatedDealersById: { ...prev.manuallyCreatedDealersById, [id]: manual },
      });
      if (Number.isFinite(uoNum) && uoNum > 0) {
        next = mergeActualizationState(next, {
          unloadingOrderByDealerId: { ...(next.unloadingOrderByDealerId ?? {}), [id]: uoNum },
        });
      }
      const leId = draftLegalEntityIdRef.current;
      if (legalName.trim() && leId) {
        const prevLe = next.legalEntityOverridesByDealerId[id];
        const row = {
          name: legalName.trim(),
          inn: legalInn.trim() || undefined,
          kpp: legalKpp.trim() || undefined,
          ogrn: legalOgrn.trim() || undefined,
          legalAddress: legalAddress.trim() || undefined,
          actualAddress: legalActualAddress.trim() || undefined,
          createdAt: isoNow(),
          updatedAt: isoNow(),
          updatedBy: profile.personaUserId,
          updatedByName: userLabelFromProfile(profile),
        };
        next = mergeActualizationState(next, {
          legalEntityOverridesByDealerId: {
            ...next.legalEntityOverridesByDealerId,
            [id]: {
              createdById: profile.personaUserId,
              overridesById: { ...(prevLe?.overridesById ?? {}), [leId]: row },
              archivedById: { ...(prevLe?.archivedById ?? {}) },
            },
          },
        });
      }
      const iso = isoNow();
      const contactPatch: Record<string, DealerActualizationContact> = {};
      if (contactPerson.trim() || phone.trim() || email.trim()) {
        const cid = newActualizationContactId(id);
        contactPatch[cid] = {
          id: cid,
          dealerId: id,
          fullName: contactPerson.trim() || "Контакт",
          role: "lpr",
          phone: phone.trim(),
          email: email.trim(),
          messenger: "",
          comment: "",
          isPrimary: true,
          createdAt: iso,
          updatedAt: iso,
          updatedBy: profile.personaUserId,
          updatedByName: userLabelFromProfile(profile),
        };
      }
      next = mergeActualizationState(next, {
        dealerActualizationContactsById: { ...next.dealerActualizationContactsById, ...contactPatch },
        dealerActualizationAuditByDealerId: {
          ...next.dealerActualizationAuditByDealerId,
          [id]: {
            lastUpdatedAt: iso,
            lastUpdatedBy: profile.personaUserId,
            lastUpdatedByName: userLabelFromProfile(profile),
          },
        },
      });
      return next;
    });

    setSaving(false);
    saveLockRef.current = false;

    if (r.success) {
      toast({ title: "Клиент сохранён" });
      onOpenChange(false);
      onCreated(id);
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
  }, [
    name,
    inn,
    city,
    address,
    clientCategory,
    status,
    managerUserId,
    regionalManager,
    ropName,
    shipmentDayId,
    routeLabel,
    unloadingOrder,
    comment,
    contactPerson,
    phone,
    email,
    legalName,
    legalInn,
    legalKpp,
    legalOgrn,
    legalAddress,
    legalActualAddress,
    categoryOptions,
    persist,
    onOpenChange,
    onCreated,
    profile,
    state,
  ]);

  const onSaveClick = useCallback(() => {
    if (!name.trim() || !city.trim()) {
      toast({ title: "Заполните обязательные поля", description: "Название и город.", variant: "destructive" });
      return;
    }
    const mgr = getSalesUserById(managerUserId);
    if (!mgr) {
      toast({ title: "Выберите ответственного менеджера", variant: "destructive" });
      return;
    }
    const id = draftDealerIdRef.current;
    if (!id) return;

    const innDup = findInnDuplicateInActualization(inn, mergedDealerRows, state, id);
    if (inn.trim() && innDup) {
      setInnDupMatch(innDup);
      setInnDupOpen(true);
      return;
    }

    const nc = findNameCityDuplicateInActualization(name, city, mergedDealerRows, state, id);
    if (!inn.trim() && nc) {
      setNameCityDup(nc);
      setNameCityWarnOpen(true);
      return;
    }

    void runPersist();
  }, [name, city, inn, managerUserId, mergedDealerRows, state, runPersist]);

  return (
    <>
      <AlertDialog open={innDupOpen} onOpenChange={setInnDupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Клиент с таким ИНН уже есть</AlertDialogTitle>
            <AlertDialogDescription>
              {innDupMatch
                ? `Клиент с таким ИНН уже есть в базе: ${innDupMatch.name}. Открыть существующего или всё равно создать?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto">
                Отмена
              </Button>
            </AlertDialogCancel>
            {innDupMatch ? (
              <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" asChild>
                <Link href={`/dealers/${encodeURIComponent(innDupMatch.dealerId)}`}>Открыть существующего</Link>
              </Button>
            ) : null}
            <AlertDialogAction
              type="button"
              className="min-h-10 w-full bg-primary sm:w-auto"
              onClick={() => {
                setInnDupOpen(false);
                void runPersist();
              }}
            >
              Всё равно создать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={nameCityWarnOpen} onOpenChange={setNameCityWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Похожий клиент уже есть</AlertDialogTitle>
            <AlertDialogDescription>
              {nameCityDup
                ? `Найден клиент с тем же названием и городом: ${nameCityDup.name}. Продолжить создание?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                setNameCityWarnOpen(false);
                void runPersist();
              }}
            >
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto pb-24 sm:max-w-xl" data-testid="dialog-dealer-create">
          <DialogHeader>
            <DialogTitle className="text-base">Новый клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-1">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Основное</p>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Название клиента <span className="text-destructive">*</span>
                </Label>
                <Input
                  data-testid="input-dealer-create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН</Label>
                <Input data-testid="input-dealer-create-inn" value={inn} onChange={(e) => setInn(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Категория клиента</Label>
                <Select value={clientCategory} onValueChange={(v) => setClientCategory(v as ClientCategoryId)}>
                  <SelectTrigger className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={String(c.value)}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус активности</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as DealerStatus)}>
                  <SelectTrigger className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEALER_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="min-h-[52px]" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Адрес и логистика</p>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Город / населённый пункт <span className="text-destructive">*</span>
                </Label>
                <Input data-testid="input-dealer-create-city" value={city} onChange={(e) => setCity(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  data-testid="input-dealer-create-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="min-h-[52px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">День отгрузки</Label>
                <Select
                  value={shipmentDayId || "__none__"}
                  onValueChange={(v) => setShipmentDayId(v === "__none__" ? "" : (v as DealerShipmentDayId))}
                >
                  <SelectTrigger className="min-h-10">
                    <SelectValue placeholder="Не выбран" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не выбран</SelectItem>
                    {DEALER_SHIPMENT_DAY_ORDER.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DEALER_SHIPMENT_DAY_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Маршрут / направление</Label>
                <Input value={routeLabel} onChange={(e) => setRouteLabel(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Порядок выгрузки</Label>
                <Input value={unloadingOrder} onChange={(e) => setUnloadingOrder(e.target.value)} className="min-h-10" inputMode="numeric" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ответственные</p>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Ответственный менеджер <span className="text-destructive">*</span>
                </Label>
                <Select value={managerUserId} onValueChange={setManagerUserId}>
                  <SelectTrigger className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный региональный менеджер</Label>
                <Input value={regionalManager} onChange={(e) => setRegionalManager(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный РОП</Label>
                <Input value={ropName} onChange={(e) => setRopName(e.target.value)} className="min-h-10" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Контакты</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-10" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Юридическое лицо (необязательно)</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Название юрлица</Label>
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН</Label>
                <Input value={legalInn} onChange={(e) => setLegalInn(e.target.value)} className="min-h-10" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">КПП</Label>
                  <Input value={legalKpp} onChange={(e) => setLegalKpp(e.target.value)} className="min-h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ОГРН</Label>
                  <Input value={legalOgrn} onChange={(e) => setLegalOgrn(e.target.value)} className="min-h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Юридический адрес</Label>
                <Textarea value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} rows={2} className="min-h-[52px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Фактический адрес</Label>
                <Textarea value={legalActualAddress} onChange={(e) => setLegalActualAddress(e.target.value)} rows={2} className="min-h-[52px]" />
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border bg-background pt-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full sm:w-auto"
              data-testid="button-dealer-create-cancel"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-create-submit"
              disabled={saving}
              onClick={() => void onSaveClick()}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
