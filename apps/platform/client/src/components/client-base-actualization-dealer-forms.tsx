/**
 * Диалоги актуализации: редактирование и создание клиента (сохранение в ActualizationState + API).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { DEALER_SHIPMENT_DAY_LABELS, DEALER_SHIPMENT_DAY_ORDER, type DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { getDealerUnloadingOrder } from "@/lib/dealer-unloading-order-storage";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { getAllSalesManagers, getSalesUserById, getTeamManagers, type SalesUser } from "@/lib/sales-control-data";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { toast } from "@/hooks/use-toast";
import { mergeActualizationState, type DealerActualizationOverride } from "@/lib/client-base-actualization-state";

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
    const sd = f?.shipmentDayId;
    setShipmentDayId(
      sd === "monday" || sd === "tuesday" || sd === "wednesday" || sd === "thursday" || sd === "friday" || sd === "saturday"
        ? sd
        : "",
    );
  }, [open, baseRow, state]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      toast({ title: "Заполните название клиента", variant: "destructive" });
      return;
    }
    setSaving(true);
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
    };
    const ov: DealerActualizationOverride = {
      dealerId: baseRow.id,
      fields,
      updatedAt: isoNow(),
      updatedBy: uid,
      updatedByName: uname,
      source: "manual_actualization",
    };
    const ok = await persist((prev) => {
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
      return next;
    });
    setSaving(false);
    if (ok) {
      toast({ title: "Сохранено" });
      onOpenChange(false);
    } else {
      toast({ title: "Ошибка сохранения", description: "Проверьте сеть или статус синхронизации.", variant: "destructive" });
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
  onCreated: (id: string) => void;
};

export function DealerActualizationCreateDialog(props: DealerActualizationCreateDialogProps): ReactElement {
  const { open, onOpenChange, profile, onCreated } = props;
  const { persist } = useClientBaseActualization();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [managerUserId, setManagerUserId] = useState(profile.personaUserId);
  const [regionalManager, setRegionalManager] = useState("");
  const [ropName, setRopName] = useState("");
  const [shipmentDayLabel, setShipmentDayLabel] = useState("");
  const [unloadingOrder, setUnloadingOrder] = useState("");
  const [comment, setComment] = useState("");

  const managerOptions: SalesUser[] = useMemo(() => {
    const self = getSalesUserById(profile.personaUserId);
    if (profile.role === "sales_manager" && self) return [self];
    if (profile.role === "team_lead" && self?.teamId) return getTeamManagers(self.teamId);
    return getAllSalesManagers();
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    setManagerUserId(profile.personaUserId);
    setName("");
    setInn("");
    setCity("");
    setAddress("");
    setRegionalManager("");
    setRopName("");
    setShipmentDayLabel("");
    setUnloadingOrder("");
    setComment("");
  }, [open, profile.personaUserId]);

  const onSave = useCallback(async () => {
    if (!name.trim() || !city.trim() || !address.trim()) {
      toast({ title: "Заполните обязательные поля", description: "Название, город и адрес.", variant: "destructive" });
      return;
    }
    const mgr = getSalesUserById(managerUserId);
    if (!mgr) {
      toast({ title: "Выберите ответственного менеджера", variant: "destructive" });
      return;
    }
    setSaving(true);
    const id = `manual-dealer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const uoNum = unloadingOrder.trim() ? Math.floor(Number(unloadingOrder.trim())) : NaN;
    const fields: Record<string, unknown> = {
      name: name.trim(),
      inn: inn.trim(),
      city: city.trim(),
      address: address.trim(),
      manager: mgr.name,
      managerUserId: mgr.id,
      releaseManagerId: mgr.id,
      releaseTeamId: mgr.teamId,
      regionalManager: regionalManager.trim(),
      ropName: ropName.trim(),
      shipmentDayLabel: shipmentDayLabel.trim(),
      unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
      comment: comment.trim(),
    };
    const ok = await persist((prev) => {
      const manual = {
        id,
        fields,
        createdAt: isoNow(),
        createdBy: profile.personaUserId,
        createdByName: userLabelFromProfile(profile),
        source: "manual_actualization" as const,
      };
      let next = mergeActualizationState(prev, {
        manuallyCreatedDealersById: { ...prev.manuallyCreatedDealersById, [id]: manual },
      });
      if (Number.isFinite(uoNum) && uoNum > 0) {
        next = mergeActualizationState(next, {
          unloadingOrderByDealerId: { ...(next.unloadingOrderByDealerId ?? {}), [id]: uoNum },
        });
      }
      return next;
    });
    setSaving(false);
    if (ok) {
      toast({ title: "Сохранено", description: "Клиент добавлен в базу." });
      onOpenChange(false);
      onCreated(id);
    } else {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    }
  }, [
    name,
    inn,
    city,
    address,
    managerUserId,
    regionalManager,
    ropName,
    shipmentDayLabel,
    unloadingOrder,
    comment,
    persist,
    onOpenChange,
    onCreated,
    profile,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto pb-24 sm:max-w-lg" data-testid="dialog-dealer-create">
        <DialogHeader>
          <DialogTitle className="text-base">Новый клиент</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ИНН</Label>
            <Input value={inn} onChange={(e) => setInn(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Город <span className="text-destructive">*</span>
            </Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Адрес <span className="text-destructive">*</span>
            </Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="min-h-[52px]" />
          </div>
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
          <div className="space-y-1.5">
            <Label className="text-xs">День отгрузки (текст)</Label>
            <Input value={shipmentDayLabel} onChange={(e) => setShipmentDayLabel(e.target.value)} className="min-h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Порядок выгрузки</Label>
            <Input value={unloadingOrder} onChange={(e) => setUnloadingOrder(e.target.value)} className="min-h-10" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Комментарий</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="min-h-[52px]" />
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 border-t border-border bg-background pt-3">
          <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-create-submit" disabled={saving} onClick={() => void onSave()}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
