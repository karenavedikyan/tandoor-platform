/**
 * Список торговых точек по всем доступным клиентам (актуализация).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Info, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DealerBulkDeleteCheckbox } from "@/components/dealer-bulk-delete-checkbox";
import { TradePointRowListThumb } from "@/components/trade-point-row-list-thumb";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { mergeActualizationState, createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  canArchiveTradePointDuringActualization,
  canActualizeClientBase,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import {
  buildTradePointListForActualization,
  type TradePointListRow,
  type TradePointShowcaseBucket,
} from "@/lib/trade-point-list-for-actualization";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { getClientCategoryLabel, type ClientCategoryId } from "@/lib/client-category";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";

type ViewMode = "cards" | "list" | "compact";

type SortKey =
  | "city"
  | "dealer"
  | "tpName"
  | "showcase"
  | "deficit"
  | "updated"
  | "unloading";

type ShowcaseStatusFilter = "all" | TradePointShowcaseBucket;
type TasksFilter = "all" | "deficit" | "no_deficit" | "has_tasks" | "no_tasks";
type PortalFilter = "all" | "has_portals" | "no_portals" | "unfilled" | "free" | "overflow";

type QuickPreset = "all" | "unfilled_showcase" | "deficit" | "no_address" | "no_responsible";

const SHOWCASE_FILTER_LABELS: Record<Exclude<ShowcaseStatusFilter, "all">, string> = {
  not_filled: "Не заполнена",
  no_showcase: "Нет витрины",
  has_showcase: "Есть витрина",
  partial: "Заполнена частично",
  needs_attention: "Требует заполнения",
};

const PORTAL_FILTER_LABELS: Record<Exclude<PortalFilter, "all">, string> = {
  has_portals: "Есть порталы",
  no_portals: "Нет порталов",
  unfilled: "Порталы не заполнены",
  free: "Свободные порталы",
  overflow: "Превышение моделей",
};

const TASKS_FILTER_LABELS: Record<Exclude<TasksFilter, "all">, string> = {
  deficit: "Есть дефицит по матрице",
  no_deficit: "Нет дефицита",
  has_tasks: "Есть созданные задачи",
  no_tasks: "Нет задач",
};

const UNFILLED_SHOWCASE_BUCKETS: TradePointShowcaseBucket[] = ["not_filled", "partial", "needs_attention"];

const LS_TRADE_POINTS_VIEW_MODE = "tandoor-trade-points-view-mode-v1";
const LS_TRADE_POINTS_FILTERS_COLLAPSED = "tandoor-trade-points-filters-collapsed-v1";

function readViewModeFromStorage(): ViewMode {
  if (typeof window === "undefined") return "cards";
  try {
    const v = window.localStorage.getItem(LS_TRADE_POINTS_VIEW_MODE);
    if (v === "cards" || v === "list" || v === "compact") return v;
  } catch {
    /* ignore */
  }
  return "cards";
}

function readFiltersCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_TRADE_POINTS_FILTERS_COLLAPSED) === "1";
  } catch {
    return false;
  }
}

/** Круглый селектор удаления ТТ: ≥28px на mobile, иконка галочки крупнее. */
const TRADE_POINT_BULK_CHECKBOX_CLASS =
  "!box-border !h-7 !w-7 !min-h-[28px] !min-w-[28px] !border-2 sm:!h-8 sm:!w-8 sm:!min-h-8 sm:!min-w-8 [&_svg]:!h-4 [&_svg]:!w-4";

/** Компактный чекбокс для dense-режимов (bulk), без раздувания карточки/строки. */
const TRADE_POINT_BULK_CHECKBOX_COMPACT_CLASS =
  "!box-border !h-5 !w-5 !min-h-5 !min-w-5 !border-2 [&_svg]:!h-2.5 [&_svg]:!w-2.5 md:!h-6 md:!w-6 md:!min-h-6 md:!min-w-6 md:[&_svg]:!h-3 md:[&_svg]:!w-3";

function searchMatches(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => haystack.includes(p));
}

function showcaseRank(b: TradePointShowcaseBucket): number {
  const order: TradePointShowcaseBucket[] = ["not_filled", "needs_attention", "partial", "no_showcase", "has_showcase"];
  const i = order.indexOf(b);
  return i === -1 ? 99 : i;
}

function rowKey(r: TradePointListRow): string {
  return `${r.dealerId}:${r.tradePointId}`;
}

function isMeaningfulStaffName(s: string): boolean {
  const t = s.trim();
  return t !== "" && t !== "—";
}

function staffDisplayForDetail(s: string): string {
  return isMeaningfulStaffName(s) ? s.trim() : "Не назначен";
}

function rowHasNoResponsible(r: TradePointListRow): boolean {
  return !isMeaningfulStaffName(r.manager) && !isMeaningfulStaffName(r.regionalManager) && !isMeaningfulStaffName(r.rop);
}

function rowHasNoAddress(r: TradePointListRow): boolean {
  const a = r.address.trim();
  const c = r.city.trim();
  return a === "" || a === "—" || c === "" || c === "—";
}

function uniqueSortedStaff(values: Iterable<string>): string[] {
  const s = new Set<string>();
  for (const v of Array.from(values)) {
    if (isMeaningfulStaffName(v)) s.add(v.trim());
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

type ActiveFilterChip = {
  filterKey: string;
  label: string;
};

export default function TradePointsPage(): ReactElement {
  const actx = useClientBaseActualization();
  const { profile } = useReleaseDemoProfile();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const actState = actx.enabled ? actx.state : createEmptyActualizationState();

  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewModeFromStorage());
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(() => readFiltersCollapsedFromStorage());
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [dealerFilter, setDealerFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<ClientCategoryId | "all">("all");
  const [pointFormatFilter, setPointFormatFilter] = useState<string>("__all__");
  const [showcaseFilter, setShowcaseFilter] = useState<ShowcaseStatusFilter>("all");
  const [portalFilter, setPortalFilter] = useState<PortalFilter>("all");
  const [tasksFilter, setTasksFilter] = useState<TasksFilter>("all");
  const [mgrFilter, setMgrFilter] = useState<string>("__all__");
  const [rmFilter, setRmFilter] = useState<string>("__all__");
  const [ropFilter, setRopFilter] = useState<string>("__all__");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("tpName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [quickPreset, setQuickPreset] = useState<QuickPreset>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<TradePointListRow | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  /** В bulk-режиме: показать также ТТ без права архива (по умолчанию скрыты). */
  const [showIneligibleInBulkMode, setShowIneligibleInBulkMode] = useState(false);
  const [selectedBulkTpKeys, setSelectedBulkTpKeys] = useState<Set<string>>(() => new Set());
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [bulkArchiveBusy, setBulkArchiveBusy] = useState(false);

  const baseRows = useMemo(
    () => buildTradePointListForActualization(actState, profile, { includeArchivedTradePoints: showArchived }),
    [actState, profile, showArchived],
  );

  const workingRows = useMemo(
    () => buildTradePointListForActualization(actState, profile, { includeArchivedTradePoints: false }),
    [actState, profile],
  );

  const summary = useMemo(() => {
    let filled = 0;
    let missing = 0;
    let noShow = 0;
    let deficit = 0;
    let tasks = 0;
    for (const r of workingRows) {
      if (r.showcaseBucket === "has_showcase") filled += 1;
      if (r.showcaseBucket === "no_showcase") noShow += 1;
      if (r.showcaseBucket === "not_filled" || r.showcaseBucket === "partial" || r.showcaseBucket === "needs_attention") {
        missing += 1;
      }
      if (r.matrixDeficitCount > 0) deficit += 1;
      if (r.showcaseNewTasksCount > 0) tasks += 1;
    }
    return {
      total: workingRows.length,
      filled,
      noShow,
      missing,
      deficit,
      tasks,
    };
  }, [workingRows]);

  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of baseRows) {
      if (r.city && r.city !== "—") s.add(r.city);
    }
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((c) => ({ value: c, label: c }));
  }, [baseRows]);

  const dealerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of baseRows) m.set(r.dealerId, r.dealerName);
    return Array.from(m.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ru"))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [baseRows]);

  const formatOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of baseRows) {
      if (r.tradePointFormatLabel) s.add(r.tradePointFormatLabel);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [baseRows]);

  const managerOptions = useMemo(() => uniqueSortedStaff(baseRows.map((r) => r.manager)), [baseRows]);
  const rmOptions = useMemo(() => uniqueSortedStaff(baseRows.map((r) => r.regionalManager)), [baseRows]);
  const ropOptions = useMemo(() => uniqueSortedStaff(baseRows.map((r) => r.rop)), [baseRows]);

  const filteredSorted = useMemo(() => {
    let list = baseRows.slice();

    if (search.trim()) list = list.filter((r) => searchMatches(r.searchHaystack, search));
    if (cityFilter.length) list = list.filter((r) => cityFilter.includes(r.city));
    if (dealerFilter !== "__all__") list = list.filter((r) => r.dealerId === dealerFilter);
    if (categoryFilter !== "all") list = list.filter((r) => r.clientCategory === categoryFilter);
    if (pointFormatFilter !== "__all__") {
      list = list.filter((r) => (r.tradePointFormatLabel ?? "") === pointFormatFilter);
    }
    if (showcaseFilter !== "all") list = list.filter((r) => r.showcaseBucket === showcaseFilter);

    if (portalFilter === "has_portals") list = list.filter((r) => r.portalsTotal != null && r.portalsTotal > 0);
    else if (portalFilter === "no_portals") list = list.filter((r) => r.hasShowcase === true && (r.portalsTotal == null || r.portalsTotal === 0));
    else if (portalFilter === "unfilled") list = list.filter((r) => r.portalsUnfilled);
    else if (portalFilter === "free") list = list.filter((r) => r.hasFreePortals);
    else if (portalFilter === "overflow") list = list.filter((r) => r.portalOverfill);

    if (tasksFilter === "deficit") list = list.filter((r) => r.matrixDeficitCount > 0);
    else if (tasksFilter === "no_deficit") list = list.filter((r) => r.matrixDeficitCount === 0);
    else if (tasksFilter === "has_tasks") list = list.filter((r) => r.showcaseNewTasksCount > 0);
    else if (tasksFilter === "no_tasks") list = list.filter((r) => r.showcaseNewTasksCount === 0);

    if (mgrFilter !== "__all__") list = list.filter((r) => r.manager.trim() === mgrFilter);
    if (rmFilter !== "__all__") list = list.filter((r) => r.regionalManager.trim() === rmFilter);
    if (ropFilter !== "__all__") list = list.filter((r) => r.rop.trim() === ropFilter);

    if (quickPreset === "unfilled_showcase") {
      list = list.filter((r) => UNFILLED_SHOWCASE_BUCKETS.includes(r.showcaseBucket));
    } else if (quickPreset === "deficit") {
      list = list.filter((r) => r.matrixDeficitCount > 0);
    } else if (quickPreset === "no_address") {
      list = list.filter((r) => rowHasNoAddress(r));
    } else if (quickPreset === "no_responsible") {
      list = list.filter((r) => rowHasNoResponsible(r));
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "city":
          cmp = a.city.localeCompare(b.city, "ru");
          break;
        case "dealer":
          cmp = a.dealerName.localeCompare(b.dealerName, "ru");
          break;
        case "tpName":
          cmp = a.tradePointName.localeCompare(b.tradePointName, "ru");
          break;
        case "showcase":
          cmp = showcaseRank(a.showcaseBucket) - showcaseRank(b.showcaseBucket);
          break;
        case "deficit":
          cmp = a.matrixDeficitCount - b.matrixDeficitCount;
          break;
        case "updated": {
          const ta = a.showcaseUpdatedAt ?? "";
          const tb = b.showcaseUpdatedAt ?? "";
          cmp = ta < tb ? -1 : ta > tb ? 1 : 0;
          break;
        }
        case "unloading": {
          const ua = a.unloadingOrder ?? 999999;
          const ub = b.unloadingOrder ?? 999999;
          cmp = ua - ub;
          break;
        }
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = a.tradePointId.localeCompare(b.tradePointId);
      return cmp * dir;
    });

    return list;
  }, [
    baseRows,
    search,
    cityFilter,
    dealerFilter,
    categoryFilter,
    pointFormatFilter,
    showcaseFilter,
    portalFilter,
    tasksFilter,
    mgrFilter,
    rmFilter,
    ropFilter,
    sortKey,
    sortDir,
    quickPreset,
  ]);

  const listStats = useMemo(() => {
    let deficit = 0;
    let unfilledShowcase = 0;
    for (const r of filteredSorted) {
      if (r.matrixDeficitCount > 0) deficit += 1;
      if (UNFILLED_SHOWCASE_BUCKETS.includes(r.showcaseBucket)) unfilledShowcase += 1;
    }
    return { deficit, unfilledShowcase };
  }, [filteredSorted]);

  const canEdit = useCallback((row: TradePointListRow) => canEditDealerDuringActualization(profile, row.dealer), [profile]);

  const canArchiveRow = useCallback(
    (row: TradePointListRow) =>
      actx.enabled &&
      canEdit(row) &&
      !row.isVirtual &&
      canArchiveTradePointDuringActualization(profile, row.dealer, row.point) &&
      !row.isArchived,
    [actx.enabled, profile, canEdit],
  );

  const archiveBlockReason = useCallback(
    (row: TradePointListRow): string | null => {
      if (!actx.enabled) return "Актуализация недоступна.";
      if (row.isArchived) return "Точка уже в архиве.";
      if (row.isVirtual) return "Виртуальная точка не архивируется.";
      if (!canEdit(row)) return "Нет прав на редактирование этого клиента.";
      if (!canArchiveTradePointDuringActualization(profile, row.dealer, row.point)) return "Нет прав на архив торговых точек.";
      return null;
    },
    [actx.enabled, profile, canEdit],
  );

  const canShowBulkTradePointControls = actx.enabled && canActualizeClientBase(profile) && !showArchived;

  /** Сколько ТТ в текущей выдаче (по фильтрам) реально можно архивировать. */
  const eligibleTradePointsInFilterCount = useMemo(() => filteredSorted.filter((r) => canArchiveRow(r)).length, [filteredSorted, canArchiveRow]);

  /** Строки для списка/карточек: в bulk по умолчанию только доступные для удаления. */
  const tradePointsRowsForList = useMemo(() => {
    if (!bulkDeleteMode || !canShowBulkTradePointControls) return filteredSorted;
    if (showIneligibleInBulkMode) return filteredSorted;
    return filteredSorted.filter((r) => canArchiveRow(r));
  }, [bulkDeleteMode, canShowBulkTradePointControls, showIneligibleInBulkMode, filteredSorted, canArchiveRow]);

  /** Ключи ТТ, доступных для выбора на экране (совпадают с отображаемым списком при скрытых недоступных). */
  const archivableTpKeysInView = useMemo(() => {
    const s = new Set<string>();
    for (const r of tradePointsRowsForList) {
      if (canArchiveRow(r)) s.add(rowKey(r));
    }
    return s;
  }, [tradePointsRowsForList, canArchiveRow]);

  const bulkSelectedVisibleCount = useMemo(() => {
    let n = 0;
    for (const k of Array.from(selectedBulkTpKeys)) {
      if (archivableTpKeysInView.has(k)) n += 1;
    }
    return n;
  }, [selectedBulkTpKeys, archivableTpKeysInView]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_TRADE_POINTS_VIEW_MODE, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_TRADE_POINTS_FILTERS_COLLAPSED, desktopFiltersCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [desktopFiltersCollapsed]);

  useEffect(() => {
    if (showArchived) {
      setBulkDeleteMode(false);
      setShowIneligibleInBulkMode(false);
      setSelectedBulkTpKeys(new Set());
    }
  }, [showArchived]);

  const exitBulkDeleteMode = useCallback(() => {
    setBulkDeleteMode(false);
    setShowIneligibleInBulkMode(false);
    setSelectedBulkTpKeys(new Set());
  }, []);

  useEffect(() => {
    setSelectedBulkTpKeys((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((k) => {
        if (archivableTpKeysInView.has(k)) n.add(k);
        else changed = true;
      });
      if (!changed && n.size === prev.size) return prev;
      return n;
    });
  }, [archivableTpKeysInView]);

  const toggleBulkTp = useCallback((key: string, checked: boolean) => {
    setSelectedBulkTpKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const allVisibleArchivableSelected = useMemo(() => {
    if (archivableTpKeysInView.size === 0) return false;
    for (const k of Array.from(archivableTpKeysInView)) {
      if (!selectedBulkTpKeys.has(k)) return false;
    }
    return true;
  }, [archivableTpKeysInView, selectedBulkTpKeys]);

  const someVisibleArchivableSelected = useMemo(() => {
    for (const k of Array.from(archivableTpKeysInView)) {
      if (selectedBulkTpKeys.has(k)) return true;
    }
    return false;
  }, [archivableTpKeysInView, selectedBulkTpKeys]);

  const resetAllFilters = useCallback(() => {
    setSearch("");
    setCityFilter([]);
    setDealerFilter("__all__");
    setCategoryFilter("all");
    setPointFormatFilter("__all__");
    setShowcaseFilter("all");
    setPortalFilter("all");
    setTasksFilter("all");
    setMgrFilter("__all__");
    setRmFilter("__all__");
    setRopFilter("__all__");
    setShowArchived(false);
    setQuickPreset("all");
    setSortKey("tpName");
    setSortDir("asc");
  }, []);

  const removeFilterChip = useCallback((filterKey: string) => {
    switch (filterKey) {
      case "search":
        setSearch("");
        break;
      case "city":
        setCityFilter([]);
        break;
      case "dealer":
        setDealerFilter("__all__");
        break;
      case "category":
        setCategoryFilter("all");
        break;
      case "format":
        setPointFormatFilter("__all__");
        break;
      case "showcase":
        setShowcaseFilter("all");
        break;
      case "portals":
        setPortalFilter("all");
        break;
      case "tasks":
        setTasksFilter("all");
        break;
      case "manager":
        setMgrFilter("__all__");
        break;
      case "regionalManager":
        setRmFilter("__all__");
        break;
      case "rop":
        setRopFilter("__all__");
        break;
      case "archived":
        setShowArchived(false);
        break;
      case "quick":
        setQuickPreset("all");
        break;
      default:
        break;
    }
  }, []);

  const activeFilterChips = useMemo((): ActiveFilterChip[] => {
    const chips: ActiveFilterChip[] = [];
    if (search.trim()) chips.push({ filterKey: "search", label: `Поиск: ${search.trim()}` });
    if (cityFilter.length) chips.push({ filterKey: "city", label: `Город: ${cityFilter.join(", ")}` });
    if (dealerFilter !== "__all__") {
      const name = dealerOptions.find((o) => o.value === dealerFilter)?.label ?? dealerFilter;
      chips.push({ filterKey: "dealer", label: `Клиент: ${name}` });
    }
    if (categoryFilter !== "all") {
      chips.push({ filterKey: "category", label: `Категория: ${getClientCategoryLabel(categoryFilter)}` });
    }
    if (pointFormatFilter !== "__all__") chips.push({ filterKey: "format", label: `Формат ТТ: ${pointFormatFilter}` });
    if (showcaseFilter !== "all") {
      chips.push({ filterKey: "showcase", label: `Витрина: ${SHOWCASE_FILTER_LABELS[showcaseFilter]}` });
    }
    if (portalFilter !== "all") {
      chips.push({ filterKey: "portals", label: `Порталы: ${PORTAL_FILTER_LABELS[portalFilter]}` });
    }
    if (tasksFilter !== "all") {
      chips.push({ filterKey: "tasks", label: `Задачи: ${TASKS_FILTER_LABELS[tasksFilter]}` });
    }
    if (mgrFilter !== "__all__") chips.push({ filterKey: "manager", label: `Менеджер: ${mgrFilter}` });
    if (rmFilter !== "__all__") chips.push({ filterKey: "regionalManager", label: `Рег. менеджер: ${rmFilter}` });
    if (ropFilter !== "__all__") chips.push({ filterKey: "rop", label: `РОП: ${ropFilter}` });
    if (showArchived) chips.push({ filterKey: "archived", label: "Показаны архивные ТТ" });
    if (quickPreset !== "all") {
      const qLabel =
        quickPreset === "unfilled_showcase"
          ? "Не заполнена витрина"
          : quickPreset === "deficit"
            ? "Есть дефицит"
            : quickPreset === "no_address"
              ? "Без адреса"
              : "Без ответственного";
      chips.push({ filterKey: "quick", label: `Быстро: ${qLabel}` });
    }
    return chips;
  }, [
    search,
    cityFilter,
    dealerFilter,
    categoryFilter,
    pointFormatFilter,
    showcaseFilter,
    portalFilter,
    tasksFilter,
    mgrFilter,
    rmFilter,
    ropFilter,
    showArchived,
    quickPreset,
    dealerOptions,
  ]);

  const activeFilterCount = activeFilterChips.length;

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget || !actx.enabled) return;
    setArchiveBusy(true);
    const tp = archiveTarget.point;
    const now = new Date().toISOString();
    const uid = user?.id ?? profile.personaUserId;
    const uname = user?.name?.trim() || userLabelFromProfile(profile);
    const r = await actx.persist((prev) =>
      mergeActualizationState(prev, {
        archivedTradePointsById: {
          ...prev.archivedTradePointsById,
          [tp.id]: {
            tradePointId: tp.id,
            dealerId: archiveTarget.dealerId,
            archivedAt: now,
            archivedBy: uid,
            archivedByName: uname,
            source: "manual_actualization" as const,
          },
        },
      }),
    );
    setArchiveBusy(false);
    setArchiveTarget(null);
    if (r.success) toast({ title: "Торговая точка удалена из рабочей базы" });
    else toast({ title: "Не удалось сохранить", variant: "destructive" });
  }, [archiveTarget, actx, profile, user]);

  const rowsByCompositeKey = useMemo(() => new Map(filteredSorted.map((x) => [rowKey(x), x])), [filteredSorted]);

  const confirmBulkArchive = useCallback(async () => {
    if (!actx.enabled) return;
    const keys = Array.from(selectedBulkTpKeys).filter((k) => archivableTpKeysInView.has(k));
    if (keys.length === 0) {
      setBulkArchiveDialogOpen(false);
      return;
    }
    setBulkArchiveBusy(true);
    const now = new Date().toISOString();
    const uid = user?.id ?? profile.personaUserId;
    const uname = user?.name?.trim() || userLabelFromProfile(profile);
    const r = await actx.persist((prev) => {
      const next = { ...prev.archivedTradePointsById };
      for (const key of keys) {
        const row = rowsByCompositeKey.get(key);
        if (!row || row.isArchived || row.isVirtual) continue;
        if (!canEditDealerDuringActualization(profile, row.dealer)) continue;
        if (!canArchiveTradePointDuringActualization(profile, row.dealer, row.point)) continue;
        next[row.tradePointId] = {
          tradePointId: row.tradePointId,
          dealerId: row.dealerId,
          archivedAt: now,
          archivedBy: uid,
          archivedByName: uname,
          source: "manual_actualization" as const,
        };
      }
      return mergeActualizationState(prev, { archivedTradePointsById: next });
    });
    setBulkArchiveBusy(false);
    if (r.success) {
      toast({ title: "Торговые точки удалены из рабочей базы" });
      setSelectedBulkTpKeys(new Set());
      setBulkDeleteMode(false);
      setBulkArchiveDialogOpen(false);
    } else {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    }
  }, [selectedBulkTpKeys, archivableTpKeysInView, actx, profile, user, rowsByCompositeKey]);

  const tpHref = (r: TradePointListRow) => `/dealers/${encodeURIComponent(r.dealerId)}/trade-points/${encodeURIComponent(r.tradePointId)}`;
  const dealerHref = (r: TradePointListRow) => `/dealers/${encodeURIComponent(r.dealerId)}`;

  const filtersCollapsibleOpen = isMobile ? mobileFiltersOpen : true;

  const filterForm = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1 sm:col-span-2 lg:col-span-3">
        <Label className="text-xs">Поиск</Label>
        <Input
          className="min-h-10"
          value={search}
          data-testid="input-trade-points-search"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ТТ, адрес, город, клиент, коды…"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Город</Label>
        <MultiSelect options={cityOptions} value={cityFilter} onChange={setCityFilter} placeholder="Все города" testId="filter-trade-points-city" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Клиент</Label>
        <Select value={dealerFilter} onValueChange={setDealerFilter}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-client">
            <SelectValue placeholder="Все клиенты" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все клиенты</SelectItem>
            {dealerOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Категория клиента</Label>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ClientCategoryId | "all")}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-client-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="top150">ТОП 150</SelectItem>
            <SelectItem value="top350">ТОП 350</SelectItem>
            <SelectItem value="top500">ТОП 500</SelectItem>
            <SelectItem value="top500plus">ТОП 500+</SelectItem>
            <SelectItem value="uncategorized">Без категории</SelectItem>
            <SelectItem value="potential">Потенциальный</SelectItem>
            <SelectItem value="lead">Лид</SelectItem>
            <SelectItem value="no_sales">Б/П</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Формат ТТ</Label>
        <Select value={pointFormatFilter} onValueChange={setPointFormatFilter}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-point-category">
            <SelectValue placeholder={formatOptions.length ? "Все форматы" : "Нет данных в анкетах"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все / не указано</SelectItem>
            {formatOptions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Статус витрины</Label>
        <Select value={showcaseFilter} onValueChange={(v) => setShowcaseFilter(v as ShowcaseStatusFilter)}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-showcase-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            {(Object.keys(SHOWCASE_FILTER_LABELS) as Exclude<ShowcaseStatusFilter, "all">[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SHOWCASE_FILTER_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Порталы</Label>
        <Select value={portalFilter} onValueChange={(v) => setPortalFilter(v as PortalFilter)}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-portals">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="has_portals">Есть порталы (число заполнено)</SelectItem>
            <SelectItem value="no_portals">Нет порталов (0)</SelectItem>
            <SelectItem value="unfilled">Порталы не заполнены</SelectItem>
            <SelectItem value="free">Есть свободные порталы</SelectItem>
            <SelectItem value="overflow">Превышение моделей над порталами</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Задачи по витрине</Label>
        <Select value={tasksFilter} onValueChange={(v) => setTasksFilter(v as TasksFilter)}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-showcase-tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="deficit">Есть дефицит по матрице</SelectItem>
            <SelectItem value="no_deficit">Нет дефицита</SelectItem>
            <SelectItem value="has_tasks">Есть созданные задачи</SelectItem>
            <SelectItem value="no_tasks">Нет задач</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Менеджер</Label>
        <Select value={mgrFilter} onValueChange={setMgrFilter}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-manager">
            <SelectValue placeholder="ФИО менеджера" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все менеджеры</SelectItem>
            {managerOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Региональный менеджер</Label>
        <Select value={rmFilter} onValueChange={setRmFilter}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-regional-manager">
            <SelectValue placeholder="ФИО регионального менеджера" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все</SelectItem>
            {rmOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">РОП</Label>
        <Select value={ropFilter} onValueChange={setRopFilter}>
          <SelectTrigger className="min-h-10" data-testid="filter-trade-points-rop">
            <SelectValue placeholder="ФИО РОП" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все</SelectItem>
            {ropOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-3">
        <div className="space-y-0.5">
          <Label htmlFor="toggle-archived-tp" className="text-xs">
            Показать архивные ТТ
          </Label>
          <p className="text-[11px] text-muted-foreground">По умолчанию скрыты архивные точки и клиенты в архиве не попадают в список.</p>
          <p className="text-[11px] text-muted-foreground" data-testid="text-trade-points-archived-dealers-hidden-hint">
            Точки архивных клиентов скрыты из рабочего списка. Восстановите клиента, чтобы вернуть его точки в рабочую базу.
          </p>
        </div>
        <Switch id="toggle-archived-tp" checked={showArchived} data-testid="toggle-trade-points-show-archived" onCheckedChange={(v) => setShowArchived(v === true)} />
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
        <div className="space-y-1">
          <Label className="text-xs">Сортировка</Label>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="min-h-10 w-[200px] max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="city">По городу</SelectItem>
              <SelectItem value="dealer">По клиенту</SelectItem>
              <SelectItem value="tpName">По названию ТТ</SelectItem>
              <SelectItem value="showcase">По статусу витрины</SelectItem>
              <SelectItem value="deficit">По дефициту матрицы</SelectItem>
              <SelectItem value="updated">По дате актуализации витрины</SelectItem>
              <SelectItem value="unloading">По порядку выгрузки</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "По возрастанию" : "По убыванию"}
        </Button>
        <Button type="button" size="sm" variant="secondary" className="min-h-10" data-testid="button-trade-points-filters-reset" onClick={resetAllFilters}>
          Сбросить все
        </Button>
      </div>
    </div>
  );

  const quickPresetButton = (id: QuickPreset, label: string) => (
    <Button
      key={id}
      type="button"
      size="sm"
      variant={quickPreset === id ? "default" : "outline"}
      className="shrink-0 touch-manipulation"
      onClick={() => setQuickPreset(id)}
    >
      {label}
    </Button>
  );

  const viewModeBtnClass = (active: boolean) =>
    cn("min-h-10 shrink-0 touch-manipulation", active && "ring-2 ring-primary ring-offset-2 ring-offset-background");

  const renderArchiveHint = (row: TradePointListRow) => {
    const reason = archiveBlockReason(row);
    if (!reason || canArchiveRow(row)) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Почему недоступно удаление"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          {reason}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderBulkRowControl = (r: TradePointListRow, opts?: { dense?: boolean }) => {
    const dense = opts?.dense === true;
    const cbClass = dense ? TRADE_POINT_BULK_CHECKBOX_COMPACT_CLASS : TRADE_POINT_BULK_CHECKBOX_CLASS;
    if (!bulkDeleteMode || !canShowBulkTradePointControls) return null;
    const k = rowKey(r);
    const selected = selectedBulkTpKeys.has(k);
    if (canArchiveRow(r)) {
      return (
        <div className={cn("flex shrink-0 items-center", dense ? "gap-1" : "gap-2 sm:gap-2.5")}>
          <DealerBulkDeleteCheckbox
            id={`tp-bulk-${k}`}
            checked={selected}
            onCheckedChange={(v) => toggleBulkTp(k, v === true)}
            data-testid={`checkbox-trade-points-select-${r.tradePointId}`}
            aria-label="Выбрать торговую точку для удаления из рабочей базы"
            className={cbClass}
          />
          {!dense ? (
            <button
              type="button"
              className={cn(
                "shrink-0 text-left text-xs font-semibold leading-none underline-offset-2 hover:underline sm:text-sm",
                selected ? "text-destructive" : "text-destructive/90",
              )}
              onClick={() => toggleBulkTp(k, !selected)}
            >
              {selected ? "Выбрано" : "Выбрать"}
            </button>
          ) : null}
        </div>
      );
    }
    if (!showIneligibleInBulkMode) return null;
    const reason = archiveBlockReason(r);
    return (
      <div className="flex shrink-0 items-center" data-testid={`text-trade-points-delete-unavailable-${r.tradePointId}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
              aria-label={reason ?? "Недоступно"}
            >
              Недоступно
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px]">
            {reason ?? "Недоступно для удаления"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const listDesktopGridCols =
    bulkDeleteMode && canShowBulkTradePointControls
      ? "md:grid-cols-[auto_minmax(0,2.75rem)_minmax(0,4.5rem)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,4.5rem)_minmax(0,6.5rem)_minmax(0,3.5rem)_auto]"
      : "md:grid-cols-[minmax(0,2.75rem)_minmax(0,4.5rem)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,4.5rem)_minmax(0,6.5rem)_minmax(0,3.5rem)_auto]";

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden px-1 sm:space-y-6 sm:px-0" data-testid="page-trade-points">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Торговые точки</h1>
          </div>
          <p className="text-sm text-muted-foreground">Все точки клиентов, доступные по вашей зоне ответственности</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "cards" ? "default" : "outline"}
            className={viewModeBtnClass(viewMode === "cards")}
            data-testid="button-trade-points-view-cards"
            onClick={() => setViewMode("cards")}
          >
            Карточки
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            className={viewModeBtnClass(viewMode === "list")}
            data-testid="button-trade-points-view-list"
            onClick={() => setViewMode("list")}
          >
            Список
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "compact" ? "default" : "outline"}
            className={viewModeBtnClass(viewMode === "compact")}
            data-testid="button-trade-points-view-compact"
            onClick={() => setViewMode("compact")}
          >
            Компактно
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border border-border/70 bg-muted/20 p-3",
          "max-md:flex max-md:flex-col max-md:gap-2 max-md:text-sm",
          "md:flex md:flex-wrap md:items-center md:gap-x-4 md:gap-y-1 md:text-sm",
        )}
      >
        <p className="max-md:leading-snug md:inline md:shrink-0" data-testid="text-trade-points-found-summary">
          <span className="font-medium text-foreground">Найдено:</span>{" "}
          <span data-testid="text-trade-points-found-count">
            {filteredSorted.length} из {summary.total} ТТ
          </span>
        </p>
        <span className="hidden md:inline md:text-muted-foreground" aria-hidden>
          ·
        </span>
        <p className="max-md:leading-snug md:inline md:shrink-0" data-testid="text-trade-points-total-count">
          <span className="font-medium text-foreground">Всего рабочих ТТ:</span> {summary.total}
        </p>
        <span className="hidden md:inline md:text-muted-foreground" aria-hidden>
          ·
        </span>
        <p className="max-md:leading-snug md:inline md:shrink-0" data-testid="text-trade-points-list-deficit-count">
          <span className="font-medium text-foreground">Дефицит:</span> {listStats.deficit}
        </p>
        <span className="hidden md:inline md:text-muted-foreground" aria-hidden>
          ·
        </span>
        <p className="max-md:leading-snug md:inline md:shrink-0" data-testid="text-trade-points-list-unfilled-showcase-count">
          <span className="font-medium text-foreground">Витрина не заполнена:</span> {listStats.unfilledShowcase}
        </p>
        <span className="hidden md:inline md:text-muted-foreground" aria-hidden>
          ·
        </span>
        <p className="max-md:leading-snug md:inline md:shrink-0" data-testid="text-trade-points-with-tasks-count">
          <span className="font-medium text-foreground">С задачами:</span> {summary.tasks}
        </p>
        <div className="max-md:mt-1 max-md:flex max-md:flex-col max-md:gap-2 max-md:border-t max-md:border-border/60 max-md:pt-2 md:contents">
          <p className="text-sm md:hidden" data-testid="text-trade-points-showcase-filled-count">
            <span className="font-medium text-foreground">С заполненной витриной:</span> {summary.filled}
          </p>
          <p className="text-sm md:hidden">
            <span className="font-medium text-foreground">Без витрины:</span> {summary.noShow}
          </p>
          <p className="text-sm md:hidden" data-testid="text-trade-points-showcase-missing-count">
            <span className="font-medium text-foreground">Витрина не заполнена / частично (всего):</span> {summary.missing}
          </p>
          <p className="text-sm md:hidden" data-testid="text-trade-points-matrix-deficit-count">
            <span className="font-medium text-foreground">С дефицитом по матрице (всего):</span> {summary.deficit}
          </p>
        </div>
        {activeFilterCount > 0 ? (
          <p
            className="text-sm font-medium text-amber-950 dark:text-amber-100 max-md:pt-1 md:ml-auto md:w-full md:pt-1 lg:w-auto"
            data-testid="text-trade-points-active-filters-banner"
          >
            Фильтры активны: {activeFilterCount}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground md:w-auto md:py-1.5">Быстрые фильтры</span>
        {quickPresetButton("all", "Все")}
        {quickPresetButton("unfilled_showcase", "Не заполнена витрина")}
        {quickPresetButton("deficit", "Есть дефицит")}
        {quickPresetButton("no_address", "Без адреса")}
        {quickPresetButton("no_responsible", "Без ответственного")}
        <Button
          type="button"
          size="sm"
          variant={showArchived ? "default" : "outline"}
          className="shrink-0 touch-manipulation"
          onClick={() => setShowArchived((v) => !v)}
        >
          С архивом
        </Button>
      </div>

      {canShowBulkTradePointControls ? (
        <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {!bulkDeleteMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 shrink-0 gap-2 font-semibold"
                data-testid="button-trade-points-bulk-delete-mode"
                disabled={filteredSorted.length === 0}
                title={filteredSorted.length === 0 ? "В списке нет торговых точек." : undefined}
                onClick={() => {
                  setShowIneligibleInBulkMode(false);
                  setBulkDeleteMode(true);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Выбрать для удаления</span>
                <span className="sm:hidden">Удалить ТТ</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 shrink-0 font-semibold"
                data-testid="button-trade-points-bulk-delete-mode-cancel"
                onClick={exitBulkDeleteMode}
              >
                Отменить выбор
              </Button>
            )}
          </div>
          {bulkDeleteMode ? (
            <p className="text-sm leading-snug text-muted-foreground" data-testid="text-trade-points-bulk-delete-mode-hint">
              Отметьте точки в списке ниже или воспользуйтесь «Выбрать доступные на экране».
            </p>
          ) : null}
          {bulkDeleteMode && canShowBulkTradePointControls && eligibleTradePointsInFilterCount === 0 && filteredSorted.length > 0 ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50"
              data-testid="text-trade-points-bulk-no-eligible-alert"
            >
              В текущем списке нет торговых точек, доступных для удаления.
            </div>
          ) : null}
        </div>
      ) : null}

      {bulkDeleteMode && canShowBulkTradePointControls && eligibleTradePointsInFilterCount > 0 ? (
        <div
          className="space-y-3 rounded-xl border-2 border-destructive/35 bg-destructive/[0.08] p-3 shadow-sm"
          data-testid="panel-trade-points-bulk-actions"
        >
          <div className="flex flex-wrap items-center gap-3">
            <DealerBulkDeleteCheckbox
              id="tp-bulk-select-all-visible"
              checked={allVisibleArchivableSelected ? true : someVisibleArchivableSelected ? "indeterminate" : false}
              onCheckedChange={(v) => {
                if (v === true) setSelectedBulkTpKeys(new Set(archivableTpKeysInView));
                else setSelectedBulkTpKeys(new Set());
              }}
              data-testid="checkbox-trade-points-select-all-visible"
              aria-label="Выбрать все доступные для удаления торговые точки на экране"
              className={viewMode === "compact" ? TRADE_POINT_BULK_CHECKBOX_COMPACT_CLASS : TRADE_POINT_BULK_CHECKBOX_CLASS}
            />
            <Label htmlFor="tp-bulk-select-all-visible" className="cursor-pointer text-sm font-semibold text-destructive sm:text-base">
              Выбрать доступные на экране
            </Label>
          </div>
          {bulkSelectedVisibleCount > 0 ? (
            <div className="flex flex-col gap-3 border-t border-destructive/25 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-base font-bold text-destructive" data-testid="text-trade-points-bulk-selected-count">
                Выбрано: {bulkSelectedVisibleCount}
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-full font-semibold sm:min-h-10 sm:w-auto"
                  data-testid="button-trade-points-bulk-clear-selection"
                  onClick={() => setSelectedBulkTpKeys(new Set())}
                >
                  Снять выбор
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="default"
                  className="min-h-11 w-full text-base font-bold shadow-md sm:min-h-10 sm:w-auto"
                  data-testid="button-trade-points-bulk-archive"
                  onClick={() => setBulkArchiveDialogOpen(true)}
                >
                  Удалить / в архив
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Отметьте точки в списке ниже или нажмите «Выбрать доступные на экране».</p>
          )}
        </div>
      ) : null}

      {isMobile ? (
        <Collapsible open={filtersCollapsibleOpen} onOpenChange={setMobileFiltersOpen}>
          <Card>
            <CardHeader className="space-y-3 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="secondary" size="sm" className="min-h-10 gap-2" data-testid="button-trade-points-filters-toggle">
                    Фильтры
                    {activeFilterCount > 0 ? (
                      <Badge variant="default" className="rounded-full px-2 py-0 text-xs font-bold">
                        <span data-testid="text-trade-points-active-filters-count">{activeFilterCount}</span>
                      </Badge>
                    ) : null}
                  </Button>
                </CollapsibleTrigger>
                {activeFilterCount > 0 ? (
                  <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={resetAllFilters}>
                    Сбросить
                  </Button>
                ) : null}
              </div>
              {activeFilterCount > 0 ? (
                <div className="flex flex-wrap gap-2" data-testid="panel-trade-points-active-filter-chips">
                  {activeFilterChips.map((c) => (
                    <Badge key={`m-${c.filterKey}`} variant="secondary" className="max-w-full gap-1 py-1 pl-2 pr-1" data-testid={`chip-trade-points-filter-${c.filterKey}`}>
                      <span className="truncate">{c.label}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-background/80"
                        data-testid={`button-trade-points-filter-chip-remove-${c.filterKey}`}
                        aria-label={`Сбросить: ${c.label}`}
                        onClick={() => removeFilterChip(c.filterKey)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              <CardTitle className="text-base">Фильтры</CardTitle>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>{filterForm}</CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <CardTitle className="text-base">Фильтры</CardTitle>
              {!desktopFiltersCollapsed && activeFilterCount > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    <span data-testid="text-trade-points-active-filters-count">{activeFilterCount}</span> активных
                  </Badge>
                  <Button type="button" variant="ghost" size="sm" onClick={resetAllFilters}>
                    Сбросить
                  </Button>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0 gap-1.5"
              data-testid={desktopFiltersCollapsed ? "button-trade-points-filters-expand" : "button-trade-points-filters-collapse"}
              onClick={() => setDesktopFiltersCollapsed((v) => !v)}
            >
              {desktopFiltersCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  Показать фильтры
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  Свернуть фильтры
                </>
              )}
            </Button>
          </CardHeader>
          {desktopFiltersCollapsed ? (
            <CardContent className="pt-0">
              <div
                className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
                data-testid="section-trade-points-filters-collapsed-summary"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Фильтры: {activeFilterCount} активных</span>
                  {activeFilterCount > 0 ? (
                    <Button type="button" variant="secondary" size="sm" className="h-8" data-testid="button-trade-points-filters-reset" onClick={resetAllFilters}>
                      Сбросить все
                    </Button>
                  ) : null}
                </div>
                {activeFilterCount > 0 ? (
                  <div className="flex flex-wrap gap-2" data-testid="panel-trade-points-active-filter-chips">
                    {activeFilterChips.map((c) => (
                      <Badge key={c.filterKey} variant="secondary" className="max-w-full gap-1 py-1 pl-2 pr-1" data-testid={`chip-trade-points-filter-${c.filterKey}`}>
                        <span className="truncate">{c.label}</span>
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-background/80"
                          data-testid={`button-trade-points-filter-chip-remove-${c.filterKey}`}
                          aria-label={`Сбросить: ${c.label}`}
                          onClick={() => removeFilterChip(c.filterKey)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Нет активных фильтров. Раскройте блок, чтобы задать поиск и отбор.</p>
                )}
              </div>
            </CardContent>
          ) : (
            <>
              {activeFilterCount > 0 ? (
                <CardContent className="border-t pt-3">
                  <div className="flex flex-wrap gap-2" data-testid="panel-trade-points-active-filter-chips">
                    {activeFilterChips.map((c) => (
                      <Badge key={c.filterKey} variant="secondary" className="max-w-full gap-1 py-1 pl-2 pr-1" data-testid={`chip-trade-points-filter-${c.filterKey}`}>
                        <span className="truncate">{c.label}</span>
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-background/80"
                          data-testid={`button-trade-points-filter-chip-remove-${c.filterKey}`}
                          aria-label={`Сбросить: ${c.label}`}
                          onClick={() => removeFilterChip(c.filterKey)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              ) : null}
              <CardContent className={activeFilterCount > 0 ? "pt-0" : ""}>{filterForm}</CardContent>
            </>
          )}
        </Card>
      )}

      {bulkDeleteMode && canShowBulkTradePointControls && eligibleTradePointsInFilterCount > 0 ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="text-trade-points-bulk-list-scope-hint"
        >
          {!showIneligibleInBulkMode ? (
            <p>
              В режиме удаления показаны только точки, доступные для удаления.
              {eligibleTradePointsInFilterCount < filteredSorted.length ? (
                <span className="whitespace-nowrap font-medium text-foreground">
                  {" "}
                  ({eligibleTradePointsInFilterCount} из {filteredSorted.length})
                </span>
              ) : null}
            </p>
          ) : (
            <p>Показаны все точки по фильтру. Недоступные для удаления помечены бейджем «Недоступно».</p>
          )}
          {eligibleTradePointsInFilterCount < filteredSorted.length ? (
            !showIneligibleInBulkMode ? (
              <Button type="button" variant="ghost" className="h-auto min-h-0 shrink-0 self-start p-0 text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => setShowIneligibleInBulkMode(true)}>
                Показать недоступные ({filteredSorted.length - eligibleTradePointsInFilterCount})
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="h-auto min-h-0 shrink-0 self-start p-0 text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => setShowIneligibleInBulkMode(false)}>
                Только доступные для удаления
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      {viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border/80">
          <div
            className={cn(
              "hidden gap-2 border-b bg-muted/40 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid md:items-center",
              listDesktopGridCols,
            )}
          >
            {bulkDeleteMode && canShowBulkTradePointControls ? <span className="sr-only">Выбор</span> : null}
            <span className="sr-only">Фото</span>
            <span>Код</span>
            <span>ТТ</span>
            <span>Клиент</span>
            <span>Город</span>
            <span>Витрина</span>
            <span>Дефицит</span>
            <span className="text-right">Действия</span>
          </div>
          <ul className="divide-y divide-border/70">
            {tradePointsRowsForList.map((r) => {
              const k = rowKey(r);
              const bulkRowSelected = bulkDeleteMode && selectedBulkTpKeys.has(k) && canArchiveRow(r);
              const listBulkDense = !isMobile;
              return (
                <li
                  key={k}
                  data-testid={`row-trade-point-${r.tradePointId}`}
                  className={cn(
                    bulkRowSelected && "rounded-md border border-destructive/45 bg-destructive/[0.04] md:rounded-none md:border-x-0 md:border-t-0 md:border-b",
                  )}
                >
                  <div className="flex flex-col gap-2 px-2 py-3 md:hidden">
                    <div className="flex w-full min-w-0 items-start gap-2">
                      {renderBulkRowControl(r, { dense: false })}
                      <TradePointRowListThumb point={r.point} size="xs" className="shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-mono text-[11px] text-muted-foreground" data-testid={`text-trade-point-list-code-${r.tradePointId}`}>
                          {r.tradePointDisplayCode}
                        </p>
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{r.tradePointName}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{r.city}</p>
                      </div>
                    </div>
                    <p className="line-clamp-1 text-sm font-medium" data-testid={`text-trade-point-list-dealer-${r.tradePointId}`}>
                      {r.dealerName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {r.showcaseBucketLabel}
                      </Badge>
                      {r.matrixDeficitCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Деф. {r.matrixDeficitCount}
                        </Badge>
                      ) : null}
                      {r.isArchived ? (
                        <Badge variant="secondary" className="text-[10px]">
                          В архиве
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button asChild size="sm" variant="default" className="h-8 min-h-8 px-2 text-xs" data-testid={`button-trade-point-list-open-${r.tradePointId}`} title="ТТ">
                        <Link href={tpHref(r)}>ТТ</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-8 min-h-8 px-2 text-xs" data-testid={`button-trade-point-list-open-dealer-${r.dealerId}-${r.tradePointId}`} title="Клиент">
                        <Link href={dealerHref(r)}>Клиент</Link>
                      </Button>
                      {!bulkDeleteMode && !canArchiveRow(r) ? renderArchiveHint(r) : null}
                      {!bulkDeleteMode && canArchiveRow(r) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8 min-h-8 w-8 shrink-0 p-0"
                          data-testid={`button-trade-point-list-delete-${r.tradePointId}`}
                          title="Удалить ТТ"
                          onClick={() => setArchiveTarget(r)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn("hidden md:grid md:items-center md:gap-x-2 md:px-2 md:py-2 md:text-sm", listDesktopGridCols)}>
                    {bulkDeleteMode && canShowBulkTradePointControls ? (
                      <div className="flex items-center justify-start">{renderBulkRowControl(r, { dense: listBulkDense })}</div>
                    ) : null}
                    <div className="flex justify-center">
                      <TradePointRowListThumb point={r.point} size="xs" />
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground tabular-nums" data-testid={`text-trade-point-list-code-${r.tradePointId}`}>
                      {r.tradePointDisplayCode}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium leading-tight">{r.tradePointName}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium" data-testid={`text-trade-point-list-dealer-${r.tradePointId}`}>
                        {r.dealerName}
                      </p>
                    </div>
                    <div className="min-w-0 text-sm">{r.city}</div>
                    <div className="min-w-0">
                      <Badge variant="outline" className="max-w-full truncate text-[10px]">
                        {r.showcaseBucketLabel}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      {r.matrixDeficitCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Деф. {r.matrixDeficitCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex min-w-0 justify-end gap-1">
                      <Button asChild size="sm" variant="default" className="h-7 shrink-0 px-2 text-xs" data-testid={`button-trade-point-list-open-${r.tradePointId}`} title="ТТ">
                        <Link href={tpHref(r)}>ТТ</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" data-testid={`button-trade-point-list-open-dealer-${r.dealerId}-${r.tradePointId}`} title="Клиент">
                        <Link href={dealerHref(r)}>Клиент</Link>
                      </Button>
                      {!bulkDeleteMode && !canArchiveRow(r) ? renderArchiveHint(r) : null}
                      {!bulkDeleteMode && canArchiveRow(r) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 w-7 shrink-0 p-0"
                          data-testid={`button-trade-point-list-delete-${r.tradePointId}`}
                          title="Удалить ТТ"
                          onClick={() => setArchiveTarget(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : viewMode === "compact" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {tradePointsRowsForList.map((r) => {
            const k = rowKey(r);
            const bulkCardSelected = bulkDeleteMode && selectedBulkTpKeys.has(k) && canArchiveRow(r);
            return (
              <Card
                key={k}
                data-testid={`compact-card-trade-point-${r.tradePointId}`}
                className={cn(
                  "flex h-[160px] min-h-[140px] max-h-[180px] flex-col overflow-hidden border-border/80 shadow-sm",
                  bulkCardSelected && "border-destructive/50 bg-destructive/[0.03]",
                )}
              >
                <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
                  <div className="flex min-h-0 flex-1 gap-2">
                    {bulkDeleteMode && canShowBulkTradePointControls ? (
                      <div className="flex shrink-0 flex-col items-center pt-0.5">{renderBulkRowControl(r, { dense: true })}</div>
                    ) : null}
                    <TradePointRowListThumb point={r.point} size="xs" className="shrink-0" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-mono text-[10px] leading-none text-muted-foreground">{r.tradePointDisplayCode}</p>
                      <p className="line-clamp-1 text-sm font-semibold leading-tight">{r.tradePointName}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{r.city}</p>
                      <p className="line-clamp-1 text-xs font-medium leading-snug">{r.dealerName}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Badge variant="outline" className="max-w-full truncate px-1.5 py-0 text-[10px] leading-tight">
                      {r.showcaseBucketLabel}
                    </Badge>
                    {r.matrixDeficitCount > 0 ? (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px] leading-tight">
                        Деф. {r.matrixDeficitCount}
                      </Badge>
                    ) : null}
                    {r.isArchived ? (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] leading-tight">
                        Архив
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-auto flex shrink-0 flex-wrap gap-1">
                    <Button asChild size="sm" variant="default" className="h-7 min-h-7 flex-1 px-2 text-[11px] font-semibold sm:flex-none">
                      <Link href={tpHref(r)}>ТТ</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 min-h-7 flex-1 px-2 text-[11px] font-semibold sm:flex-none">
                      <Link href={dealerHref(r)}>Клиент</Link>
                    </Button>
                    {!bulkDeleteMode && !canArchiveRow(r) ? <span className="inline-flex shrink-0">{renderArchiveHint(r)}</span> : null}
                    {!bulkDeleteMode && canArchiveRow(r) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 w-7 shrink-0 p-0"
                        title="Удалить ТТ"
                        onClick={() => setArchiveTarget(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-6xl gap-3 sm:grid-cols-2">
          {tradePointsRowsForList.map((r) => {
            const k = rowKey(r);
            const bulkCardSelected = bulkDeleteMode && selectedBulkTpKeys.has(k) && canArchiveRow(r);
            return (
            <Card
              key={k}
              data-testid={`card-trade-point-${r.tradePointId}`}
              className={cn(
                "overflow-hidden",
                bulkCardSelected && "border-destructive/50 bg-destructive/[0.03]",
              )}
            >
              <CardHeader className="space-y-2 pb-2">
                <div className="flex w-full flex-col gap-2 sm:gap-2">
                  {bulkDeleteMode && canShowBulkTradePointControls ? <div className="flex w-full shrink-0">{renderBulkRowControl(r)}</div> : null}
                  <div className="flex w-full flex-wrap items-start gap-2 sm:gap-3">
                    <TradePointRowListThumb point={r.point} size="sm" className="shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-[11px] text-muted-foreground">{r.tradePointDisplayCode}</p>
                      <CardTitle className="text-base leading-snug">{r.tradePointName}</CardTitle>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {r.showcaseBucketLabel}
                      </Badge>
                      {r.matrixDeficitCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Дефицит {r.matrixDeficitCount}
                        </Badge>
                      ) : null}
                      {r.isArchived ? (
                        <Badge variant="secondary" className="text-[10px]">
                          В архиве
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{r.city}</span>
                  {r.address && r.address !== "—" ? <span className="block text-xs">{r.address}</span> : null}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="line-clamp-2">
                  <span className="text-muted-foreground">Клиент:</span>{" "}
                  <span className="font-medium">{r.dealerName}</span> <span className="text-xs text-muted-foreground">({r.dealerClientCode})</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Категория:</span> {r.clientCategoryLabel}
                </p>
                {r.tradePointFormatLabel ? (
                  <p>
                    <span className="text-muted-foreground">Формат ТТ:</span> {r.tradePointFormatLabel}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Витрина:</span> {r.showcaseBucketLabel}
                  {r.portalsTotal != null ? ` · порталов: ${r.portalsTotal}` : ""} · моделей: {r.modelsOnShowcaseCount}
                </p>
                {r.matrixDeficitCount > 0 ? (
                  <p className="text-sm">
                    <span className="font-semibold text-destructive">Дефицит матрицы:</span>{" "}
                    <span className="text-foreground">{r.matrixDeficitCount}</span>
                  </p>
                ) : null}
                {r.showcaseNewTasksCount > 0 ? <p className="text-xs text-emerald-800">Задач по витрине: {r.showcaseNewTasksCount}</p> : null}
                {r.showcaseUpdatedAt ? (
                  <p className="text-xs text-muted-foreground">Обновлено: {new Date(r.showcaseUpdatedAt).toLocaleString("ru-RU")}</p>
                ) : null}
                <div className="space-y-1 border-t border-border/60 pt-2 text-xs">
                  <p>
                    <span className="text-muted-foreground">Менеджер:</span> {staffDisplayForDetail(r.manager)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Рег. менеджер:</span> {staffDisplayForDetail(r.regionalManager)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">РОП:</span> {staffDisplayForDetail(r.rop)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="default">
                    <Link href={tpHref(r)}>Открыть ТТ</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={dealerHref(r)}>Клиент</Link>
                  </Button>
                  {!bulkDeleteMode && !canArchiveRow(r) ? renderArchiveHint(r) : null}
                  {!bulkDeleteMode && canArchiveRow(r) ? (
                    <Button type="button" size="sm" variant="destructive" onClick={() => setArchiveTarget(r)}>
                      Удалить ТТ
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {filteredSorted.length === 0 ? <p className="text-sm text-muted-foreground">Нет торговых точек по выбранным фильтрам.</p> : null}

      <AlertDialog open={archiveTarget != null} onOpenChange={(o) => !o && !archiveBusy && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить торговую точку?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {archiveTarget ? (
                  <>
                    <p>Точка «{archiveTarget.tradePointName}» будет скрыта из рабочей базы.</p>
                    <p>Это архив, а не физическое удаление — данные можно восстановить из архива.</p>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={archiveBusy} onClick={() => void confirmArchive()}>
              {archiveBusy ? "…" : "Удалить ТТ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkArchiveDialogOpen} onOpenChange={(o) => !o && !bulkArchiveBusy && setBulkArchiveDialogOpen(false)}>
        <AlertDialogContent data-testid="dialog-trade-points-bulk-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные торговые точки?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>Точки будут скрыты из рабочей базы.</span>{" "}
              <span>Данные не удаляются физически, их можно восстановить из архива.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkArchiveBusy} data-testid="button-trade-points-bulk-archive-cancel">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction disabled={bulkArchiveBusy} data-testid="button-trade-points-bulk-archive-confirm" onClick={() => void confirmBulkArchive()}>
              {bulkArchiveBusy ? "…" : "Удалить ТТ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
