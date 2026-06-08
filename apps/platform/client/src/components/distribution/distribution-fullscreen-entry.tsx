import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Grid3x3,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
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

const CARD_SIZE_STORAGE_KEY = "distribution-fullscreen-entry-card-size";

function fullscreenEntryProductGridClass(size: CatalogCardSize): string {
  if (size === "list") return "flex flex-col gap-2";
  const dense: Record<Exclude<CatalogCardSize, "list">, string> = {
    xl: "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    m: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    s: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  };
  return dense[size];
}

type SourceTab = "matrix" | "catalog";
type DoorFilter = "all" | "vh" | "mk";

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
  const [cardSize, setCardSize] = useState<CatalogCardSize>(() =>
    readCatalogCardSizeFromStorage(CARD_SIZE_STORAGE_KEY, "m"),
  );
  const [draft, setDraft] = useState<FullscreenEntryDraftMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    writeCatalogCardSizeToStorage(CARD_SIZE_STORAGE_KEY, cardSize);
  }, [cardSize]);

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
      return products;
    }
    return catalogProducts;
  }, [catalogProducts, doorFilter, matrixModels, searchQuery, sourceTab]);

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

  const changedIds = useMemo(() => collectChangedProductIds(draft, baselines), [draft, baselines]);
  const installedCount = useMemo(() => countInstalledInDraft(draft), [draft]);

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

  const handleSave = useCallback(async () => {
    if (changedIds.length === 0 || saving) return;
    setSaving(true);
    let anyQueued = false;
    try {
      for (const productId of changedIds) {
        const row = draft[productId];
        const baseline = baselines[productId];
        if (!row || !baseline) continue;

        const status = row.status;
        const product = getProductById(productId);
        const model =
          matrixModelById.get(productId) ??
          (product ? stubMatrixModelFromProduct(product) : null);
        if (!model) continue;

        const isInstalled = status === "installed";
        const placementType: ShowcasePlacementType | null = isInstalled ? row.placementType : null;
        const placementSegment: ShowcasePlacementSegment | null = isInstalled
          ? row.placementSegment
          : null;

        const { queued } = setMatrixStatus({
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
        if (queued) anyQueued = true;

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
        for (const productId of changedIds) {
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
      if (offline || anyQueued) {
        toast({
          title: "Сохранено локально",
          description: "Данные попадут на сервер после восстановления сети.",
          className: "border-amber-500/40 bg-amber-500/10",
        });
      } else {
        toast({
          title: `Сохранено · ${formatSavedAt()} · ${actorName}`,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    actorName,
    actorUserId,
    baselines,
    changedIds,
    dealer.id,
    draft,
    matrixModelById,
    point.id,
    saving,
    toast,
  ]);

  const gridClass = fullscreenEntryProductGridClass(cardSize);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="distribution-fullscreen-entry"
      role="dialog"
      aria-modal="true"
    >
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

      <div
        className={cn(
          "z-10 shrink-0 overflow-hidden border-b border-border/60 bg-background/95 backdrop-blur-sm transition-[max-height,opacity] duration-200 ease-out",
          headerCollapsed ? "max-h-0 border-transparent opacity-0" : "max-h-[min(40vh,520px)] opacity-100",
        )}
        aria-hidden={headerCollapsed}
      >
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-4 md:gap-2 md:py-2.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
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
            </div>
          </div>

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
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4 sm:px-4 md:pb-28 md:pr-4">
          {visibleProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : cardSize === "list" ? (
            <ul className={gridClass}>
              {visibleProducts.map((p) => (
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
              {visibleProducts.map((p) => (
                <FullscreenProductCard
                  key={p.id}
                  product={p}
                  cardSize={cardSize}
                  draft={draft[p.id]}
                  matrixModel={matrixModelById.get(p.id)}
                  onDraftChange={updateDraft}
                />
              ))}
            </div>
          )}
        </div>

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
      </div>

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

const STATUS_SEGMENTS: {
  id: ShowcaseMatrixStatusId;
  label: string;
  activeClass: string;
}[] = [
  { id: "installed", label: "На витрине", activeClass: "bg-emerald-600 text-white border-emerald-600" },
  { id: "need_install", label: "Нужно поставить", activeClass: "bg-amber-500 text-white border-amber-500" },
  { id: "postponed", label: "Отложено", activeClass: "bg-sky-600 text-white border-sky-600" },
  { id: "not_relevant", label: "Не актуально", activeClass: "bg-muted text-muted-foreground border-border" },
];

function StatusSegmentedControl({
  value,
  onChange,
  productId,
  size = "default",
}: {
  value: ShowcaseMatrixStatusId;
  onChange: (status: ShowcaseMatrixStatusId) => void;
  productId: string;
  size?: "default" | "compact";
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", size === "compact" ? "mt-1" : "mt-2")}>
      {STATUS_SEGMENTS.map((segment) => {
        const active = value === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            className={cn(
              "h-7 rounded-md border px-2 text-[10px] transition-colors",
              active ? segment.activeClass : "border-border bg-background text-foreground/70",
            )}
            onClick={() => onChange(segment.id)}
            data-testid={`button-fullscreen-entry-status-${productId}-${segment.id}`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

function FullscreenProductCard({
  product,
  cardSize,
  draft,
  matrixModel,
  onDraftChange,
}: ProductDraftProps & { cardSize: CatalogCardSize }) {
  const row = draft;
  const segment = row ? row.placementSegment : segmentForProduct(product, matrixModel);
  const placementOptions = allowedTypesForSegment(segment);
  const img = product.image?.trim() ?? "";
  const titleSize =
    cardSize === "xl" ? "text-sm" : cardSize === "s" ? "text-[11px]" : "text-xs";

  const currentStatus = row?.status ?? "need_install";

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs",
        cardSize === "s" ? "p-1.5" : "p-2",
      )}
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
      </div>
      <h3 className={cn("line-clamp-2 font-medium leading-snug text-foreground", titleSize)}>
        {product.name}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">
        {product.type || product.doorKind}
        {product.article ? ` · ${product.article}` : ""}
      </p>
      <StatusSegmentedControl
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
        <StatusSegmentedControl
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
          size="compact"
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

