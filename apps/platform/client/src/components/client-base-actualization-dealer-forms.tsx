/**
 * Диалоги актуализации: редактирование и создание клиента (сохранение в ActualizationState + API).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { DealerRow, DealerStatus } from "@/lib/dealer-base-mock-data";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  formatShipmentDaysForDisplay,
  normalizeManualDealerShipmentDayIdsFromFields,
  sortDealerShipmentDayIds,
  type DealerShipmentDayId,
} from "@/lib/dealer-shipment-days";
import { getDealerUnloadingOrder } from "@/lib/dealer-unloading-order-storage";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { getAllSalesManagers, getSalesUserById, getTeamManagers, type SalesUser } from "@/lib/sales-control-data";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { AddressSuggestInput } from "@/components/address-suggest-input";
import { getClientCategoryOptions } from "@/lib/client-category";
import type { ClientCategoryId } from "@/lib/client-category";
import {
  findInnDuplicateInActualization,
  findDealerCandidatesByName,
  findExactNameDuplicateInActualization,
  findNameCityDuplicateInActualization,
  generateStableManualDealerId,
  nextManualDealerInternalCode,
  isManualActualizationDealerId,
  type NameMatchCandidate,
} from "@/lib/client-base-actualization-stable-ids";
import { mergeDealerRowWithActualization } from "@/lib/client-base-actualization-data-merge";
import {
  mergeActualizationState,
  type DealerActualizationOverride,
  type DealerActualizationContact,
  type ManualDealer,
} from "@/lib/client-base-actualization-state";
import { newActualizationContactId } from "@/lib/client-base-actualization-contacts-helpers";
import {
  commercialTriFromBoolNull,
  commercialTriToBoolNull,
  type DealerCommercialTriSelect,
} from "@/lib/dealer-commercial-characteristics";
import {
  formatRussianPhoneInput,
  isValidRussianPhoneLoose,
  RU_PHONE_INVALID_MESSAGE,
  RU_PHONE_PLACEHOLDER,
} from "@/lib/phone-format";
import { cn } from "@/lib/utils";

const REGIONAL_MANAGER_OPTIONS = [
  "Мельник Владимир Викторович",
  "Богачев Денис Николаевич",
  "Бойко Сергей Валерьевич",
  "Дзодзиков Георгий Викторович",
  "Дрогобицкий Игорь Ярославович",
  "Серебряков Юрий Витальевич",
] as const;

const ROP_OPTIONS = [
  "Купянский Родион Александрович",
  "Скалабан Александр Александрович",
  "Сапожков Артем Эдуардович",
] as const;

function ResponsiblePersonCombobox(props: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  testId: string;
}): ReactElement {
  const { value, onValueChange, options, placeholder, searchPlaceholder, emptyText, testId } = props;
  const [open, setOpen] = useState(false);
  const selected = value.trim();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("min-h-10 w-full justify-between bg-background px-3 text-left font-normal", !selected && "text-muted-foreground")}
          data-testid={testId}
        >
          <span className="min-w-0 truncate">{selected || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4 text-primary", selected === option ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="min-w-0 truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ShipmentDaysMultiSelect(props: {
  value: DealerShipmentDayId[];
  onChange: (next: DealerShipmentDayId[]) => void;
  onMarkDirty: () => void;
  triggerTestId: string;
  popoverTestId: string;
}): ReactElement {
  const { value, onChange, onMarkDirty, triggerTestId, popoverTestId } = props;
  const [open, setOpen] = useState(false);

  const summary =
    value.length === 0
      ? "Выберите дни"
      : sortDealerShipmentDayIds(value)
          .map((d) => DEALER_SHIPMENT_DAY_LABELS[d])
          .join(", ");

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full justify-between bg-background px-3 py-2 text-left font-normal"
            data-testid={triggerTestId}
          >
            <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-sm leading-snug">{summary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start" data-testid={popoverTestId}>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {DEALER_SHIPMENT_DAY_ORDER.map((d) => (
              <div
                key={d}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                data-testid={`checkbox-dealer-shipment-day-${d}`}
              >
                <Checkbox
                  checked={value.includes(d)}
                  onCheckedChange={(checked) => {
                    const on = checked === true;
                    const next = on
                      ? sortDealerShipmentDayIds([...value, d])
                      : value.filter((x) => x !== d);
                    onChange(next);
                    onMarkDirty();
                  }}
                />
                <span className="select-none">{DEALER_SHIPMENT_DAY_LABELS[d]}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="chips-dealer-shipment-days">
          {sortDealerShipmentDayIds(value).map((d) => (
            <Badge key={d} variant="secondary" className="max-w-full truncate font-normal">
              {DEALER_SHIPMENT_DAY_LABELS[d]}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommercialCharacteristicsFormSection(props: {
  door: DealerCommercialTriSelect;
  setDoor: (v: DealerCommercialTriSelect) => void;
  doorComment: string;
  setDoorComment: (v: string) => void;
  hardware: DealerCommercialTriSelect;
  setHardware: (v: DealerCommercialTriSelect) => void;
  hardwareComment: string;
  setHardwareComment: (v: string) => void;
  club: DealerCommercialTriSelect;
  setClub: (v: DealerCommercialTriSelect) => void;
  clubComment: string;
  setClubComment: (v: string) => void;
  special: DealerCommercialTriSelect;
  setSpecial: (v: DealerCommercialTriSelect) => void;
  specialComment: string;
  setSpecialComment: (v: string) => void;
  cashback: DealerCommercialTriSelect;
  setCashback: (v: DealerCommercialTriSelect) => void;
  cashbackComment: string;
  setCashbackComment: (v: string) => void;
  external1c: string;
  setExternal1c: (v: string) => void;
  onMarkDirty: () => void;
}): ReactElement {
  const {
    door,
    setDoor,
    doorComment,
    setDoorComment,
    hardware,
    setHardware,
    hardwareComment,
    setHardwareComment,
    club,
    setClub,
    clubComment,
    setClubComment,
    special,
    setSpecial,
    specialComment,
    setSpecialComment,
    cashback,
    setCashback,
    cashbackComment,
    setCashbackComment,
    external1c,
    setExternal1c,
    onMarkDirty,
  } = props;

  const triSelect = (value: DealerCommercialTriSelect, onChange: (v: DealerCommercialTriSelect) => void, testId: string) => (
    <Select
      value={value}
      onValueChange={(v) => {
        onChange(v as DealerCommercialTriSelect);
        onMarkDirty();
      }}
    >
      <SelectTrigger className="min-h-10 w-full min-w-0" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unset">Не указано</SelectItem>
        <SelectItem value="yes">Да</SelectItem>
        <SelectItem value="no">Нет</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div data-testid="section-dealer-commercial-characteristics" className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Коммерческие характеристики</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Склад двери</Label>
          {triSelect(door, setDoor, "select-dealer-door-warehouse")}
          <Label className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            data-testid="textarea-dealer-door-warehouse-comment"
            rows={2}
            className="min-h-[52px]"
            value={doorComment}
            onChange={(e) => {
              setDoorComment(e.target.value);
              onMarkDirty();
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Склад фурнитуры</Label>
          {triSelect(hardware, setHardware, "select-dealer-hardware-warehouse")}
          <Label className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            data-testid="textarea-dealer-hardware-warehouse-comment"
            rows={2}
            className="min-h-[52px]"
            value={hardwareComment}
            onChange={(e) => {
              setHardwareComment(e.target.value);
              onMarkDirty();
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Tandoor Club</Label>
          {triSelect(club, setClub, "select-dealer-tandoor-club")}
          <Label className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            data-testid="textarea-dealer-tandoor-club-comment"
            rows={2}
            className="min-h-[52px]"
            value={clubComment}
            onChange={(e) => {
              setClubComment(e.target.value);
              onMarkDirty();
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Спец. условия</Label>
          {triSelect(special, setSpecial, "select-dealer-special-terms")}
          <Label className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            data-testid="textarea-dealer-special-terms-comment"
            rows={2}
            className="min-h-[52px]"
            value={specialComment}
            onChange={(e) => {
              setSpecialComment(e.target.value);
              onMarkDirty();
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">КЭШБЭК клиент</Label>
          {triSelect(cashback, setCashback, "select-dealer-cashback-client")}
          <Label className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            data-testid="textarea-dealer-cashback-client-comment"
            rows={2}
            className="min-h-[52px]"
            value={cashbackComment}
            onChange={(e) => {
              setCashbackComment(e.target.value);
              onMarkDirty();
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Код клиента в 1С</Label>
          <Input
            data-testid="input-dealer-external-1c-code"
            className="min-h-10"
            value={external1c}
            onChange={(e) => {
              setExternal1c(e.target.value);
              onMarkDirty();
            }}
            placeholder="Необязательно"
          />
        </div>
      </div>
    </div>
  );
}

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
  const passportSave = useSectionSaveFeedback();
  const responsiblesSave = useSectionSaveFeedback();
  const logisticsSave = useSectionSaveFeedback();
  const contactsSave = useSectionSaveFeedback();
  const commercialSave = useSectionSaveFeedback();
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manager, setManager] = useState("");
  const [regionalManager, setRegionalManager] = useState("");
  const [ropName, setRopName] = useState("");
  const [shipmentDayIds, setShipmentDayIds] = useState<DealerShipmentDayId[]>([]);
  const [unloadingOrder, setUnloadingOrder] = useState("");
  const [comment, setComment] = useState("");
  const [passportClientKind, setPassportClientKind] = useState("other");
  const [passportLifecycleStatus, setPassportLifecycleStatus] = useState("new");
  const [passportCategoryTier, setPassportCategoryTier] = useState("none");
  const [territoryZone, setTerritoryZone] = useState("");
  const [logisticsComment, setLogisticsComment] = useState("");
  const [doorTri, setDoorTri] = useState<DealerCommercialTriSelect>("unset");
  const [doorComment, setDoorComment] = useState("");
  const [hardwareTri, setHardwareTri] = useState<DealerCommercialTriSelect>("unset");
  const [hardwareComment, setHardwareComment] = useState("");
  const [clubTri, setClubTri] = useState<DealerCommercialTriSelect>("unset");
  const [clubComment, setClubComment] = useState("");
  const [specialTri, setSpecialTri] = useState<DealerCommercialTriSelect>("unset");
  const [specialComment, setSpecialComment] = useState("");
  const [cashbackTri, setCashbackTri] = useState<DealerCommercialTriSelect>("unset");
  const [cashbackComment, setCashbackComment] = useState("");
  const [external1c, setExternal1c] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(baseRow.name ?? "");
    setInn(baseRow.actualizationInn ?? "");
    setCity(baseRow.city ?? "");
    setAddress(baseRow.releaseAddress ?? "");
    setPhone(formatRussianPhoneInput(baseRow.contacts?.phone ?? ""));
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
    setShipmentDayIds(normalizeManualDealerShipmentDayIdsFromFields(merged));
    const pk = typeof merged.passportClientKind === "string" ? merged.passportClientKind : "";
    setPassportClientKind(pk || "other");
    const ls = typeof merged.passportLifecycleStatus === "string" ? merged.passportLifecycleStatus : "";
    setPassportLifecycleStatus(ls || "new");
    const ct = typeof merged.passportCategoryTier === "string" ? merged.passportCategoryTier : "";
    setPassportCategoryTier(ct || "none");
    setTerritoryZone(typeof merged.territoryZone === "string" ? merged.territoryZone : "");
    setLogisticsComment(typeof merged.logisticsComment === "string" ? merged.logisticsComment : "");
    const effective = mergeDealerRowWithActualization(baseRow, state);
    setDoorTri(commercialTriFromBoolNull(effective.hasDoorWarehouse));
    setDoorComment((effective.doorWarehouseComment ?? "").trim());
    setHardwareTri(commercialTriFromBoolNull(effective.hasHardwareWarehouse));
    setHardwareComment((effective.hardwareWarehouseComment ?? "").trim());
    setClubTri(commercialTriFromBoolNull(effective.isTandoorClubMember));
    setClubComment((effective.tandoorClubComment ?? "").trim());
    setSpecialTri(commercialTriFromBoolNull(effective.hasSpecialTerms));
    setSpecialComment((effective.specialTermsComment ?? "").trim());
    setCashbackTri(commercialTriFromBoolNull(effective.isCashbackClient));
    setCashbackComment((effective.cashbackComment ?? "").trim());
    setExternal1c((effective.external1cCode ?? "").trim());
  }, [open, baseRow, state]);

  const persistAll = useCallback(async (): Promise<boolean> => {
    if (!name.trim()) {
      toast({ title: "Заполните название клиента", variant: "destructive" });
      return false;
    }
    if (phone.trim() && !isValidRussianPhoneLoose(phone)) {
      toast({ title: RU_PHONE_INVALID_MESSAGE, variant: "destructive" });
      return false;
    }
    const phoneFormatted = phone.trim() ? formatRussianPhoneInput(phone) : "";
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const uoNum = unloadingOrder.trim() ? Math.floor(Number(unloadingOrder.trim())) : NaN;
    const fields: Record<string, unknown> = {
      dealerName: name.trim(),
      inn: inn.trim() || undefined,
      city: city.trim(),
      address: address.trim(),
      phone: phoneFormatted,
      email: email.trim(),
      manager: manager.trim(),
      regionalManager: regionalManager.trim(),
      ropName: ropName.trim(),
      comment: comment.trim(),
      shipmentDayIds: shipmentDayIds.length > 0 ? shipmentDayIds : [],
      shipmentDayLabel: shipmentDayIds.length > 0 ? formatShipmentDaysForDisplay(shipmentDayIds) : undefined,
      unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
      passportClientKind,
      passportLifecycleStatus,
      passportCategoryTier,
      territoryZone: territoryZone.trim() || undefined,
      logisticsComment: logisticsComment.trim() || undefined,
      hasDoorWarehouse: commercialTriToBoolNull(doorTri),
      doorWarehouseComment: doorComment.trim(),
      hasHardwareWarehouse: commercialTriToBoolNull(hardwareTri),
      hardwareWarehouseComment: hardwareComment.trim(),
      isTandoorClubMember: commercialTriToBoolNull(clubTri),
      tandoorClubComment: clubComment.trim(),
      hasSpecialTerms: commercialTriToBoolNull(specialTri),
      specialTermsComment: specialComment.trim(),
      isCashbackClient: commercialTriToBoolNull(cashbackTri),
      cashbackComment: cashbackComment.trim(),
      external1cCode: external1c.trim() || undefined,
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
          const mergedFields: Record<string, unknown> = {
            ...prevF,
            name: name.trim(),
            inn: inn.trim(),
            city: city.trim(),
            address: address.trim(),
            phone: phoneFormatted,
            email: email.trim(),
            manager: manager.trim(),
            regionalManager: regionalManager.trim(),
            ropName: ropName.trim(),
            comment: comment.trim(),
            shipmentDayIds: shipmentDayIds.length > 0 ? shipmentDayIds : [],
            shipmentDayLabel: shipmentDayIds.length > 0 ? formatShipmentDaysForDisplay(shipmentDayIds) : undefined,
            passportClientKind,
            passportLifecycleStatus,
            passportCategoryTier,
            territoryZone: territoryZone.trim(),
            logisticsComment: logisticsComment.trim(),
            unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
            hasDoorWarehouse: commercialTriToBoolNull(doorTri),
            doorWarehouseComment: doorComment.trim(),
            hasHardwareWarehouse: commercialTriToBoolNull(hardwareTri),
            hardwareWarehouseComment: hardwareComment.trim(),
            isTandoorClubMember: commercialTriToBoolNull(clubTri),
            tandoorClubComment: clubComment.trim(),
            hasSpecialTerms: commercialTriToBoolNull(specialTri),
            specialTermsComment: specialComment.trim(),
            isCashbackClient: commercialTriToBoolNull(cashbackTri),
            cashbackComment: cashbackComment.trim(),
            external1cCode: external1c.trim() || undefined,
          };
          next = mergeActualizationState(next, {
            manuallyCreatedDealersById: {
              ...next.manuallyCreatedDealersById,
              [baseRow.id]: {
                ...m,
                fields: mergedFields,
                updatedAt: iso,
                updatedBy: uid,
                updatedByName: uname,
              },
            },
          });
          const m2 = next.manuallyCreatedDealersById[baseRow.id];
          if (m2) {
            const ic = (m2.internalCode ?? "").trim();
            if (!/^TND-CL-\d{6}$/i.test(ic)) {
              const code = nextManualDealerInternalCode(next);
              next = mergeActualizationState(next, {
                manuallyCreatedDealersById: {
                  ...next.manuallyCreatedDealersById,
                  [baseRow.id]: { ...m2, internalCode: code },
                },
              });
            }
          }
        }
      }
      return next;
    });
    if (!r.success) {
      const extra =
        r.syncStatus === "local_fallback" || r.storageMode === "local_fallback"
          ? " Данные могли сохраниться только на этом устройстве."
          : "";
      toast({
        title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
        description: extra.trim() || "Проверьте статус синхронизации.",
        variant: "destructive",
      });
      return false;
    }
    return true;
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
    shipmentDayIds,
    unloadingOrder,
    passportClientKind,
    passportLifecycleStatus,
    passportCategoryTier,
    territoryZone,
    logisticsComment,
    doorTri,
    doorComment,
    hardwareTri,
    hardwareComment,
    clubTri,
    clubComment,
    specialTri,
    specialComment,
    cashbackTri,
    cashbackComment,
    external1c,
    baseRow.id,
    persist,
    profile,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto pb-24 sm:max-w-lg" data-testid="dialog-dealer-edit">
        <DialogHeader>
          <DialogTitle className="text-base">Редактирование клиента</DialogTitle>
        </DialogHeader>
        <Accordion type="multiple" defaultValue={["passport", "responsibles", "logistics", "contacts", "commercial"]} className="py-1">
          <AccordionItem value="passport">
            <AccordionTrigger className="text-left text-sm font-semibold">Паспорт клиента</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН</Label>
                <Input
                  value={inn}
                  onChange={(e) => {
                    setInn(e.target.value);
                    passportSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тип клиента</Label>
                <Select
                  value={passportClientKind}
                  onValueChange={(v) => {
                    setPassportClientKind(v);
                    passportSave.markDirty();
                  }}
                >
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
                <Select
                  value={passportLifecycleStatus}
                  onValueChange={(v) => {
                    setPassportLifecycleStatus(v);
                    passportSave.markDirty();
                  }}
                >
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
                <Select
                  value={passportCategoryTier}
                  onValueChange={(v) => {
                    setPassportCategoryTier(v);
                    passportSave.markDirty();
                  }}
                >
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
              <SectionSaveButton
                testId="button-dealer-section-save-passport"
                statusTestId="text-save-status-passport"
                phase={passportSave.phase}
                onSave={() =>
                  void passportSave.runSave(async () => {
                    return persistAll();
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="responsibles">
            <AccordionTrigger className="text-left text-sm font-semibold">Ответственные</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный менеджер</Label>
                <Input
                  value={manager}
                  onChange={(e) => {
                    setManager(e.target.value);
                    responsiblesSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный региональный менеджер</Label>
                <ResponsiblePersonCombobox
                  value={regionalManager}
                  onValueChange={(next) => {
                    setRegionalManager(next);
                    responsiblesSave.markDirty();
                  }}
                  options={REGIONAL_MANAGER_OPTIONS}
                  placeholder="Выберите регионального менеджера"
                  searchPlaceholder="Введите ФИО регионального менеджера"
                  emptyText="Региональный менеджер не найден."
                  testId="select-dealer-regional-manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный РОП</Label>
                <ResponsiblePersonCombobox
                  value={ropName}
                  onValueChange={(next) => {
                    setRopName(next);
                    responsiblesSave.markDirty();
                  }}
                  options={ROP_OPTIONS}
                  placeholder="Выберите РОП"
                  searchPlaceholder="Введите ФИО РОП"
                  emptyText="РОП не найден."
                  testId="select-dealer-rop"
                />
              </div>
              <SectionSaveButton
                testId="button-dealer-section-save-responsibles"
                statusTestId="text-save-status-responsibles"
                phase={responsiblesSave.phase}
                onSave={() =>
                  void responsiblesSave.runSave(async () => {
                    return persistAll();
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="logistics">
            <AccordionTrigger className="text-left text-sm font-semibold">Адрес и логистика</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Город / населённый пункт</Label>
                <Input
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    logisticsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <AddressSuggestInput
                  key={baseRow.id}
                  value={address}
                  onChange={(v) => {
                    setAddress(v);
                    logisticsSave.markDirty();
                  }}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-edit-address-suggest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Дни отгрузки</Label>
                <ShipmentDaysMultiSelect
                  value={shipmentDayIds}
                  onChange={setShipmentDayIds}
                  onMarkDirty={() => logisticsSave.markDirty()}
                  triggerTestId="button-dealer-shipment-days-trigger"
                  popoverTestId="popover-dealer-shipment-days"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Порядок выгрузки (число)</Label>
                <Input
                  inputMode="numeric"
                  value={unloadingOrder}
                  onChange={(e) => {
                    setUnloadingOrder(e.target.value);
                    logisticsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Территория / зона</Label>
                <Input
                  value={territoryZone}
                  onChange={(e) => {
                    setTerritoryZone(e.target.value);
                    logisticsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий по логистике</Label>
                <Textarea
                  rows={2}
                  value={logisticsComment}
                  onChange={(e) => {
                    setLogisticsComment(e.target.value);
                    logisticsSave.markDirty();
                  }}
                  className="min-h-[52px]"
                />
              </div>
              <SectionSaveButton
                testId="button-dealer-section-save-logistics"
                statusTestId="text-save-status-logistics"
                phase={logisticsSave.phase}
                onSave={() =>
                  void logisticsSave.runSave(async () => {
                    return persistAll();
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contacts">
            <AccordionTrigger className="text-left text-sm font-semibold">Контакты и заметка</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Название клиента <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    contactsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={phone}
                  inputMode="tel"
                  placeholder={RU_PHONE_PLACEHOLDER}
                  onChange={(e) => {
                    setPhone(formatRussianPhoneInput(e.target.value));
                    contactsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    contactsSave.markDirty();
                  }}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий / заметка</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    contactsSave.markDirty();
                  }}
                  rows={2}
                  className="min-h-[52px]"
                />
              </div>
              <SectionSaveButton
                testId="button-dealer-section-save-contacts"
                statusTestId="text-save-status-contacts"
                phase={contactsSave.phase}
                onSave={() =>
                  void contactsSave.runSave(async () => {
                    return persistAll();
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="commercial">
            <AccordionTrigger className="text-left text-sm font-semibold">Коммерческие характеристики</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4 pt-1">
              <CommercialCharacteristicsFormSection
                door={doorTri}
                setDoor={setDoorTri}
                doorComment={doorComment}
                setDoorComment={setDoorComment}
                hardware={hardwareTri}
                setHardware={setHardwareTri}
                hardwareComment={hardwareComment}
                setHardwareComment={setHardwareComment}
                club={clubTri}
                setClub={setClubTri}
                clubComment={clubComment}
                setClubComment={setClubComment}
                special={specialTri}
                setSpecial={setSpecialTri}
                specialComment={specialComment}
                setSpecialComment={setSpecialComment}
                cashback={cashbackTri}
                setCashback={setCashbackTri}
                cashbackComment={cashbackComment}
                setCashbackComment={setCashbackComment}
                external1c={external1c}
                setExternal1c={setExternal1c}
                onMarkDirty={() => commercialSave.markDirty()}
              />
              <SectionSaveButton
                testId="button-dealer-section-save-commercial"
                statusTestId="text-save-status-commercial"
                phase={commercialSave.phase}
                onSave={() =>
                  void commercialSave.runSave(async () => {
                    return persistAll();
                  })
                }
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <DialogFooter className="sticky bottom-0 flex-col items-stretch gap-2 border-t border-border bg-background pt-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">Сохраняйте изменения кнопкой внутри каждого блока.</p>
          <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Закрыть без сохранения
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

function clientCategoryFromPassportTier(tier: string): ClientCategoryId {
  if (tier === "top150" || tier === "top350" || tier === "top500") return tier;
  return "uncategorized";
}

function dealerStatusFromPassportLifecycle(lifecycle: string): DealerStatus {
  if (lifecycle === "needs_review") return "требует внимания";
  if (lifecycle === "inactive" || lifecycle === "archived") return "приостановлен";
  return "активный";
}

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
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [shipmentDayIds, setShipmentDayIds] = useState<DealerShipmentDayId[]>([]);
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
  const [doorTri, setDoorTri] = useState<DealerCommercialTriSelect>("unset");
  const [doorComment, setDoorComment] = useState("");
  const [hardwareTri, setHardwareTri] = useState<DealerCommercialTriSelect>("unset");
  const [hardwareComment, setHardwareComment] = useState("");
  const [clubTri, setClubTri] = useState<DealerCommercialTriSelect>("unset");
  const [clubComment, setClubComment] = useState("");
  const [specialTri, setSpecialTri] = useState<DealerCommercialTriSelect>("unset");
  const [specialComment, setSpecialComment] = useState("");
  const [cashbackTri, setCashbackTri] = useState<DealerCommercialTriSelect>("unset");
  const [cashbackComment, setCashbackComment] = useState("");
  const [external1c, setExternal1c] = useState("");
  /** Поля паспорта / логистики: должны попадать в `manuallyCreatedDealersById[id].fields` при создании (см. анкету «Паспорт клиента»). */
  const [passportClientKind, setPassportClientKind] = useState("other");
  const [passportLifecycleStatus, setPassportLifecycleStatus] = useState("new");
  const [passportCategoryTier, setPassportCategoryTier] = useState("none");
  const [territoryZone, setTerritoryZone] = useState("");
  const [logisticsComment, setLogisticsComment] = useState("");

  const [innDupOpen, setInnDupOpen] = useState(false);
  const [innDupMatch, setInnDupMatch] = useState<{ dealerId: string; name: string } | null>(null);
  const [nameCityWarnOpen, setNameCityWarnOpen] = useState(false);
  const [nameCityDup, setNameCityDup] = useState<{ dealerId: string; name: string } | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<NameMatchCandidate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

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
      setNameSuggestions([]);
      setShowSuggestions(true);
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
    setCity("");
    setAddress("");
    setShipmentDayIds([]);
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
    setDoorTri("unset");
    setDoorComment("");
    setHardwareTri("unset");
    setHardwareComment("");
    setClubTri("unset");
    setClubComment("");
    setSpecialTri("unset");
    setSpecialComment("");
    setCashbackTri("unset");
    setCashbackComment("");
    setExternal1c("");
    setPassportClientKind("other");
    setPassportLifecycleStatus("new");
    setPassportCategoryTier("none");
    setTerritoryZone("");
    setLogisticsComment("");
    setShowSuggestions(true);
  }, [open, profile.personaUserId]);

  useEffect(() => {
    if (!open) {
      setNameSuggestions([]);
      return;
    }
    const q = name.trim();
    if (q.length < 3) {
      setNameSuggestions([]);
      return;
    }
    setNameSuggestions(
      findDealerCandidatesByName({
        nameQuery: q,
        mergedRows: mergedDealerRows,
        act: state,
        managerUserId,
        excludeDealerId: draftDealerIdRef.current ?? undefined,
        limit: 6,
      }),
    );
  }, [name, open, mergedDealerRows, managerUserId, state]);

  const categoryOptions = useMemo(() => getClientCategoryOptions().filter((o) => o.value !== "all"), []);

  const managerOptions: SalesUser[] = useMemo(() => {
    const self = getSalesUserById(profile.personaUserId);
    if (profile.role === "sales_manager" && self) return [self];
    if (profile.role === "team_lead" && self?.teamId) return getTeamManagers(self.teamId);
    return getAllSalesManagers();
  }, [profile]);
  const dealerAddressOption = useMemo(() => {
    const line = address.trim();
    if (!line) return [];
    return [
      {
        value: line,
        label: line,
        description: "Адрес из раздела «Адрес и логистика»",
        testId: "option-dealer-create-use-logistics-address",
      },
    ];
  }, [address]);

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

    if (phone.trim() && !isValidRussianPhoneLoose(phone)) {
      toast({ title: RU_PHONE_INVALID_MESSAGE, variant: "destructive" });
      return;
    }
    const phoneFormatted = phone.trim() ? formatRussianPhoneInput(phone) : "";

    saveLockRef.current = true;
    setSaving(true);
    const uoNum = unloadingOrder.trim() ? Math.floor(Number(unloadingOrder.trim())) : NaN;
    const clientCategory = clientCategoryFromPassportTier(passportCategoryTier);
    const status = dealerStatusFromPassportLifecycle(passportLifecycleStatus);
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
      shipmentDayIds: shipmentDayIds.length > 0 ? shipmentDayIds : [],
      shipmentDayLabel: shipmentDayIds.length > 0 ? formatShipmentDaysForDisplay(shipmentDayIds) : undefined,
      routeLabel: routeLabel.trim() || undefined,
      unloadingOrder: Number.isFinite(uoNum) && uoNum > 0 ? uoNum : undefined,
      passportClientKind,
      passportLifecycleStatus,
      passportCategoryTier,
      territoryZone: territoryZone.trim() || undefined,
      logisticsComment: logisticsComment.trim() || undefined,
      comment: comment.trim(),
      contactPerson: contactPerson.trim(),
      phone: phoneFormatted,
      email: email.trim(),
      hasDoorWarehouse: commercialTriToBoolNull(doorTri),
      doorWarehouseComment: doorComment.trim(),
      hasHardwareWarehouse: commercialTriToBoolNull(hardwareTri),
      hardwareWarehouseComment: hardwareComment.trim(),
      isTandoorClubMember: commercialTriToBoolNull(clubTri),
      tandoorClubComment: clubComment.trim(),
      hasSpecialTerms: commercialTriToBoolNull(specialTri),
      specialTermsComment: specialComment.trim(),
      isCashbackClient: commercialTriToBoolNull(cashbackTri),
      cashbackComment: cashbackComment.trim(),
      external1cCode: external1c.trim() || undefined,
    };

    const r = await persist((prev) => {
      const existing = prev.manuallyCreatedDealersById[id];
      const nowIso = isoNow();
      const uid = profile.personaUserId;
      const uname = userLabelFromProfile(profile);
      const manual: ManualDealer = {
        id,
        internalCode,
        fields,
        createdAt: existing?.createdAt ?? nowIso,
        createdBy: existing?.createdBy ?? uid,
        createdByName: existing?.createdByName ?? uname,
        updatedAt: nowIso,
        updatedBy: uid,
        updatedByName: uname,
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
          phone: phoneFormatted,
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
    managerUserId,
    regionalManager,
    ropName,
    shipmentDayIds,
    routeLabel,
    unloadingOrder,
    passportClientKind,
    passportLifecycleStatus,
    passportCategoryTier,
    territoryZone,
    logisticsComment,
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
    doorTri,
    doorComment,
    hardwareTri,
    hardwareComment,
    clubTri,
    clubComment,
    specialTri,
    specialComment,
    cashbackTri,
    cashbackComment,
    external1c,
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

    const nc = findNameCityDuplicateInActualization(name, city, mergedDealerRows, state, id);
    if (nc) {
      setNameCityDup(nc);
      setNameCityWarnOpen(true);
      return;
    }

    const exactName = findExactNameDuplicateInActualization(name, mergedDealerRows, state, managerUserId, id);
    if (exactName) {
      setNameCityDup(exactName);
      setNameCityWarnOpen(true);
      return;
    }

    const innDup = findInnDuplicateInActualization(inn, mergedDealerRows, state, id);
    if (inn.trim() && innDup) {
      setInnDupMatch(innDup);
      setInnDupOpen(true);
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
            <AlertDialogTitle>Этот клиент уже есть в базе</AlertDialogTitle>
            <AlertDialogDescription>
              {nameCityDup
                ? `В базе уже есть: ${nameCityDup.name}. Откройте его и продолжите актуализацию там — данные сохранятся в общей карточке. Создавать дубль нельзя без необходимости.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            {nameCityDup ? (
              <Button type="button" variant="default" className="min-h-10 w-full sm:w-auto" asChild>
                <Link
                  href={`/dealers/${encodeURIComponent(nameCityDup.dealerId)}`}
                  onClick={() => {
                    setNameCityWarnOpen(false);
                    onOpenChange(false);
                  }}
                >
                  Открыть существующего
                </Link>
              </Button>
            ) : null}
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 w-full sm:w-auto"
                onClick={() => {
                  setNameCityWarnOpen(false);
                  void runPersist();
                }}
              >
                Всё равно создать новую карточку
              </Button>
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
                {nameSuggestions.length > 0 && showSuggestions ? (
                  <div
                    className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
                    data-testid="block-dealer-create-name-suggestions"
                  >
                    <div className="mb-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                      Возможно, клиент уже есть в базе:
                    </div>
                    <div className="space-y-1.5">
                      {nameSuggestions.map((c) => (
                        <div
                          key={c.dealerId}
                          className="flex items-start justify-between gap-2 rounded border border-amber-200/60 bg-background/80 p-2 text-xs dark:border-amber-900/30"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{c.name}</div>
                            <div className="truncate text-muted-foreground">
                              {c.code ?? "—"} · {c.city || "Без города"} · {c.managerName || "Менеджер не указан"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 text-xs"
                            data-testid={`button-suggestion-open-${c.dealerId}`}
                            asChild
                          >
                            <Link href={`/dealers/${encodeURIComponent(c.dealerId)}`} onClick={() => onOpenChange(false)}>
                              Открыть
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Скрыть подсказки — я уверен(а) что это новый клиент
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ИНН</Label>
                <Input data-testid="input-dealer-create-inn" value={inn} onChange={(e) => setInn(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="min-h-[52px]" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Паспорт клиента</p>
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
                <AddressSuggestInput
                  key={draftDealerIdRef.current ?? "dealer-create"}
                  value={address}
                  onChange={(v) => setAddress(v)}
                  disabled={saving}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-create-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Дни отгрузки</Label>
                <ShipmentDaysMultiSelect
                  value={shipmentDayIds}
                  onChange={setShipmentDayIds}
                  onMarkDirty={() => {}}
                  triggerTestId="button-dealer-create-shipment-days-trigger"
                  popoverTestId="popover-dealer-create-shipment-days"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Маршрут / направление</Label>
                <Input value={routeLabel} onChange={(e) => setRouteLabel(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Порядок выгрузки</Label>
                <Input value={unloadingOrder} onChange={(e) => setUnloadingOrder(e.target.value)} className="min-h-10" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Территория / зона</Label>
                <Input value={territoryZone} onChange={(e) => setTerritoryZone(e.target.value)} className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий по логистике</Label>
                <Textarea value={logisticsComment} onChange={(e) => setLogisticsComment(e.target.value)} rows={2} className="min-h-[52px]" />
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
                <ResponsiblePersonCombobox
                  value={regionalManager}
                  onValueChange={setRegionalManager}
                  options={REGIONAL_MANAGER_OPTIONS}
                  placeholder="Выберите регионального менеджера"
                  searchPlaceholder="Введите ФИО регионального менеджера"
                  emptyText="Региональный менеджер не найден."
                  testId="select-dealer-create-regional-manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ответственный РОП</Label>
                <ResponsiblePersonCombobox
                  value={ropName}
                  onValueChange={setRopName}
                  options={ROP_OPTIONS}
                  placeholder="Выберите РОП"
                  searchPlaceholder="Введите ФИО РОП"
                  emptyText="РОП не найден."
                  testId="select-dealer-create-rop"
                />
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
                <Input
                  value={phone}
                  inputMode="tel"
                  placeholder={RU_PHONE_PLACEHOLDER}
                  onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
                  className="min-h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-10" />
              </div>
            </div>

            <CommercialCharacteristicsFormSection
              door={doorTri}
              setDoor={setDoorTri}
              doorComment={doorComment}
              setDoorComment={setDoorComment}
              hardware={hardwareTri}
              setHardware={setHardwareTri}
              hardwareComment={hardwareComment}
              setHardwareComment={setHardwareComment}
              club={clubTri}
              setClub={setClubTri}
              clubComment={clubComment}
              setClubComment={setClubComment}
              special={specialTri}
              setSpecial={setSpecialTri}
              specialComment={specialComment}
              setSpecialComment={setSpecialComment}
              cashback={cashbackTri}
              setCashback={setCashbackTri}
              cashbackComment={cashbackComment}
              setCashbackComment={setCashbackComment}
              external1c={external1c}
              setExternal1c={setExternal1c}
              onMarkDirty={() => {}}
            />

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
                <AddressSuggestInput
                  value={legalAddress}
                  onChange={(v) => setLegalAddress(v)}
                  localOptions={dealerAddressOption}
                  disabled={saving}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-create-legal-address-suggest"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Фактический адрес</Label>
                <AddressSuggestInput
                  value={legalActualAddress}
                  onChange={(v) => setLegalActualAddress(v)}
                  localOptions={dealerAddressOption}
                  disabled={saving}
                  rows={2}
                  className="[&_textarea]:min-h-[52px]"
                  testId="input-dealer-create-legal-actual-address-suggest"
                />
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
