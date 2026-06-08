import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Square,
  X,
} from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  buildCatalogProductSearchHaystack,
  CATALOG_PRODUCTS,
  catalogSearchQueryMatchesHaystack,
  getProductById,
  searchCatalog,
  type CatalogProduct,
} from "@/lib/catalog-data";
import {
  readCatalogCardSizeFromStorage,
  writeCatalogCardSizeToStorage,
  type CatalogCardSize,
} from "@/lib/catalog-card-grid";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  allowedTypesForSegment,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import type { ShowcasePlacementSegment, ShowcasePlacementType } from "@/lib/showcase-matrix-api";
import {
  loadCachedMatrix,
  setMatrixStatus,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import {
  buildInitialDraftRow,
  collectChangedProductIds,
  countInstalledInDraft,
  type FullscreenEntryBaseline,
  type FullscreenEntryDraftMap,
} from "@/lib/distribution-fullscreen-entry-draft";
import {
  getShowcaseMatrixModelsForTradePoint,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import {
  getEffectiveMatrixEntry,
  getEffectiveMatrixStatus,
  getShowcaseMatrixTpHistoryEvents,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
  upsertShowcaseMatrixModelState,
  type ShowcaseMatrixStatusId,
} from "@/lib/trade-point-showcase-matrix-storage";
import { useToast } from "@/hooks/use-toast";
import {
  OVERRIDES_PENDING_CHANGED_EVENT,
  pendingSyncCount,
} from "@/lib/overrides-pending-sync";
import { runOverridesPendingSyncOnce } from "@/lib/overrides-pending-sync-worker";

const CARD_SIZE_STORAGE_KEY = "distribution-fullscreen-entry-card-size";
const COMPACT_STORAGE_KEY = "distribution-fullscreen-entry-compact";

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
type DoorFilter = "all" | "vh" | "mk";
type StatusFilter = "all" | ShowcaseMatrixStatusId;

function segmentFromProduct(p: CatalogProduct): ShowcasePlacementSegment {
  if (p.category.includes("Фурнитура") || p.doorKind === "Фурнитура") return "hardware";
  if (p.doorKind === "Межкомнатная" || p.category.includes("Межкомнат")) return "mk";
  return "vh";
}

function segmentFromMatrixModel(m: ShowcaseMatrixModelDefinition): ShowcasePlacementSegment {
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
    categoryRules: [],
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

type Props = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
  onClose: () => void;
  onBackToList?: () => void;
};

export function DistributionFullscreenEntry({
  dealer,
  point,
  actorUserId,
  actorName,
  onClose,
  onBackToList,
}: Props) {
  const { toast } = useToast();
  const [bump, setBump] = useState(0);
  const [sourceTab, setSourceTab] = useState<SourceTab>("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [doorFilter, setDoorFilter] = useState<DoorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cardSize, setCardSize] = useState<CatalogCardSize>(() =>
    readCatalogCardSizeFromStorage(CARD_SIZE_STORAGE_KEY, "m"),
  );
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COMPACT_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [quickStatus, setQuickStatus] = useState<ShowcaseMatrixStatusId>("installed");
  const [needInstallSelection, setNeedInstallSelection] = useState<Set<string>>(() => new Set());
  const needInstallInitedRef = useRef(false);
  const [draft, setDraft] = useState<FullscreenEntryDraftMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() => pendingSyncCount());
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    writeCatalogCardSizeToStorage(CARD_SIZE_STORAGE_KEY, cardSize);
  }, [cardSize]);

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

  const storage = useMemo(() => {
    void bump;
    return loadShowcaseMatrixStorage();
  }, [bump]);

  const backendByModelId = useMemo(() => {
    void bump;
    const map = new Map<string, ReturnType<typeof loadCachedMatrix>[number]>();
    for (const entry of loadCachedMatrix(point.id)) {
      if (entry.targetKind === "model") map.set(entry.targetId, entry);
    }
    return map;
  }, [bump, point.id]);

  const matrixModels = useMemo(
    () => getShowcaseMatrixModelsForTradePoint(dealer.id, point.id, dealer.clientCategory),
    [dealer.clientCategory, dealer.id, point.id],
  );

  const matrixModelById = useMemo(() => {
    const m = new Map<string, ShowcaseMatrixModelDefinition>();
    for (const model of matrixModels) m.set(model.id, model);
    return m;
  }, [matrixModels]);

  const baselineForProduct = useCallback(
    (productId: string): FullscreenEntryBaseline => {
      const backend = backendByModelId.get(productId);
      if (backend) {
        return {
          status: backend.status as ShowcaseMatrixStatusId,
          placementType: backend.placementType,
          placementSegment: backend.placementSegment,
          comment: backend.comment ?? "",
        };
      }
      const local = getEffectiveMatrixEntry(dealer.id, point.id, productId, storage);
      return {
        status: getEffectiveMatrixStatus(dealer.id, point.id, productId, storage),
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
    for (const p of CATALOG_PRODUCTS) {
      if (!out[p.id]) out[p.id] = baselineForProduct(p.id);
    }
    return out;
  }, [matrixModels, baselineForProduct]);

  const catalogProducts = useMemo(() => {
    const q = searchQuery.trim();
    let list: CatalogProduct[] = q
      ? searchCatalog(q, 500)
      : [...CATALOG_PRODUCTS].sort((a, b) => a.showcasePriority - b.showcasePriority);

    if (doorFilter === "vh") {
      list = list.filter((p) => segmentFromProduct(p) === "vh");
    } else if (doorFilter === "mk") {
      list = list.filter((p) => segmentFromProduct(p) === "mk");
    }
    return list;
  }, [doorFilter, searchQuery]);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: CatalogProduct[];
    if (sourceTab === "matrix") {
      let models = matrixModels;
      if (doorFilter === "vh") models = models.filter((m) => m.type === "entrance");
      if (doorFilter === "mk") models = models.filter((m) => m.type === "interior");
      const products: CatalogProduct[] = [];
      for (const m of models) {
        const p = getProductById(m.id);
        if (!p) continue;
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
    if (statusFilter === "all") return list;
    return list.filter((p) => {
      const status = draft[p.id]?.status ?? baselines[p.id]?.status ?? "need_install";
      return status === statusFilter;
    });
  }, [baselines, catalogProducts, doorFilter, draft, matrixModels, searchQuery, sourceTab, statusFilter]);

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

  const needInstallMode = compactMode && quickStatus === "need_install";
  const needInstallCount = needInstallSelection.size;

  useEffect(() => {
    const active = compactMode && quickStatus === "need_install";
    if (!active) {
      needInstallInitedRef.current = false;
      return;
    }
    if (needInstallInitedRef.current) return;
    needInstallInitedRef.current = true;
    const initial = new Set<string>();
    for (const p of visibleProducts) {
      if (matrixModelById.has(p.id)) initial.add(p.id);
    }
    setNeedInstallSelection(initial);
  }, [compactMode, matrixModelById, quickStatus, visibleProducts]);

  const changedIds = useMemo(() => collectChangedProductIds(draft, baselines), [draft, baselines]);
  const changedSet = useMemo(() => new Set(changedIds), [changedIds]);
  const installedCount = useMemo(() => countInstalledInDraft(draft), [draft]);

  const orderedProducts = useMemo(() => {
    if (!(compactMode && quickStatus === "need_install")) return visibleProducts;
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
  }, [compactMode, matrixModelById, quickStatus, visibleProducts]);

  const historyEvents = useMemo(
    () => getShowcaseMatrixTpHistoryEvents(dealer.id, point.id, storage),
    [dealer.id, point.id, storage],
  );
  const selectedHistoryEvent = useMemo(
    () => historyEvents.find((ev) => ev.id === selectedHistoryId) ?? null,
    [historyEvents, selectedHistoryId],
  );

  const updateDraft = useCallback((productId: string, patch: Partial<FullscreenEntryDraftMap[string]>) => {
    setDraft((prev) => ({
      ...prev,
      [productId]: { ...prev[productId]!, ...patch },
    }));
  }, []);

  const handleResetDraft = useCallback(() => {
    setDraft({});
  }, []);

  const handleToggleNeedInstall = useCallback((productId: string) => {
    setNeedInstallSelection((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const handleCompactReset = useCallback(() => {
    if (needInstallMode) {
      setNeedInstallSelection(new Set());
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
    const saveIds = needInstallMode ? Array.from(needInstallSelection) : changedIds;
    if (saveIds.length === 0 || saving) return;
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
          if (entry.targetKind === "model") freshBackend.set(entry.targetId, entry);
        }
        for (const productId of saveIds) {
          const backend = freshBackend.get(productId);
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
    } finally {
      setSaving(false);
    }
  }, [
    actorUserId,
    actorName,
    baselines,
    changedIds,
    dealer.id,
    draft,
    flushPendingNow,
    matrixModelById,
    needInstallMode,
    needInstallSelection,
    point.id,
    saving,
    showSaveSyncToast,
  ]);

  const compactHasChanges = needInstallMode ? needInstallCount > 0 : changedIds.length > 0;
  const compactSaveCount = needInstallMode ? needInstallCount : changedIds.length;

  const gridClass = fullscreenEntryProductGridClass(cardSize, compactMode);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="distribution-fullscreen-entry"
      role="dialog"
      aria-modal="true"
    >
      {!compactMode ? (
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/95 px-3 py-2 backdrop-blur-sm sm:px-4 md:py-2.5">
        <div className="flex min-h-10 items-center gap-2">
          {onBackToList ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 gap-1 px-2"
              onClick={onBackToList}
              data-testid="button-fullscreen-entry-back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Назад
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">{point.name}</p>
            {!headerCollapsed ? (
              <p className="truncate text-sm text-muted-foreground">
                {dealer.name}
                {point.city?.trim() && point.city !== "—" ? ` · ${point.city.trim()}` : ""}
              </p>
            ) : null}
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
              onClick={onClose}
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
          headerCollapsed && !compactMode ? "max-h-0 border-transparent opacity-0" : "max-h-[min(40vh,520px)] opacity-100",
        )}
        aria-hidden={headerCollapsed && !compactMode}
      >
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-4 md:gap-2 md:py-2.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {compactMode && onBackToList ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={onBackToList}
                  data-testid="button-fullscreen-entry-back-compact"
                  aria-label="Назад"
                  title="Назад"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по каталогу"
                  className="min-h-9 pl-9"
                  data-testid="input-fullscreen-entry-search"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 md:ml-auto">
              {(
                [
                  ["xl", Square],
                  ["m", LayoutGrid],
                  ["s", Grid3x3],
                  ["list", List],
                ] as const
              ).map(([size, Icon]) => (
                <Button
                  key={size}
                  type="button"
                  size="icon"
                  variant={cardSize === size ? "default" : "outline"}
                  className="h-9 w-9"
                  onClick={() => setCardSize(size)}
                  data-testid={`button-fullscreen-entry-size-${size}`}
                  aria-label={size}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
              <Button
                type="button"
                size="icon"
                variant={compactMode ? "default" : "outline"}
                className="h-9 w-9"
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
            </div>
          </div>

          {pendingCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
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

          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={sourceTab}
              onValueChange={(v) => setSourceTab(v as SourceTab)}
              className="min-w-0 shrink-0"
            >
              <TabsList className="grid h-auto min-h-9 w-full min-w-[12rem] max-w-md grid-cols-2 gap-1 p-0.5">
                <TabsTrigger
                  value="matrix"
                  className="min-h-9 text-xs sm:text-sm"
                  data-testid="tab-fullscreen-entry-matrix"
                >
                  Из матрицы
                </TabsTrigger>
                <TabsTrigger
                  value="catalog"
                  className="min-h-9 text-xs sm:text-sm"
                  data-testid="tab-fullscreen-entry-catalog"
                >
                  Весь каталог
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "Все"],
                  ["vh", "ВХ"],
                  ["mk", "МК"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={doorFilter === id ? "default" : "outline"}
                  className="min-h-9 px-2.5"
                  onClick={() => setDoorFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {compactMode ? (
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">Отмечаю как:</span>
                <Select
                  value={quickStatus}
                  onValueChange={(v) => setQuickStatus(v as ShowcaseMatrixStatusId)}
                >
                  <SelectTrigger
                    className="h-9 min-w-[9rem] text-xs sm:text-sm"
                    data-testid="select-fullscreen-entry-quick-status"
                  >
                    <SelectValue>{STATUS_LABEL_RU[quickStatus]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger
                className="h-9 min-w-[10rem] text-xs sm:text-sm"
                data-testid="select-fullscreen-entry-status-filter"
              >
                <SelectValue placeholder="Все статусы" />
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
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4 sm:px-4 md:pb-28 md:pr-4">
          {visibleProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : cardSize === "list" ? (
            <ul className={gridClass}>
              {orderedProducts.map((p) => (
                <FullscreenProductRow
                  key={p.id}
                  product={p}
                  draft={draft[p.id]}
                  matrixModel={matrixModelById.get(p.id)}
                  onDraftChange={updateDraft}
                />
              ))}
            </ul>
          ) : (
            <div className={gridClass}>
              {orderedProducts.map((p) => (
                <FullscreenProductCard
                  key={p.id}
                  product={p}
                  cardSize={cardSize}
                  draft={draft[p.id]}
                  matrixModel={matrixModelById.get(p.id)}
                  onDraftChange={updateDraft}
                  quickMode={compactMode}
                  quickStatus={quickStatus}
                  baselineStatus={baselines[p.id]?.status ?? "need_install"}
                  isChanged={changedSet.has(p.id)}
                  isMatrixRecommended={matrixModelById.has(p.id)}
                  needInstallMode={needInstallMode}
                  isSelectedNeedInstall={needInstallSelection.has(p.id)}
                  onToggleNeedInstall={handleToggleNeedInstall}
                />
              ))}
            </div>
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
              Отмечено: <span className="font-semibold tabular-nums text-foreground">{installedCount}</span>
            </p>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button
                type="button"
                className="min-h-10 flex-1 sm:flex-none"
                disabled={changedIds.length === 0 || saving}
                onClick={() => void handleSave()}
                data-testid="button-fullscreen-entry-save"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Сохранить ({changedIds.length})
              </Button>
              {changedIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={handleResetDraft}
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
    </div>
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
  needInstallMode,
  isSelectedNeedInstall,
  onToggleNeedInstall,
}: ProductDraftProps & {
  cardSize: CatalogCardSize;
  quickMode: boolean;
  quickStatus: ShowcaseMatrixStatusId;
  baselineStatus: ShowcaseMatrixStatusId;
  isChanged: boolean;
  isMatrixRecommended: boolean;
  needInstallMode: boolean;
  isSelectedNeedInstall: boolean;
  onToggleNeedInstall: (productId: string) => void;
}) {
  const row = draft;
  const segment = row ? row.placementSegment : segmentForProduct(product, matrixModel);
  const placementOptions = allowedTypesForSegment(segment);
  const img = product.image?.trim() ?? "";
  const titleSize =
    cardSize === "xl" ? "text-sm" : cardSize === "s" ? "text-[11px]" : "text-xs";

  const currentStatus = row?.status ?? "need_install";
  const hasExplicitMark =
    isChanged || (baselineStatus === quickStatus && quickStatus !== "need_install");
  const isMarked =
    !needInstallMode && quickMode && currentStatus === quickStatus && hasExplicitMark;
  const isNeedInstallHighlighted = needInstallMode && isSelectedNeedInstall;

  const handleQuickTap = () => {
    if (needInstallMode) {
      onToggleNeedInstall(product.id);
      return;
    }
    const seg = segmentForProduct(product, matrixModel);
    if (currentStatus === quickStatus) {
      onDraftChange(product.id, {
        status: baselineStatus,
        placementSegment: row?.placementSegment ?? seg,
        placementType: row?.placementType ?? "portal",
      });
    } else {
      onDraftChange(product.id, {
        status: quickStatus,
        placementSegment: row?.placementSegment ?? seg,
        placementType: row?.placementType ?? "portal",
      });
    }
  };

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs",
        isNeedInstallHighlighted
          ? STATUS_ACCENT.need_install
          : isMarked
            ? STATUS_ACCENT[quickStatus]
            : quickMode && isMatrixRecommended
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
        {needInstallMode ? (
          isSelectedNeedInstall ? (
            <span
              className={cn(
                "absolute right-1 top-1 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow",
                STATUS_BADGE.need_install,
              )}
            >
              <Check className="h-3 w-3" aria-hidden />
              Выбрано
            </span>
          ) : isMatrixRecommended ? (
            <span className="absolute left-1 top-1 z-10 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow">
              По матрице
            </span>
          ) : null
        ) : (
          <>
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
          </>
        )}
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
            value={currentStatus}
            onChange={(newStatus) => {
              const seg = segmentForProduct(product, matrixModel);
              onDraftChange(product.id, {
                status: newStatus,
                placementSegment: row?.placementSegment ?? seg,
                placementType: row?.placementType ?? "portal",
              });
            }}
            productId={product.id}
            className="mt-2"
          />
          {row?.status === "installed" ? (
            <div className="mt-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Крепление</Label>
              <Select
                value={row.placementType}
                onValueChange={(v) =>
                  onDraftChange(product.id, { placementType: v as ShowcasePlacementType })
                }
              >
                <SelectTrigger
                  className="h-9 text-xs"
                  data-testid={`select-fullscreen-entry-placement-${product.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {placementOptions.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {PLACEMENT_TYPE_LABEL_RU[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function FullscreenProductRow({ product, draft, matrixModel, onDraftChange }: ProductDraftProps) {
  const row = draft;
  const segment = row ? row.placementSegment : segmentForProduct(product, matrixModel);
  const placementOptions = allowedTypesForSegment(segment);
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
              placementType: row?.placementType ?? "portal",
            });
          }}
          productId={product.id}
          className="mt-1"
        />
        {row?.status === "installed" ? (
          <Select
            value={row.placementType}
            onValueChange={(v) =>
              onDraftChange(product.id, { placementType: v as ShowcasePlacementType })
            }
          >
            <SelectTrigger
              className="mt-2 h-9 text-xs"
              data-testid={`select-fullscreen-entry-placement-${product.id}`}
            >
              <SelectValue placeholder="Крепление" />
            </SelectTrigger>
            <SelectContent>
              {placementOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {PLACEMENT_TYPE_LABEL_RU[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </li>
  );
}

