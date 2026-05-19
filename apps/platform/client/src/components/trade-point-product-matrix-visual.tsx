import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getProductById } from "@/lib/catalog-data";
import type {
  MatrixFilterId,
  MatrixPresenceStatus,
  TradePointMatrixSummary,
  TradePointProductMatrixItem,
} from "@/lib/trade-point-matrix-data";
import type { MatrixTask, MatrixTaskRecommendation } from "@/lib/trade-point-task-data";
import { MATRIX_TASK_STATUS_LABEL } from "@/lib/trade-point-task-data";

export type ProductMatrixViewMode = "large" | "compact" | "mini" | "list";

const MATRIX_PRODUCT_FILTERS: { id: MatrixFilterId; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-trade-point-matrix-all" },
  { id: "present", label: "Есть на витрине", testId: "filter-trade-point-matrix-present" },
  { id: "missing", label: "Нет на витрине", testId: "filter-trade-point-matrix-missing" },
  { id: "zone-a", label: "Зона A", testId: "filter-trade-point-matrix-zone-a" },
  { id: "entrance", label: "Входные", testId: "filter-trade-point-matrix-entrance" },
  { id: "interior", label: "Межкомнатные", testId: "filter-trade-point-matrix-interior" },
];

const PHOTO_LARGE = "h-[15rem] w-full shrink-0 sm:h-[16rem] sm:w-[200px]";
const PHOTO_COMPACT = "h-[11.25rem] w-full shrink-0 sm:h-[13.75rem] md:h-[14.5rem] lg:h-[15rem]";
const PHOTO_MINI = "h-[7rem] w-full shrink-0 min-[380px]:h-[7.5rem] md:h-[8.25rem] lg:h-[8.75rem] xl:h-[9.375rem]";
const PHOTO_LIST = "h-[52px] w-[44px] shrink-0";

function presenceBadgeClass(p: MatrixPresenceStatus) {
  if (p === "есть на витрине") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (p === "нужно добавить") return "border-red-200 bg-red-50 text-red-900";
  if (p === "на проверке") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function zoneBadgeClass(zone: TradePointProductMatrixItem["zone"]) {
  if (zone === "A") return "border-primary/40 bg-primary/10 text-primary";
  if (zone === "B") return "border-border bg-muted text-foreground";
  return "border-border bg-muted/60 text-muted-foreground";
}

function matrixItemPriorityClass(p: TradePointProductMatrixItem["priority"]) {
  if (p === "Высокий") return "border-red-200 bg-red-50 text-red-900";
  if (p === "Средний") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function productMatrixCardShellClass(presence: MatrixPresenceStatus): string {
  if (presence === "есть на витрине") {
    return "border border-emerald-200/90 bg-card shadow-sm";
  }
  if (presence === "на проверке") {
    return "border border-amber-300/80 bg-amber-50/40 shadow-sm ring-1 ring-amber-300/35";
  }
  if (presence === "нужно добавить" || presence === "нет на витрине") {
    return "border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-50/40 shadow-md ring-1 ring-amber-300/40";
  }
  return "border border-border bg-card shadow-sm";
}

/** Фото двери: фиксированная рамка + object-contain (как в матрице витрины). */
function ModelDoorPhotoFrame({
  src,
  alt,
  frameClass,
  imgTestId,
  imgPaddingClass = "p-2",
}: {
  src: string;
  alt?: string;
  frameClass: string;
  imgTestId?: string;
  imgPaddingClass?: string;
}) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border border-border/70 bg-neutral-50", frameClass)}>
      {src ? (
        <img
          src={src}
          alt={alt ?? ""}
          data-testid={imgTestId}
          className={cn(
            "absolute inset-0 box-border h-full w-full object-contain object-center",
            imgPaddingClass,
          )}
          loading="lazy"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-muted-foreground">Нет фото</span>
      )}
    </div>
  );
}

function ProductMatrixSummaryCard({ summary }: { summary: TradePointMatrixSummary }) {
  const tiles = [
    { label: "Должно быть", value: summary.totalRequired, tone: "border-border bg-muted/40 text-foreground" },
    { label: "На витрине", value: summary.totalPresent, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
    { label: "Отсутствует", value: summary.totalMissing, tone: "border-red-200 bg-red-50 text-red-900" },
    { label: "На проверке", value: summary.totalUnderReview, tone: "border-amber-200 bg-amber-50 text-amber-950" },
  ];
  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-md" data-testid="card-trade-point-matrix-summary">
      <CardContent className="space-y-4 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border px-3 py-2.5", t.tone)}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Зона A", value: summary.zoneA },
            { label: "Зона B", value: summary.zoneB },
            { label: "Зона C", value: summary.zoneC },
          ].map((z) => (
            <div key={z.label} className="rounded-xl border border-border bg-card px-3 py-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{z.label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{z.value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Портал входных дверей</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <span className="tabular-nums">{summary.entrancePresent}</span>
              <span className="text-muted-foreground"> / {summary.entranceRequired}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Портал межкомнатных дверей</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <span className="tabular-nums">{summary.interiorPresent}</span>
              <span className="text-muted-foreground"> / {summary.interiorRequired}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function productMatrixGridClass(viewMode: ProductMatrixViewMode): string {
  if (viewMode === "large") return "grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2";
  if (viewMode === "compact") {
    return "grid grid-cols-1 items-stretch gap-2 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  }
  if (viewMode === "mini") {
    return "grid grid-cols-1 items-stretch gap-1 min-[360px]:grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8";
  }
  return "flex flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-card";
}

export type TradePointProductMatrixVisualProps = {
  viewMode: ProductMatrixViewMode;
  matrixSummary: TradePointMatrixSummary;
  filteredItems: TradePointProductMatrixItem[];
  matrixFilter: MatrixFilterId;
  onMatrixFilterChange: (id: MatrixFilterId) => void;
  recommendationByProductId: Map<string, MatrixTaskRecommendation>;
  createdTaskByProductId: Map<string, MatrixTask>;
  onCreateMatrixTask: (rec: MatrixTaskRecommendation) => void;
  onScrollToMatrixTask: (taskId: string) => void;
};

export function TradePointProductMatrixVisual({
  viewMode,
  matrixSummary,
  filteredItems,
  matrixFilter,
  onMatrixFilterChange,
  recommendationByProductId,
  createdTaskByProductId,
  onCreateMatrixTask,
  onScrollToMatrixTask,
}: TradePointProductMatrixVisualProps) {
  const [detailsOpenById, setDetailsOpenById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDetailsOpenById({});
  }, [viewMode]);

  const setDetails = useCallback((id: string, open: boolean) => {
    setDetailsOpenById((prev) => ({ ...prev, [id]: open }));
  }, []);

  const gridClass = productMatrixGridClass(viewMode);
  const isMini = viewMode === "mini";
  const isCompact = viewMode === "compact";
  const isList = viewMode === "list";

  const primaryActionFor = (item: TradePointProductMatrixItem, layout: "dense" | "comfortable" = "comfortable") => {
    const rec = recommendationByProductId.get(item.productId);
    const created = createdTaskByProductId.get(item.productId);
    if (!rec) return null;
    const btnClass =
      layout === "dense"
        ? cn("w-full font-medium", isMini ? "h-7 text-[10px]" : "h-8 text-xs")
        : "min-h-9 w-full font-semibold text-xs sm:w-auto sm:min-w-[10rem]";
    if (created) {
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={btnClass}
          data-testid={`button-trade-point-product-matrix-create-task-${item.productId}`}
          onClick={() => onScrollToMatrixTask(created.taskId)}
        >
          {MATRIX_TASK_STATUS_LABEL[created.status]} · открыть
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant={item.presence === "нет на витрине" || item.presence === "нужно добавить" ? "default" : "secondary"}
        size="sm"
        className={btnClass}
        data-testid={`button-trade-point-product-matrix-create-task-${item.productId}`}
        onClick={() => onCreateMatrixTask(rec)}
      >
        Создать задачу
      </Button>
    );
  };

  const openCatalogButton = (item: TradePointProductMatrixItem, className: string) => (
    <Button asChild variant="outline" size="sm" className={className} data-testid={`button-trade-point-product-matrix-open-model-${item.productId}`}>
      <Link href={`/catalog/${item.productId}`}>Открыть модель</Link>
    </Button>
  );

  const detailsLabel = isMini ? "Ещё" : "Подробнее";

  const renderItem = (item: TradePointProductMatrixItem) => {
    const img = getProductById(item.productId)?.image ?? "";
    const detailsOpen = !!detailsOpenById[item.productId];
    const rec = recommendationByProductId.get(item.productId);
    const created = createdTaskByProductId.get(item.productId);
    const showPrimaryInFold = isMini;

    if (isList) {
      return (
        <div
          key={item.productId}
          data-testid={`card-trade-point-product-matrix-${item.productId}`}
          className={cn(
            "flex min-w-0 flex-col gap-1.5 px-2 py-1.5 sm:flex-row sm:items-center sm:gap-3 sm:px-2.5",
            productMatrixCardShellClass(item.presence),
          )}
        >
          <div className="shrink-0 self-start sm:self-center">
            <ModelDoorPhotoFrame
              src={img}
              alt=""
              frameClass={PHOTO_LIST}
              imgPaddingClass="p-1"
              imgTestId={`img-trade-point-product-matrix-${item.productId}`}
            />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-foreground">{item.productName}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{item.productArticle}</p>
            </div>
            <Badge variant="outline" className={cn("w-fit shrink-0 text-[10px] font-medium", presenceBadgeClass(item.presence))} data-testid={`badge-trade-point-product-matrix-status-${item.productId}`}>
              {item.presence}
            </Badge>
            <div className="flex w-fit flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px] font-medium">
                {item.doorCategory}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] font-medium", zoneBadgeClass(item.zone))}>
                Зона {item.zone}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 sm:ml-auto sm:shrink-0 sm:justify-end">
            {rec ? (created ? (
              <Button type="button" variant="secondary" size="sm" className="h-8 text-[11px]" data-testid={`button-trade-point-product-matrix-create-task-${item.productId}`} onClick={() => onScrollToMatrixTask(created.taskId)}>
                {MATRIX_TASK_STATUS_LABEL[created.status]} · открыть
              </Button>
            ) : (
              <Button type="button" variant="default" size="sm" className="h-8 text-[11px] font-semibold" data-testid={`button-trade-point-product-matrix-create-task-${item.productId}`} onClick={() => onCreateMatrixTask(rec)}>
                Создать задачу
              </Button>
            )) : null}
            {openCatalogButton(item, "h-8 shrink-0 text-[11px]")}
          </div>
        </div>
      );
    }

    if (isCompact || isMini) {
      const photoClass = isMini ? PHOTO_MINI : PHOTO_COMPACT;
      const pad = isMini ? "p-1" : "p-2.5";
      const rounded = isMini ? "rounded-lg" : "rounded-2xl";
      return (
        <Card
          key={item.productId}
          data-testid={`card-trade-point-product-matrix-${item.productId}`}
          className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden shadow-md", rounded, productMatrixCardShellClass(item.presence))}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative w-full shrink-0">
              <ModelDoorPhotoFrame
                src={img}
                alt=""
                frameClass={photoClass}
                imgPaddingClass={isMini ? "p-1" : "p-2"}
                imgTestId={`img-trade-point-product-matrix-${item.productId}`}
              />
            </div>
            <CardContent className={cn("flex min-h-0 flex-1 flex-col gap-1.5", pad)}>
              <p className={cn("line-clamp-2 min-w-0 max-w-full break-words font-semibold leading-snug text-foreground", isMini ? "text-[10px]" : "text-sm")}>
                {item.productName}
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={cn("max-w-full text-[10px] font-semibold", presenceBadgeClass(item.presence))} data-testid={`badge-trade-point-product-matrix-status-${item.productId}`}>
                  {item.presence}
                </Badge>
                {!isMini ? (
                  <>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {item.doorCategory}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[10px] font-medium", zoneBadgeClass(item.zone))}>
                      Зона {item.zone}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[10px] font-medium", matrixItemPriorityClass(item.priority))}>
                      {item.priority}
                    </Badge>
                  </>
                ) : null}
              </div>
              {!showPrimaryInFold && rec ? primaryActionFor(item, "dense") : null}
              {openCatalogButton(item, cn("w-full", isMini ? "h-7 text-[10px]" : "h-8 text-xs"))}
              <Collapsible open={detailsOpen} onOpenChange={(o) => setDetails(item.productId, o)}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("w-full gap-1", isMini ? "h-7 text-[10px]" : "h-8 text-xs")}
                    data-testid={`button-trade-point-product-matrix-details-${item.productId}`}
                  >
                    {detailsLabel}
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", detailsOpen && "rotate-180")} aria-hidden />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <section
                    data-testid={`section-trade-point-product-matrix-details-${item.productId}`}
                    className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/20 p-2"
                  >
                    {isMini ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {item.doorCategory}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", zoneBadgeClass(item.zone))}>
                          Зона {item.zone}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", matrixItemPriorityClass(item.priority))}>
                          {item.priority}
                        </Badge>
                      </div>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Портал: </span>
                      {item.portal}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Образцы: </span>
                      <span className="tabular-nums">
                        {item.actualSamples} / {item.targetSamples}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Действие: </span>
                      {item.action}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Проверено: </span>
                      <span className="tabular-nums">{item.lastCheckedAt}</span>
                    </p>
                    {showPrimaryInFold && rec ? primaryActionFor(item, "dense") : null}
                    {item.presence === "на проверке" ? (
                      <Button type="button" variant="secondary" size="sm" className="h-8 w-full text-xs">
                        Проверить
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

    /* large */
    return (
      <Card
        key={item.productId}
        data-testid={`card-trade-point-product-matrix-${item.productId}`}
        className={cn("h-full min-h-0 min-w-0 overflow-hidden shadow-md rounded-2xl", productMatrixCardShellClass(item.presence))}
      >
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col sm:flex-row">
          <div className="relative w-full shrink-0 sm:w-[200px]">
            <ModelDoorPhotoFrame
              src={img}
              alt=""
              frameClass={PHOTO_LARGE}
              imgPaddingClass="p-2"
              imgTestId={`img-trade-point-product-matrix-${item.productId}`}
            />
          </div>
          <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-3.5">
            <div className="space-y-2">
              <p className="text-base font-semibold leading-snug text-foreground">{item.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.productArticle}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={cn("text-[10px] font-medium", presenceBadgeClass(item.presence))} data-testid={`badge-trade-point-product-matrix-status-${item.productId}`}>
                  {item.presence}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {item.doorCategory}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] font-medium", zoneBadgeClass(item.zone))}>
                  Зона {item.zone}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] font-medium", matrixItemPriorityClass(item.priority))}>
                  {item.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Портал: </span>
                {item.portal}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Образцы: </span>
                <span className="tabular-nums">
                  {item.actualSamples} / {item.targetSamples}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Действие: </span>
                {item.action}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Проверено: </span>
                {item.lastCheckedAt}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {rec ? primaryActionFor(item, "comfortable") : null}
              {openCatalogButton(item, "min-h-9 flex-1 text-xs sm:flex-none")}
              {item.presence === "на проверке" ? (
                <Button type="button" variant="outline" size="sm" className="min-h-9 flex-1 text-xs sm:flex-none">
                  Проверить
                </Button>
              ) : null}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <section
      id="section-trade-point-matrix"
      data-testid="section-trade-point-matrix"
      className="scroll-mt-28 sm:scroll-mt-32"
    >
      <div data-testid="section-trade-point-product-matrix-visual" className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фактическая витрина</p>
        <p className="text-sm text-muted-foreground">Позиции каталога на точке: зоны, порталы, наличие на витрине.</p>
      </div>

      <ProductMatrixSummaryCard summary={matrixSummary} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Выберите модель в каталоге и добавьте её в матрицу точки.</p>
        <Button asChild variant="default" className="min-h-10 w-full shrink-0 font-semibold sm:w-auto" data-testid="button-add-products-from-catalog">
          <Link href="/catalog">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Добавить из каталога
          </Link>
        </Button>
      </div>

      <div
        className="-mx-1 overflow-x-hidden px-1 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Фильтры матрицы товаров"
      >
        <div className="flex flex-wrap gap-1.5 pb-1">
          {MATRIX_PRODUCT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={matrixFilter === f.id}
              onClick={() => onMatrixFilterChange(f.id)}
              data-testid={f.testId}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                matrixFilter === f.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="pt-5 text-sm text-muted-foreground">По выбранному фильтру позиций нет.</CardContent>
        </Card>
      ) : (
        <div className={cn(gridClass, isList && "divide-y divide-border/80")}>{filteredItems.map((item) => renderItem(item))}</div>
      )}
      </div>
    </section>
  );
}
