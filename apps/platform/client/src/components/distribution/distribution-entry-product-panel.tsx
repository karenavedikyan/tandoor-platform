import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Grid3x3, LayoutGrid, List, Search, Square } from "lucide-react";
import {
  ProductCardGrid,
  ProductListHeader,
  ProductListRow,
} from "@/components/catalog/ProductListRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  catalogCardGridClass,
  readCatalogCardSizeFromStorage,
  writeCatalogCardSizeToStorage,
  type CatalogCardSize,
} from "@/lib/catalog-card-grid";
import {
  DISTRIBUTION_SEGMENT_OPTIONS,
  type DistributionFilterState,
  type DistributionSegmentFilter,
} from "@/lib/distribution-filters";
import {
  buildEntryProductTradePointRows,
  collectEntryCatalogModels,
  entryProductModelsToCatalogProducts,
  entryProductPresenceLabelRu,
  type EntryProductTradePointRow,
} from "@/lib/distribution-entry-product-view-model";
import {
  findDealerTradePointForEntryRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import {
  DistributionTradePointMatrixEntry,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { loadCachedMatrix, SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryCatalogGridColumns,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";

import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type Step = "segment" | "model" | "tradePoints" | "showcase";
const DISTRIBUTION_ENTRY_CATALOG_CARD_SIZE_KEY = "catalog-card-size";

type DistributionEntryProductPanelProps = {
  profile: ReleaseDemoProfile;
  dealers: readonly DealerRow[];
  filter: DistributionFilterState;
};

function presenceBadgeClass(presence: EntryProductTradePointRow["presence"]): string {
  if (presence === "installed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (presence === "recommended") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

export function DistributionEntryProductPanel({
  profile,
  dealers,
  filter,
}: DistributionEntryProductPanelProps) {
  const { user } = useCurrentUser();
  const [segment, setSegment] = useState<DistributionSegmentFilter>(filter.segment);
  const [step, setStep] = useState<Step>("segment");
  const [modelQuery, setModelQuery] = useState("");
  const [tpQuery, setTpQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedTradePointId, setSelectedTradePointId] = useState<string | null>(null);
  const [cacheBump, setCacheBump] = useState(0);

  useEffect(() => {
    setSegment(filter.segment);
  }, [filter.segment]);
  useEffect(() => {
    if (filter.segment !== "all") {
      setSegment(filter.segment);
      setStep((s) => (s === "segment" ? "model" : s));
    }
  }, [filter.segment]);


  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const allModels = useMemo(() => collectEntryCatalogModels(dealers), [dealers]);

  const selectedModel = useMemo(
    () => allModels.find((m) => m.id === selectedModelId) ?? null,
    [allModels, selectedModelId],
  );

  const [cardSize, setCardSize] = useState<CatalogCardSize>(() =>
    readCatalogCardSizeFromStorage(DISTRIBUTION_ENTRY_CATALOG_CARD_SIZE_KEY, "m"),
  );

  useEffect(() => {
    writeCatalogCardSizeToStorage(DISTRIBUTION_ENTRY_CATALOG_CARD_SIZE_KEY, cardSize);
  }, [cardSize]);

  const catalogProducts = useMemo(
    () => entryProductModelsToCatalogProducts(dealers, segment, modelQuery),
    [dealers, segment, modelQuery],
  );

  const tpRows = useMemo(() => {
    void cacheBump;
    if (!selectedModel) return [];
    return buildEntryProductTradePointRows(dealers, selectedModel, tpQuery, loadCachedMatrix);
  }, [dealers, selectedModel, tpQuery, cacheBump]);

  const selectedTpRow = useMemo(
    () => tpRows.find((r) => r.tradePointId === selectedTradePointId) ?? null,
    [tpRows, selectedTradePointId],
  );

  const selectedRef = useMemo(
    () =>
      selectedTpRow
        ? findDealerTradePointForEntryRow(dealers, {
            dealerId: selectedTpRow.dealerId,
            tradePointId: selectedTpRow.tradePointId,
            tradePointName: selectedTpRow.tradePointName,
            clientName: selectedTpRow.clientName,
            city: selectedTpRow.city,
            clientCategory: "top350",
            managerName: null,
            templateModelsCount: 0,
            filledCount: 0,
            coveragePct: 0,
            lastUpdatedAt: null,
          })
        : null,
    [dealers, selectedTpRow],
  );

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    setSelectedTradePointId(null);
    setStep("tradePoints");
  }, []);

  const furnitureEmpty = segment === "furniture" && allModels.length > 0 && catalogProducts.length === 0;

  const segmentStep = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Выберите сегмент продукта</p>
      <div className="flex flex-wrap gap-2">
        {DISTRIBUTION_SEGMENT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={segment === opt.value ? "default" : "outline"}
            className="min-h-10"
            data-testid={`distribution-entry-product-segment-${opt.value}`}
            onClick={() => {
              setSegment(opt.value);
              setSelectedModelId(null);
              setSelectedTradePointId(null);
              setStep("model");
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );

  const gridCls = catalogCardGridClass(cardSize === "list" ? "m" : cardSize);
  const catalogGridColumns = useDistributionEntryCatalogGridColumns(cardSize === "list" ? "" : gridCls);
  const modelScrollRef = useRef<HTMLDivElement>(null);
  const modelVirtualRowCount =
    cardSize === "list"
      ? catalogProducts.length
      : Math.ceil(catalogProducts.length / Math.max(1, catalogGridColumns));
  const modelVirtualizer = useDistributionEntryVirtualizer({
    count: modelVirtualRowCount,
    estimateSize:
      cardSize === "list"
        ? DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.catalogList
        : DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.catalogGridRow,
    scrollRef: modelScrollRef,
  });

  const tpScrollRef = useRef<HTMLDivElement>(null);
  const tpVirtualizer = useDistributionEntryVirtualizer({
    count: tpRows.length,
    estimateSize: DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.simpleRow,
    scrollRef: tpScrollRef,
  });

  const modelList = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={modelQuery}
            onChange={(e) => setModelQuery(e.target.value)}
            placeholder="Поиск модели"
            className="min-h-10 pl-9"
            data-testid="input-distribution-entry-product-model-search"
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5 self-start rounded-lg border border-border bg-card p-0.5"
          role="radiogroup"
          aria-label="Размер карточек моделей"
          data-testid="distribution-entry-product-card-size-toggle"
        >
          {(
            [
              { id: "xl" as const, label: "Крупный", icon: Square, hideNarrow: true },
              { id: "m" as const, label: "Средний", icon: LayoutGrid, hideNarrow: false },
              { id: "s" as const, label: "Мелкий", icon: Grid3x3, hideNarrow: true },
              { id: "list" as const, label: "Список", icon: List, hideNarrow: false },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = cardSize === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0 rounded-md border",
                  opt.hideNarrow && "max-[865px]:hidden",
                  active
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label={opt.label}
                aria-pressed={active}
                onClick={() => setCardSize(opt.id)}
                data-testid={`distribution-entry-product-card-size-${opt.id}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </Button>
            );
          })}
        </div>
      </div>
      {furnitureEmpty ? (
        <p className="text-sm text-muted-foreground">
          В матрице витрины нет позиций сегмента «Фурнитура». Выберите ВХ или МК.
        </p>
      ) : catalogProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Модели не найдены.</p>
      ) : cardSize === "list" ? (
        <div
          ref={modelScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto rounded-lg border border-border bg-card"
          data-testid="list-distribution-entry-product-models"
        >
          <ProductListHeader />
          <div className="relative w-full" style={{ height: modelVirtualizer.getTotalSize() }}>
            {modelVirtualizer.getVirtualItems().map((vi) => {
              const p = catalogProducts[vi.index];
              if (!p) return null;
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={modelVirtualizer.measureElement}
                  style={distributionEntryVirtualItemStyle(modelVirtualizer, vi.start)}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectModel(p.id)}
                    className={cn(
                      "block w-full text-left [&_a]:pointer-events-none [&_button]:pointer-events-none",
                      selectedModelId === p.id && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                    )}
                    data-testid={`distribution-entry-product-model-${p.id}`}
                  >
                    <ProductListRow product={p} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          ref={modelScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto"
          data-testid="list-distribution-entry-product-models"
        >
          <div className="relative w-full" style={{ height: modelVirtualizer.getTotalSize() }}>
            {modelVirtualizer.getVirtualItems().map((vi) => {
              const startIdx = vi.index * catalogGridColumns;
              const slice = catalogProducts.slice(startIdx, startIdx + catalogGridColumns);
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={modelVirtualizer.measureElement}
                  className="pb-2"
                  style={distributionEntryVirtualItemStyle(modelVirtualizer, vi.start)}
                >
                  <div className={gridCls}>
                    {slice.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectModel(p.id)}
                        className={cn(
                          "block w-full min-w-0 text-left [&_a]:pointer-events-none [&_button]:pointer-events-none",
                          selectedModelId === p.id && "rounded-[15px] ring-2 ring-primary/40",
                        )}
                        data-testid={`distribution-entry-product-model-${p.id}`}
                      >
                        <ProductCardGrid product={p} size={cardSize} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const tpList = selectedModel ? (
    <div className="flex min-h-0 flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{selectedModel.name}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={tpQuery}
          onChange={(e) => setTpQuery(e.target.value)}
          placeholder="Поиск по точке, клиенту, городу"
          className="min-h-10 pl-9"
          data-testid="input-distribution-entry-product-tp-search"
        />
      </div>
      {tpRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет торговых точек, где эта модель стоит или рекомендована.</p>
      ) : (
        <div
          ref={tpScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto"
          data-testid="list-distribution-entry-product-tradepoints"
        >
          <ul className="relative m-0 list-none p-0" style={{ height: tpVirtualizer.getTotalSize() }}>
            {tpVirtualizer.getVirtualItems().map((vi) => {
              const row = tpRows[vi.index];
              if (!row) return null;
              return (
                <li
                  key={vi.key}
                  data-index={vi.index}
                  ref={tpVirtualizer.measureElement}
                  className="mb-2 list-none"
                  style={distributionEntryVirtualItemStyle(tpVirtualizer, vi.start)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTradePointId(row.tradePointId);
                      setStep("showcase");
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      selectedTradePointId === row.tradePointId
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                    data-testid={`distribution-entry-product-tp-${row.tradePointId}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.tradePointName}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
                        {row.city ? <p className="truncate text-xs text-muted-foreground">{row.city}</p> : null}
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 text-[10px]", presenceBadgeClass(row.presence))}>
                        {entryProductPresenceLabelRu(row.presence)}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  const showcase =
    selectedRef && selectedTpRow ? (
      <DistributionTradePointMatrixEntry
        dealer={selectedRef.dealer}
        point={selectedRef.point}
        profile={profile}
        actorUserId={actorUserId}
        actorName={actorName}
      />
    ) : (
      <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-none">
        <CardContent className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Выберите торговую точку, чтобы внести факт по витрине.</p>
        </CardContent>
      </Card>
    );

  const localBack = () => {
    if (step === "showcase") {
      setSelectedTradePointId(null);
      setStep("tradePoints");
      return;
    }
    if (step === "tradePoints") {
      setSelectedModelId(null);
      setStep("model");
      return;
    }
    if (step === "model") {
      setStep("segment");
    }
  };

  const showLocalBack = step !== "segment";

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-entry-product-panel">
      {showLocalBack ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-0 text-muted-foreground"
          onClick={localBack}
          data-testid="distribution-entry-product-step-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Назад
        </Button>
      ) : null}

      {step === "segment" ? segmentStep : null}

      {step === "model" ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-3 sm:p-4">{modelList}</CardContent>
        </Card>
      ) : null}

      {(step === "tradePoints" || step === "showcase") && (
        <div className="hidden min-h-[min(70vh,780px)] gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-3 sm:p-4">{tpList}</CardContent>
          </Card>
          <div className="min-w-0">{step === "showcase" ? showcase : (
            <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-none">
              <CardContent className="px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">Выберите торговую точку в списке.</p>
              </CardContent>
            </Card>
          )}</div>
        </div>
      )}

      {(step === "tradePoints" || step === "showcase") && (
        <div className="space-y-4 lg:hidden">
          {step === "showcase" ? showcase : (
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardContent className="p-3 sm:p-4">{tpList}</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
