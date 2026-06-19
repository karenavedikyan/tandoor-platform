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
import {
  formatRussianPhoneInput,
  isValidRussianPhoneLoose,
  RU_PHONE_INVALID_MESSAGE,
  RU_PHONE_PLACEHOLDER,
} from "@/lib/phone-format";
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
import { getShowcaseTasksForDealerDisplay, type ShowcaseStorageV1Dto, userLabelFromProfile } from "@/lib/showcase-distribution-data";
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
import { findSimilarTradePointsInDealer, type TradePointSuggestion } from "@/lib/client-base-actualization-tp-suggest";
import { toast } from "@/hooks/use-toast";
import { mapActualizationTpFieldsToOverrides, saveTradePointFields } from "@/lib/use-dealer-field-saver";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trashTradePointStrict, setPrimaryTradePointStrict } from "@/lib/trade-point-overrides-api";
import { hydrateTradePointOverridesFromServer } from "@/lib/dealer-overrides-sync";
import { isTradePointTrashedInRuntime } from "@/lib/dealer-overrides-runtime";
import {
  canTrashTradePointUi,
  resolveTradePointIsPrimary,
  tradePointTrashDisabledReason,
} from "@/lib/trade-point-primary-ui";
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
  readOnly?: boolean;
  showcaseState?: ShowcaseStorageV1Dto;
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

function openShowcaseTasksCount(dealer: DealerRow, mergedActiveCount: number, storage: ShowcaseStorageV1Dto): number | undefined {
  if (mergedActiveCount !== 1) return undefined;
  const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
  return tasks.filter((t) => t.status !== "done").length;
}

/** Подписи кнопки удаления в корзину. */
function tradePointArchiveActionLabels(isManual: boolean): { action: string; confirm: string } {
  return isManual
    ? { action: "В корзину", confirm: "В корзину" }
    : { action: "В корзину", confirm: "В корзину" };
}

function LocalSuggestInput(props: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label?: string; description?: string; testId?: string }[];
  className?: string;
  testId: string;
  placeholder?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) {
  const { value, onChange, options, className, testId, placeholder, inputMode } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const visible = options
    .map((option, index) => ({ ...option, value: option.value.trim(), testId: option.testId ?? `${testId}-option-${index}` }))
    .filter((option) => {
      if (!option.value) return false;
      if (option.value === value.trim()) return false;
      if (!q) return true;
      return option.value.toLowerCase().includes(q);
    });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || !(e.target instanceof Node)) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (visible.length > 0) setOpen(true);
        }}
        className={className}
        data-testid={testId}
        placeholder={placeholder}
        inputMode={inputMode}
      />
      {open && visible.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
          role="listbox"
          data-testid={`${testId}-options`}
        >
          {visible.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                data-testid={option.testId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-foreground">{option.label ?? option.value}</span>
                {option.description ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.description}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DealerTradePointsSection({ row, sectionDomId, profile, showcaseState }: Props) {
  const emptyShowcase: ShowcaseStorageV1Dto = useMemo(
    () => ({ overrides: {}, taskUpdates: {}, historyByDealer: {}, recommendationTaskEntries: {} }),
    [],
  );
  const resolvedShowcase = showcaseState ?? emptyShowcase;
  const actx = useClientBaseActualization();
  const useAct = actx.enabled && canEditDealerDuringActualization(profile, row);
  const hideSyntheticTpChrome = actx.enabled && CLIENT_BASE_ACTUALIZATION_CLEAN_MODE;
  const canEdit = canEditDealerTradePoints(profile, row);
  const [tpBump, setTpBump] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addFormat, setAddFormat] = useState("Розница / салон");
  const [addContactName, setAddContactName] = useState("");
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addContactEmail, setAddContactEmail] = useState("");
  const [addComment, setAddComment] = useState("");
  const [addError, setAddError] = useState("");
  const [tpSuggestionsDismissed, setTpSuggestionsDismissed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editFormat, setEditFormat] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editComment, setEditComment] = useState("");
  const [selectedBulkArchiveTpIds, setSelectedBulkArchiveTpIds] = useState<Set<string>>(() => new Set());
  const [bulkArchiveTpDialogOpen, setBulkArchiveTpDialogOpen] = useState(false);
  const [bulkArchiveTpBusy, setBulkArchiveTpBusy] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{
    tp: DealerTradePoint;
    isManual: boolean;
  } | null>(null);
  const [singleDeleteBusy, setSingleDeleteBusy] = useState(false);
  const [primaryBusyId, setPrimaryBusyId] = useState<string | null>(null);
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
    const base = useAct
      ? mergeTradePointsActiveForActualization(row, actx.state)
      : getEffectiveDealerTradePoints(row, { includeArchived: false });
    const visible = base.filter((entry) => !isTradePointTrashedInRuntime(entry.point.id, actx.state));
    const activeCount = visible.length;
    return visible.map((entry) => ({
      ...entry,
      point: {
        ...entry.point,
        isPrimary: resolveTradePointIsPrimary(entry.point, activeCount),
      },
    }));
  }, [useAct, actx.state, row, tpBump]);
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
    return openShowcaseTasksCount(row, mergedActive.length, resolvedShowcase);
  }, [hideSyntheticTpChrome, row, mergedActive.length, resolvedShowcase, tpBump]);

  const dealerCityOptions = useMemo(
    () =>
      isFilled(row.city)
        ? [{ value: row.city.trim(), description: "Город из карточки клиента", testId: "option-trade-point-use-dealer-city" }]
        : [],
    [row.city],
  );
  const dealerAddressOptions = useMemo(
    () =>
      isFilled(row.releaseAddress)
        ? [{ value: row.releaseAddress!.trim(), description: "Адрес из карточки клиента", testId: "option-trade-point-use-dealer-address" }]
        : [],
    [row.releaseAddress],
  );
  const dealerContactNameOptions = useMemo(
    () =>
      isFilled(row.contacts.lpr)
        ? [{ value: row.contacts.lpr.trim(), description: "ЛПР из карточки клиента", testId: "option-trade-point-use-dealer-contact-name" }]
        : [],
    [row.contacts.lpr],
  );
  const dealerPhoneOptions = useMemo(
    () =>
      isFilled(row.contacts.phone)
        ? [{ value: formatRussianPhoneInput(row.contacts.phone), description: "Телефон из карточки клиента", testId: "option-trade-point-use-dealer-phone" }]
        : [],
    [row.contacts.phone],
  );
  const dealerEmailOptions = useMemo(
    () =>
      isFilled(row.contacts.email)
        ? [{ value: row.contacts.email.trim(), description: "Email из карточки клиента", testId: "option-trade-point-use-dealer-email" }]
        : [],
    [row.contacts.email],
  );

  const resetAddForm = useCallback(() => {
    setAddName("");
    setAddCity("");
    setAddAddress("");
    setAddFormat("Розница / салон");
    setAddContactName("");
    setAddContactPhone("");
    setAddContactEmail("");
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
      setTpSuggestionsDismissed(false);
    }
    prevAddOpenRef.current = addOpen;
  }, [addOpen, row.id]);

  const tpSuggestions = useMemo<TradePointSuggestion[]>(() => {
    if (!addOpen) return [];
    return findSimilarTradePointsInDealer({
      row,
      manualTradePoints: Object.values(actx.state.manuallyCreatedTradePointsById ?? {}),
      inputName: addName,
      inputAddress: addAddress,
      inputCity: addCity,
      excludeTradePointId: draftTpIdRef.current,
    });
  }, [addOpen, row, actx.state.manuallyCreatedTradePointsById, addName, addAddress, addCity]);

  const tpSuggestionsBlock =
    tpSuggestions.length > 0 && !tpSuggestionsDismissed ? (
      <div
        className="my-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
        data-testid="block-tp-create-suggestions"
      >
        <div className="mb-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          В карточке уже есть похожие точки:
        </div>
        <div className="space-y-1.5">
          {tpSuggestions.map((s) => (
            <div
              key={s.tradePointId}
              className="rounded border border-amber-200/60 bg-background/80 p-2 text-xs dark:border-amber-900/30"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-muted-foreground">
                {[s.city, s.address].filter(Boolean).join(", ") || "Без адреса"}
              </div>
              <div className="mt-1 text-[10px] text-amber-800/80 dark:text-amber-200/70">
                {s.source === "seed" ? "Системная точка" : "Ручная точка"}
                {s.matchedField === "both"
                  ? " · похож адрес и название"
                  : s.matchedField === "address"
                    ? " · похож адрес"
                    : " · похоже название"}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTpSuggestionsDismissed(true)}
          className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          data-testid="button-tp-suggestions-dismiss"
        >
          Скрыть подсказки — это другая точка
        </button>
      </div>
    ) : null;

  const onAddSave = useCallback(async (): Promise<boolean> => {
    setAddError("");
    if (!addName.trim() || !addCity.trim() || !addAddress.trim() || !addContactName.trim() || !addContactPhone.trim()) {
      setAddError("Заполните название, город, адрес, контактное лицо и телефон.");
      return false;
    }
    if (!isValidRussianPhoneLoose(addContactPhone)) {
      setAddError(RU_PHONE_INVALID_MESSAGE);
      return false;
    }
    const formattedPhone = formatRussianPhoneInput(addContactPhone);
    if (useAct) {
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
            contactPhone: formattedPhone,
            email: addContactEmail.trim(),
            comment: addComment.trim(),
          },
          createdAt: existing?.createdAt ?? now,
          createdBy: existing?.createdBy ?? profile.personaUserId,
          createdByName: existing?.createdByName ?? userLabelFromProfile(profile),
          updatedAt: now,
          updatedBy: profile.personaUserId,
          updatedByName: userLabelFromProfile(profile),
          source: "manual_actualization" as const,
        };
        return mergeActualizationState(prev, {
          manuallyCreatedTradePointsById: { ...prev.manuallyCreatedTradePointsById, [id]: rec },
        });
      });
      if (r.success) {
        try {
          const tpFields = mapActualizationTpFieldsToOverrides({
            name: addName.trim(),
            city: addCity.trim(),
            address: addAddress.trim(),
            contactName: addContactName.trim(),
            contactPhone: formattedPhone,
            comment: addComment.trim(),
          });
          await saveTradePointFields(id, tpFields, row.id, {
            fieldLabel: "Торговая точка",
            source: "dealer-trade-points-section",
          });
        } catch {
          /* очередь tp-upsert подхватит воркер */
        }
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
        contactPhone: formattedPhone,
        contactEmail: addContactEmail,
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
    addContactEmail,
    addComment,
    profile,
    row.id,
    resetAddForm,
  ]);

  const promoteVirtualToManual = useCallback(
    async (virtualTp: DealerTradePoint): Promise<DealerTradePoint | null> => {
      if (!useAct) return null;
      const newId = generateStableManualTradePointId(row.id);
      const now = new Date().toISOString();
      const fields = {
        name: virtualTp.name || "Основная торговая точка",
        city: virtualTp.city || "",
        address: virtualTp.address || "",
        format: virtualTp.format || "Розница / салон",
        contactName: virtualTp.contactName ?? "",
        contactPhone: virtualTp.contactPhone ?? "",
        email: virtualTp.contactEmail ?? "",
        comment: virtualTp.tpComment ?? "",
      };
      const r = await actx.persist((prev) => {
        const existing = prev.manuallyCreatedTradePointsById[newId];
        const internalCode = existing?.internalCode ?? nextManualTradePointInternalCode(prev);
        const rec = {
          id: newId,
          dealerId: row.id,
          internalCode,
          fields,
          createdAt: existing?.createdAt ?? now,
          createdBy: existing?.createdBy ?? profile.personaUserId,
          createdByName: existing?.createdByName ?? userLabelFromProfile(profile),
          updatedAt: now,
          updatedBy: profile.personaUserId,
          updatedByName: userLabelFromProfile(profile),
          source: "manual_actualization" as const,
        };
        return mergeActualizationState(prev, {
          manuallyCreatedTradePointsById: { ...prev.manuallyCreatedTradePointsById, [newId]: rec },
        });
      });
      if (!r.success) {
        toast({
          title: "Не удалось создать редактируемую точку. Проверьте соединение.",
          variant: "destructive",
        });
        return null;
      }
      try {
        const tpFields = mapActualizationTpFieldsToOverrides({
          name: fields.name,
          city: fields.city,
          address: fields.address,
          contactName: fields.contactName,
          contactPhone: fields.contactPhone,
          comment: fields.comment,
        });
        await saveTradePointFields(newId, tpFields, row.id, {
          fieldLabel: "Торговая точка",
          source: "dealer-trade-points-section",
        });
      } catch {
        /* очередь tp-upsert подхватит воркер */
      }
      setTpBump((n) => n + 1);
      return {
        ...virtualTp,
        id: newId,
        name: fields.name,
        city: fields.city,
        address: fields.address,
        format: fields.format,
        contactName: fields.contactName,
        contactPhone: fields.contactPhone,
        contactEmail: fields.email,
        tpComment: fields.comment,
      };
    },
    [useAct, actx, row.id, profile],
  );

  const openEdit = useCallback(
    (tp: DealerTradePoint) => {
      setEditId(tp.id);
      setEditName(tp.name);
      setEditCity(tp.city);
      setEditAddress(tp.address);
      setEditFormat(tp.format);
      setEditContactName(tp.contactName ?? "");
      setEditContactPhone(formatRussianPhoneInput(tp.contactPhone ?? ""));
      setEditContactEmail(tp.contactEmail ?? "");
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
    if (editContactPhone.trim() && !isValidRussianPhoneLoose(editContactPhone)) {
      toast({ title: RU_PHONE_INVALID_MESSAGE, variant: "destructive" });
      return false;
    }
    const formattedPhone = editContactPhone.trim() ? formatRussianPhoneInput(editContactPhone) : "";
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      name: editName.trim(),
      city: editCity.trim(),
      address: editAddress.trim(),
      format: editFormat.trim(),
      contactName: editContactName.trim(),
      contactPhone: formattedPhone,
      email: editContactEmail.trim(),
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
    const tpFields = mapActualizationTpFieldsToOverrides({
      name: editName.trim(),
      city: editCity.trim(),
      address: editAddress.trim(),
      contactName: editContactName.trim(),
      contactPhone: formattedPhone,
      comment: editComment.trim(),
    });
    const strictResult = await saveTradePointFields(editId, tpFields, row.id, {
      fieldLabel: "Торговая точка",
      source: "dealer-trade-points-section",
    });
    if (r.success || strictResult.ok) {
      setEditOpen(false);
      setEditId(null);
      return true;
    }
    toast({
      title: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.",
      variant: "destructive",
    });
    return false;
  }, [useAct, editId, editName, editCity, editAddress, editFormat, editContactName, editContactPhone, editContactEmail, editComment, actx, row.id, profile]);

  /** Промт 422: удаление ТТ из карточки клиента — trash API (БД). */
  const refreshTradePointsFromServer = useCallback(async () => {
    await hydrateTradePointOverridesFromServer({ dealerId: row.id });
    setTpBump((n) => n + 1);
  }, [row.id]);

  const onArchive = useCallback(
    async (tp: DealerTradePoint): Promise<boolean> => {
      if (!useAct || !canArchiveTradePointDuringActualization(profile, row, tp)) return false;
      const r = await trashTradePointStrict(tp.id);
      if (r.ok) {
        await refreshTradePointsFromServer();
        toast({ title: "Точка перемещена в корзину", description: "Хранится 14 дней. Восстановить можно из раздела «Корзина»." });
        return true;
      }
      toast({
        title: "Не удалось переместить в корзину",
        description: r.message ?? "Ошибка запроса",
        variant: "destructive",
      });
      return false;
    },
    [useAct, profile, row, refreshTradePointsFromServer],
  );

  const onSetPrimary = useCallback(
    async (tpId: string) => {
      if (!useAct || !canEdit) return;
      setPrimaryBusyId(tpId);
      const r = await setPrimaryTradePointStrict(tpId);
      setPrimaryBusyId(null);
      if (r.ok) {
        await refreshTradePointsFromServer();
      } else {
        toast({
          title: "Не удалось назначить основную точку",
          description: r.message ?? "Ошибка запроса",
          variant: "destructive",
        });
      }
    },
    [useAct, canEdit, refreshTradePointsFromServer],
  );

  const confirmSingleArchiveTradePoint = useCallback(async () => {
    if (!singleDeleteTarget) return;
    setSingleDeleteBusy(true);
    const ok = await onArchive(singleDeleteTarget.tp);
    setSingleDeleteBusy(false);
    if (ok) setSingleDeleteTarget(null);
  }, [singleDeleteTarget, onArchive]);


  const primaryTpId = useMemo(
    () => mergedActive.find((e) => e.point.isPrimary)?.point.id ?? mergedActive[0]?.point.id ?? "",
    [mergedActive],
  );
  const showPrimaryRadios = useAct && canEdit && mergedActive.length >= 2;
  const listToShow = mergedActive;
  void hasAnyTradePointEver;

  const tpListLimit = useMemo(() => {
    if (expanded || listToShow.length <= 3) return listToShow.length;
    return Math.min(3, listToShow.length);
  }, [expanded, listToShow]);

  const tpListSlice = useMemo(() => listToShow.slice(0, tpListLimit), [listToShow, tpListLimit]);
  const manualTpStateForRow = Object.values(actx.state.manuallyCreatedTradePointsById).filter((m) => m.dealerId === row.id);
  const tpListSliceIds = tpListSlice.map((e) => e.point.id).join(",");
  const manualTpStateIds = manualTpStateForRow.map((m) => m.id).join(",");
  const diagAttrs = {
    "data-diag-row-id": row.id,
    "data-diag-use-act": String(useAct),
    "data-diag-can-edit": String(canEdit),
    "data-diag-actx-enabled": String(actx.enabled),
    "data-diag-merged-active-len": String(mergedActive.length),
    "data-diag-has-any-ever": String(hasAnyTradePointEver),
    "data-diag-is-virtual": String(isUsingVirtualDefault),
    "data-diag-tp-list-len": String(tpListSlice.length),
    "data-diag-tp-list-ids": tpListSliceIds,
    "data-diag-manual-tp-state-len": String(manualTpStateForRow.length),
    "data-diag-manual-tp-state-ids": manualTpStateIds,
  };

  const archivableTradePointIdsFull = useMemo(() => {
    if (!useAct || !canEdit) return new Set<string>();
    const s = new Set<string>();
    for (const entry of mergedActive) {
      const tp = entry.point;
      if (isVirtualDefaultTradePointId(row.id, tp.id)) continue;
      if (!canArchiveTradePointDuringActualization(profile, row, tp)) continue;
      if (!canTrashTradePointUi(tp, mergedActive.length)) continue;
      s.add(tp.id);
    }
    return s;
  }, [useAct, canEdit, mergedActive, profile, row]);

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

  /** Промт 422: bulk-delete ТТ из карточки клиента — trash API (БД). */
  const confirmBulkArchiveTradePoints = useCallback(async () => {
    const ids = Array.from(selectedBulkArchiveTpIds).filter((id) => archivableTradePointIdsFull.has(id));
    if (ids.length === 0) {
      setBulkArchiveTpDialogOpen(false);
      return;
    }
    setBulkArchiveTpBusy(true);
    let okCount = 0;
    let lastError: string | undefined;
    for (const id of ids) {
      const r = await trashTradePointStrict(id);
      if (r.ok) okCount += 1;
      else lastError = r.message;
    }
    if (okCount > 0) await refreshTradePointsFromServer();
    setBulkArchiveTpBusy(false);
    if (okCount === ids.length) {
      toast({ title: "Торговые точки перемещены в корзину", description: "Хранятся 14 дней. Восстановить можно из раздела «Корзина»." });
      setSelectedBulkArchiveTpIds(new Set());
      setBulkArchiveTpDialogOpen(false);
    } else {
      toast({
        title: okCount > 0 ? "Часть точек не удалось переместить" : "Не удалось переместить в корзину",
        description: lastError ?? "Ошибка запроса",
        variant: "destructive",
      });
    }
  }, [selectedBulkArchiveTpIds, archivableTradePointIdsFull, refreshTradePointsFromServer]);

  if (mergedActive.length === 0 && !hasAnyTradePointEver) {
    return (
      <section
        id={sectionDomId}
        data-testid="section-dealer-trade-points"
        className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
        {...diagAttrs}
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
                <LocalSuggestInput
                  value={addCity}
                  onChange={(v) => {
                    setAddCity(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerCityOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-city"
                />
              </div>
              {tpSuggestionsBlock}
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
                  localOptions={dealerAddressOptions}
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
                <LocalSuggestInput
                  value={addContactName}
                  onChange={(v) => {
                    setAddContactName(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerContactNameOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <LocalSuggestInput
                  value={addContactPhone}
                  onChange={(v) => {
                    setAddContactPhone(formatRussianPhoneInput(v));
                    addTpSave.markDirty();
                  }}
                  options={dealerPhoneOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-phone"
                  placeholder={RU_PHONE_PLACEHOLDER}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <LocalSuggestInput
                  value={addContactEmail}
                  onChange={(v) => {
                    setAddContactEmail(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerEmailOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-email"
                  inputMode="email"
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

  if (mergedActive.length === 0 && hasAnyTradePointEver) {
    return (
      <section
        id={sectionDomId}
        data-testid="section-dealer-trade-points"
        className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
        {...diagAttrs}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
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
                <LocalSuggestInput
                  value={addCity}
                  onChange={(v) => {
                    setAddCity(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerCityOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-city"
                />
              </div>
              {tpSuggestionsBlock}
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
                  localOptions={dealerAddressOptions}
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
                <LocalSuggestInput
                  value={addContactName}
                  onChange={(v) => {
                    setAddContactName(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerContactNameOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <LocalSuggestInput
                  value={addContactPhone}
                  onChange={(v) => {
                    setAddContactPhone(formatRussianPhoneInput(v));
                    addTpSave.markDirty();
                  }}
                  options={dealerPhoneOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-phone"
                  placeholder={RU_PHONE_PLACEHOLDER}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <LocalSuggestInput
                  value={addContactEmail}
                  onChange={(v) => {
                    setAddContactEmail(v);
                    addTpSave.markDirty();
                  }}
                  options={dealerEmailOptions}
                  className="min-h-10"
                  testId="input-dealer-trade-point-contact-email"
                  inputMode="email"
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
    <section
      id={sectionDomId}
      data-testid="section-dealer-trade-points"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
      {...diagAttrs}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
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

      {useAct && canEdit && archivableTradePointIdsFull.size > 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="text-trade-point-bulk-selection-hint">
          Выберите одну или несколько точек, чтобы удалить их из рабочей карточки.
        </p>
      ) : null}

      {useAct &&
      canEdit &&
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
              Удалить
            </Button>
          </div>
        </div>
      ) : null}

      <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <RadioGroup
          value={primaryTpId}
          onValueChange={(value) => {
            if (value && value !== primaryTpId) void onSetPrimary(value);
          }}
          className="space-y-2"
        >
        {tpListSlice.map((entry) => {
          const { point: tp, isManual, isEdited, isArchived } = entry;
          const contact = tradePointContact(tp, row, mergedActive.length);
          const showBadge = isFilled(tp.showcaseStatus);
          const isVirtual = isVirtualDefaultTradePointId(row.id, tp.id);
          const isPrimary = tp.isPrimary === true;
          const showPrimaryRadio = showPrimaryRadios && !isVirtual;
          const trashDisabledReason = tradePointTrashDisabledReason(tp, mergedActive.length);
          const rowTestId = isVirtual ? "row-dealer-trade-point-default" : `row-dealer-trade-point-${tp.id}`;
          const openButtonTestId = isVirtual
            ? "button-dealer-open-default-trade-point"
            : `button-dealer-trade-point-open-${tp.id}`;
          const canArchiveThisTp =
            useAct && canEdit && !isVirtual && !isArchived && canArchiveTradePointDuringActualization(profile, row, tp);
          const trashButton = canArchiveThisTp ? (
            trashDisabledReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="inline-flex h-8 w-full items-center justify-center gap-1 border-destructive/30 px-2 text-xs font-medium text-destructive opacity-70 sm:justify-start"
                      data-testid={`button-trade-point-delete-${tp.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="max-sm:sr-only">В корзину</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{trashDisabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex h-8 w-full items-center justify-center gap-1 border-destructive/30 px-2 text-xs font-medium text-destructive hover:bg-destructive/[0.06] sm:justify-start"
                data-testid={`button-trade-point-delete-${tp.id}`}
                onClick={() => setSingleDeleteTarget({ tp, isManual })}
                title="В корзину"
                aria-label="В корзину"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="max-sm:sr-only">В корзину</span>
              </Button>
            )
          ) : null;
          return (
            <Card
              key={tp.id}
              data-testid={rowTestId}
              className="rounded-lg border border-border/60 bg-card shadow-xs"
            >
              <CardContent className="space-y-2 p-3 sm:p-3.5">
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
                      {isPrimary && !showPrimaryRadio ? (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          data-testid={`badge-dealer-trade-point-primary-${tp.id}`}
                        >
                          Основная
                        </Badge>
                      ) : null}
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
                    {showPrimaryRadio ? (
                      <div
                        className="flex items-center gap-2 pt-1"
                        data-testid={`trade-point-primary-radio-${tp.id}`}
                      >
                        <RadioGroupItem
                          value={tp.id}
                          id={`tp-primary-${tp.id}`}
                          disabled={primaryBusyId !== null}
                          data-testid={`radio-trade-point-primary-${tp.id}`}
                        />
                        <Label htmlFor={`tp-primary-${tp.id}`} className="text-xs font-medium text-foreground">
                          Основная
                        </Label>
                      </div>
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
                    <div className="mt-1 flex flex-col gap-1.5 border-t border-border/40 pt-2 sm:mt-0 sm:border-t-0 sm:pt-0">
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                        className={cn(
                          "h-8 w-full px-2 text-xs font-semibold",
                          hideSyntheticTpChrome && "bg-primary text-primary-foreground hover:bg-[#86B832]",
                        )}
                        data-testid={openButtonTestId}
                      >
                        <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>
                          {isVirtual ? "Открыть основную точку" : "Открыть точку"}
                        </Link>
                      </Button>
                      {useAct && canEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full px-2 text-xs font-medium"
                          data-testid={`button-trade-point-edit-${tp.id}`}
                          onClick={() => {
                            void (async () => {
                              if (isVirtual) {
                                const realTp = await promoteVirtualToManual(tp);
                                if (realTp) openEdit(realTp);
                              } else {
                                openEdit(tp);
                              }
                            })();
                          }}
                        >
                          Редактировать
                        </Button>
                      ) : null}
                      {trashButton}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </RadioGroup>
      </div>
      </TooltipProvider>

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
              <LocalSuggestInput
                value={addCity}
                onChange={(v) => {
                  setAddCity(v);
                  addTpSave.markDirty();
                }}
                options={dealerCityOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-city"
              />
            </div>
            {tpSuggestionsBlock}
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
                localOptions={dealerAddressOptions}
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
              <LocalSuggestInput
                value={addContactName}
                onChange={(v) => {
                  setAddContactName(v);
                  addTpSave.markDirty();
                }}
                options={dealerContactNameOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <LocalSuggestInput
                value={addContactPhone}
                onChange={(v) => {
                  setAddContactPhone(formatRussianPhoneInput(v));
                  addTpSave.markDirty();
                }}
                options={dealerPhoneOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-contact-phone"
                placeholder={RU_PHONE_PLACEHOLDER}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <LocalSuggestInput
                value={addContactEmail}
                onChange={(v) => {
                  setAddContactEmail(v);
                  addTpSave.markDirty();
                }}
                options={dealerEmailOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-contact-email"
                inputMode="email"
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
              <LocalSuggestInput
                value={editCity}
                onChange={(v) => {
                  setEditCity(v);
                  editTpSave.markDirty();
                }}
                options={dealerCityOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-edit-city"
              />
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
                localOptions={dealerAddressOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <LocalSuggestInput
                value={editContactName}
                onChange={(v) => {
                  setEditContactName(v);
                  editTpSave.markDirty();
                }}
                options={dealerContactNameOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-edit-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <LocalSuggestInput
                value={editContactPhone}
                onChange={(v) => {
                  setEditContactPhone(formatRussianPhoneInput(v));
                  editTpSave.markDirty();
                }}
                options={dealerPhoneOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-edit-contact-phone"
                placeholder={RU_PHONE_PLACEHOLDER}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <LocalSuggestInput
                value={editContactEmail}
                onChange={(v) => {
                  setEditContactEmail(v);
                  editTpSave.markDirty();
                }}
                options={dealerEmailOptions}
                className="min-h-10"
                testId="input-dealer-trade-point-edit-contact-email"
                inputMode="email"
              />
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
            <AlertDialogTitle>Переместить {bulkArchiveTpDialogCount} торговых точек в корзину?</AlertDialogTitle>
            <AlertDialogDescription>
              Торговые точки будут храниться в корзине 14 дней. Восстановить можно в любой момент на странице «Корзина». Через 14 дней удалятся окончательно.
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
              className="min-h-10 w-full gap-1.5 font-semibold sm:w-auto"
              data-testid="button-trade-point-bulk-archive-confirm"
              disabled={bulkArchiveTpBusy || bulkArchiveTpDialogCount === 0}
              onClick={() => void confirmBulkArchiveTradePoints()}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {bulkArchiveTpBusy ? "Перемещение…" : "Переместить в корзину"}
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
              Торговая точка уйдёт в корзину на 30 дней. Восстановить можно из раздела «Корзина».
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
              variant="destructive"
              className="min-h-10 w-full gap-1.5 font-semibold sm:w-auto"
              data-testid="button-trade-point-delete-confirm"
              disabled={singleDeleteBusy || !singleDeleteTarget}
              onClick={() => void confirmSingleArchiveTradePoint()}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {singleDeleteBusy ? "Удаление…" : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
