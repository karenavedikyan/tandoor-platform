import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Grid3x3,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CatalogFiltersPanel } from "@/components/catalog/CatalogFiltersPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShowcaseSaveCompletenessGate } from "@/components/showcase-save-completeness-gate";
import { ShowcaseEquipmentCapacityDialog } from "@/components/showcase-equipment-capacity-dialog";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import {
  mergeActualizationState,
  normalizeHasShowcase,
  type TradePointShowcaseActualization,
} from "@/lib/client-base-actualization-state";
import {
  findShowcaseCapacityGaps,
  patchShowcaseTypeCapacity,
  type ShowcaseTypeKey,
} from "@/lib/showcase-type-capacity";
import {
  persistEquipmentCapacityInputs,
  categoryCapacityFieldsForPersist,
  categoryCapacityFromPlacements,
  growPlacementBlockToFitOurMarks,
  ourMarkLimitFromPlacementBlock,
  type EquipmentCapacityInputV2,
} from "@/lib/showcase-capacity-by-equipment";
import { notifyShowcaseCapacityAutoGrow } from "@/lib/showcase-capacity-toast";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { cn } from "@/lib/utils";
import {
  buildCatalogProductSearchHaystack,
  CATALOG_PRODUCTS,
  catalogSearchQueryMatchesHaystack,
  getProductById,
  searchCatalog,
  type CatalogProduct,
} from "@/lib/catalog-data";
import { useCatalogReady } from "@/lib/catalog-warmup";
import {
  readCatalogCardSizeFromStorage,
  writeCatalogCardSizeToStorage,
  type CatalogCardSize,
} from "@/lib/catalog-card-grid";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { fullscreenCounterpartyLine, resolveTradePointDisplayName } from "@/lib/trade-point-display-labels";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  allowedTypesForSegment,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import type {
  ShowcaseMatrixEntryDto,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "@/lib/showcase-matrix-api";
import {
  loadCachedMatrix,
  loadCachedPlacements,
  normalizeShowcaseMatrixModelId,
  setMatrixStatus,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import {
  buildInitialDraftRow,
  collectChangedProductIds,
  countInstalledInDraft,
  type FullscreenEntryBaseline,
  type FullscreenEntryDraftMap,
  type FullscreenEntryDraftRow,
} from "@/lib/distribution-fullscreen-entry-draft";
import { resolveTradePointMatrixModels } from "@/lib/trade-point-matrix-resolver";
import {
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import {
  getEffectiveMatrixEntry,
  getEffectiveMatrixStatus,
  getShowcaseMatrixTpHistoryEvents,
  loadShowcaseMatrixStorage,
  resolveMatrixModelStatus,
  SHOWCASE_MATRIX_CHANGED_EVENT,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCatalogFiltersUrl } from "@/hooks/use-catalog-filters-url";
import { computeCatalogFacets, countActiveCatalogFilters, filterCatalogProductsByFilters } from "@/lib/catalog-facets";
import {
  activeFullscreenSegmentCategory,
  FULLSCREEN_SEGMENT_CATEGORY_IDS,
  isFullscreenSegmentTabsVisible,
  segmentContextFromCategories,
  type FullscreenSegmentCategoryId,
} from "@/lib/distribution-fullscreen-entry-segments";
import {
  DISTRIBUTION_CATALOG_CATEGORIES,
  productDistributionCategory,
  type DistributionCatalogCategoryId,
} from "@/lib/distribution-catalog-categories";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryCatalogGridColumns,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import {
  assignmentShareUrl,
  createAssignment,
} from "@/lib/showcase-assignments-api";
import { fetchResolveTradePoint, fetchUsersForRole } from "@/lib/responsibility-api";
import { pickerUserById, type PickerUser } from "@/lib/users-picker-api";
import {
  OVERRIDES_PENDING_CHANGED_EVENT,
  pendingSyncCount,
} from "@/lib/overrides-pending-sync";
import { runOverridesPendingSyncOnce } from "@/lib/overrides-pending-sync-worker";

const CARD_SIZE_STORAGE_KEY = "distribution-fullscreen-entry-card-size";
const COMPACT_STORAGE_KEY = "distribution-fullscreen-entry-compact";
const ASSIGNMENT_ASSIGNEE_NONE = "__none__";

type FullscreenViewMode = "m" | "s" | "list";

function readFullscreenViewMode(): FullscreenViewMode {
  const raw = readCatalogCardSizeFromStorage(CARD_SIZE_STORAGE_KEY, "m");
  if (raw === "list") return "list";
  if (raw === "s") return "s";
  return "m";
}

function assigneeRoleLabel(role: string): string {
  if (role === "manager") return "менеджер";
  if (role === "regional_manager") return "региональный менеджер";
  if (role === "rop") return "РОП";
  return "";
}

function resolveModelDisplayName(id: string, matrixName?: string): string {
  const trimmed = matrixName?.trim();
  if (trimmed && trimmed !== id) return trimmed;
  const product = getProductById(id);
  if (product?.name?.trim()) return product.name.trim();
  return trimmed || id;
}

const ASSIGNMENT_CREATE_ROLES = new Set(["admin", "director", "rop", "regional_manager", "manager"]);

function fullscreenEntryProductGridClass(size: CatalogCardSize, compact: boolean): string {
  if (size === "list") return "flex flex-col gap-2";
  if (compact) {
    const compactDense: Record<Exclude<CatalogCardSize, "list">, string> = {
      xl: "grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      m: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7",
      s: "grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12",
    };
    return compactDense[size];
  }
  const dense: Record<Exclude<CatalogCardSize, "list">, string> = {
    xl: "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    m: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    s: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  };
  return dense[size];
}

type SourceTab = "matrix" | "catalog";
type StatusFilter = "all" | ShowcaseMatrixStatusId;

function matrixModelCategory(m: ShowcaseMatrixModelDefinition): DistributionCatalogCategoryId {
  if (m.type === "hardware") return "hardware";
  if (m.type === "interior") return "mk";
  return "vh";
}

function modelMatchesCategories(
  category: DistributionCatalogCategoryId,
  selected: readonly DistributionCatalogCategoryId[],
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(category);
}

function segmentFromProduct(p: CatalogProduct): ShowcasePlacementSegment {
  const cat = productDistributionCategory(p);
  if (cat === "hardware") return "hardware";
  if (cat === "mk") return "mk";
  return "vh";
}

function segmentFromMatrixModel(m: ShowcaseMatrixModelDefinition): ShowcasePlacementSegment {
  if (m.type === "hardware") return "hardware";
  return m.type === "interior" ? "mk" : "vh";
}

function stubMatrixModelFromProduct(p: CatalogProduct): ShowcaseMatrixModelDefinition {
  const entrance = segmentFromProduct(p) === "vh";
  return {
    id: p.id,
    name: p.name,
    type: entrance ? "entrance" : "interior",
    typeLabelRu: entrance ? "ВХ" : "МК",
    imageUrl: p.image ?? "",
    basePriority: "medium",
    importanceReason: "",
    characteristics: "",
    advantages: "",
    benefitsDealer: "",
    benefitsBuyer: "",
    objections: "",
    objectionAnswers: "",
    copyMessage: "",
  };
}

function formatHistoryAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatSavedAt(): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
}

function ourMarkLimitFromBlock(block: ShowcaseMatrixEntryDto | null): number | null {
  return ourMarkLimitFromPlacementBlock(block);
}

const PLACEMENT_SEGMENT_TO_TYPE_KEY: Record<ShowcasePlacementSegment, ShowcaseTypeKey> = {
  vh: "entrance",
  mk: "interior",
  hardware: "hardware",
};

function findPlacementBlock(
  placements: ShowcaseMatrixEntryDto[],
  segment: ShowcasePlacementSegment,
  placementType: ShowcasePlacementType,
): ShowcaseMatrixEntryDto | null {
  return (
    placements.find(
      (p) => p.placementSegment === segment && p.placementType === placementType,
    ) ?? null
  );
}

function effectiveDraftRow(
  productId: string,
  draft: FullscreenEntryDraftMap,
  baselines: Record<string, FullscreenEntryBaseline>,
): FullscreenEntryDraftRow | null {
  const row = draft[productId];
  if (row) return row;
  const baseline = baselines[productId];
  if (!baseline) return null;
  return buildInitialDraftRow(baseline);
}

function countMarkedOursInPlacement(
  draft: FullscreenEntryDraftMap,
  baselines: Record<string, FullscreenEntryBaseline>,
  segment: ShowcasePlacementSegment,
  placementType: ShowcasePlacementType,
): number {
  let count = 0;
  for (const id of Object.keys({ ...draft, ...baselines })) {
    const row = effectiveDraftRow(id, draft, baselines);
    if (!row || row.status !== "installed") continue;
    if (row.placementSegment !== segment || row.placementType !== placementType) continue;
    count++;
  }
  return count;
}

function isInstalledInPlacementType(
  productId: string,
  draft: FullscreenEntryDraftMap,
  baselines: Record<string, FullscreenEntryBaseline>,
  segment: ShowcasePlacementSegment,
  placementType: ShowcasePlacementType,
): boolean {
  const row = effectiveDraftRow(productId, draft, baselines);
  if (!row || row.status !== "installed") return false;
  return row.placementSegment === segment && row.placementType === placementType;
}

type Props = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  onClose: () => void;
  onBackToList?: () => void;
  initialProductId?: string;
};

function emptyShowcase(dealerId: string, tradePointId: string): TradePointShowcaseActualization {
  const iso = new Date().toISOString();
  return {
    tradePointId,
    dealerId,
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: null,
    interiorPortals: null,
    hardwareSections: null,
    showcaseAreaSqm: null,
    showcaseComment: "",
    tandoorTotalPortals: null,
    tandoorEntrancePortals: null,
    tandoorInteriorPortals: null,
    competitorPortals: null,
    competitorsListed: "",
    fillingComment: "",
    hasExpansionPotential: null,
    additionalPortalsPotential: null,
    showcasePriority: "",
    firstPriorityNeed: "",
    rmRopComment: "",
    updatedAt: iso,
    updatedBy: "",
    updatedByName: "",
  };
}

export function DistributionFullscreenEntry({
  dealer,
  point,
  profile,
  actorUserId,
  actorName,
  onClose,
  onBackToList,
  initialProductId,
}: Props) {
  const { toast } = useToast();
  const catalogReady = useCatalogReady();
  const { user } = useCurrentUser();
  const actx = useClientBaseActualization();
  const showcaseRec = actx.state.tradePointShowcaseActualizationById[point.id];
  const selectedShowcaseModels = showcaseRec?.selectedShowcaseModels ?? [];
  const [completenessGateOpen, setCompletenessGateOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [exitGateGaps, setExitGateGaps] = useState<ShowcaseTypeKey[]>([]);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const [bump, setBump] = useState(0);
  const {
    filters: catalogFilters,
    setFilter: setCatalogFilter,
    categories: selectedCategoryIds,
    setCategories: setSelectedCategoryIds,
    query: searchQuery,
    setQuery: setSearchQuery,
    source,
    setSource,
    resetAll: resetCatalogFilters,
  } = useCatalogFiltersUrl({ prefix: "dx" });
  const sourceTab: SourceTab = source === "matrix" ? "matrix" : "catalog";
  const setSourceTab = useCallback(
    (tab: SourceTab) => setSource(tab === "matrix" ? "matrix" : "all"),
    [setSource],
  );
  /** Единый селектор: фильтр списка + кисть в compact-режиме (кроме «Все статусы»). */
  const [workStatus, setWorkStatus] = useState<StatusFilter>("all");
  const [pendingStatusSwitch, setPendingStatusSwitch] = useState<StatusFilter | null>(null);
  const [cardSize, setCardSize] = useState<FullscreenViewMode>(() => readFullscreenViewMode());
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(true);
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COMPACT_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [explicitQuickMarks, setExplicitQuickMarks] = useState<Set<string>>(() => new Set());
  const [activePlacementType, setActivePlacementType] = useState<ShowcasePlacementType>("portal");
  const [draft, setDraft] = useState<FullscreenEntryDraftMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const counterpartyLine = useMemo(
    () => fullscreenCounterpartyLine(dealer, point),
    [dealer, point],
  );
  const tradePointDisplayName = useMemo(
    () => resolveTradePointDisplayName(dealer, point),
    [dealer, point],
  );
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() => pendingSyncCount());
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentPhase, setAssignmentPhase] = useState<"form" | "success">("form");
  const [assignmentShareLink, setAssignmentShareLink] = useState("");
  const [assignmentCreatedId, setAssignmentCreatedId] = useState<string | null>(null);
  const [assignmentAssigneeId, setAssignmentAssigneeId] = useState(ASSIGNMENT_ASSIGNEE_NONE);
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentComment, setAssignmentComment] = useState("");
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [assignmentManagers, setAssignmentManagers] = useState<PickerUser[]>([]);
  const [assignmentManagersLoading, setAssignmentManagersLoading] = useState(false);
  const [assignmentManagersError, setAssignmentManagersError] = useState("");
  const [assignmentDialogItemIds, setAssignmentDialogItemIds] = useState<string[]>([]);
  const [pendingAssignmentOpenIds, setPendingAssignmentOpenIds] = useState<string[] | null>(null);

  useEffect(() => {
    writeCatalogCardSizeToStorage(CARD_SIZE_STORAGE_KEY, cardSize);
  }, [cardSize]);

  const filtersActive =
    source === "matrix" ||
    selectedCategoryIds.length > 0 ||
    Object.keys(catalogFilters).length > 0 ||
    searchQuery.trim().length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, compactMode ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [compactMode]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const update = () => setPendingCount(pendingSyncCount());
    update();
    window.addEventListener(OVERRIDES_PENDING_CHANGED_EVENT, update);
    const iv = setInterval(update, 5000);
    return () => {
      window.removeEventListener(OVERRIDES_PENDING_CHANGED_EVENT, update);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, refresh);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, refresh);
      window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, refresh);
    };
  }, []);

  // Блокировка скролла фоновой страницы на время открытой распашонки.
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscroll: documentElement.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      documentElement.style.overscrollBehavior = prev.overscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const storage = useMemo(() => {
    void bump;
    return loadShowcaseMatrixStorage();
  }, [bump]);

  const backendByModelId = useMemo(() => {
    void bump;
    const map = new Map<string, ReturnType<typeof loadCachedMatrix>[number]>();
    for (const entry of loadCachedMatrix(point.id)) {
      if (entry.targetKind === "variant") {
        const key = normalizeShowcaseMatrixModelId(entry.targetId);
        const prev = map.get(key);
        if (!prev || entry.updatedAt > prev.updatedAt) map.set(key, entry);
      }
    }
    for (const entry of loadCachedMatrix(point.id)) {
      if (entry.targetKind === "model") {
        const key = normalizeShowcaseMatrixModelId(entry.targetId);
        const prev = map.get(key);
        if (!prev || entry.updatedAt > prev.updatedAt) map.set(key, entry);
      }
    }
    return map;
  }, [bump, point.id]);

  const matrixModels = useMemo(
    () =>
      resolveTradePointMatrixModels({
        dealerId: dealer.id,
        tradePointId: point.id,
        clientCategory: dealer.clientCategory,
        region: dealer.region,
        city: point.city,
      }),
    [dealer.clientCategory, dealer.id, dealer.region, point.id, point.city],
  );

  const matrixModelById = useMemo(() => {
    const m = new Map<string, ShowcaseMatrixModelDefinition>();
    for (const model of matrixModels) m.set(model.id, model);
    return m;
  }, [matrixModels]);

  useEffect(() => {
    if (!initialProductId) return;
    const inMatrix = matrixModels.some((m) => m.id === initialProductId);
    setSourceTab(inMatrix ? "matrix" : "catalog");
    setWorkStatus("all");
    setSearchQuery("");
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-testid="card-fullscreen-entry-quick-${initialProductId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [initialProductId, matrixModels]);

  const baselineForProduct = useCallback(
    (productId: string): FullscreenEntryBaseline => {
      const backend = backendByModelId.get(normalizeShowcaseMatrixModelId(productId));
      const status = resolveMatrixModelStatus({
        dealerId: dealer.id,
        tradePointId: point.id,
        modelId: productId,
        backend,
        storage,
      });
      if (backend) {
        return {
          status,
          placementType: backend.placementType,
          placementSegment: backend.placementSegment,
          comment: backend.comment ?? "",
        };
      }
      const local = getEffectiveMatrixEntry(dealer.id, point.id, productId, storage);
      return {
        status,
        placementType: null,
        placementSegment: null,
        comment: local.comment,
      };
    },
    [backendByModelId, dealer.id, point.id, storage],
  );

  const baselines = useMemo(() => {
    const out: Record<string, FullscreenEntryBaseline> = {};
    for (const model of matrixModels) {
      out[model.id] = baselineForProduct(model.id);
    }
    if (catalogReady) {
      for (const p of CATALOG_PRODUCTS) {
        if (!out[p.id]) out[p.id] = baselineForProduct(p.id);
      }
    }
    return out;
  }, [matrixModels, baselineForProduct, catalogReady]);

  const selectedCategories = selectedCategoryIds as DistributionCatalogCategoryId[];

  const matrixCatalogProducts = useMemo(() => {
    const products: CatalogProduct[] = [];
    for (const m of matrixModels) {
      const p = getProductById(m.id);
      if (p) products.push(p);
    }
    return products;
  }, [matrixModels]);

  const catalogProducts = useMemo(() => {
    if (!catalogReady) return [];
    const q = searchQuery.trim();
    let list: CatalogProduct[] = q
      ? searchCatalog(q, 500)
      : [...CATALOG_PRODUCTS].sort((a, b) => a.showcasePriority - b.showcasePriority);
    list = filterCatalogProductsByFilters(list, catalogFilters, selectedCategories);
    return list;
  }, [catalogFilters, catalogReady, searchQuery, selectedCategories]);

  const facetBaseProducts = useMemo(
    () => (sourceTab === "matrix" ? matrixCatalogProducts : catalogProducts),
    [sourceTab, matrixCatalogProducts, catalogProducts],
  );

  const catalogFacets = useMemo(
    () => computeCatalogFacets(facetBaseProducts, catalogFilters, selectedCategories),
    [facetBaseProducts, catalogFilters, selectedCategories],
  );

  const categoryChips = useMemo(() => {
    const pool = sourceTab === "matrix" ? matrixCatalogProducts : catalogReady ? [...CATALOG_PRODUCTS] : [];
    return DISTRIBUTION_CATALOG_CATEGORIES.map((cat) => ({
      ...cat,
      count: pool.filter((p) => productDistributionCategory(p) === cat.id).length,
    })).filter((c) => c.count > 0);
  }, [matrixCatalogProducts, sourceTab, catalogReady]);

  const segmentCategoryChips = useMemo(
    () =>
      categoryChips.filter((c): c is typeof c & { id: FullscreenSegmentCategoryId } =>
        (FULLSCREEN_SEGMENT_CATEGORY_IDS as readonly string[]).includes(c.id),
      ),
    [categoryChips],
  );

  const filterPanelCategoryChips = useMemo(
    () =>
      categoryChips.filter(
        (c) => !(FULLSCREEN_SEGMENT_CATEGORY_IDS as readonly string[]).includes(c.id),
      ),
    [categoryChips],
  );

  const activeFilterCount = useMemo(
    () =>
      countActiveCatalogFilters(catalogFilters, selectedCategories, searchQuery) +
      (source === "matrix" ? 1 : 0),
    [catalogFilters, selectedCategories, searchQuery, source],
  );

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: CatalogProduct[];
    if (sourceTab === "matrix") {
      const products: CatalogProduct[] = [];
      for (const m of matrixModels) {
        if (!modelMatchesCategories(matrixModelCategory(m), selectedCategories)) continue;
        const p = getProductById(m.id);
        if (!p) continue;
        if (!filterCatalogProductsByFilters([p], catalogFilters, []).length) continue;
        if (q) {
          const haystack = buildCatalogProductSearchHaystack(p);
          if (!catalogSearchQueryMatchesHaystack(q, haystack)) continue;
        }
        products.push(p);
      }
      list = products;
    } else {
      list = catalogProducts;
    }
    if (sourceTab === "catalog") return list;
    if (workStatus === "all") return list;
    return list.filter((p) => {
      const status = draft[p.id]?.status ?? baselines[p.id]?.status ?? "need_install";
      return status === workStatus;
    });
  }, [
    baselines,
    catalogFilters,
    catalogProducts,
    draft,
    matrixModels,
    searchQuery,
    selectedCategories,
    sourceTab,
    workStatus,
  ]);

  useEffect(() => {
    setDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of visibleProducts) {
        if (next[p.id]) continue;
        const baseline = baselines[p.id] ?? {
          status: "need_install" as const,
          placementType: null,
          placementSegment: null,
          comment: "",
        };
        const segment =
          matrixModelById.get(p.id) != null
            ? segmentFromMatrixModel(matrixModelById.get(p.id)!)
            : segmentFromProduct(p);
        const row = buildInitialDraftRow(baseline);
        row.placementSegment = baseline.placementSegment ?? segment;
        next[p.id] = row;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [baselines, matrixModelById, visibleProducts]);

  const needInstallMode = workStatus === "need_install";
  const statusBrushActive = workStatus !== "all";
  const brushStatus: ShowcaseMatrixStatusId =
    workStatus === "all" ? "installed" : workStatus;

  useEffect(() => {
    setExplicitQuickMarks(new Set());
  }, [workStatus]);

  const getCandidateShowcaseRec = useCallback(
    () => actx.state.tradePointShowcaseActualizationById[point.id],
    [actx.state.tradePointShowcaseActualizationById, point.id],
  );

  const persistShowcaseCapacity = useCallback(
    async (type: ShowcaseTypeKey, value: number) => {
      const iso = new Date().toISOString();
      await actx.persist((prev) => {
        const prevRec = prev.tradePointShowcaseActualizationById[point.id] ?? emptyShowcase(dealer.id, point.id);
        const nextRec: TradePointShowcaseActualization = {
          ...prevRec,
          ...patchShowcaseTypeCapacity(type, value),
          updatedAt: iso,
          updatedBy: actorUserId,
          updatedByName: actorName,
        };
        return mergeActualizationState(prev, {
          tradePointShowcaseActualizationById: {
            ...prev.tradePointShowcaseActualizationById,
            [point.id]: nextRec,
          },
        });
      });
    },
    [actx, actorName, actorUserId, dealer.id, point.id],
  );

  const runPendingClose = useCallback(() => {
    const close = pendingCloseRef.current;
    pendingCloseRef.current = null;
    setCompletenessGateOpen(false);
    close?.();
  }, []);

  const requestClose = useCallback(() => {
    const rec = actx.state.tradePointShowcaseActualizationById[point.id];
    if (normalizeHasShowcase(rec?.hasShowcase) === false) {
      (onBackToList ?? onClose)();
      return;
    }
    const gaps = findShowcaseCapacityGaps(rec, selectedShowcaseModels, getProductById);
    if (gaps.length === 0) {
      (onBackToList ?? onClose)();
      return;
    }
    pendingCloseRef.current = onBackToList ?? onClose;
    setExitGateGaps(gaps);
    setCompletenessGateOpen(true);
  }, [
    actx.state.tradePointShowcaseActualizationById,
    onBackToList,
    onClose,
    point.id,
    selectedShowcaseModels,
  ]);

  const handleBack = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const workStatusHint = useMemo(() => {
    if (workStatus === "all") {
      return "Выбранный статус показывается в списке. Отметьте модели нужным статусом и сохраните по кнопке «Сохранить».";
    }
    if (workStatus === "need_install") {
      return "Показаны модели из матрицы, которые нужно поставить. Чтобы добавить другие — откройте «Весь каталог».";
    }
    return "Показан весь каталог. Найдите модели, отметьте статусом и сохраните.";
  }, [workStatus]);

  const changedIds = useMemo(() => collectChangedProductIds(draft, baselines), [draft, baselines]);
  const changedSet = useMemo(() => new Set(changedIds), [changedIds]);
  const needInstallMarkedIds = useMemo(() => {
    if (!needInstallMode) return new Set<string>();
    const ids = new Set<string>();
    for (const p of visibleProducts) {
      const baseline = baselines[p.id]?.status ?? "need_install";
      const currentStatus = draft[p.id]?.status ?? baseline;
      if (currentStatus !== "need_install") continue;
      if (changedSet.has(p.id) || explicitQuickMarks.has(p.id)) {
        ids.add(p.id);
      }
    }
    return ids;
  }, [baselines, changedSet, draft, explicitQuickMarks, needInstallMode, visibleProducts]);
  const needInstallCount = needInstallMarkedIds.size;
  const installedCount = useMemo(() => countInstalledInDraft(draft), [draft]);

  const canCreateAssignment = useMemo(
    () => Boolean(user?.role && ASSIGNMENT_CREATE_ROLES.has(user.role)),
    [user?.role],
  );

  const assigneeRequired = user?.role !== "manager";

  const orderedProducts = useMemo(() => {
    if (workStatus !== "need_install") return visibleProducts;
    return [...visibleProducts]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const ma = matrixModelById.get(a.p.id);
        const mb = matrixModelById.get(b.p.id);
        const ra = ma ? (PRIORITY_RANK[ma.basePriority] ?? 3) : 9;
        const rb = mb ? (PRIORITY_RANK[mb.basePriority] ?? 3) : 9;
        if (ra !== rb) return ra - rb;
        return a.i - b.i;
      })
      .map((x) => x.p);
  }, [matrixModelById, workStatus, visibleProducts]);

  const placementTypeMode = workStatus === "installed";
  const activeSegmentCategory = useMemo(
    () => activeFullscreenSegmentCategory(selectedCategoryIds, placementTypeMode),
    [selectedCategoryIds, placementTypeMode],
  );
  const handleSegmentCategorySelect = useCallback(
    (id: FullscreenSegmentCategoryId | "all") => {
      const segmentIds = new Set<string>(FULLSCREEN_SEGMENT_CATEGORY_IDS);
      const nonSegment = selectedCategoryIds.filter((x) => !segmentIds.has(x));
      if (id === "all") {
        setSelectedCategoryIds(nonSegment);
        return;
      }
      if (placementTypeMode) {
        setSelectedCategoryIds([...nonSegment, id]);
        return;
      }
      if (selectedCategoryIds.includes(id)) {
        setSelectedCategoryIds(selectedCategoryIds.filter((x) => x !== id));
        return;
      }
      setSelectedCategoryIds([...nonSegment, id]);
    },
    [placementTypeMode, selectedCategoryIds, setSelectedCategoryIds],
  );
  const placementSegmentContext = useMemo(
    () => segmentContextFromCategories(selectedCategories),
    [selectedCategories],
  );
  const placementTypeOptions = useMemo(
    () => allowedTypesForSegment(placementSegmentContext),
    [placementSegmentContext],
  );

  useEffect(() => {
    if (!placementTypeOptions.includes(activePlacementType)) {
      setActivePlacementType(placementTypeOptions[0] ?? "portal");
    }
  }, [placementTypeOptions, activePlacementType]);

  const placements = useMemo(() => {
    void bump;
    return loadCachedPlacements(point.id);
  }, [point.id, bump]);

  const activePlacementBlock = useMemo(
    () => findPlacementBlock(placements, placementSegmentContext, activePlacementType),
    [placements, placementSegmentContext, activePlacementType],
  );

  const activeSlotLimit = useMemo(
    () => ourMarkLimitFromBlock(activePlacementBlock),
    [activePlacementBlock],
  );

  const markedInActivePlacement = useMemo(
    () =>
      countMarkedOursInPlacement(draft, baselines, placementSegmentContext, activePlacementType),
    [draft, baselines, placementSegmentContext, activePlacementType],
  );

  const syncCategoryCapacityAfterPlacementChange = useCallback(() => {
    const freshPlacements = loadCachedPlacements(point.id);
    const cats = categoryCapacityFromPlacements(freshPlacements);
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const iso = new Date().toISOString();
    void actx.persist((prev) => {
      const prevRec =
        prev.tradePointShowcaseActualizationById[point.id] ??
        emptyShowcase(dealer.id, point.id);
      const capacityFields = categoryCapacityFieldsForPersist({
        next: cats,
        prevRec,
        hasShowcase: normalizeHasShowcase(prevRec.hasShowcase) !== false,
      });
      const nextRec: TradePointShowcaseActualization = {
        ...prevRec,
        ...capacityFields,
        updatedAt: iso,
        updatedBy: uid,
        updatedByName: uname,
      };
      return mergeActualizationState(prev, {
        tradePointShowcaseActualizationById: {
          ...prev.tradePointShowcaseActualizationById,
          [point.id]: nextRec,
        },
      });
    });
  }, [actx, dealer.id, point.id, profile]);

  const growActivePlacementIfNeeded = useCallback(
    (nextDraft: FullscreenEntryDraftMap) => {
      const marked = countMarkedOursInPlacement(
        nextDraft,
        baselines,
        placementSegmentContext,
        activePlacementType,
      );
      const uid = profile.personaUserId;
      const uname = userLabelFromProfile(profile);
      const grown = growPlacementBlockToFitOurMarks({
        dealerId: dealer.id,
        tradePointId: point.id,
        placements,
        segment: placementSegmentContext,
        placementType: activePlacementType,
        ourMarkCount: marked,
        updatedBy: uid,
        updatedByName: uname,
      });
      if (!grown) return;
      syncCategoryCapacityAfterPlacementChange();
      setBump((n) => n + 1);
      notifyShowcaseCapacityAutoGrow({
        tradePointId: point.id,
        type: PLACEMENT_SEGMENT_TO_TYPE_KEY[placementSegmentContext],
        oldCapacity: grown.oldCapacity,
        nextCapacity: grown.nextCapacity,
      });
    },
    [
      activePlacementType,
      baselines,
      dealer.id,
      placementSegmentContext,
      placements,
      point.id,
      profile,
      syncCategoryCapacityAfterPlacementChange,
    ],
  );

  const productsForList = useMemo(() => {
    if (!placementTypeMode) return orderedProducts;
    return orderedProducts.filter((p) => {
      const row = effectiveDraftRow(p.id, draft, baselines);
      const status = row?.status ?? "need_install";
      if (status !== "installed") return true;
      const seg =
        row?.placementSegment ??
        (matrixModelById.get(p.id)
          ? segmentFromMatrixModel(matrixModelById.get(p.id)!)
          : segmentFromProduct(p));
      return row?.placementType === activePlacementType && seg === placementSegmentContext;
    });
  }, [
    placementTypeMode,
    orderedProducts,
    draft,
    baselines,
    activePlacementType,
    placementSegmentContext,
    matrixModelById,
  ]);

  const historyEvents = useMemo(
    () => getShowcaseMatrixTpHistoryEvents(dealer.id, point.id, storage),
    [dealer.id, point.id, storage],
  );
  const selectedHistoryEvent = useMemo(
    () => historyEvents.find((ev) => ev.id === selectedHistoryId) ?? null,
    [historyEvents, selectedHistoryId],
  );

  const updateDraft = useCallback(
    (productId: string, patch: Partial<FullscreenEntryDraftMap[string]>) => {
      let growNext: FullscreenEntryDraftMap | null = null;
      setDraft((prev) => {
        const next = { ...prev, [productId]: { ...prev[productId]!, ...patch } };
        if (
          placementTypeMode &&
          patch.status === "installed" &&
          !isInstalledInPlacementType(
            productId,
            prev,
            baselines,
            placementSegmentContext,
            activePlacementType,
          )
        ) {
          growNext = next;
        }
        return next;
      });
      if (growNext) growActivePlacementIfNeeded(growNext);
    },
    [
      activePlacementType,
      baselines,
      growActivePlacementIfNeeded,
      placementSegmentContext,
      placementTypeMode,
    ],
  );

  const handleResetDraft = useCallback(() => {
    setDraft({});
  }, []);

  const setExplicitQuickMark = useCallback((productId: string, marked: boolean) => {
    setExplicitQuickMarks((prev) => {
      const next = new Set(prev);
      if (marked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const handleCompactReset = useCallback(() => {
    if (needInstallMode) {
      setExplicitQuickMarks(new Set());
    } else {
      handleResetDraft();
    }
  }, [handleResetDraft, needInstallMode]);

  const flushPendingNow = useCallback(async (): Promise<number> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return pendingSyncCount();
    }
    let guard = 0;
    while (pendingSyncCount() > 0 && guard < 50) {
      const res = await runOverridesPendingSyncOnce();
      guard += 1;
      if (!res || (res.succeeded === 0 && res.processed > 0)) {
        await new Promise((r) => setTimeout(r, 400));
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
    return pendingSyncCount();
  }, []);

  const showSaveSyncToast = useCallback(
    (remaining: number) => {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        toast({
          title: "Сохранено локально",
          description: "Данные попадут на сервер после восстановления сети.",
          className: "border-amber-500/40 bg-amber-500/10",
        });
        return;
      }
      if (remaining === 0) {
        toast({
          title: `Сохранено · ${formatSavedAt()} · ${actorName}`,
        });
        return;
      }
      toast({
        title: `Сохраняем… отправлено на сервер, осталось ${remaining}`,
        description: "Остальное отправится автоматически",
        className: "border-amber-500/40 bg-amber-500/10",
      });
    },
    [actorName, toast],
  );

  const handleSyncNow = useCallback(async () => {
    if (syncing || saving) return;
    setSyncing(true);
    try {
      const remaining = await flushPendingNow();
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        toast({
          title: "Нет сети",
          description: "Данные отправятся после восстановления соединения.",
          className: "border-amber-500/40 bg-amber-500/10",
        });
      } else if (remaining === 0) {
        toast({ title: "Все изменения отправлены на сервер" });
      } else {
        toast({
          title: `Отправлено частично, осталось ${remaining}`,
          description: "Остальное отправится автоматически",
          className: "border-amber-500/40 bg-amber-500/10",
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [flushPendingNow, saving, syncing, toast]);

  const handleSave = useCallback(async () => {
    const saveIds = needInstallMode ? Array.from(needInstallMarkedIds) : changedIds;
    if (saveIds.length === 0 || saving) return;
    const needInstallSaveIds = needInstallMode
      ? saveIds
      : saveIds.filter(
          (id) => (draft[id]?.status ?? baselines[id]?.status ?? "need_install") === "need_install",
        );
    const shouldOpenAssignmentDialog = canCreateAssignment && needInstallSaveIds.length > 0;
    setSaving(true);
    try {
      for (const productId of saveIds) {
        const baseline = baselines[productId];
        const product = getProductById(productId);
        const model =
          matrixModelById.get(productId) ??
          (product ? stubMatrixModelFromProduct(product) : null);
        if (!model) continue;

        if (needInstallMode) {
          setMatrixStatus({
            dealerId: dealer.id,
            tradePointId: point.id,
            targetKind: "model",
            targetId: productId,
            status: "need_install",
            comment: baseline?.comment ?? null,
            updatedBy: actorUserId,
            updatedByName: actorName,
            placementType: null,
            placementSegment: null,
          });

          upsertShowcaseMatrixModelState({
            dealerId: dealer.id,
            tradePointId: point.id,
            model,
            status: "need_install",
            comment: baseline?.comment ?? "",
            actorUserId,
            actorName,
          });
          continue;
        }

        const row = draft[productId];
        if (!row || !baseline) continue;

        const status = row.status;
        const isInstalled = status === "installed";
        const placementType: ShowcasePlacementType | null = isInstalled ? row.placementType : null;
        const placementSegment: ShowcasePlacementSegment | null = isInstalled
          ? row.placementSegment
          : null;

        setMatrixStatus({
          dealerId: dealer.id,
          tradePointId: point.id,
          targetKind: "model",
          targetId: productId,
          status,
          comment: baseline.comment || null,
          updatedBy: actorUserId,
          updatedByName: actorName,
          placementType,
          placementSegment,
        });

        upsertShowcaseMatrixModelState({
          dealerId: dealer.id,
          tradePointId: point.id,
          model,
          status,
          comment: baseline.comment,
          actorUserId,
          actorName,
        });
      }

      setBump((n) => n + 1);
      setDraft((prev) => {
        const next = { ...prev };
        const freshStorage = loadShowcaseMatrixStorage();
        const freshBackend = new Map<string, ReturnType<typeof loadCachedMatrix>[number]>();
        for (const entry of loadCachedMatrix(point.id)) {
          if (entry.targetKind === "model") {
            freshBackend.set(normalizeShowcaseMatrixModelId(entry.targetId), entry);
          }
        }
        for (const productId of saveIds) {
          const backend = freshBackend.get(normalizeShowcaseMatrixModelId(productId));
          const baseline: FullscreenEntryBaseline = backend
            ? {
                status: backend.status as ShowcaseMatrixStatusId,
                placementType: backend.placementType,
                placementSegment: backend.placementSegment,
                comment: backend.comment ?? "",
              }
            : {
                status: getEffectiveMatrixStatus(dealer.id, point.id, productId, freshStorage),
                placementType: null,
                placementSegment: null,
                comment: getEffectiveMatrixEntry(dealer.id, point.id, productId, freshStorage).comment,
              };
          const prod = getProductById(productId);
          const seg =
            matrixModelById.get(productId) != null
              ? segmentFromMatrixModel(matrixModelById.get(productId)!)
              : prod
                ? segmentFromProduct(prod)
                : "vh";
          const row = buildInitialDraftRow(baseline);
          row.placementSegment = baseline.placementSegment ?? seg;
          next[productId] = row;
        }
        return next;
      });

      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        showSaveSyncToast(pendingSyncCount());
      } else {
        const remaining = await flushPendingNow();
        showSaveSyncToast(remaining);
      }
      if (needInstallMode) {
        setExplicitQuickMarks(new Set());
      }
      if (shouldOpenAssignmentDialog) {
        setPendingAssignmentOpenIds([...needInstallSaveIds]);
      } else if (
        !needInstallMode &&
        normalizeHasShowcase(showcaseRec?.hasShowcase) !== false
      ) {
        setEquipmentDialogOpen(true);
      }
    } finally {
      setSaving(false);
    }
  }, [
    actorUserId,
    actorName,
    baselines,
    canCreateAssignment,
    changedIds,
    dealer.id,
    draft,
    flushPendingNow,
    matrixModelById,
    needInstallMarkedIds,
    needInstallMode,
    point.id,
    saving,
    showSaveSyncToast,
    showcaseRec?.hasShowcase,
  ]);

  const handleEquipmentDialogConfirm = useCallback(
    (inputs: EquipmentCapacityInputV2) => {
      const uid = profile.personaUserId;
      const uname = userLabelFromProfile(profile);
      persistEquipmentCapacityInputs({
        dealerId: dealer.id,
        tradePointId: point.id,
        placements,
        inputs,
        updatedBy: uid,
        updatedByName: uname,
      });
      syncCategoryCapacityAfterPlacementChange();
      setBump((n) => n + 1);
      setEquipmentDialogOpen(false);
    },
    [dealer.id, placements, point.id, profile, syncCategoryCapacityAfterPlacementChange],
  );

  const assignmentSelectedModels = useMemo(
    () =>
      assignmentDialogItemIds.map((id) => ({
        id,
        name: resolveModelDisplayName(id, matrixModelById.get(id)?.name),
      })),
    [matrixModelById, assignmentDialogItemIds],
  );

  const resetAssignmentDialog = useCallback(() => {
    setAssignmentPhase("form");
    setAssignmentShareLink("");
    setAssignmentCreatedId(null);
    setAssignmentAssigneeId(ASSIGNMENT_ASSIGNEE_NONE);
    setAssignmentDueDate("");
    setAssignmentComment("");
    setAssignmentSubmitting(false);
    setAssignmentManagersError("");
    setAssignmentDialogItemIds([]);
  }, []);

  const handleAssignmentDialogOpenChange = useCallback(
    (open: boolean) => {
      setAssignmentDialogOpen(open);
      if (!open) resetAssignmentDialog();
    },
    [resetAssignmentDialog],
  );

  const handleOpenAssignmentDialog = useCallback(
    (itemIds?: readonly string[]) => {
      resetAssignmentDialog();
      const ids = itemIds?.length ? [...itemIds] : Array.from(needInstallMarkedIds);
      setAssignmentDialogItemIds(ids);
      setAssignmentDialogOpen(true);
      setAssignmentManagersLoading(true);
      void (async () => {
        try {
          const resolved = await fetchResolveTradePoint(point.id);
          const ordered: Array<{ key: "manager" | "regional_manager" | "rop" }> = [
            { key: "manager" },
            { key: "regional_manager" },
            { key: "rop" },
          ];
          const seen = new Set<string>();
          let users: PickerUser[] = [];
          for (const { key } of ordered) {
            const r = resolved[key];
            const id = r.userId?.trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            users.push({
              id,
              full_name: r.userName?.trim() || "—",
              role: key,
              status: "active",
            });
          }

          if (users.length === 0) {
            const [mgrs, rms, rops] = await Promise.all([
              fetchUsersForRole("manager"),
              fetchUsersForRole("regional_manager"),
              fetchUsersForRole("rop"),
            ]);
            const merged: PickerUser[] = [];
            const fallbackSeen = new Set<string>();
            for (const u of [...mgrs, ...rms, ...rops]) {
              const id = u.id?.trim();
              if (!id || fallbackSeen.has(id)) continue;
              fallbackSeen.add(id);
              merged.push(u);
            }
            users = merged;
          }

          setAssignmentManagers(users);
          setAssignmentManagersError("");
          if (actorUserId && users.some((u) => u.id === actorUserId)) {
            setAssignmentAssigneeId(actorUserId);
          } else {
            setAssignmentAssigneeId(ASSIGNMENT_ASSIGNEE_NONE);
          }
        } catch {
          setAssignmentManagers([]);
          setAssignmentManagersError("Не удалось загрузить ответственных по точке.");
        } finally {
          setAssignmentManagersLoading(false);
        }
      })();
    },
    [actorUserId, needInstallMarkedIds, point.id, resetAssignmentDialog],
  );

  useEffect(() => {
    if (saving || !pendingAssignmentOpenIds?.length) return;
    handleOpenAssignmentDialog(pendingAssignmentOpenIds);
    setPendingAssignmentOpenIds(null);
  }, [saving, pendingAssignmentOpenIds, handleOpenAssignmentDialog]);

  const handleCreateAssignment = useCallback(async () => {
    if (assignmentSubmitting || assignmentDialogItemIds.length === 0) return;
    setAssignmentSubmitting(true);
    try {
      const assignee =
        assignmentAssigneeId === ASSIGNMENT_ASSIGNEE_NONE
          ? null
          : pickerUserById(assignmentManagers, assignmentAssigneeId);
      const assignment = await createAssignment({
        dealerId: dealer.id,
        tradePointId: point.id,
        title: `Отгрузить на витрину · ${tradePointDisplayName}`,
        comment: assignmentComment.trim() || null,
        dueDate: assignmentDueDate || null,
        assigneeUserId: assignee?.id ?? null,
        assigneeName: assignee?.full_name ?? null,
        items: assignmentDialogItemIds.map((id) => ({
          targetKind: "model" as const,
          targetId: id,
          modelName: resolveModelDisplayName(id, matrixModelById.get(id)?.name),
        })),
      });
      setAssignmentShareLink(assignmentShareUrl(assignment.id));
      setAssignmentCreatedId(assignment.id);
      setAssignmentPhase("success");
      toast({ title: `Задание создано · ${assignment.itemsTotal} позиций` });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Не удалось создать задание",
        variant: "destructive",
      });
    } finally {
      setAssignmentSubmitting(false);
    }
  }, [
    assignmentAssigneeId,
    assignmentComment,
    assignmentDueDate,
    assignmentDialogItemIds,
    assignmentManagers,
    assignmentSubmitting,
    dealer.id,
    matrixModelById,
    point.id,
    tradePointDisplayName,
    toast,
  ]);

  const handleCopyAssignmentLink = useCallback(async () => {
    if (!assignmentShareLink) return;
    try {
      await navigator.clipboard.writeText(assignmentShareLink);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Не удалось скопировать ссылку", variant: "destructive" });
    }
  }, [assignmentShareLink, toast]);

  const handleOpenAssignmentDetail = useCallback(() => {
    if (!assignmentCreatedId) return;
    window.location.assign(buildBrowserHashAppHref(`/assignment/${assignmentCreatedId}`));
  }, [assignmentCreatedId]);

  const handleGoToAssignmentsList = useCallback(() => {
    window.location.assign(buildBrowserHashAppHref("/assignments"));
  }, []);

  const compactHasChanges = needInstallMode ? needInstallCount > 0 : changedIds.length > 0;
  const compactSaveCount = needInstallMode ? needInstallCount : changedIds.length;

  const applyStatusSwitch = useCallback(
    (value: StatusFilter) => {
      setWorkStatus(value);
      if (value === "need_install") {
        setSourceTab("matrix");
      } else if (value !== "all") {
        setSourceTab("catalog");
      }
    },
    [setSourceTab],
  );

  const handleWorkStatusChange = useCallback(
    (value: StatusFilter) => {
      if (value === workStatus) return;
      if (compactHasChanges) {
        setPendingStatusSwitch(value);
        return;
      }
      applyStatusSwitch(value);
    },
    [applyStatusSwitch, compactHasChanges, workStatus],
  );

  const handleStatusSwitchSave = useCallback(async () => {
    await handleSave();
    const next = pendingStatusSwitch;
    setPendingStatusSwitch(null);
    if (next) applyStatusSwitch(next);
  }, [applyStatusSwitch, handleSave, pendingStatusSwitch]);

  const handleStatusSwitchDiscard = useCallback(() => {
    setDraft({});
    setExplicitQuickMarks(new Set());
    const next = pendingStatusSwitch;
    setPendingStatusSwitch(null);
    if (next) applyStatusSwitch(next);
  }, [applyStatusSwitch, pendingStatusSwitch]);

  const gridClass = fullscreenEntryProductGridClass(cardSize, compactMode);
  const productScrollRef = useRef<HTMLDivElement>(null);
  const catalogGridColumns = useDistributionEntryCatalogGridColumns(gridClass);
  const matrixEmpty = sourceTab === "matrix" && matrixModels.length === 0;
  const listVirtualizer = useDistributionEntryVirtualizer({
    count:
      cardSize === "list"
        ? productsForList.length
        : Math.ceil(productsForList.length / Math.max(catalogGridColumns, 1)),
    estimateSize:
      cardSize === "list"
        ? DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.catalogList
        : DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.catalogGridRow,
    scrollRef: productScrollRef,
  });

  const renderProductItem = (p: CatalogProduct) => {
    if (cardSize === "list") {
      return (
        <FullscreenProductRow
          key={p.id}
          product={p}
          draft={draft[p.id]}
          matrixModel={matrixModelById.get(p.id)}
          onDraftChange={updateDraft}
          placementTypeMode={placementTypeMode}
          activePlacementType={activePlacementType}
        />
      );
    }
    return (
      <FullscreenProductCard
        key={p.id}
        product={p}
        cardSize={cardSize}
        draft={draft[p.id]}
        matrixModel={matrixModelById.get(p.id)}
        onDraftChange={updateDraft}
        quickMode={statusBrushActive}
        quickStatus={brushStatus}
        baselineStatus={baselines[p.id]?.status ?? "need_install"}
        isChanged={changedSet.has(p.id)}
        isMatrixRecommended={matrixModelById.has(p.id)}
        isExplicitMark={explicitQuickMarks.has(p.id)}
        onSetExplicitMark={setExplicitQuickMark}
        placementTypeMode={placementTypeMode}
        activePlacementType={activePlacementType}
      />
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col overscroll-contain bg-background"
      data-testid="distribution-fullscreen-entry"
      role="dialog"
      aria-modal="true"
    >
      {!compactMode ? (
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/95 px-3 py-2 backdrop-blur-sm sm:px-4 md:py-2.5">
        <div className="flex min-h-10 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 gap-1 px-2"
            onClick={handleBack}
            data-testid="button-fullscreen-entry-back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Назад
          </Button>
          <div className="min-w-0 flex-1">
            {headerCollapsed ? (
              <p
                className="truncate text-sm font-medium text-foreground"
                data-testid="text-fullscreen-entry-counterparty"
              >
                {counterpartyLine}
              </p>
            ) : (
              <>
                <p className="truncate text-base font-semibold text-foreground">{tradePointDisplayName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {dealer.name}
                  {point.city?.trim() && point.city !== "—" ? ` · ${point.city.trim()}` : ""}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!online ? (
              <Badge
                variant="outline"
                className="hidden max-w-[9rem] truncate border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-900 dark:text-amber-200 sm:inline-flex"
              >
                Оффлайн
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setHeaderCollapsed((c) => !c)}
              data-testid="button-fullscreen-entry-toggle-header"
              aria-label={headerCollapsed ? "Развернуть панель" : "Свернуть панель"}
              aria-expanded={!headerCollapsed}
            >
              {headerCollapsed ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronUp className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={requestClose}
              data-testid="button-fullscreen-entry-close"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {!headerCollapsed ? (
          <p className="mt-1.5 text-sm text-muted-foreground md:hidden">
            Отмечено: <span className="font-semibold tabular-nums text-foreground">{installedCount}</span>
          </p>
        ) : null}
        {!online ? (
          <Badge
            variant="outline"
            className="mt-2 w-fit border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-900 dark:text-amber-200 sm:hidden"
          >
            Оффлайн — сохранится после синхронизации
          </Badge>
        ) : null}
      </header>
      ) : null}

      <div
        className={cn(
          "z-10 shrink-0 overflow-hidden border-b border-border/60 bg-background/95 backdrop-blur-sm transition-[max-height,opacity] duration-200 ease-out",
          headerCollapsed && !compactMode ? "max-h-0 border-transparent opacity-0" : "max-h-[min(36vh,420px)] opacity-100",
        )}
        aria-hidden={headerCollapsed && !compactMode}
      >
        <div className="flex flex-col gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2">
          {compactMode ? (
            <div
              className="min-w-0 border-b border-border/50 pb-1.5"
              data-testid="text-fullscreen-entry-counterparty"
            >
              <p className="truncate text-xs font-medium text-foreground">{counterpartyLine}</p>
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleBack}
              data-testid="button-fullscreen-entry-back-compact"
              aria-label="Назад"
              title="Назад"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по каталогу"
                className="h-9 pl-9"
                data-testid="input-fullscreen-entry-search"
              />
            </div>
            {(
              [
                ["m", LayoutGrid, "Сетка"],
                ["s", Grid3x3, "Мельче"],
                ["list", List, "Список"],
              ] as const
            ).map(([size, Icon, label]) => (
              <Button
                key={size}
                type="button"
                size="icon"
                variant={cardSize === size ? "default" : "outline"}
                className="h-9 w-9 shrink-0"
                onClick={() => setCardSize(size)}
                data-testid={`button-fullscreen-entry-size-${size}`}
                aria-label={label}
                title={label}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </Button>
            ))}
            <Button
              type="button"
              size="icon"
              variant={compactMode ? "default" : "outline"}
              className="h-9 w-9 shrink-0"
              onClick={() => setCompactMode((v) => !v)}
              data-testid="button-fullscreen-entry-compact"
              aria-label="Компактный режим"
              title="Компактный режим — больше моделей на экране"
            >
              {compactMode ? (
                <Minimize2 className="h-4 w-4" aria-hidden />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant={filtersPanelOpen || filtersActive ? "default" : "outline"}
              className="relative h-9 w-9 shrink-0"
              onClick={() => setFiltersPanelOpen((v) => !v)}
              data-testid="button-fullscreen-entry-filters-toggle"
              aria-label="Фильтры каталога"
              aria-expanded={filtersPanelOpen}
              title="Фильтры каталога"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {filtersActive && !filtersPanelOpen ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-hidden />
              ) : null}
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Tabs
                value={sourceTab}
                onValueChange={(v) => setSourceTab(v as SourceTab)}
                className="w-auto max-w-[260px] shrink-0"
              >
                <TabsList className="grid h-auto min-h-9 w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted/60 p-0.5">
                  <TabsTrigger
                    value="matrix"
                    className={cn(
                      "min-h-9 text-xs",
                      "data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
                    )}
                    data-testid="tab-fullscreen-entry-matrix"
                  >
                    Из матрицы
                  </TabsTrigger>
                  <TabsTrigger
                    value="catalog"
                    className={cn(
                      "min-h-9 text-xs",
                      "data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
                    )}
                    data-testid="tab-fullscreen-entry-catalog"
                  >
                    Весь каталог
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Статус:</span>
              <Select value={workStatus} onValueChange={(v) => handleWorkStatusChange(v as StatusFilter)}>
                <SelectTrigger
                  className="h-9 min-w-0 flex-1 text-xs sm:max-w-xs sm:text-sm"
                  data-testid="select-fullscreen-entry-quick-status"
                >
                  <SelectValue>
                    {workStatus === "all" ? "Все статусы" : STATUS_LABEL_RU[workStatus]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Все статусы
                  </SelectItem>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">{workStatusHint}</p>
          </div>

          {isFullscreenSegmentTabsVisible(workStatus) && segmentCategoryChips.length > 0 ? (
            <div
              className="space-y-1"
              data-testid="section-fullscreen-entry-segment-tabs"
            >
              <div
                className="-mx-0.5 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Сегмент витрины"
              >
                {!placementTypeMode ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeSegmentCategory === "all"}
                    data-testid="button-fullscreen-entry-segment-all"
                    onClick={() => handleSegmentCategorySelect("all")}
                    className={cn(
                      "h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition",
                      activeSegmentCategory === "all"
                        ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_12px_rgba(154,202,60,0.35)]"
                        : "border-border bg-card text-foreground hover:border-[#9aca3c] hover:text-[#86b832]",
                    )}
                  >
                    Все
                  </button>
                ) : null}
                {segmentCategoryChips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSegmentCategory === c.id}
                    data-testid={`button-fullscreen-entry-segment-${c.id}`}
                    onClick={() => handleSegmentCategorySelect(c.id)}
                    className={cn(
                      "h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition",
                      activeSegmentCategory === c.id
                        ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_12px_rgba(154,202,60,0.35)]"
                        : "border-border bg-card text-foreground hover:border-[#9aca3c] hover:text-[#86b832]",
                    )}
                  >
                    {c.label}
                    {c.count != null ? ` (${c.count.toLocaleString("ru-RU")})` : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {placementTypeMode ? (
            <div
              className="space-y-1 rounded-lg border border-border/80 bg-muted/20 px-2 py-1.5"
              data-testid="section-fullscreen-entry-placement-type"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[11px] text-muted-foreground">Тип:</span>
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
                  {placementTypeOptions.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={activePlacementType === t ? "default" : "outline"}
                      className="h-8 shrink-0 px-2 text-xs"
                      data-testid={`button-fullscreen-entry-placement-type-${t}`}
                      onClick={() => setActivePlacementType(t)}
                    >
                      {PLACEMENT_TYPE_LABEL_RU[t]}
                    </Button>
                  ))}
                </div>
                {normalizeHasShowcase(showcaseRec?.hasShowcase) !== false ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-1 text-[11px] text-primary underline-offset-2 hover:underline"
                    data-testid="button-fullscreen-entry-edit-capacity"
                    onClick={() => setEquipmentDialogOpen(true)}
                  >
                    Изменить количество витрин
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground" data-testid="text-fullscreen-entry-placement-counter">
                Отмечено{" "}
                <span className="font-semibold tabular-nums text-foreground">{markedInActivePlacement}</span>
                {activeSlotLimit != null ? (
                  <>
                    {" "}
                    из <span className="font-semibold tabular-nums text-foreground">{activeSlotLimit}</span>
                  </>
                ) : null}
              </p>
              {activeSlotLimit == null ? (
                <p className="text-[11px] text-muted-foreground">
                  Ёмкость для типа «{PLACEMENT_TYPE_LABEL_RU[activePlacementType]}» не задана — лимит не
                  контролируется
                </p>
              ) : null}
            </div>
          ) : null}

          {pendingCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1">
              <span
                className="text-[11px] font-medium text-amber-900 dark:text-amber-200"
                data-testid="text-fullscreen-entry-pending-count"
              >
                Не синхронизировано: {pendingCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-amber-500/40 px-2 text-[11px]"
                onClick={() => void handleSyncNow()}
                disabled={syncing || saving}
                data-testid="button-fullscreen-entry-sync-now"
              >
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : "Отправить сейчас"}
              </Button>
            </div>
          ) : null}

          {filtersPanelOpen ? (
            <div className="space-y-2" data-testid="panel-fullscreen-entry-filters">
              <CatalogFiltersPanel
                categories={filterPanelCategoryChips}
                selectedCategories={selectedCategoryIds}
                onCategoriesChange={setSelectedCategoryIds}
                facets={catalogFacets}
                value={catalogFilters}
                onChange={setCatalogFilter}
                onResetAll={resetCatalogFilters}
                activeCount={activeFilterCount}
                open
                data-testid="fullscreen-entry-catalog-filters"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={productScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4 sm:px-4 md:pb-28 md:pr-4"
        >
          {matrixEmpty ? (
            <div
              className="flex flex-col items-center gap-3 py-12 text-center"
              data-testid="fullscreen-entry-empty-matrix"
            >
              <p className="max-w-md text-sm text-muted-foreground">
                На ТТ нет назначенной матрицы. Откройте «Весь каталог», чтобы выбрать модели вручную.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setSourceTab("catalog")}
                data-testid="button-fullscreen-entry-open-catalog"
              >
                Открыть весь каталог
              </Button>
            </div>
          ) : productsForList.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : sourceTab === "catalog" ? (
            cardSize === "list" ? (
              <ul className={gridClass}>
                <div className="relative w-full" style={{ height: listVirtualizer.getTotalSize() }}>
                  {listVirtualizer.getVirtualItems().map((vi) => {
                    const p = productsForList[vi.index];
                    if (!p) return null;
                    return (
                      <div
                        key={vi.key}
                        data-index={vi.index}
                        ref={listVirtualizer.measureElement}
                        style={distributionEntryVirtualItemStyle(listVirtualizer, vi.start)}
                      >
                        {renderProductItem(p)}
                      </div>
                    );
                  })}
                </div>
              </ul>
            ) : (
              <div className="relative w-full" style={{ height: listVirtualizer.getTotalSize() }}>
                {listVirtualizer.getVirtualItems().map((vi) => {
                  const startIdx = vi.index * catalogGridColumns;
                  const slice = productsForList.slice(startIdx, startIdx + catalogGridColumns);
                  return (
                    <div
                      key={vi.key}
                      data-index={vi.index}
                      ref={listVirtualizer.measureElement}
                      style={distributionEntryVirtualItemStyle(listVirtualizer, vi.start)}
                      className={gridClass}
                    >
                      {slice.map((p) => renderProductItem(p))}
                    </div>
                  );
                })}
              </div>
            )
          ) : cardSize === "list" ? (
            <ul className={gridClass}>{productsForList.map((p) => renderProductItem(p))}</ul>
          ) : (
            <div className={gridClass}>{productsForList.map((p) => renderProductItem(p))}</div>
          )}
        </div>

        {!compactMode ? (
          <div
            className={cn(
              "z-30 shrink-0 border-t border-border/80 bg-background/95 px-3 py-3 backdrop-blur-sm sm:px-4",
              "md:fixed md:bottom-3 md:right-3 md:z-30 md:max-w-[min(100vw-1.5rem,28rem)] md:rounded-xl md:border md:border-t md:shadow-lg",
            )}
            aria-live="polite"
          >
            <p className="mb-2 text-center text-sm text-muted-foreground md:text-right">
              Отмечено:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {needInstallMode ? needInstallCount : installedCount}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button
                type="button"
                className="min-h-10 flex-1 sm:flex-none"
                disabled={!compactHasChanges || saving}
                onClick={() => void handleSave()}
                data-testid="button-fullscreen-entry-save"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Сохранить ({compactSaveCount})
              </Button>
              {compactHasChanges ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={handleCompactReset}
                  data-testid="button-fullscreen-entry-reset"
                >
                  Сбросить
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-10"
                onClick={() => setHistoryOpen(true)}
                data-testid="button-fullscreen-entry-history"
              >
                История
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {compactMode && compactHasChanges ? (
        <Button
          type="button"
          variant="outline"
          className="fixed bottom-4 left-4 z-40 min-h-11 rounded-full bg-background/95 px-4 shadow-lg backdrop-blur"
          onClick={handleCompactReset}
          data-testid="button-fullscreen-entry-reset-floating"
        >
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
          Сбросить
        </Button>
      ) : null}

      {compactMode && compactHasChanges ? (
        <Button
          type="button"
          className="fixed bottom-4 right-4 z-40 min-h-11 rounded-full px-5 shadow-lg"
          disabled={saving}
          onClick={() => void handleSave()}
          data-testid="button-fullscreen-entry-save-floating"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Сохранить ({compactSaveCount})
        </Button>
      ) : null}

      <Dialog
        open={pendingStatusSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatusSwitch(null);
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-fullscreen-entry-status-switch">
          <DialogHeader>
            <DialogTitle>Несохранённый выбор</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            В статусе «{workStatus === "all" ? "Все статусы" : STATUS_LABEL_RU[workStatus]}» есть отмеченные
            модели, которые не сохранены. Сохранить их перед переключением?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingStatusSwitch(null)}
              data-testid="button-fullscreen-entry-status-switch-cancel"
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleStatusSwitchDiscard}
              data-testid="button-fullscreen-entry-status-switch-discard"
            >
              Сбросить
            </Button>
            <Button
              type="button"
              onClick={() => void handleStatusSwitchSave()}
              disabled={saving}
              data-testid="button-fullscreen-entry-status-switch-save"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialogOpen} onOpenChange={handleAssignmentDialogOpenChange}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="break-words pr-6">Задание на отгрузку — {tradePointDisplayName}</DialogTitle>
          </DialogHeader>

          {assignmentPhase === "form" ? (
            <div className="min-w-0 space-y-4 py-1">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Выбранные модели</Label>
                  <Badge variant="secondary" data-testid="badge-assignment-models-count">
                    {assignmentSelectedModels.length}
                  </Badge>
                </div>
                <ul
                  className="max-h-40 w-full min-w-0 space-y-1 overflow-y-auto rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm"
                  data-testid="list-assignment-selected-models"
                >
                  {assignmentSelectedModels.map((m) => (
                    <li key={m.id} className="min-w-0 break-words text-foreground">
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-assignee" className="text-sm">
                  Исполнитель
                </Label>
                {assignmentManagersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Загрузка…
                  </div>
                ) : (
                  <Select
                    value={assignmentAssigneeId}
                    onValueChange={setAssignmentAssigneeId}
                    disabled={assignmentSubmitting}
                  >
                    <SelectTrigger
                      id="assignment-assignee"
                      className="min-h-10 w-full"
                      data-testid="select-assignment-assignee"
                    >
                      <SelectValue placeholder="— не выбрано —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ASSIGNMENT_ASSIGNEE_NONE}>— не выбрано —</SelectItem>
                      {assignmentManagers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                          {assigneeRoleLabel(u.role) ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              · {assigneeRoleLabel(u.role)}
                            </span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {assignmentManagersError ? (
                  <p className="text-xs text-destructive">{assignmentManagersError}</p>
                ) : null}
                {!assignmentManagersLoading &&
                !assignmentManagersError &&
                assignmentManagers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Для этой точки не назначены ответственные. Создайте задание без исполнителя или
                    назначьте ответственных в карточке точки.
                  </p>
                ) : null}
                {assigneeRequired && assignmentAssigneeId === ASSIGNMENT_ASSIGNEE_NONE ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Выберите ответственного исполнителя.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-due-date" className="text-sm">
                  Срок (необязательно)
                </Label>
                <Input
                  id="assignment-due-date"
                  type="date"
                  value={assignmentDueDate}
                  onChange={(e) => setAssignmentDueDate(e.target.value)}
                  disabled={assignmentSubmitting}
                  data-testid="input-assignment-due-date"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-comment" className="text-sm">
                  Комментарий (необязательно)
                </Label>
                <Textarea
                  id="assignment-comment"
                  value={assignmentComment}
                  onChange={(e) => setAssignmentComment(e.target.value)}
                  disabled={assignmentSubmitting}
                  rows={3}
                  data-testid="textarea-assignment-comment"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAssignmentDialogOpenChange(false)}
                  disabled={assignmentSubmitting}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreateAssignment()}
                  disabled={
                    assignmentSubmitting ||
                    assignmentDialogItemIds.length === 0 ||
                    (assigneeRequired && assignmentAssigneeId === ASSIGNMENT_ASSIGNEE_NONE)
                  }
                  data-testid="button-assignment-submit"
                >
                  {assignmentSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Создать задание
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">
                Задание создано. Откройте его или передайте ссылку ответственному менеджеру.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={assignmentShareLink}
                  className="min-h-10 font-mono text-xs"
                  data-testid="text-assignment-share-link"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 shrink-0 whitespace-nowrap"
                  onClick={() => void handleCopyAssignmentLink()}
                  data-testid="button-assignment-copy-link"
                >
                  Скопировать ссылку
                </Button>
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  type="button"
                  className="min-h-10 w-full whitespace-nowrap sm:w-auto"
                  disabled={!assignmentCreatedId}
                  onClick={handleOpenAssignmentDetail}
                  data-testid="button-assignment-open-detail"
                >
                  Открыть задачу
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 w-full whitespace-nowrap sm:w-auto"
                  onClick={handleGoToAssignmentsList}
                  data-testid="button-assignment-go-to-list"
                >
                  К списку задач
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 w-full whitespace-nowrap sm:w-auto"
                  onClick={() => handleAssignmentDialogOpenChange(false)}
                >
                  Готово
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) setSelectedHistoryId(null);
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          {selectedHistoryEvent ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    onClick={() => setSelectedHistoryId(null)}
                    data-testid="button-history-detail-back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Назад
                  </Button>
                </div>
                <SheetTitle>Что изменено</SheetTitle>
              </SheetHeader>
              <div
                className="min-h-0 flex-1 overflow-y-auto py-4"
                data-testid="distribution-fullscreen-entry-history-detail"
              >
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{formatHistoryAt(selectedHistoryEvent.at)}</p>
                    <p className="text-muted-foreground">{selectedHistoryEvent.meta}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Изменения
                    </p>
                    <p className="whitespace-pre-line text-sm text-foreground">
                      {selectedHistoryEvent.body?.trim()
                        ? selectedHistoryEvent.body
                        : "Детали изменения не сохранены."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>История изменений</SheetTitle>
              </SheetHeader>
              <div
                className="min-h-0 flex-1 overflow-y-auto py-4"
                data-testid="distribution-fullscreen-entry-history"
              >
                {historyEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Пока нет истории изменений</p>
                ) : (
                  <ul className="space-y-3">
                    {historyEvents.map((ev) => (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryId(ev.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`button-history-event-${ev.id}`}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">{formatHistoryAt(ev.at)}</span>
                            <span className="block text-muted-foreground">{ev.meta}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {completenessGateOpen && exitGateGaps.length > 0 ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-1 shadow-lg">
            <ShowcaseSaveCompletenessGate
              gaps={exitGateGaps}
              getCandidateRec={getCandidateShowcaseRec}
              selectedModels={selectedShowcaseModels}
              catalogLookup={getProductById}
              onSaveCapacity={(type, value) => {
                void persistShowcaseCapacity(type, value);
              }}
              onConfirm={runPendingClose}
              onSaveAnyway={runPendingClose}
              onCancel={() => {
                pendingCloseRef.current = null;
                setCompletenessGateOpen(false);
              }}
              confirmLabel="Выйти"
            />
          </div>
        </div>
      ) : null}

      <ShowcaseEquipmentCapacityDialog
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
        tradePointId={point.id}
        getCandidateRec={getCandidateShowcaseRec}
        selectedModels={selectedShowcaseModels}
        catalogLookup={getProductById}
        onConfirm={handleEquipmentDialogConfirm}
        onCancel={() => setEquipmentDialogOpen(false)}
      />
    </div>,
    document.body,
  );
}

type ProductDraftProps = {
  product: CatalogProduct;
  draft: FullscreenEntryDraftMap[string] | undefined;
  matrixModel?: ShowcaseMatrixModelDefinition;
  onDraftChange: (productId: string, patch: Partial<FullscreenEntryDraftMap[string]>) => void;
};

function segmentForProduct(product: CatalogProduct, matrixModel?: ShowcaseMatrixModelDefinition) {
  if (matrixModel) return segmentFromMatrixModel(matrixModel);
  return segmentFromProduct(product);
}

const STATUS_OPTIONS: { id: ShowcaseMatrixStatusId; label: string }[] = [
  { id: "installed", label: "На витрине" },
  { id: "need_install", label: "Нужно поставить" },
  { id: "postponed", label: "Отложено" },
  { id: "not_relevant", label: "Не актуально" },
];

const STATUS_LABEL_RU: Record<ShowcaseMatrixStatusId, string> = {
  installed: "На витрине",
  need_install: "Нужно поставить",
  postponed: "Отложено",
  not_relevant: "Не актуально",
};

const STATUS_ACCENT: Record<ShowcaseMatrixStatusId, string> = {
  installed: "border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/30",
  need_install: "border-amber-500 ring-2 ring-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30",
  postponed: "border-sky-500 ring-2 ring-sky-500/40 bg-sky-50/60 dark:bg-sky-950/30",
  not_relevant: "border-zinc-400 ring-2 ring-zinc-400/40 bg-zinc-100/60 dark:bg-zinc-900/40",
};

const STATUS_BADGE: Record<ShowcaseMatrixStatusId, string> = {
  installed: "bg-emerald-600",
  need_install: "bg-amber-600",
  postponed: "bg-sky-600",
  not_relevant: "bg-zinc-500",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function StatusSelectControl({
  value,
  onChange,
  productId,
  className,
}: {
  value: ShowcaseMatrixStatusId;
  onChange: (status: ShowcaseMatrixStatusId) => void;
  productId: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ShowcaseMatrixStatusId)}>
      <SelectTrigger
        className={cn("h-8 text-xs", className)}
        data-testid={`select-fullscreen-entry-status-${productId}`}
      >
        <SelectValue>{STATUS_LABEL_RU[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FullscreenProductCard({
  product,
  cardSize,
  draft,
  matrixModel,
  onDraftChange,
  quickMode,
  quickStatus,
  baselineStatus,
  isChanged,
  isMatrixRecommended,
  isExplicitMark,
  onSetExplicitMark,
  placementTypeMode,
  activePlacementType,
}: ProductDraftProps & {
  cardSize: CatalogCardSize;
  quickMode: boolean;
  quickStatus: ShowcaseMatrixStatusId;
  baselineStatus: ShowcaseMatrixStatusId;
  isChanged: boolean;
  isMatrixRecommended: boolean;
  isExplicitMark: boolean;
  onSetExplicitMark: (productId: string, marked: boolean) => void;
  placementTypeMode: boolean;
  activePlacementType: ShowcasePlacementType;
}) {
  const row = draft;
  const segment = row ? row.placementSegment : segmentForProduct(product, matrixModel);
  const defaultPlacementType = placementTypeMode ? activePlacementType : (row?.placementType ?? "portal");
  const img = product.image?.trim() ?? "";
  const titleSize =
    cardSize === "xl" ? "text-sm" : cardSize === "s" ? "text-[11px]" : "text-xs";

  const effectiveStatus = row?.status ?? baselineStatus;
  const isMarked =
    quickMode &&
    (quickStatus === "need_install"
      ? isExplicitMark || (isChanged && effectiveStatus === "need_install")
      : effectiveStatus === quickStatus);

  const handleQuickTap = () => {
    const seg = segmentForProduct(product, matrixModel);
    const isToggledOn = (isExplicitMark || isChanged) && effectiveStatus === quickStatus;
    if (isToggledOn) {
      if (quickStatus === "need_install" && baselineStatus === quickStatus) {
        onSetExplicitMark(product.id, false);
      } else {
        onDraftChange(product.id, {
          status: baselineStatus,
          placementSegment: row?.placementSegment ?? seg,
          placementType: row?.placementType ?? defaultPlacementType,
        });
        onSetExplicitMark(product.id, false);
      }
      return;
    }
    if (quickStatus === "need_install" && baselineStatus === quickStatus) {
      onSetExplicitMark(product.id, true);
      return;
    }
    onDraftChange(product.id, {
      status: quickStatus,
      placementSegment: row?.placementSegment ?? seg,
      placementType: placementTypeMode && quickStatus === "installed" ? activePlacementType : defaultPlacementType,
    });
    onSetExplicitMark(product.id, true);
  };

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs",
        isMarked
          ? STATUS_ACCENT[quickStatus]
          :         quickMode && isMatrixRecommended
            ? "border-primary/40"
            : "border-border/80",
        quickMode && "cursor-pointer select-none",
        cardSize === "s" ? "p-1.5" : "p-2",
      )}
      onClick={quickMode ? handleQuickTap : undefined}
      role={quickMode ? "button" : undefined}
      data-testid={quickMode ? `card-fullscreen-entry-quick-${product.id}` : undefined}
    >
      <div
        className={cn(
          "relative mb-2 w-full overflow-hidden rounded-lg bg-muted/40",
          cardSize === "xl" ? "aspect-[4/5]" : cardSize === "s" ? "aspect-square" : "aspect-[3/4]",
        )}
      >
        {img ? (
          <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
        )}
        {quickMode && isMatrixRecommended && !isMarked ? (
          <span className="absolute left-1 top-1 z-10 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow">
            По матрице
          </span>
        ) : null}
        {isMarked ? (
          <span
            className={cn(
              "absolute right-1 top-1 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow",
              STATUS_BADGE[quickStatus],
            )}
          >
            <Check className="h-3 w-3" aria-hidden />
            {STATUS_LABEL_RU[quickStatus]}
          </span>
        ) : null}
      </div>
      <h3 className={cn("line-clamp-2 font-medium leading-snug text-foreground", titleSize)}>
        {product.name}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">
        {product.type || product.doorKind}
        {product.article ? ` · ${product.article}` : ""}
      </p>
      {!quickMode ? (
        <>
          <StatusSelectControl
            value={effectiveStatus}
            onChange={(newStatus) => {
              const seg = segmentForProduct(product, matrixModel);
              onDraftChange(product.id, {
                status: newStatus,
                placementSegment: row?.placementSegment ?? seg,
                placementType:
                  newStatus === "installed" && placementTypeMode
                    ? activePlacementType
                    : (row?.placementType ?? defaultPlacementType),
              });
            }}
            productId={product.id}
            className="mt-2"
          />
          {row?.status === "installed" && row.placementType ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Крепление:{" "}
              <span className="font-medium text-foreground">
                {PLACEMENT_TYPE_LABEL_RU[row.placementType]}
              </span>
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function FullscreenProductRow({
  product,
  draft,
  matrixModel,
  onDraftChange,
  placementTypeMode,
  activePlacementType,
}: ProductDraftProps & {
  placementTypeMode: boolean;
  activePlacementType: ShowcasePlacementType;
}) {
  const row = draft;
  const defaultPlacementType = placementTypeMode ? activePlacementType : (row?.placementType ?? "portal");
  const img = product.image?.trim() ?? "";
  const currentStatus = row?.status ?? "need_install";

  return (
    <li className="flex gap-3 rounded-xl border border-border/80 bg-card p-2">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40">
        {img ? <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.doorKind}
            {product.article ? ` · ${product.article}` : ""}
          </p>
        </div>
        <StatusSelectControl
          value={currentStatus}
          onChange={(newStatus) => {
            const seg = segmentForProduct(product, matrixModel);
            onDraftChange(product.id, {
              status: newStatus,
              placementSegment: row?.placementSegment ?? seg,
              placementType:
                newStatus === "installed" && placementTypeMode
                  ? activePlacementType
                  : (row?.placementType ?? defaultPlacementType),
            });
          }}
          productId={product.id}
          className="mt-1"
        />
        {row?.status === "installed" && row.placementType ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Крепление:{" "}
            <span className="font-medium text-foreground">
              {PLACEMENT_TYPE_LABEL_RU[row.placementType]}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

