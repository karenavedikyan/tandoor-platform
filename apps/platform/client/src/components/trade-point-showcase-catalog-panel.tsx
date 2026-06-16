/**
 * Каталог моделей на витрине + вкладка задач по матрице (ручная актуализация ТТ).
 * UI-only настройки: localStorage (режим сетки, свёрнутость фильтров, вкладка).
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ShowcaseMatrixTask, TradePointShowcaseSelectedModel } from "@/lib/client-base-actualization-state";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import {
  CATALOG_PRODUCTS,
  buildCatalogProductSearchHaystack,
  catalogSearchQueryMatchesHaystack,
  getProductById,
} from "@/lib/catalog-data";
import type { ClientCategoryId } from "@/lib/client-category";
import {
  computeShowcasePortalOverfill,
  effectivePortalTypeForSelectedModel,
  inferShowcasePortalTypeFromCatalogProduct,
  type ShowcasePortalCaps,
} from "@/lib/trade-point-showcase-matrix-required";
import {
  resolveTradePointMatrixWithSource,
  type ResolvedTradePointMatrix,
} from "@/lib/trade-point-matrix-resolver";
import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";
import {
  countSelectedByType,
  evaluateSelectionGate,
  getShowcaseTypeCapacity,
  inferShowcaseTypeKeyFromProduct,
  patchShowcaseTypeCapacity,
  SHOWCASE_TYPE_SHORT_RU,
  type ShowcaseTypeKey,
} from "@/lib/showcase-type-capacity";
import { notifyShowcaseCapacityAutoGrow } from "@/lib/showcase-capacity-toast";
import { ShowcaseTypeCapacityInlineForm } from "@/components/showcase-type-capacity-inline-form";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import {
  loadCachedMatrix,
  refreshMatrixFromServer,
  setMatrixStatus,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import { cn } from "@/lib/utils";

export type ShowcaseCatalogViewMode = "large" | "compact" | "mini" | "list";

export type CatalogFilterPreset =
  | "all"
  | "required"
  | "recommended"
  | "missing"
  | "on_showcase"
  | "unselected"
  | "entrance"
  | "interior"
  | "overfill";

type DoorTypeFilter = "all" | "entrance" | "interior" | "hardware" | "other";

function lsKeyView(tpId: string): string {
  return `tandoor-tp-showcase-view-${tpId}`;
}
function lsKeyTab(tpId: string): string {
  return `tandoor-tp-showcase-tab-${tpId}`;
}
function lsKeyFiltersCollapsed(tpId: string): string {
  return `tandoor-tp-showcase-filters-collapsed-${tpId}`;
}

function readLsString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLsString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function newTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `showcase-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function catalogLookup(id: string): CatalogProduct | undefined {
  return getProductById(id);
}

export type TradePointShowcaseCatalogPanelProps = {
  tradePointId: string;
  dealerId: string;
  matrixScopeRegion?: string | null;
  matrixScopeCity?: string | null;
  matrixClientCategory: ClientCategoryId | null;
  canEdit: boolean;
  actorUserId: string;
  actorLabel: string;
  selectedShowcaseModels: TradePointShowcaseSelectedModel[];
  onChangeSelected: (next: TradePointShowcaseSelectedModel[]) => void;
  showcaseMatrixTasks: ShowcaseMatrixTask[];
  onChangeTasks: (next: ShowcaseMatrixTask[]) => void;
  onMarkDirty: () => void;
  showcaseRec?: TradePointShowcaseActualization;
  onPatchShowcase?: (patch: Partial<TradePointShowcaseActualization>) => void;
  portalCaps?: ShowcasePortalCaps;
  onOpenEntry?: (productId?: string) => void;
};

function isShowcaseCatalogProduct(p: CatalogProduct): boolean {
  return p.doorKind === "Входная" || p.doorKind === "Межкомнатная" || p.doorKind === "Фурнитура";
}

function productBadges(params: { selected: boolean; required: boolean; categoryKnown: boolean }): { line: string; missing: boolean } {
  if (params.selected) return { line: "Стоит", missing: false };
  if (!params.categoryKnown) return { line: "Не на витрине", missing: false };
  if (params.required) return { line: "Нужно поставить", missing: true };
  return { line: "Не требуется", missing: false };
}

function buildCapacityFormHint(type: ShowcaseTypeKey, productName: string): string {
  const what =
    type === "entrance"
      ? "Учитывайте все витрины под входные двери — порталы и любые другие конструкции."
      : type === "interior"
        ? "Учитывайте все витрины под межкомнатные двери — порталы, книжки, раздвижные и т. д."
        : "Учитывайте все секции, на которых выставлена фурнитура — ручки, петли, замки и т. д.";
  return `Чтобы добавить «${productName}» и корректно посчитать дистрибуцию, укажите общее количество. ${what}`;
}

export function TradePointShowcaseCatalogPanel(props: TradePointShowcaseCatalogPanelProps): ReactElement {
  const {
    tradePointId,
    dealerId,
    matrixScopeRegion,
    matrixScopeCity,
    matrixClientCategory,
    canEdit,
    actorUserId,
    actorLabel,
    selectedShowcaseModels,
    onChangeSelected,
    showcaseMatrixTasks,
    onChangeTasks,
    onMarkDirty,
    showcaseRec,
    onPatchShowcase,
    portalCaps: portalCapsProp,
    onOpenEntry,
  } = props;

  const portalCaps = useMemo((): ShowcasePortalCaps => {
    if (portalCapsProp) return portalCapsProp;
    if (!showcaseRec) return { entrance: null, interior: null, total: null, hardware: null };
    return {
      entrance: showcaseRec.entrancePortals,
      interior: showcaseRec.interiorPortals,
      total: showcaseRec.totalPortals,
      hardware: showcaseRec.hardwareSections,
    };
  }, [portalCapsProp, showcaseRec]);

  const [hydrated, setHydrated] = useState(false);
  const [mainTab, setMainTab] = useState<"catalog" | "matrix">("catalog");
  const [viewMode, setViewMode] = useState<ShowcaseCatalogViewMode>("compact");
  const [search, setSearch] = useState("");
  const [doorType, setDoorType] = useState<DoorTypeFilter>("all");
  const [preset, setPreset] = useState<CatalogFilterPreset>("all");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [matrixListMode, setMatrixListMode] = useState<"deficit" | "all">("deficit");
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const [pendingSelectionProductId, setPendingSelectionProductId] = useState<string | null>(null);
  const [headerCapacityFormType, setHeaderCapacityFormType] = useState<ShowcaseTypeKey | null>(null);
  const [bump, setBump] = useState(0);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    void refreshMatrixFromServer(tradePointId, dealerId);
  }, [tradePointId, dealerId]);

  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    const v = readLsString(lsKeyView(tradePointId));
    if (v === "large" || v === "compact" || v === "mini" || v === "list") setViewMode(v);
    const t = readLsString(lsKeyTab(tradePointId));
    if (t === "catalog" || t === "matrix") setMainTab(t);
    const fc = readLsString(lsKeyFiltersCollapsed(tradePointId));
    if (fc === "1") setFiltersOpen(false);
    else if (fc === "0") setFiltersOpen(true);
    else if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) setFiltersOpen(false);
    setHydrated(true);
  }, [tradePointId]);

  useEffect(() => {
    if (!hydrated) return;
    writeLsString(lsKeyView(tradePointId), viewMode);
  }, [hydrated, tradePointId, viewMode]);

  useEffect(() => {
    if (!hydrated) return;
    writeLsString(lsKeyTab(tradePointId), mainTab);
  }, [hydrated, tradePointId, mainTab]);

  useEffect(() => {
    if (!hydrated) return;
    writeLsString(lsKeyFiltersCollapsed(tradePointId), filtersOpen ? "0" : "1");
  }, [hydrated, filtersOpen, tradePointId]);

  useEffect(() => {
    if (!jumpHighlightId) return;
    const el = cardRefs.current.get(jumpHighlightId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => setJumpHighlightId(null), 2000);
    return () => window.clearTimeout(t);
  }, [jumpHighlightId, mainTab, viewMode, search, preset, doorType]);

  const backendModelStatus = useMemo(() => {
    void bump;
    const map = new Map<string, ShowcaseMatrixStatus>();
    for (const entry of loadCachedMatrix(tradePointId)) {
      if (entry.targetKind === "variant") map.set(entry.targetId, entry.status);
    }
    for (const entry of loadCachedMatrix(tradePointId)) {
      if (entry.targetKind === "model") map.set(entry.targetId, entry.status);
    }
    return map;
  }, [bump, tradePointId]);

  const isProductSelected = useCallback(
    (productId: string): boolean => {
      const backend = backendModelStatus.get(productId);
      if (backend === "not_relevant") return false;
      if (backend === "installed") return true;
      return selectedShowcaseModels.some((m) => m.productId === productId);
    },
    [backendModelStatus, selectedShowcaseModels],
  );

  const resolvedMatrix = useMemo<ResolvedTradePointMatrix>(() => {
    if (!matrixClientCategory) {
      return { source: "fallback", defId: null, models: [] };
    }
    return resolveTradePointMatrixWithSource({
      dealerId,
      tradePointId,
      clientCategory: matrixClientCategory,
      region: matrixScopeRegion ?? null,
      city: matrixScopeCity ?? null,
    });
  }, [matrixClientCategory, dealerId, tradePointId, matrixScopeRegion, matrixScopeCity]);

  const hasManagedMatrix = resolvedMatrix.source === "managed";

  /** Только модели с high-приоритетом — «Обязательно». */
  const requiredDefs = useMemo(
    () => resolvedMatrix.models.filter((m) => m.basePriority === "high"),
    [resolvedMatrix.models],
  );

  /** Модели с medium-приоритетом — «Рекомендовано». */
  const recommendedDefs = useMemo(
    () => resolvedMatrix.models.filter((m) => m.basePriority === "medium"),
    [resolvedMatrix.models],
  );

  const requiredIdSet = useMemo(() => new Set(requiredDefs.map((d) => d.id)), [requiredDefs]);
  const recommendedIdSet = useMemo(() => new Set(recommendedDefs.map((d) => d.id)), [recommendedDefs]);

  const missingRequiredCount = useMemo(() => {
    let n = 0;
    for (const d of requiredDefs) {
      if (!isProductSelected(d.id)) n += 1;
    }
    return n;
  }, [requiredDefs, isProductSelected]);

  const doorCatalog = useMemo(() => CATALOG_PRODUCTS.filter(isShowcaseCatalogProduct), []);

  const hayById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of doorCatalog) m.set(p.id, buildCatalogProductSearchHaystack(p));
    return m;
  }, [doorCatalog]);

  const portalWarn = useMemo(
    () => computeShowcasePortalOverfill(selectedShowcaseModels, portalCaps, catalogLookup),
    [selectedShowcaseModels, portalCaps],
  );

  const filteredCatalog = useMemo(() => {
    let list = doorCatalog;
    if (doorType === "entrance") list = list.filter((p) => p.doorKind === "Входная");
    else if (doorType === "interior") list = list.filter((p) => p.doorKind === "Межкомнатная");
    else if (doorType === "hardware") list = list.filter((p) => p.doorKind === "Фурнитура");
    else if (doorType === "other") list = list.filter((p) => !isShowcaseCatalogProduct(p));

    const q = search.trim();
    if (q) {
      list = list.filter((p) => catalogSearchQueryMatchesHaystack(q, hayById.get(p.id) ?? ""));
    }

    if (preset === "on_showcase") list = list.filter((p) => isProductSelected(p.id));
    else if (preset === "unselected") list = list.filter((p) => !isProductSelected(p.id));
    else if (preset === "required") list = list.filter((p) => hasManagedMatrix && requiredIdSet.has(p.id));
    else if (preset === "recommended") list = list.filter((p) => hasManagedMatrix && recommendedIdSet.has(p.id));
    else if (preset === "missing") list = list.filter((p) => hasManagedMatrix && requiredIdSet.has(p.id) && !isProductSelected(p.id));
    else if (preset === "entrance") list = list.filter((p) => inferShowcasePortalTypeFromCatalogProduct(p) === "entrance");
    else if (preset === "interior") list = list.filter((p) => inferShowcasePortalTypeFromCatalogProduct(p) === "interior");
    else if (preset === "overfill") {
      if (!portalWarn) list = [];
      else list = list.filter((p) => isProductSelected(p.id));
    }

    return list;
  }, [doorCatalog, doorType, search, hayById, preset, isProductSelected, requiredIdSet, recommendedIdSet, hasManagedMatrix, portalWarn]);

  const typeStatusLine = useMemo(() => {
    const types: ShowcaseTypeKey[] = ["entrance", "interior", "hardware"];
    return types.map((type) => {
      const cap = getShowcaseTypeCapacity(showcaseRec, type);
      const cnt = countSelectedByType(selectedShowcaseModels, type, catalogLookup);
      const short = SHOWCASE_TYPE_SHORT_RU[type];
      if (cap == null) {
        return { type, label: `${short}: ${cnt} из — не заполнено`, unfilled: true, overfill: false };
      }
      const over = cnt > cap;
      return {
        type,
        label: `${short}: ${cnt} из ${cap}${over ? " (превышено)" : ""}`,
        unfilled: false,
        overfill: over,
      };
    });
  }, [selectedShowcaseModels, showcaseRec]);

  const countsLine = useMemo(() => {
    let ent = 0;
    let int = 0;
    let oth = 0;
    let hw = 0;
    for (const m of selectedShowcaseModels) {
      const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
      if (t === "entrance") ent += 1;
      else if (t === "interior") int += 1;
      else if (t === "hardware") hw += 1;
      else oth += 1;
    }
    const parts: string[] = [];
    if (portalCaps.entrance != null) parts.push(`входных моделей: ${ent} из ${portalCaps.entrance}`);
    if (portalCaps.interior != null) parts.push(`межкомнатных: ${int} из ${portalCaps.interior}`);
    if (portalCaps.hardware != null) parts.push(`фурнитуры: ${hw} из ${portalCaps.hardware}`);
    if (portalCaps.total != null) parts.push(`всего на витрине: ${selectedShowcaseModels.length} из ${portalCaps.total}`);
    if (oth > 0) parts.push(`тип не определён: ${oth}`);
    return parts.length ? parts.join(" · ") : "";
  }, [selectedShowcaseModels, portalCaps]);

  const applyShowcasePatch = useCallback(
    (patch: Partial<TradePointShowcaseActualization>) => {
      onMarkDirty();
      onPatchShowcase?.(patch);
    },
    [onMarkDirty, onPatchShowcase],
  );

  const performSelect = useCallback(
    (p: CatalogProduct) => {
      setMatrixStatus({
        dealerId,
        tradePointId,
        targetKind: "model",
        targetId: p.id,
        status: "installed",
        updatedBy: actorUserId,
        updatedByName: actorLabel,
      });
      const iso = new Date().toISOString();
      const portalType = inferShowcasePortalTypeFromCatalogProduct(p);
      onChangeSelected([
        ...selectedShowcaseModels.filter((x) => x.productId !== p.id),
        {
          productId: p.id,
          productName: p.name,
          productType: p.type,
          selectedAt: iso,
          selectedBy: actorUserId,
          selectedByName: actorLabel,
          portalType,
        },
      ]);
    },
    [actorLabel, actorUserId, dealerId, onChangeSelected, selectedShowcaseModels, tradePointId],
  );

  const completeCapacityAndSelect = useCallback(
    (productId: string, type: ShowcaseTypeKey, savedValue: number) => {
      const p = getProductById(productId);
      if (!p) return;
      const baseRec = showcaseRec;
      const withSaved = { ...baseRec, ...patchShowcaseTypeCapacity(type, savedValue) } as
        | TradePointShowcaseActualization
        | undefined;
      applyShowcasePatch(patchShowcaseTypeCapacity(type, savedValue));
      const gate = evaluateSelectionGate(withSaved, selectedShowcaseModels, p, catalogLookup);
      if (
        gate?.action === "select-and-grow" &&
        gate.nextCapacity != null &&
        gate.oldCapacity != null
      ) {
        applyShowcasePatch(patchShowcaseTypeCapacity(type, gate.nextCapacity));
        notifyShowcaseCapacityAutoGrow({
          tradePointId,
          type,
          oldCapacity: gate.oldCapacity,
          nextCapacity: gate.nextCapacity,
        });
      }
      performSelect(p);
    },
    [applyShowcasePatch, performSelect, selectedShowcaseModels, showcaseRec, tradePointId],
  );

  const toggleSelected = useCallback(
    (p: CatalogProduct, nextChecked: boolean) => {
      if (!canEdit) return;
      onMarkDirty();
      if (nextChecked) {
        const gate = evaluateSelectionGate(showcaseRec, selectedShowcaseModels, p, catalogLookup);
        if (gate?.action === "open-capacity-form") {
          setPendingSelectionProductId(p.id);
          return;
        }
        if (
          gate?.action === "select-and-grow" &&
          gate.nextCapacity != null &&
          gate.oldCapacity != null
        ) {
          applyShowcasePatch(patchShowcaseTypeCapacity(gate.type, gate.nextCapacity));
          notifyShowcaseCapacityAutoGrow({
            tradePointId,
            type: gate.type,
            oldCapacity: gate.oldCapacity,
            nextCapacity: gate.nextCapacity,
          });
        }
        performSelect(p);
      } else {
        setMatrixStatus({
          dealerId,
          tradePointId,
          targetKind: "model",
          targetId: p.id,
          status: "not_relevant",
          updatedBy: actorUserId,
          updatedByName: actorLabel,
        });
        onChangeSelected(selectedShowcaseModels.filter((x) => x.productId !== p.id));
      }
    },
    [
      actorLabel,
      actorUserId,
      applyShowcasePatch,
      canEdit,
      dealerId,
      onChangeSelected,
      onMarkDirty,
      performSelect,
      selectedShowcaseModels,
      showcaseRec,
      tradePointId,
    ],
  );

  const requestEntryForProduct = useCallback(
    (p: CatalogProduct) => {
      if (!canEdit) return;
      if (onOpenEntry) {
        onOpenEntry(p.id);
        return;
      }
      toggleSelected(p, !isProductSelected(p.id));
    },
    [canEdit, isProductSelected, onOpenEntry, toggleSelected],
  );

  const addMatrixTask = useCallback(
    (productId: string, productName: string) => {
      if (!canEdit) return;
      if (showcaseMatrixTasks.some((t) => t.productId === productId && t.status === "new")) return;
      onMarkDirty();
      const iso = new Date().toISOString();
      onChangeTasks([
        ...showcaseMatrixTasks,
        {
          id: newTaskId(),
          tradePointId,
          dealerId,
          productId,
          productName,
          reason: "matrix_required_missing",
          createdAt: iso,
          createdBy: actorUserId,
          createdByName: actorLabel,
          status: "new",
        },
      ]);
    },
    [actorLabel, actorUserId, canEdit, dealerId, onChangeTasks, onMarkDirty, showcaseMatrixTasks, tradePointId],
  );

  const patchSelectedModel = useCallback(
    (productId: string, patch: Partial<TradePointShowcaseSelectedModel>) => {
      onMarkDirty();
      onChangeSelected(selectedShowcaseModels.map((m) => (m.productId === productId ? { ...m, ...patch } : m)));
    },
    [onChangeSelected, onMarkDirty, selectedShowcaseModels],
  );

  const matrixEmptyConfigured = hasManagedMatrix && requiredDefs.length === 0;

  useEffect(() => {
    if (!hasManagedMatrix && (preset === "required" || preset === "recommended" || preset === "missing")) {
      setPreset("all");
    }
  }, [hasManagedMatrix, preset]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (preset !== "all") chips.push({ key: `preset:${preset}`, label: presetLabelRu(preset) });
    if (doorType !== "all") chips.push({ key: `door:${doorType}`, label: doorType === "entrance" ? "Входные" : doorType === "interior" ? "Межкомнатные" : doorType === "hardware" ? "Фурнитура" : "Другое" });
    if (search.trim()) chips.push({ key: "search", label: `Поиск: ${search.trim().slice(0, 24)}${search.trim().length > 24 ? "…" : ""}` });
    return chips;
  }, [preset, doorType, search]);

  const resetFilters = useCallback(() => {
    setPreset("all");
    setDoorType("all");
    setSearch("");
  }, []);

  const detailProduct = detailProductId ? getProductById(detailProductId) : undefined;

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const jumpToCatalogProduct = useCallback((productId: string) => {
    setMainTab("catalog");
    setPreset("all");
    setDoorType("all");
    setSearch("");
    setJumpHighlightId(productId);
  }, []);

  const renderProductCard = (p: CatalogProduct): ReactElement => {
    const sel = isProductSelected(p.id);
    const req = hasManagedMatrix && requiredIdSet.has(p.id);
    const rec = hasManagedMatrix && recommendedIdSet.has(p.id);
    const { line, missing } = productBadges({ selected: sel, required: req, categoryKnown: hasManagedMatrix });
    const portalType = inferShowcasePortalTypeFromCatalogProduct(p);
    const typeShort =
      portalType === "entrance" ? "Вх." : portalType === "interior" ? "МК" : portalType === "hardware" ? "Фурн." : "—";
    const productTypeKey = inferShowcaseTypeKeyFromProduct(p);
    const pendingCapacity = pendingSelectionProductId === p.id && productTypeKey != null;

    const imgBox = (opts: { maxH: string; rounded: string }) => (
      <div
        className={cn(
          "flex w-full items-center justify-center bg-muted/40",
          opts.rounded,
          opts.maxH,
          jumpHighlightId === p.id && "ring-2 ring-amber-500 ring-offset-2",
        )}
      >
        {p.image ? (
          <img src={p.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <span className="p-2 text-[10px] text-muted-foreground">Нет фото</span>
        )}
      </div>
    );

    const badgesRow = (
      <div className="flex flex-wrap items-center gap-1">
        {sel ? (
          <Badge variant="default" className="h-5 bg-emerald-600 px-1.5 text-[10px] font-normal hover:bg-emerald-600" data-testid={`badge-showcase-model-selected-${p.id}`}>
            На витрине
          </Badge>
        ) : null}
        {req ? (
          <Badge
            variant="outline"
            className="h-5 border-rose-500/70 bg-rose-500/10 px-1.5 text-[10px] font-medium text-rose-900 dark:text-rose-200"
            data-testid={`badge-showcase-model-required-${p.id}`}
          >
            Обязательная
          </Badge>
        ) : rec ? (
          <Badge
            variant="outline"
            className="h-5 border-sky-500/70 bg-sky-500/10 px-1.5 text-[10px] font-medium text-sky-900 dark:text-sky-200"
            data-testid={`badge-showcase-model-recommended-${p.id}`}
          >
            Рекомендованная
          </Badge>
        ) : null}
        {req && missing ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal text-destructive" data-testid={`badge-showcase-model-missing-${p.id}`}>
            Нужно поставить
          </Badge>
        ) : null}
        {req && sel ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            Закрыто
          </Badge>
        ) : null}
      </div>
    );

    const onCardActivate = () => {
      if (!canEdit) {
        setDetailProductId(p.id);
        return;
      }
      requestEntryForProduct(p);
    };

    const cornerToggle = (
      <div
        className="absolute right-1.5 top-1.5 z-10 rounded-md bg-background/90 p-0.5 shadow-sm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={sel}
          disabled={!canEdit}
          className="h-6 w-6 min-h-[24px] min-w-[24px] rounded-md border-2 [&_svg]:h-4 [&_svg]:w-4"
          data-testid={`button-showcase-model-select-${p.id}`}
          aria-label={sel ? "Убрать с витрины" : "На витрину"}
          onCheckedChange={() => requestEntryForProduct(p)}
        />
      </div>
    );

    const nameBlock = (
      <div className="min-w-0 space-y-0.5">
        <button
          type="button"
          className="line-clamp-2 w-full text-left text-xs font-semibold leading-snug text-foreground hover:underline sm:text-sm"
          onClick={(e) => {
            e.stopPropagation();
            setDetailProductId(p.id);
          }}
        >
          {p.name}
        </button>
        <Badge variant="outline" className="h-5 px-1 text-[10px] font-normal">
          {typeShort}
        </Badge>
        {badgesRow}
        <p className="text-[10px] font-medium text-muted-foreground" data-testid={`text-showcase-product-status-${p.id}`}>
          {line}
        </p>
        {pendingCapacity && productTypeKey ? (
          <ShowcaseTypeCapacityInlineForm
            type={productTypeKey}
            currentCapacity={getShowcaseTypeCapacity(showcaseRec, productTypeKey)}
            hint={buildCapacityFormHint(productTypeKey, p.name)}
            onSave={(value) => {
              setPendingSelectionProductId(null);
              completeCapacityAndSelect(p.id, productTypeKey, value);
            }}
            onCancel={() => setPendingSelectionProductId(null)}
            className="mt-1"
          />
        ) : null}
      </div>
    );

    const nameFooterMini = (
      <div className="min-w-0 space-y-0.5">
        <button
          type="button"
          className="line-clamp-2 w-full text-left text-[11px] font-semibold leading-tight text-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setDetailProductId(p.id);
          }}
        >
          {p.name}
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {sel ? (
            <Badge variant="default" className="h-4 bg-emerald-600 px-1 text-[9px] font-normal hover:bg-emerald-600" data-testid={`badge-showcase-model-selected-${p.id}`}>
              На витрине
            </Badge>
          ) : null}
          {req && missing ? (
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal text-destructive" data-testid={`badge-showcase-model-missing-${p.id}`}>
              Нужно поставить
            </Badge>
          ) : null}
        </div>
        {pendingCapacity && productTypeKey ? (
          <ShowcaseTypeCapacityInlineForm
            type={productTypeKey}
            currentCapacity={getShowcaseTypeCapacity(showcaseRec, productTypeKey)}
            hint={buildCapacityFormHint(productTypeKey, p.name)}
            onSave={(value) => {
              setPendingSelectionProductId(null);
              completeCapacityAndSelect(p.id, productTypeKey, value);
            }}
            onCancel={() => setPendingSelectionProductId(null)}
            className="mt-1"
          />
        ) : null}
      </div>
    );

    const cardTestId =
      viewMode === "large"
        ? `card-showcase-model-large-${p.id}`
        : viewMode === "compact"
          ? `card-showcase-model-compact-${p.id}`
          : viewMode === "mini"
            ? `card-showcase-model-mini-${p.id}`
            : `row-showcase-model-${p.id}`;

    if (viewMode === "list") {
      return (
        <div
          key={p.id}
          ref={(el) => setCardRef(p.id, el)}
          data-testid={cardTestId}
          role="button"
          tabIndex={0}
          onClick={onCardActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCardActivate();
            }
          }}
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-card p-2 text-left transition-colors",
            sel ? "border-emerald-600 opacity-60 ring-1 ring-emerald-600/30 grayscale" : "border-border/70 hover:bg-muted/30",
          )}
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md sm:h-14 sm:w-14">{imgBox({ maxH: "h-12 sm:h-14", rounded: "rounded-md" })}</div>
          <div className="min-w-0 flex-1">{nameBlock}</div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {cornerToggle}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); setDetailProductId(p.id); }}>
            Подробнее
          </Button>
        </div>
      );
    }

    const pad = viewMode === "large" ? "p-2.5 sm:p-3" : viewMode === "compact" ? "p-2" : "p-1.5";
    const imgH =
      viewMode === "large" ? "h-[120px] sm:h-[150px] lg:h-[160px]" : viewMode === "compact" ? "h-[90px] sm:h-[110px]" : "h-[64px] sm:h-[84px]";

    return (
      <div
        key={p.id}
        ref={(el) => setCardRef(p.id, el)}
        data-testid={cardTestId}
        role="button"
        tabIndex={0}
        onClick={onCardActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardActivate();
          }
        }}
        className={cn(
          "relative flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-card text-left transition-colors",
          pad,
          viewMode === "large" && "max-h-[300px]",
          sel ? "border-emerald-600 opacity-60 ring-1 ring-emerald-600/25 grayscale" : "border-border/70 hover:bg-muted/20",
          jumpHighlightId === p.id && "ring-2 ring-amber-500",
        )}
      >
        {cornerToggle}
        <div className={cn("w-full min-h-0 shrink overflow-hidden rounded-md", imgH)}>{imgBox({ maxH: "h-full", rounded: "rounded-md" })}</div>
        {viewMode === "mini" ? nameFooterMini : nameBlock}
      </div>
    );
  };

  const gridClass =
    viewMode === "large"
      ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      : viewMode === "compact"
        ? "grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5"
        : viewMode === "mini"
          ? "grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          : "flex flex-col gap-1.5";

  const presetChips = useMemo<{ id: CatalogFilterPreset; label: string }[]>(() => {
    const base: { id: CatalogFilterPreset; label: string }[] = [{ id: "all", label: "Все" }];
    if (hasManagedMatrix) {
      base.push(
        { id: "required", label: "Обязательные" },
        { id: "recommended", label: "Рекомендованные" },
        { id: "missing", label: "Нужно поставить" },
      );
    }
    base.push(
      { id: "on_showcase", label: "Уже стоит" },
      { id: "unselected", label: "Не выбраны" },
      { id: "entrance", label: "Входные" },
      { id: "interior", label: "Межкомнатные" },
      { id: "overfill", label: "Переполнение" },
    );
    return base;
  }, [hasManagedMatrix]);

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4" data-testid="section-trade-point-showcase-catalog">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">Модели на витрине</p>
        <p className="text-xs text-muted-foreground">Отметьте модели на витрине. Сохранение — в блоке «Витрина и порталы» выше.</p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "catalog" | "matrix")}>
        <TabsList className="grid w-full grid-cols-2" data-testid="switch-showcase-tasks-mode">
          <TabsTrigger value="catalog">Каталог</TabsTrigger>
          <TabsTrigger value="matrix">Задачи по витрине</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-3 space-y-3">
          <div
            className="sticky top-0 z-20 -mx-1 space-y-2 border-b border-border/60 bg-background/95 px-1 pb-2 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            data-testid="section-showcase-catalog-toolbar"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Режим</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant={viewMode === "large" ? "default" : "outline"} className="h-8 px-2 text-xs" data-testid="button-showcase-view-large" onClick={() => setViewMode("large")}>
                  Крупно
                </Button>
                <Button type="button" size="sm" variant={viewMode === "compact" ? "default" : "outline"} className="h-8 px-2 text-xs" data-testid="button-showcase-view-compact" onClick={() => setViewMode("compact")}>
                  Компактно
                </Button>
                <Button type="button" size="sm" variant={viewMode === "mini" ? "default" : "outline"} className="h-8 px-2 text-xs" data-testid="button-showcase-view-mini" onClick={() => setViewMode("mini")}>
                  Мини
                </Button>
                <Button type="button" size="sm" variant={viewMode === "list" ? "default" : "outline"} className="h-8 px-2 text-xs" data-testid="button-showcase-view-list" onClick={() => setViewMode("list")}>
                  Список
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Выбрано: {selectedShowcaseModels.length}</span>
              <span className="text-border">·</span>
              <span className={missingRequiredCount > 0 ? "font-medium text-amber-900 dark:text-amber-100" : ""}>Нужно поставить: {missingRequiredCount}</span>
            </div>
            <Input className="h-9 min-h-9 text-sm" value={search} data-testid="input-showcase-catalog-search" onChange={(e) => setSearch(e.target.value)} placeholder="Поиск…" />

            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-between gap-2 sm:w-auto" data-testid="button-showcase-filters-toggle">
                  <span className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    Фильтры
                  </span>
                  {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="flex flex-wrap gap-1.5" data-testid="panel-showcase-active-filters">
                  {presetChips.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      size="sm"
                      variant={preset === c.id ? "default" : "secondary"}
                      className="h-7 rounded-full px-2.5 text-[11px]"
                      data-testid={`chip-showcase-filter-${c.id}`}
                      onClick={() => setPreset(c.id)}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Тип двери</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      data-testid="filter-showcase-catalog-type"
                      value={doorType}
                      onChange={(e) => setDoorType(e.target.value as DoorTypeFilter)}
                    >
                      <option value="all">Все</option>
                      <option value="entrance">Входные</option>
                      <option value="interior">Межкомнатные</option>
                      <option value="hardware">Фурнитура</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" data-testid="button-showcase-filters-reset" onClick={resetFilters}>
                      Сбросить фильтры
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap gap-1 text-[10px]" data-testid="panel-showcase-active-filter-chips">
                {activeFilterChips.map((c) => (
                  <Badge key={c.key} variant="outline" className="font-normal" data-testid={`chip-showcase-active-${c.key.replace(/:/g, "-")}`}>
                    {c.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {!hasManagedMatrix ? (
            <div
              className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm"
              data-testid="banner-no-managed-matrix"
            >
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Для этой торговой точки не назначена матрица витрины.
              </p>
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                Без матрицы нельзя отметить «обязательные» и «рекомендованные» модели. Назначьте матрицу в справочнике —{" "}
                <Link
                  href="/distribution/matrix-catalog"
                  className="font-medium underline underline-offset-2"
                  data-testid="link-banner-go-to-matrix-catalog"
                >
                  перейти в справочник матриц
                </Link>
                .
              </p>
            </div>
          ) : null}

          {portalWarn ? (
            <p className="text-xs font-medium text-amber-900 dark:text-amber-100" data-testid="text-showcase-portal-warning">
              Выбрано моделей больше, чем порталов по типам. Проверьте цифры витрины.
            </p>
          ) : null}
          <div className="space-y-1" data-testid="text-showcase-type-capacity-status">
            {typeStatusLine.map((row) => (
              <p key={row.type} className="text-[11px]">
                {row.unfilled ? (
                  <>
                    <span className="text-muted-foreground">{row.label.replace(" не заполнено", "")} </span>
                    <button
                      type="button"
                      className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
                      onClick={() => setHeaderCapacityFormType(row.type)}
                    >
                      не заполнено
                    </button>
                  </>
                ) : (
                  <span className={row.overfill ? "font-medium text-destructive" : "text-muted-foreground"}>{row.label}</span>
                )}
              </p>
            ))}
            {headerCapacityFormType ? (
              <ShowcaseTypeCapacityInlineForm
                type={headerCapacityFormType}
                currentCapacity={getShowcaseTypeCapacity(showcaseRec, headerCapacityFormType)}
                onSave={(value) => {
                  applyShowcasePatch(patchShowcaseTypeCapacity(headerCapacityFormType, value));
                  setHeaderCapacityFormType(null);
                }}
                onCancel={() => setHeaderCapacityFormType(null)}
              />
            ) : null}
          </div>
          {countsLine ? <p className="text-[11px] text-muted-foreground">{countsLine}</p> : null}

          <div className={gridClass}>{filteredCatalog.map(renderProductCard)}</div>
          {filteredCatalog.length === 0 ? <p className="text-sm text-muted-foreground">Нет моделей по фильтрам.</p> : null}
        </TabsContent>

        <TabsContent value="matrix" className="mt-3 space-y-3" data-testid="section-trade-point-showcase-matrix">
          {matrixClientCategory == null ? (
            <p className="text-sm text-muted-foreground" data-testid="text-showcase-category-missing">
              Укажите категорию клиента, чтобы рассчитать обязательную матрицу.
            </p>
          ) : matrixEmptyConfigured ? (
            <p className="text-sm text-muted-foreground" data-testid="text-showcase-matrix-empty">
              Для этой категории матрица не настроена.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={matrixListMode === "deficit" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setMatrixListMode("deficit")}>
                  Только дефицит
                </Button>
                <Button type="button" size="sm" variant={matrixListMode === "all" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setMatrixListMode("all")}>
                  Все обязательные
                </Button>
              </div>
              {(() => {
                const defs =
                  matrixListMode === "deficit" ? requiredDefs.filter((d) => !isProductSelected(d.id)) : requiredDefs;
                if (defs.length === 0 && matrixListMode === "deficit") {
                  return (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-4 text-center text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50">
                      Матрица закрыта: обязательные модели отмечены на витрине.
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {defs.map((def) => {
                      const sel = isProductSelected(def.id);
                      const p = getProductById(def.id);
                      const name = p?.name ?? def.name;
                      const imgSrc = p?.image ?? def.imageUrl;
                      const task = showcaseMatrixTasks.find((t) => t.productId === def.id);
                      const hasNew = task?.status === "new";
                      const hasDone = task?.status === "done";
                      return (
                        <div key={def.id} data-testid={`card-showcase-matrix-product-${def.id}`} className="flex gap-2 rounded-lg border border-border/70 bg-card p-2">
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                            {imgSrc ? <img src={imgSrc} alt="" className="h-full w-full object-contain" loading="lazy" /> : null}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-xs font-semibold leading-tight">{name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {def.type === "entrance" ? "Входная" : "Межкомнатная"} · {def.typeLabelRu}
                            </p>
                            <p className="text-[10px] font-medium text-amber-900 dark:text-amber-100">Обязательная по матрице</p>
                            <p className="text-[10px]" data-testid={`text-showcase-matrix-task-status-${def.id}`}>
                              {sel ? "На витрине" : hasNew ? "Задача создана" : hasDone ? "Задача закрыта" : "Нужно поставить"}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {!sel && canEdit && !hasNew && !hasDone ? (
                                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" data-testid={`button-showcase-create-task-${def.id}`} onClick={() => addMatrixTask(def.id, name)}>
                                  Создать задачу
                                </Button>
                              ) : null}
                              {hasNew ? <Badge className="h-5 text-[10px] font-normal">Задача: новая</Badge> : null}
                              {hasDone ? <Badge variant="outline" className="h-5 text-[10px] font-normal">Задача: выполнена</Badge> : null}
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => jumpToCatalogProduct(def.id)}>
                                К модели в каталоге
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={detailProductId != null} onOpenChange={(o) => !o && setDetailProductId(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto sm:max-w-lg sm:rounded-t-xl" data-testid="dialog-showcase-model-detail">
          {detailProduct ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-left text-base leading-snug">{detailProduct.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-3 space-y-3">
                <div className="flex max-h-[40vh] items-center justify-center rounded-lg bg-muted/40 p-2">
                  {detailProduct.image ? (
                    <img src={detailProduct.image} alt="" className="max-h-[38vh] max-w-full object-contain" />
                  ) : (
                    <span className="text-sm text-muted-foreground">Нет фото</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Тип: {detailProduct.type}</p>
                {detailProduct.series ? <p className="text-xs text-muted-foreground">Серия: {detailProduct.series}</p> : null}
                {detailProduct.category ? <p className="text-xs text-muted-foreground">Категория: {detailProduct.category}</p> : null}
                {requiredIdSet.has(detailProduct.id) ? (
                  <p className="text-xs text-amber-900 dark:text-amber-100">Обязательна для категории клиента по матрице витрины.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Не входит в обязательный минимум для текущей категории.</p>
                )}
                <p className="text-sm font-medium">
                  {isProductSelected(detailProduct.id) ? "Статус: стоит на витрине" : requiredIdSet.has(detailProduct.id) ? "Статус: нужно поставить" : "Статус: не на витрине"}
                </p>
                {(() => {
                  const sm = selectedShowcaseModels.find((m) => m.productId === detailProduct.id);
                  if (!canEdit || !sm) return null;
                  return (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Комментарий по модели</Label>
                        <Textarea
                          className="min-h-[72px] text-sm"
                          value={sm.comment ?? ""}
                          onChange={(e) => patchSelectedModel(detailProduct.id, { comment: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Количество (опционально)</Label>
                        <Input
                          className="h-9 text-sm"
                          inputMode="numeric"
                          value={sm.quantity != null && Number.isFinite(sm.quantity) ? String(sm.quantity) : ""}
                          onChange={(e) => {
                            const t = e.target.value.trim();
                            if (t === "") patchSelectedModel(detailProduct.id, { quantity: undefined });
                            else {
                              const n = Number(t);
                              if (Number.isFinite(n)) patchSelectedModel(detailProduct.id, { quantity: n });
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button
                      type="button"
                      onClick={() => {
                        requestEntryForProduct(detailProduct);
                      }}
                    >
                      {isProductSelected(detailProduct.id) ? "Убрать с витрины" : "Отметить на витрине"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => setDetailProductId(null)}>
                    Закрыть
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function presetLabelRu(p: CatalogFilterPreset): string {
  switch (p) {
    case "all":
      return "Все";
    case "required":
      return "Обязательные";
    case "recommended":
      return "Рекомендованные";
    case "missing":
      return "Нужно поставить";
    case "on_showcase":
      return "Уже стоит";
    case "unselected":
      return "Не выбраны";
    case "entrance":
      return "Входные";
    case "interior":
      return "Межкомнатные";
    case "overfill":
      return "Переполнение";
    default:
      return p;
  }
}
