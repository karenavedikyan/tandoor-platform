import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, MoreHorizontal, PieChart, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getProductById } from "@/lib/catalog-data";
import { MultiSelect } from "@/components/ui/multi-select";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  catalogHrefForMatrixModel,
  priorityLabelRu,
  showcaseMatrixTypeLabelRu,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import {
  filterShowcaseModelsForDisplay,
  modelMatchesQuickFilter,
  modelsMatchingCategory,
  pruneCatalogFiltersForAllowedKeys,
  readShowcaseMatrixCategoryFilterFromStorage,
  writeShowcaseMatrixCategoryFilterToStorage,
  type ShowcaseMatrixCategoryFilter,
  type ShowcaseMatrixQuickFilterId,
} from "@/lib/trade-point-showcase-matrix-filters";
import { fetchActiveMatrixDef } from "@/lib/showcase-matrix-catalog-api";
import {
  refreshMatrixDefFromServer,
  SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT,
  SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT,
} from "@/lib/showcase-matrix-catalog-store";
import { resolveTradePointMatrixWithSource } from "@/lib/trade-point-matrix-resolver";
import {
  canEditTradePointShowcaseMatrix,
  canViewTradePointShowcaseMatrix,
  computeTradePointShowcaseMatrixStats,
  loadShowcaseMatrixStorage,
  resolveMatrixModelEntry,
  resolveMatrixModelStatus,
  SHOWCASE_MATRIX_CHANGED_EVENT,
  SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY,
  statusLabelRu,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import {
  loadCachedMatrix,
  normalizeShowcaseMatrixModelId,
  refreshMatrixFromServer,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import type { ShowcaseTask } from "@/lib/showcase-distribution-data";
import type { MatrixFilterId, TradePointMatrixSummary, TradePointProductMatrixItem } from "@/lib/trade-point-matrix-data";
import type { MatrixTask, MatrixTaskRecommendation } from "@/lib/trade-point-task-data";
import { ShowcaseModelPresentationDialog } from "@/components/showcase-model-presentation-dialog";
import { ModelDoorPhotoFrame } from "@/components/showcase/model-door-photo-frame";
import { TradePointShowcaseAssignmentsPanel } from "@/components/distribution/trade-point-showcase-assignments-panel";
import { TradePointPlacementBlocksSection } from "@/components/distribution/trade-point-placement-blocks-section";
import { TradePointShowcaseHistorySection } from "@/components/distribution/trade-point-showcase-history-section";
import { TradePointShowcaseSegmentSummary } from "@/components/distribution/trade-point-showcase-segment-summary";
import {
  countInstalledOursBySegment,
  installedOurModelsBySegment,
} from "@/lib/trade-point-showcase-segment-models";
import { computeDistributionOnPoint } from "@/lib/showcase-distribution-on-point";
import { getShowcaseTypeCapacity } from "@/lib/showcase-type-capacity";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { resolveShowcaseMatrixPositionForEntry } from "@/lib/showcase-matrix-deficit-tasks";
import { resolveTradePointDisplayName } from "@/lib/trade-point-display-labels";

export type ShowcaseMatrixViewMode = "large" | "compact" | "mini" | "list";
export type ShowcaseSectionDensity = "comfortable" | "compact";

const VIEW_MODE_LABEL_RU: Record<ShowcaseMatrixViewMode, string> = {
  large: "Крупно",
  compact: "Компактно",
  mini: "Мини",
  list: "Список",
};

function showcaseModelImageSrc(m: ShowcaseMatrixModelDefinition): string {
  const direct = m.imageUrl?.trim() ?? "";
  if (direct) return direct;
  return getProductById(m.id)?.image?.trim() ?? "";
}


type MatrixCatalogFilterRow = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};


function collectMatrixCatalogFilterRows(scopeModels: ShowcaseMatrixModelDefinition[]): MatrixCatalogFilterRow[] {
  const series = new Set<string>();
  const coating = new Set<string>();
  const openType = new Set<string>();
  const colors = new Set<string>();
  const sizes = new Set<string>();
  const showcasePri = new Set<string>();
  const matrixPri = new Set<ShowcaseMatrixModelDefinition["basePriority"]>();

  for (const m of scopeModels) {
    matrixPri.add(m.basePriority);
    const p = getProductById(m.id);
    if (!p) continue;
    const s = p.series?.trim();
    if (s) series.add(s);
    const coat = p.coating?.trim();
    if (coat) coating.add(coat);
    const ot = p.openType?.trim();
    if (ot && ot !== "—" && ot.toLowerCase() !== "см. карточку") openType.add(ot);
    for (const c of p.colors ?? []) {
      const t = c?.trim();
      if (t) colors.add(t);
    }
    for (const z of p.sizes ?? []) {
      const t = z?.trim();
      if (t) sizes.add(t);
    }
    showcasePri.add(String(p.showcasePriority));
  }

  const rows: MatrixCatalogFilterRow[] = [];

  const pushSimple = (key: string, label: string, vals: Set<string>) => {
    const sorted = Array.from(vals).sort((a, b) => a.localeCompare(b, "ru"));
    if (sorted.length >= 2) {
      rows.push({
        key,
        label,
        options: sorted.map((v) => ({ value: v, label: v })),
      });
    }
  };

  pushSimple("series", "Коллекция / серия", series);
  pushSimple("coating", "Отделка / покрытие", coating);
  pushSimple("openType", "Открывание", openType);
  pushSimple("color", "Цвет", colors);
  pushSimple("size", "Размер", sizes);
  pushSimple("showcasePriority", "Приоритет витрины (каталог)", showcasePri);

  if (matrixPri.size >= 2) {
    const order: ShowcaseMatrixModelDefinition["basePriority"][] = ["high", "medium", "low"];
    const opts = order.filter((k) => matrixPri.has(k)).map((k) => ({ value: k, label: priorityLabelRu(k) }));
    if (opts.length >= 2) {
      rows.push({ key: "matrixPriority", label: "Приоритет матрицы", options: opts });
    }
  }

  const orderKeys = ["series", "coating", "openType", "matrixPriority", "showcasePriority", "color", "size"];
  rows.sort((a, b) => orderKeys.indexOf(a.key) - orderKeys.indexOf(b.key) || a.label.localeCompare(b.label, "ru"));
  return rows;
}

function modelPassesMatrixCatalogFilters(
  m: ShowcaseMatrixModelDefinition,
  filters: Record<string, string[]>,
): boolean {
  for (const [key, selected] of Object.entries(filters)) {
    if (!selected?.length) continue;
    if (key === "matrixPriority") {
      if (!selected.includes(m.basePriority)) return false;
      continue;
    }
    const p = getProductById(m.id);
    if (!p) return false;
    if (key === "series") {
      const v = p.series?.trim() ?? "";
      if (!selected.includes(v)) return false;
    } else if (key === "coating") {
      const v = p.coating?.trim() ?? "";
      if (!selected.includes(v)) return false;
    } else if (key === "openType") {
      const v = p.openType?.trim() ?? "";
      if (!selected.includes(v)) return false;
    } else if (key === "showcasePriority") {
      if (!selected.includes(String(p.showcasePriority))) return false;
    } else if (key === "color") {
      const want = new Set(selected);
      const cols = (p.colors ?? []).map((c) => c.trim()).filter(Boolean);
      if (!cols.some((c) => want.has(c))) return false;
    } else if (key === "size") {
      const want = new Set(selected);
      const sz = (p.sizes ?? []).map((s) => s.trim()).filter(Boolean);
      if (!sz.some((s) => want.has(s))) return false;
    }
  }
  return true;
}

function readViewModeFromStorage(): ShowcaseMatrixViewMode {
  if (typeof window === "undefined") return "compact";
  try {
    const raw = window.localStorage.getItem(SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY);
    if (raw === "large" || raw === "compact" || raw === "mini" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "compact";
}

function priorityBadgeClass(p: ShowcaseMatrixModelDefinition["basePriority"]) {
  if (p === "high") return "border-rose-200 bg-rose-50 text-rose-900";
  if (p === "medium") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-border bg-muted text-muted-foreground";
}

function statusBadgeClass(s: ShowcaseMatrixStatusId) {
  if (s === "installed") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (s === "postponed") return "border-slate-300 bg-slate-100 text-slate-800";
  if (s === "not_relevant") return "border-border bg-muted/80 text-muted-foreground";
  return "border-amber-500/80 bg-amber-100 text-amber-950 ring-1 ring-amber-400/50";
}

function matrixCardShellClass(st: ShowcaseMatrixStatusId): string {
  if (st === "need_install") {
    return "border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-50/40 shadow-md ring-1 ring-amber-300/40";
  }
  if (st === "installed") {
    return "border border-emerald-200/90 bg-card shadow-sm";
  }
  if (st === "postponed") {
    return "border border-slate-200 bg-slate-50/60 shadow-sm";
  }
  return "border border-dashed border-border/80 bg-muted/20 opacity-[0.92] shadow-sm";
}


const MANUAL_MODEL_PRESENTATION_DEFAULTS = {
  importanceReason: "",
  characteristics: "",
  advantages: "",
  benefitsDealer: "",
  benefitsBuyer: "",
  objections: "",
  objectionAnswers: "",
  copyMessage: "",
} as const;

function catalogProductMatrixType(productId: string): ShowcaseMatrixModelDefinition["type"] {
  const p = getProductById(productId);
  if (!p) return "interior";
  const category = p.category ?? "";
  if (category.includes("Фурнитур")) return "hardware";
  if (p.doorKind === "Межкомнатная" || category.includes("Межкомнат")) return "interior";
  return "entrance";
}

function buildManualModelFromEntry(
  entry: ShowcaseMatrixEntryDto,
  dealer: DealerRow,
): ShowcaseMatrixModelDefinition {
  const resolved = resolveShowcaseMatrixPositionForEntry(entry, dealer);
  const product = getProductById(entry.targetId);
  const type = catalogProductMatrixType(entry.targetId);
  return {
    id: entry.targetId,
    name: resolved.productName?.trim() || getProductById(entry.targetId)?.name?.trim() || entry.targetId,
    type,
    typeLabelRu: showcaseMatrixTypeLabelRu(type),
    imageUrl: resolved.showcaseMatrixImageSrc ?? product?.image?.trim() ?? "",
    basePriority: "medium",
    ...MANUAL_MODEL_PRESENTATION_DEFAULTS,
  };
}

function sortModelsByPriorityThenName(
  list: ShowcaseMatrixModelDefinition[],
): ShowcaseMatrixModelDefinition[] {
  const pr: Record<ShowcaseMatrixModelDefinition["basePriority"], number> = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => pr[a.basePriority] - pr[b.basePriority] || a.name.localeCompare(b.name));
}

export type TradePointShowcasePageBundle = {
  matrixSummary: TradePointMatrixSummary;
  showcaseComment: string;
  distribution: DealerTradePoint["distribution"];
  distributionConclusion: string;
  productMatrixFiltered: TradePointProductMatrixItem[];
  productMatrixFilter: MatrixFilterId;
  onProductMatrixFilterChange: (id: MatrixFilterId) => void;
  recommendationByProductId: Map<string, MatrixTaskRecommendation>;
  showcaseTasksOpen: ShowcaseTask[];
  openTasksCount: number;
  recommendations: MatrixTaskRecommendation[];
  createdTaskByProductId: Map<string, MatrixTask>;
  onCreateMatrixTask: (rec: MatrixTaskRecommendation) => void;
  onScrollToMatrixTask: (taskId: string) => void;
  matrixTasksSlot: ReactNode;
  tasksLinkHref: string;
};

type Props = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  page: TradePointShowcasePageBundle;
  density?: ShowcaseSectionDensity;
  statusFilterActionSlot?: ReactNode;
  onOpenEntry?: (productId?: string) => void;
  hideOpenTasksSection?: boolean;
};

export function TradePointShowcaseMatrixSection({
  dealer,
  point,
  profile,
  actorUserId,
  actorName,
  page,
  density = "comfortable",
  statusFilterActionSlot,
  onOpenEntry,
  hideOpenTasksSection = false,
}: Props) {
  const canView = useMemo(() => canViewTradePointShowcaseMatrix(profile, dealer), [profile, dealer]);
  const canEdit = useMemo(() => canEditTradePointShowcaseMatrix(profile, dealer), [profile, dealer]);
  const tradePointDisplayName = useMemo(() => resolveTradePointDisplayName(dealer, point), [dealer, point]);
  const isCompact = density === "compact";
  const actx = useClientBaseActualization();
  const showcaseRec = actx.state.tradePointShowcaseActualizationById[point.id];

  const [bump, setBump] = useState(0);
  const [catalogBump, setCatalogBump] = useState(0);
  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, fn);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
      window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => setCatalogBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT, fn);
    window.addEventListener(SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT, fn);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT, fn);
      window.removeEventListener(SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT, fn);
    };
  }, []);

  useEffect(() => {
    void refreshMatrixFromServer(point.id, dealer.id);
  }, [point.id, dealer.id]);

  useEffect(() => {
    void fetchActiveMatrixDef({
      clientCategory: dealer.clientCategory,
      region: dealer.region,
      city: point.city,
    }).then((def) => {
      if (def?.id) void refreshMatrixDefFromServer(def.id);
    });
  }, [dealer.clientCategory, dealer.region, dealer.id, point.city, point.id]);

  useEffect(() => {
    const onOnline = () => void refreshMatrixFromServer(point.id, dealer.id);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [point.id, dealer.id]);

  const storage = useMemo(() => {
    void bump;
    return loadShowcaseMatrixStorage();
  }, [bump]);

  const backendByModelId = useMemo(() => {
    void bump;
    const map = new Map<string, ShowcaseMatrixEntryDto>();
    for (const entry of loadCachedMatrix(point.id)) {
      if (entry.targetKind !== "model") continue;
      const key = normalizeShowcaseMatrixModelId(entry.targetId);
      const prev = map.get(key);
      if (!prev || entry.updatedAt > prev.updatedAt) map.set(key, entry);
    }
    return map;
  }, [bump, point.id]);

  const effectiveStatus = useCallback(
    (modelId: string): ShowcaseMatrixStatusId => {
      const backend = backendByModelId.get(normalizeShowcaseMatrixModelId(modelId));
      return resolveMatrixModelStatus({
        dealerId: dealer.id,
        tradePointId: point.id,
        modelId,
        backend,
        storage,
      });
    },
    [backendByModelId, storage, dealer.id, point.id],
  );

  const effectiveEntry = useCallback(
    (modelId: string) => {
      const backend = backendByModelId.get(normalizeShowcaseMatrixModelId(modelId));
      return resolveMatrixModelEntry({
        dealerId: dealer.id,
        tradePointId: point.id,
        modelId,
        backend,
        storage,
      });
    },
    [backendByModelId, storage, dealer.id, point.id],
  );

  const resolvedMatrix = useMemo(() => {
    void catalogBump;
    return resolveTradePointMatrixWithSource({
      dealerId: dealer.id,
      tradePointId: point.id,
      clientCategory: dealer.clientCategory,
      region: dealer.region,
      city: point.city,
    });
  }, [catalogBump, dealer.clientCategory, dealer.id, dealer.region, point.city, point.id]);
  const models = resolvedMatrix.source === "managed" ? resolvedMatrix.models : [];
  const isManagedMatrix = resolvedMatrix.source === "managed";

  const manualOnlyModels = useMemo(() => {
    const matrixModelIds = new Set(models.map((m) => m.id));
    const out: ShowcaseMatrixModelDefinition[] = [];
    for (const entry of Array.from(backendByModelId.values())) {
      if (entry.targetKind !== "model") continue;
      if (matrixModelIds.has(entry.targetId)) continue;
      out.push(buildManualModelFromEntry(entry, dealer));
    }
    return sortModelsByPriorityThenName(out);
  }, [backendByModelId, dealer, models]);

  const allModels = useMemo(() => [...models, ...manualOnlyModels], [manualOnlyModels, models]);

  const matrixCompletionPct = useMemo(
    () => computeTradePointShowcaseMatrixStats(dealer, point, storage).completionPct,
    [dealer, point, storage],
  );

  const priorityNeedModels = useMemo(() => {
    return sortModelsByPriorityThenName(
      allModels.filter((m) => effectiveStatus(m.id) === "need_install"),
    ).slice(0, 3);
  }, [allModels, effectiveStatus]);

  const statusCounts = useMemo(() => {
    const acc: Record<ShowcaseMatrixStatusId, number> = {
      need_install: 0,
      installed: 0,
      postponed: 0,
      not_relevant: 0,
    };
    for (const m of allModels) {
      const st = effectiveStatus(m.id);
      acc[st] += 1;
    }
    return acc;
  }, [allModels, effectiveStatus]);

  // installed-модели по сегментам — для блока «Витрина в ТТ» и fallback тайлов дистрибуции
  const installedModelsBySegment = useMemo(() => {
    void bump;
    return installedOurModelsBySegment(loadCachedMatrix(point.id));
  }, [point.id, bump]);

  const distributionFromPlacements = useMemo(() => {
    void bump;
    const entries = loadCachedMatrix(point.id);
    const installedOursBySegment = countInstalledOursBySegment(entries);
    return computeDistributionOnPoint({
      entries,
      installedOursBySegment,
      portalCapacity: {
        entrance: getShowcaseTypeCapacity(showcaseRec, "entrance") ?? 0,
        interior: getShowcaseTypeCapacity(showcaseRec, "interior") ?? 0,
        hardware: getShowcaseTypeCapacity(showcaseRec, "hardware") ?? 0,
      },
    });
  }, [point.id, bump, showcaseRec]);

  const [userQuickFilter, setUserQuickFilter] = useState<ShowcaseMatrixQuickFilterId | null>(null);
  const autoQuickFilter: ShowcaseMatrixQuickFilterId = statusCounts.need_install > 0 ? "needed" : "all";
  const activeQuickFilter = userQuickFilter ?? autoQuickFilter;

  const [categoryFilter, setCategoryFilter] = useState<ShowcaseMatrixCategoryFilter>(() =>
    readShowcaseMatrixCategoryFilterFromStorage(point.id),
  );
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string[]>>({});
  const [catalogFiltersPanelOpen, setCatalogFiltersPanelOpen] = useState(false);
  const [matrixViewFiltersOpen, setMatrixViewFiltersOpen] = useState(false);

  const statusFilteredModels = useMemo(() => {
    return models.filter((m) => modelMatchesQuickFilter(effectiveStatus(m.id), activeQuickFilter));
  }, [models, effectiveStatus, activeQuickFilter]);

  const statusFilteredManualModels = useMemo(() => {
    return manualOnlyModels.filter((m) =>
      modelMatchesQuickFilter(effectiveStatus(m.id), activeQuickFilter),
    );
  }, [manualOnlyModels, effectiveStatus, activeQuickFilter]);

  const modelsForCatalogOptionScope = useMemo(
    () => modelsMatchingCategory(allModels, categoryFilter),
    [allModels, categoryFilter],
  );

  const catalogFilterRows = useMemo(
    () => collectMatrixCatalogFilterRows(modelsForCatalogOptionScope),
    [modelsForCatalogOptionScope],
  );

  useEffect(() => {
    writeShowcaseMatrixCategoryFilterToStorage(point.id, categoryFilter);
  }, [categoryFilter, point.id]);

  useEffect(() => {
    setCatalogFilters({});
  }, [categoryFilter]);

  const catalogFilterRowKeys = useMemo(
    () => catalogFilterRows.map((r) => r.key).join("\0"),
    [catalogFilterRows],
  );

  useEffect(() => {
    const allowed = new Set(catalogFilterRows.map((r) => r.key));
    setCatalogFilters((prev) => pruneCatalogFiltersForAllowedKeys(prev, allowed));
  }, [catalogFilterRowKeys, catalogFilterRows]);

  useEffect(() => {
    if (catalogFilterRows.length === 0) setCatalogFiltersPanelOpen(false);
  }, [catalogFilterRows.length]);

  const filteredModels = useMemo(
    () =>
      filterShowcaseModelsForDisplay(
        statusFilteredModels,
        activeQuickFilter,
        categoryFilter,
        catalogFilters,
        effectiveStatus,
        modelPassesMatrixCatalogFilters,
      ),
    [statusFilteredModels, activeQuickFilter, categoryFilter, catalogFilters, effectiveStatus],
  );

  const filteredManualModels = useMemo(
    () =>
      filterShowcaseModelsForDisplay(
        statusFilteredManualModels,
        activeQuickFilter,
        categoryFilter,
        catalogFilters,
        effectiveStatus,
        modelPassesMatrixCatalogFilters,
      ),
    [statusFilteredManualModels, activeQuickFilter, categoryFilter, catalogFilters, effectiveStatus],
  );

  const visibleModelCount = filteredModels.length + filteredManualModels.length;
  const statusFilteredTotalCount = statusFilteredModels.length + statusFilteredManualModels.length;

  const setCatalogFilterKey = useCallback((key: string, next: string[]) => {
    setCatalogFilters((prev) => ({ ...prev, [key]: next }));
  }, []);

  const [viewMode, setViewMode] = useState<ShowcaseMatrixViewMode>("compact");
  const [viewHydrated, setViewHydrated] = useState(false);

  useEffect(() => {
    setViewMode(readViewModeFromStorage());
    setViewHydrated(true);
  }, []);

  useEffect(() => {
    if (!viewHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SHOWCASE_MATRIX_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode, viewHydrated]);

  const [presentationModel, setPresentationModel] = useState<ShowcaseMatrixModelDefinition | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);
  /** Локальное раскрытие деталей карточки (компакт/мини), без localStorage. */
  const [matrixCardDetailsOpenById, setMatrixCardDetailsOpenById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMatrixCardDetailsOpenById({});
  }, [viewMode, categoryFilter]);

  const openPresentation = useCallback((m: ShowcaseMatrixModelDefinition) => {
    setPresentationModel(m);
    setPresentationOpen(true);
  }, []);

  if (!canView) return null;

  const renderOpenEntryButton = (
    modelId: string,
    status: ShowcaseMatrixStatusId,
    className?: string,
  ) => {
    if (!canEdit || !onOpenEntry) return null;
    const label = status === "need_install" ? "Внести" : "Изменить";
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("font-semibold", className)}
        data-testid={`button-trade-point-showcase-open-entry-${modelId}`}
        onClick={() => onOpenEntry(modelId)}
      >
        {label}
      </Button>
    );
  };

  const gridClass =
    viewMode === "large"
      ? "grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2"
      : viewMode === "compact"
        ? "grid grid-cols-2 items-stretch gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        : viewMode === "mini"
          ? "grid max-[340px]:grid-cols-2 grid-cols-3 items-stretch gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8"
          : "flex flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card";
  const renderShowcaseModelCard = (m: ShowcaseMatrixModelDefinition) => {
              const st = effectiveStatus(m.id);
              const entry = effectiveEntry(m.id);
              const commentVal = entry.comment ?? "";

              if (viewMode === "list") {
                const imgSrc = showcaseModelImageSrc(m);
                return (
                  <div
                    key={m.id}
                    data-testid={`row-trade-point-showcase-model-${m.id}`}
                    className={cn(
                      "flex min-w-0 flex-row items-center gap-2 px-2 py-1.5",
                      matrixCardShellClass(st),
                      st === "not_relevant" && "opacity-80",
                    )}
                  >
                    <button type="button" className="shrink-0" onClick={() => openPresentation(m)}>
                      <ModelDoorPhotoFrame
                        src={imgSrc}
                        alt=""
                        frameClass="h-10 w-9 shrink-0"
                        imgPaddingClass="p-0.5"
                        imgTestId={`image-trade-point-showcase-model-${m.id}`}
                        placeholderDensity="micro"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="line-clamp-2 w-full min-w-0 text-left text-sm font-semibold leading-snug text-foreground hover:underline"
                        data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                        onClick={() => openPresentation(m)}
                      >
                        {m.name}
                      </button>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                        <Badge variant="outline" className="max-w-[40%] shrink truncate text-[9px] font-medium">
                          {m.typeLabelRu}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[9px] font-medium", priorityBadgeClass(m.basePriority))}
                          data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                        >
                          {priorityLabelRu(m.basePriority)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[9px] font-medium", statusBadgeClass(st))}
                          data-testid={`badge-trade-point-showcase-status-${m.id}`}
                        >
                          {statusLabelRu(st)}
                        </Badge>
                      </div>
                    </div>
                    <div className="relative flex shrink-0 flex-col items-stretch gap-1">
                      {renderOpenEntryButton(m.id, st, "h-7 px-2 text-[10px] leading-none")}
                      {canEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-0.5 px-2 text-[10px] text-muted-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Ещё
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            side="bottom"
                            sideOffset={4}
                            className="max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),18rem)] space-y-2 overflow-y-auto p-2"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full text-xs"
                              data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                              onClick={() => openPresentation(m)}
                            >
                              Презентация
                            </Button>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground" htmlFor={`showcase-cmt-list-${m.id}`}>
                                Комментарий
                              </Label>
                              <Textarea
                                id={`showcase-cmt-list-${m.id}`}
                                rows={2}
                                className="min-h-[44px] resize-y text-xs"
                                data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                                readOnly={!canEdit}
                                value={commentVal}
                                onChange={(e) => {
                                  if (!canEdit) return;
                                  upsertShowcaseMatrixModelState({
                                    dealerId: dealer.id,
                                    tradePointId: point.id,
                                    model: m,
                                    status: st,
                                    comment: e.target.value,
                                    actorUserId,
                                    actorName,
                                  });
                                }}
                              />
                            </div>
                            <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                              <Link href={catalogHrefForMatrixModel(m)}>Каталог</Link>
                            </Button>
                          </PopoverContent>
                        </Popover>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const isMini = viewMode === "mini";
              const isCompact = viewMode === "compact";
              const detailsOpen = !!matrixCardDetailsOpenById[m.id];

              if (isCompact || isMini) {
                /** На телефонах — ниже рамка фото, чтобы 2–3 колонки не были «узкими небоскрёбами». */
                const compactPhotoSlot =
                  "h-[6.75rem] w-full shrink-0 sm:h-[11.25rem] md:h-[14.5rem] lg:h-[15rem]";
                const miniPhotoSlot =
                  "h-[3.75rem] w-full shrink-0 max-[340px]:h-[3.25rem] sm:h-[7rem] md:h-[8.25rem] lg:h-[8.75rem] xl:h-[9.375rem]";
                const densityPhotoClass = isMini ? miniPhotoSlot : compactPhotoSlot;
                const densityPad = isMini ? "p-1" : "p-2";
                const densityRounded = isMini ? "rounded-lg" : "rounded-2xl";
                const detailsTriggerLabel = isMini || isCompact ? "Ещё" : "Подробнее";
                const imgSrc = showcaseModelImageSrc(m);
                const phDensity = isMini ? "micro" : "compact";
                const titleClass = cn(
                  "min-w-0 max-w-full break-words font-semibold leading-snug text-foreground line-clamp-2",
                  isMini ? "text-[10px]" : "text-xs sm:text-sm",
                );

                return (
                  <Card
                    key={m.id}
                    data-testid={`row-trade-point-showcase-model-${m.id}`}
                    className={cn(
                      "flex min-h-0 min-w-0 h-full flex-col overflow-hidden shadow-md",
                      densityRounded,
                      matrixCardShellClass(st),
                      st === "not_relevant" && "opacity-[0.88]",
                    )}
                  >
                    <div className="flex min-h-0 min-w-0 h-full w-full flex-col">
                      <button type="button" className="relative w-full shrink-0 text-left" onClick={() => openPresentation(m)}>
                        <ModelDoorPhotoFrame
                          src={imgSrc}
                          alt=""
                          frameClass={densityPhotoClass}
                          imgPaddingClass={isMini ? "p-0.5" : "p-1.5 sm:p-2"}
                          imgTestId={`image-trade-point-showcase-model-${m.id}`}
                          placeholderDensity={phDensity}
                        />
                      </button>
                      <CardContent className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-1.5", densityPad)}>
                        <div className="min-w-0 space-y-1.5">
                          <p className={titleClass} data-testid={`text-trade-point-showcase-model-title-${m.id}`}>
                            {m.name}
                          </p>
                          {isCompact ? (
                            <div className="flex min-w-0 flex-wrap gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "max-w-full shrink-0 text-[10px] font-semibold",
                                  st === "need_install"
                                    ? "border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-300/50"
                                    : st === "installed"
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                      : statusBadgeClass(st),
                                )}
                                data-testid={`badge-trade-point-showcase-status-${m.id}`}
                              >
                                {statusLabelRu(st)}
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "max-w-full text-[10px] font-semibold",
                                  st === "need_install"
                                    ? "border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-300/50"
                                    : st === "installed"
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                      : statusBadgeClass(st),
                                )}
                                data-testid={`badge-trade-point-showcase-status-${m.id}`}
                              >
                                {statusLabelRu(st)}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {renderOpenEntryButton(
                          m.id,
                          st,
                          cn("w-full text-xs", isMini ? "h-7 text-[10px]" : "h-9"),
                        )}

                        <Collapsible
                          open={detailsOpen}
                          onOpenChange={(open) =>
                            setMatrixCardDetailsOpenById((prev) => ({
                              ...prev,
                              [m.id]: open,
                            }))
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn("w-full gap-1 text-xs", isMini ? "h-7 text-[10px]" : "h-8")}
                              data-testid={`button-showcase-matrix-card-details-${m.id}`}
                            >
                              {(isMini || isCompact) ? <MoreHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
                              {detailsTriggerLabel}
                              <ChevronDown
                                className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", detailsOpen && "rotate-180")}
                                aria-hidden
                              />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <section
                              data-testid={`section-showcase-matrix-card-details-${m.id}`}
                              className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/20 p-2"
                            >
                              {isMini ? (
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-[10px] font-medium">
                                    {m.typeLabelRu}
                                  </Badge>
                                  <Badge variant="outline" className={cn("text-[10px] font-medium", priorityBadgeClass(m.basePriority))}>
                                    {priorityLabelRu(m.basePriority)}
                                  </Badge>
                                </div>
                              ) : isCompact ? (
                                <div className="flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-[10px] font-medium">
                                    {m.typeLabelRu}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                                    data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                                  >
                                    {priorityLabelRu(m.basePriority)}
                                  </Badge>
                                </div>
                              ) : null}
                              <p
                                className={cn(
                                  "text-xs leading-relaxed text-muted-foreground break-words",
                                  isMini && "line-clamp-4 text-[11px] leading-snug",
                                )}
                              >
                                {m.importanceReason}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-full text-xs"
                                data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                                onClick={() => openPresentation(m)}
                              >
                                Презентация
                              </Button>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground" htmlFor={`showcase-cmt-density-${m.id}`}>
                                  Комментарий менеджера
                                </Label>
                                <Textarea
                                  id={`showcase-cmt-density-${m.id}`}
                                  rows={2}
                                  className={cn("min-h-[48px] resize-y", isMini ? "text-[11px]" : "text-xs")}
                                  data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                                  readOnly={!canEdit}
                                  value={commentVal}
                                  onChange={(e) => {
                                    if (!canEdit) return;
                                    upsertShowcaseMatrixModelState({
                                      dealerId: dealer.id,
                                      tradePointId: point.id,
                                      model: m,
                                      status: st,
                                      comment: e.target.value,
                                      actorUserId,
                                      actorName,
                                    });
                                  }}
                                />
                              </div>
                              {canEdit ? (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                                >
                                  <Link href={catalogHrefForMatrixModel(m)}>Открыть в каталоге</Link>
                                </Button>
                              ) : null}
                            </section>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </div>
                  </Card>
                );
              }

              const photoFrameClass = "h-[15rem] w-full shrink-0 sm:h-[16rem] sm:w-[200px]";
              const cardPad = "p-3 sm:p-3.5";
              const rounded = "rounded-2xl";

              return (
                <Card
                  key={m.id}
                  data-testid={`row-trade-point-showcase-model-${m.id}`}
                  className={cn(
                    "h-full min-h-0 min-w-0 overflow-hidden shadow-md",
                    rounded,
                    matrixCardShellClass(st),
                    st === "not_relevant" && "opacity-[0.88]",
                  )}
                >
                  <div className="flex h-full min-h-0 w-full min-w-0 flex-col sm:flex-row">
                    <button type="button" className="relative w-full shrink-0 text-left sm:w-[200px]" onClick={() => openPresentation(m)}>
                      <ModelDoorPhotoFrame
                        src={showcaseModelImageSrc(m)}
                        alt=""
                        frameClass={photoFrameClass}
                        imgPaddingClass="p-2"
                        imgTestId={`image-trade-point-showcase-model-${m.id}`}
                      />
                    </button>
                    <CardContent className={cn("flex min-w-0 flex-1 flex-col gap-2", cardPad)}>
                      <button type="button" className="w-full min-w-0 text-left" onClick={() => openPresentation(m)}>
                        <div className="flex flex-col gap-1.5 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
                          <p
                            className="min-w-0 text-base font-semibold leading-snug text-foreground"
                            data-testid={`text-trade-point-showcase-model-title-${m.id}`}
                          >
                            {m.name}
                          </p>
                          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5">
                            <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                              {m.typeLabelRu}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 text-[10px] font-medium", priorityBadgeClass(m.basePriority))}
                              data-testid={`badge-trade-point-showcase-priority-${m.id}`}
                            >
                              {priorityLabelRu(m.basePriority)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 text-[10px] font-medium", statusBadgeClass(st))}
                              data-testid={`badge-trade-point-showcase-status-${m.id}`}
                            >
                              {statusLabelRu(st)}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-2 hidden text-xs leading-relaxed text-muted-foreground md:block">{m.importanceReason}</p>
                      </button>
                      <Collapsible className="md:hidden">
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full text-xs"
                            data-testid={`button-showcase-matrix-large-mobile-details-${m.id}`}
                          >
                            Подробнее
                            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <p className="text-xs leading-relaxed text-muted-foreground">{m.importanceReason}</p>
                        </CollapsibleContent>
                      </Collapsible>

                      <div className="flex flex-wrap gap-1.5">
                        {renderOpenEntryButton(m.id, st, "min-h-9 flex-1 sm:flex-none")}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9 flex-1 font-semibold sm:flex-none"
                          data-testid={`button-trade-point-showcase-open-presentation-${m.id}`}
                          onClick={() => openPresentation(m)}
                        >
                          Презентация
                        </Button>
                      </div>

                      <div className="space-y-1.5 border-t border-border/60 pt-2">
                        <Label className="text-xs text-muted-foreground" htmlFor={`showcase-cmt-${m.id}`}>
                          Комментарий менеджера
                        </Label>
                        <Textarea
                          id={`showcase-cmt-${m.id}`}
                          rows={2}
                          className="min-h-[52px] resize-y text-sm"
                          data-testid={`textarea-trade-point-showcase-comment-${m.id}`}
                          readOnly={!canEdit}
                          value={commentVal}
                          onChange={(e) => {
                            if (!canEdit) return;
                            upsertShowcaseMatrixModelState({
                              dealerId: dealer.id,
                              tradePointId: point.id,
                              model: m,
                              status: st,
                              comment: e.target.value,
                              actorUserId,
                              actorName,
                            });
                          }}
                        />
                      </div>

                      {canEdit ? (
                        <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                          <Link href={catalogHrefForMatrixModel(m)}>Открыть в каталоге</Link>
                        </Button>
                      ) : null}
                    </CardContent>
                  </div>
                </Card>
              );

  };

  const renderShowcaseModelGrid = (
    modelList: ShowcaseMatrixModelDefinition[],
    gridTestId?: string,
  ) => (
    <div
      className={cn(gridClass, viewMode === "list" && "divide-y divide-border/80")}
      data-testid={gridTestId}
    >
      {modelList.map(renderShowcaseModelCard)}
    </div>
  );

  const showUnassignedMatrixMessage = !isManagedMatrix && manualOnlyModels.length === 0;


  return (
    <>
      <section
        id="section-trade-point-showcase-matrix"
        data-testid="section-trade-point-showcase-matrix"
        className={cn("scroll-mt-28 overflow-x-clip min-w-0 sm:scroll-mt-32", isCompact ? "space-y-3" : "space-y-4")}
      >
        <div
          data-testid="section-trade-point-showcase-unified"
          className={cn("rounded-2xl border border-border/80 bg-muted/10", isCompact ? "space-y-3 p-2.5 sm:p-4" : "space-y-4 p-3 sm:p-4")}
        >
          <div data-testid="section-trade-point-showcase" className={cn(isCompact ? "space-y-2" : "space-y-3")}>
            <div className="space-y-1">
              <h2 className={cn("font-semibold tracking-tight text-foreground sm:text-lg", isCompact ? "text-sm sm:text-lg" : "text-base")}>Витрина торговой точки</h2>
              <p className={cn("max-w-2xl text-sm text-muted-foreground", isCompact && "hidden sm:block")}>
                Что стоит, что нужно поставить и какие задачи есть по этой точке. Статусы матрицы сохраняются в этом браузере.
              </p>
            </div>

            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                Нужно поставить:{" "}
                <span data-testid="text-showcase-matrix-needed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.need_install}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                На витрине:{" "}
                <span data-testid="text-showcase-matrix-installed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.installed}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Отложено:{" "}
                <span data-testid="text-showcase-matrix-postponed-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.postponed}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Не актуально:{" "}
                <span data-testid="text-showcase-matrix-not-relevant-count" className="font-semibold tabular-nums text-foreground">
                  {statusCounts.not_relevant}
                </span>
              </span>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span>
                Выполнение:{" "}
                <span className="font-semibold tabular-nums text-foreground">{matrixCompletionPct}%</span>
              </span>
              {page.openTasksCount > 0 ? (
                <>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <span>
                    Открытых задач:{" "}
                    <span className="font-semibold tabular-nums text-foreground">{page.openTasksCount}</span>
                  </span>
                </>
              ) : null}
            </p>

            <div
              id="section-trade-point-showcase-focus"
              data-testid="section-trade-point-showcase-focus"
              className={cn("rounded-xl border border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/80 sm:px-4", isCompact ? "px-2.5 py-2" : "px-3 py-2.5")}
            >
              {priorityNeedModels.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/90">В первую очередь поставить</p>
                  <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {priorityNeedModels.map((m) => (
                      <li key={m.id} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-200/90 bg-background/70 px-2 py-1.5 sm:min-w-[200px] sm:flex-none">
                        <ModelDoorPhotoFrame
                          src={showcaseModelImageSrc(m)}
                          alt=""
                          frameClass="h-11 w-9 sm:h-12 sm:w-10"
                          placeholderDensity="compact"
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-foreground hover:underline"
                          onClick={() => openPresentation(m)}
                        >
                          {m.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm font-medium text-emerald-900">Матрица витрины выполнена по статусам «нужно поставить».</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Фильтры витрины
              </p>

              <Collapsible open={matrixViewFiltersOpen} onOpenChange={setMatrixViewFiltersOpen} className="space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Фильтр по статусу
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={activeQuickFilter === "needed" ? "default" : "outline"}
                      className="h-8 shrink-0 text-xs"
                      data-testid="button-showcase-matrix-filter-needed"
                      onClick={() => setUserQuickFilter("needed")}
                    >
                      Нужно поставить
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeQuickFilter === "installed" ? "default" : "outline"}
                      className="h-8 shrink-0 text-xs"
                      data-testid="button-showcase-matrix-filter-installed"
                      onClick={() => setUserQuickFilter("installed")}
                    >
                      На витрине
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeQuickFilter === "postponed" ? "default" : "outline"}
                      className="h-8 shrink-0 text-xs"
                      data-testid="button-showcase-matrix-filter-postponed"
                      onClick={() => setUserQuickFilter("postponed")}
                    >
                      Отложено
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeQuickFilter === "not_relevant" ? "default" : "outline"}
                      className="h-8 shrink-0 text-xs"
                      data-testid="button-showcase-matrix-filter-not-relevant"
                      onClick={() => setUserQuickFilter("not_relevant")}
                    >
                      Не актуально
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeQuickFilter === "all" ? "secondary" : "outline"}
                      className="h-8 shrink-0 text-xs"
                      data-testid="button-showcase-matrix-filter-all"
                      onClick={() => setUserQuickFilter("all")}
                    >
                      Все
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="ml-auto h-8 w-8 shrink-0"
                        data-testid="button-showcase-matrix-filters-toggle"
                        aria-label="Фильтры матрицы"
                        title="Фильтры матрицы"
                      >
                        <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {statusFilterActionSlot ? <div className="w-full">{statusFilterActionSlot}</div> : null}

                <CollapsibleContent className="space-y-2 pt-1">
                      <div data-testid="section-showcase-matrix-view-sticky-toolbar" className="min-w-0 space-y-1.5">
                        <p className="text-[11px] text-muted-foreground md:hidden">
                          <span className="font-semibold text-foreground">Вид матрицы:</span> {VIEW_MODE_LABEL_RU[viewMode]}
                        </p>
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Вид матрицы
                          </p>
                          <div className="flex min-w-0 flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={viewMode === "large" ? "default" : "outline"}
                              className="h-8 shrink-0 text-xs"
                              data-testid="button-showcase-matrix-view-large"
                              onClick={() => setViewMode("large")}
                            >
                              Крупно
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={viewMode === "compact" ? "default" : "outline"}
                              className="h-8 shrink-0 text-xs"
                              data-testid="button-showcase-matrix-view-compact"
                              onClick={() => setViewMode("compact")}
                            >
                              Компактно
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={viewMode === "mini" ? "default" : "outline"}
                              className="h-8 shrink-0 text-xs"
                              data-testid="button-showcase-matrix-view-mini"
                              onClick={() => setViewMode("mini")}
                            >
                              Мини
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={viewMode === "list" ? "default" : "outline"}
                              className="h-8 shrink-0 text-xs"
                              data-testid="button-showcase-matrix-view-list"
                              onClick={() => setViewMode("list")}
                            >
                              Список
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 px-2 py-2 sm:px-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Категория</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryFilter === "all" ? "secondary" : "outline"}
                            className="h-8 shrink-0 text-xs"
                            data-testid="button-showcase-matrix-category-all"
                            onClick={() => setCategoryFilter("all")}
                          >
                            Все
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryFilter === "entrance" ? "default" : "outline"}
                            className="h-8 shrink-0 text-xs"
                            data-testid="button-showcase-matrix-category-entrance"
                            onClick={() => setCategoryFilter("entrance")}
                          >
                            ВХ двери
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryFilter === "interior" ? "default" : "outline"}
                            className="h-8 shrink-0 text-xs"
                            data-testid="button-showcase-matrix-category-interior"
                            onClick={() => setCategoryFilter("interior")}
                          >
                            МК двери
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={categoryFilter === "hardware" ? "default" : "outline"}
                            className="h-8 shrink-0 text-xs"
                            data-testid="button-showcase-matrix-category-hardware"
                            onClick={() => setCategoryFilter("hardware")}
                          >
                            Фурнитура
                          </Button>
                        </div>
                      </div>
                      {catalogFilterRows.length > 0 ? (
                        <Collapsible
                          open={catalogFiltersPanelOpen}
                          onOpenChange={setCatalogFiltersPanelOpen}
                          className="min-w-0 w-full sm:w-auto sm:max-w-md"
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full justify-between gap-2 text-xs sm:w-auto sm:min-w-[11rem]"
                              data-testid="button-showcase-matrix-catalog-filters-toggle"
                            >
                              <span>Фильтры каталога</span>
                              <ChevronDown
                                className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", catalogFiltersPanelOpen && "rotate-180")}
                                aria-hidden
                              />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <section
                              data-testid="section-showcase-matrix-catalog-filters"
                              className="mt-2 space-y-2 rounded-md border border-border/70 bg-background/90 p-2"
                            >
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {catalogFilterRows.map((row) => (
                                  <div key={row.key} className="min-w-0 space-y-1">
                                    <Label className="text-[10px] leading-none text-muted-foreground">{row.label}</Label>
                                    <MultiSelect
                                      options={row.options}
                                      value={catalogFilters[row.key] ?? []}
                                      onChange={(next) => setCatalogFilterKey(row.key, next)}
                                      placeholder="Все"
                                      allLabel="Все"
                                      triggerClassName="min-h-9 py-1.5 text-xs"
                                      contentClassName="w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,24rem)]"
                                      testId={`filter-showcase-matrix-catalog-${row.key}`}
                                      ariaLabel={row.label}
                                      showSearchThreshold={10}
                                    />
                                  </div>
                                ))}
                              </div>
                            </section>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid="text-showcase-matrix-visible-count">
                      Показано:{" "}
                      <span className="font-semibold tabular-nums text-foreground">{visibleModelCount}</span>
                      {" из "}
                      <span className="font-semibold tabular-nums text-foreground">{statusFilteredTotalCount}</span> моделей
                    </p>
                      </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Матрица клиента</p>
              <p className="text-xs text-muted-foreground">Что поставить на витрину по плану.</p>
            </div>

        {showUnassignedMatrixMessage ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            <p>Для этой торговой точки не назначена матрица витрины. Назначьте матрицу, чтобы планировать выкладку.</p>
          </div>
        ) : visibleModelCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            <p>Нет моделей в выбранном фильтре.</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setUserQuickFilter("all");
                setCategoryFilter("all");
                setCatalogFilters({});
              }}
            >
              Показать все
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {isManagedMatrix && filteredModels.length > 0 ? (
              <div className="space-y-2">
                {filteredManualModels.length > 0 ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">По матрице</p>
                ) : null}
                {renderShowcaseModelGrid(filteredModels)}
              </div>
            ) : null}
            {filteredManualModels.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    data-testid="text-tradepoint-manual-group-title"
                  >
                    Добавлено вручную
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] tabular-nums"
                    data-testid="badge-tradepoint-manual-group-count"
                  >
                    {filteredManualModels.length}
                  </Badge>
                </div>
                {renderShowcaseModelGrid(filteredManualModels, "grid-tradepoint-manual-models")}
              </div>
            ) : null}
          </div>
        )}
          </div>

          <TradePointPlacementBlocksSection
            dealerId={dealer.id}
            tradePointId={point.id}
            canEdit={canEdit}
            actorUserId={actorUserId}
            actorName={actorName}
          />

          <TradePointShowcaseHistorySection tradePointId={point.id} density={density} />

          <div
            id="section-trade-point-showcase-distribution"
            data-testid="section-trade-point-showcase-distribution"
            className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
          >
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-between text-xs sm:w-auto">
                  <span className="flex items-center gap-2">
                    <PieChart className="h-4 w-4" aria-hidden />
                    Дистрибуция на точке
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent
                className="mt-2 space-y-2 rounded-lg border border-border/70 bg-card/80 p-3"
                data-testid="section-trade-point-distribution"
              >
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {[
                    { label: "МК", data: distributionFromPlacements.mk },
                    { label: "ВХ", data: distributionFromPlacements.vh },
                    { label: "Фурнитура", data: distributionFromPlacements.hardware },
                    { label: "Общее", data: distributionFromPlacements.total },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-border/80 bg-muted/20 px-2 py-2"
                      data-testid={`tile-trade-point-distribution-${item.label.toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{item.label}</p>
                        <span className="text-sm font-bold tabular-nums">{item.data.pct}%</span>
                      </div>
                      <Progress value={item.data.pct} className="mt-1.5 h-2 bg-muted" />
                      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                        наши {item.data.ours} из {item.data.total}
                      </p>
                      {item.label === "МК" && item.data.portalSecond ? (
                        <p
                          className="mt-1 text-[10px] text-muted-foreground tabular-nums"
                          data-testid="text-trade-point-mk-portal-second"
                        >
                          вкл. 2-й план: {item.data.portalSecond.ours} из {item.data.portalSecond.total} (
                          {item.data.portalSecond.pct}%)
                        </p>
                      ) : null}
                      {item.data.legacyOurs > 0 ? (
                        <>
                          <Progress
                            value={item.data.rotationPct}
                            className="mt-1.5 h-1.5 bg-muted [&>div]:bg-amber-500/80"
                          />
                          <p
                            className="mt-1 text-[10px] tabular-nums text-amber-700 dark:text-amber-300"
                            data-testid={`text-trade-point-rotation-${item.label.toLowerCase()}`}
                          >
                            под ротацию {item.data.legacyOurs} ({item.data.rotationPct}%)
                          </p>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p
                  className="text-xs leading-relaxed text-foreground"
                  data-testid="text-trade-point-distribution-conclusion"
                >
                  {!distributionFromPlacements.hasData
                    ? "Данные по витринам ещё не внесены — добавьте блоки в разделе «Типы размещения витрины» (всего витрин и сколько из них наши)."
                    : distributionFromPlacements.total.pct >= 70
                      ? "Показатели в комфортной зоне, точечные доработки по сегментам."
                      : distributionFromPlacements.total.pct >= 50
                        ? "Есть резерв по выкладке и полноте линейки."
                        : "Нужны действия по усилению дистрибуции и контролю на точке."}
                </p>
                <TradePointShowcaseSegmentSummary
                  tradePointId={point.id}
                  density={density}
                  installedModelsBySegment={installedModelsBySegment}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {!hideOpenTasksSection ? (
            <div
              id="section-trade-point-showcase-open-tasks"
              data-testid="section-trade-point-showcase-open-tasks"
              className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
            >
              <TradePointShowcaseAssignmentsPanel
                dealerId={dealer.id}
                tradePointId={point.id}
                tradePointName={tradePointDisplayName}
                actorUserId={actorUserId}
                actorName={actorName}
              />
            </div>
          ) : null}
        </div>
      </section>

      <ShowcaseModelPresentationDialog
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        model={presentationModel}
      />
    </>
  );
}
