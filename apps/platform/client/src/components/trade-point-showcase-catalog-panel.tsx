/**
 * Каталог моделей на витрине + режим обязательной матрицы для ручной актуализации ТТ.
 */

import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  getRequiredShowcaseMatrixDefinitions,
  inferShowcasePortalTypeFromCatalogProduct,
  type ShowcasePortalCaps,
} from "@/lib/trade-point-showcase-matrix-required";
import type { ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import { cn } from "@/lib/utils";

export type ShowcaseCatalogViewMode = "large" | "compact" | "mini" | "list";

type CatalogFilterPreset = "all" | "selected" | "unselected" | "required" | "deficit";

type DoorTypeFilter = "all" | "entrance" | "interior" | "other";

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
  matrixClientCategory: ClientCategoryId | null;
  canEdit: boolean;
  actorUserId: string;
  actorLabel: string;
  selectedShowcaseModels: TradePointShowcaseSelectedModel[];
  onChangeSelected: (next: TradePointShowcaseSelectedModel[]) => void;
  showcaseMatrixTasks: ShowcaseMatrixTask[];
  onChangeTasks: (next: ShowcaseMatrixTask[]) => void;
  onMarkDirty: () => void;
  portalCaps: ShowcasePortalCaps;
};

function isDoorProduct(p: CatalogProduct): boolean {
  return p.doorKind === "Входная" || p.doorKind === "Межкомнатная";
}

function productStatusLabel(params: {
  selected: boolean;
  required: boolean;
  categoryKnown: boolean;
}): string {
  if (params.selected) return "Стоит";
  if (!params.categoryKnown) return "Не на витрине";
  if (params.required) return "Нужно поставить";
  return "Не требуется";
}

export function TradePointShowcaseCatalogPanel(props: TradePointShowcaseCatalogPanelProps): ReactElement {
  const {
    tradePointId,
    dealerId,
    matrixClientCategory,
    canEdit,
    actorUserId,
    actorLabel,
    selectedShowcaseModels,
    onChangeSelected,
    showcaseMatrixTasks,
    onChangeTasks,
    onMarkDirty,
    portalCaps,
  } = props;

  const [mainTab, setMainTab] = useState<"catalog" | "matrix">("catalog");
  const [viewMode, setViewMode] = useState<ShowcaseCatalogViewMode>("large");
  const [search, setSearch] = useState("");
  const [doorType, setDoorType] = useState<DoorTypeFilter>("all");
  const [preset, setPreset] = useState<CatalogFilterPreset>("all");

  const selectedIds = useMemo(() => new Set(selectedShowcaseModels.map((m) => m.productId)), [selectedShowcaseModels]);

  const requiredDefs = useMemo(() => {
    if (!matrixClientCategory) return [] as ShowcaseMatrixModelDefinition[];
    return getRequiredShowcaseMatrixDefinitions(matrixClientCategory);
  }, [matrixClientCategory]);

  const requiredIdSet = useMemo(() => new Set(requiredDefs.map((d) => d.id)), [requiredDefs]);

  const doorCatalog = useMemo(() => CATALOG_PRODUCTS.filter(isDoorProduct), []);

  const hayById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of doorCatalog) m.set(p.id, buildCatalogProductSearchHaystack(p));
    return m;
  }, [doorCatalog]);

  const filteredCatalog = useMemo(() => {
    let list = doorCatalog;
    if (doorType === "entrance") list = list.filter((p) => p.doorKind === "Входная");
    else if (doorType === "interior") list = list.filter((p) => p.doorKind === "Межкомнатная");
    else if (doorType === "other") list = list.filter((p) => p.doorKind !== "Входная" && p.doorKind !== "Межкомнатная");

    const q = search.trim();
    if (q) {
      list = list.filter((p) => catalogSearchQueryMatchesHaystack(q, hayById.get(p.id) ?? ""));
    }

    const catKnown = matrixClientCategory != null;

    if (preset === "selected") list = list.filter((p) => selectedIds.has(p.id));
    else if (preset === "unselected") list = list.filter((p) => !selectedIds.has(p.id));
    else if (preset === "required") list = list.filter((p) => catKnown && requiredIdSet.has(p.id));
    else if (preset === "deficit") list = list.filter((p) => catKnown && requiredIdSet.has(p.id) && !selectedIds.has(p.id));

    return list;
  }, [doorCatalog, doorType, search, hayById, preset, selectedIds, requiredIdSet, matrixClientCategory]);

  const portalWarn = useMemo(
    () => computeShowcasePortalOverfill(selectedShowcaseModels, portalCaps, catalogLookup),
    [selectedShowcaseModels, portalCaps],
  );

  const countsLine = useMemo(() => {
    let ent = 0;
    let int = 0;
    let oth = 0;
    for (const m of selectedShowcaseModels) {
      const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
      if (t === "entrance") ent += 1;
      else if (t === "interior") int += 1;
      else oth += 1;
    }
    const parts: string[] = [];
    if (portalCaps.entrance != null) parts.push(`входных моделей: ${ent} из ${portalCaps.entrance} порталов`);
    if (portalCaps.interior != null) parts.push(`межкомнатных: ${int} из ${portalCaps.interior} порталов`);
    if (portalCaps.total != null) parts.push(`всего моделей на витрине: ${selectedShowcaseModels.length} из ${portalCaps.total} порталов`);
    if (oth > 0) parts.push(`тип не определён: ${oth}`);
    return parts.length ? parts.join(" · ") : "";
  }, [selectedShowcaseModels, portalCaps]);

  const toggleSelected = (p: CatalogProduct, nextChecked: boolean) => {
    if (!canEdit) return;
    onMarkDirty();
    if (nextChecked) {
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
    } else {
      onChangeSelected(selectedShowcaseModels.filter((x) => x.productId !== p.id));
    }
  };

  const addMatrixTask = (productId: string, productName: string) => {
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
  };

  const matrixEmptyConfigured = matrixClientCategory != null && requiredDefs.length === 0;

  const renderProductCard = (p: CatalogProduct) => {
    const sel = selectedIds.has(p.id);
    const req = matrixClientCategory != null && requiredIdSet.has(p.id);
    const status = productStatusLabel({
      selected: sel,
      required: req,
      categoryKnown: matrixClientCategory != null,
    });
    const portalType = inferShowcasePortalTypeFromCatalogProduct(p);
    const typeLine =
      portalType === "entrance" ? "Входная" : portalType === "interior" ? "Межкомнатная" : "Тип не определён";

    const imgCard = p.image ? (
      <img
        src={p.image}
        alt=""
        className="aspect-[3/4] w-full max-h-48 rounded-md object-cover"
        loading="lazy"
      />
    ) : (
      <div className="flex aspect-[3/4] max-h-48 w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        Нет фото
      </div>
    );

    const imgListThumb = p.image ? (
      <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">—</div>
    );

    const headToggle = (
      <div className="flex items-start gap-2">
        <Checkbox
          id={`showcase-sel-${p.id}`}
          checked={sel}
          disabled={!canEdit}
          className="mt-0.5 h-6 w-6 min-h-[24px] min-w-[24px] rounded-md [&_svg]:h-5 [&_svg]:w-5"
          data-testid={`checkbox-showcase-product-selected-${p.id}`}
          onCheckedChange={(v) => toggleSelected(p, v === true)}
        />
        <Label htmlFor={`showcase-sel-${p.id}`} className="cursor-pointer text-sm font-medium leading-snug">
          Стоит на витрине
        </Label>
      </div>
    );

    const meta = (
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium leading-tight">{p.name}</p>
        <p className="text-xs text-muted-foreground">{typeLine}</p>
        {p.series ? <p className="truncate text-xs text-muted-foreground">Серия: {p.series}</p> : null}
        {p.category ? <p className="truncate text-xs text-muted-foreground">Категория: {p.category}</p> : null}
        {req && matrixClientCategory != null ? (
          <p className="text-xs font-medium text-amber-900">Обязательная модель</p>
        ) : null}
        <p className="text-xs font-medium text-foreground" data-testid={`text-showcase-product-status-${p.id}`}>
          {status}
        </p>
      </div>
    );

    if (viewMode === "list") {
      return (
        <div
          key={p.id}
          data-testid={`card-showcase-product-${p.id}`}
          className="flex min-w-0 gap-3 rounded-lg border border-border/70 bg-card p-2"
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{imgListThumb}</div>
          <div className="min-w-0 flex-1">{meta}</div>
          <div className="shrink-0 self-center">{headToggle}</div>
        </div>
      );
    }

    const cardClass =
      viewMode === "large"
        ? "flex flex-col gap-2 p-3"
        : viewMode === "compact"
          ? "flex flex-col gap-1.5 p-2"
          : "flex flex-col gap-1 p-1.5";

    return (
      <div
        key={p.id}
        data-testid={`card-showcase-product-${p.id}`}
        className={cn("rounded-lg border border-border/70 bg-card", cardClass)}
      >
        <div className={cn("overflow-hidden rounded-md", viewMode === "mini" && "max-h-32")}>{imgCard}</div>
        {meta}
        {headToggle}
      </div>
    );
  };

  const gridClass =
    viewMode === "large"
      ? "grid grid-cols-1 gap-3"
      : viewMode === "compact"
        ? "grid grid-cols-2 gap-2 sm:gap-3"
        : viewMode === "mini"
          ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
          : "flex flex-col gap-2";

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4" data-testid="section-trade-point-showcase-catalog">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Модели на витрине</p>
        <p className="text-xs text-muted-foreground">
          Отметьте модели, которые реально стоят на витрине. Данные сохраняются в анкете точки вместе с блоком «Витрина и порталы».
        </p>
      </div>

      <div data-testid="switch-showcase-tasks-mode">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "catalog" | "matrix")}>
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-trade-point-showcase-mode">
            <TabsTrigger value="catalog">Каталог</TabsTrigger>
            <TabsTrigger value="matrix">Задачи по витрине</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog" className="mt-3 space-y-3">
            <div className="sticky top-0 z-20 -mx-1 space-y-2 border-b border-border/60 bg-card/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <p className="text-xs font-medium text-muted-foreground">Режим отображения</p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "large" ? "default" : "outline"}
                  className="min-h-9 flex-1 sm:flex-none"
                  data-testid="button-showcase-catalog-mode-large"
                  onClick={() => setViewMode("large")}
                >
                  Крупно
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "compact" ? "default" : "outline"}
                  className="min-h-9 flex-1 sm:flex-none"
                  data-testid="button-showcase-catalog-mode-compact"
                  onClick={() => setViewMode("compact")}
                >
                  Компактно
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "mini" ? "default" : "outline"}
                  className="min-h-9 flex-1 sm:flex-none"
                  data-testid="button-showcase-catalog-mode-mini"
                  onClick={() => setViewMode("mini")}
                >
                  Мини
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "outline"}
                  className="min-h-9 flex-1 sm:flex-none"
                  data-testid="button-showcase-catalog-mode-list"
                  onClick={() => setViewMode("list")}
                >
                  Список
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Поиск</Label>
                <Input
                  className="min-h-10"
                  value={search}
                  data-testid="input-showcase-catalog-search"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Название, артикул, серия…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Тип двери</Label>
                <Select value={doorType} onValueChange={(v) => setDoorType(v as DoorTypeFilter)}>
                  <SelectTrigger className="min-h-10" data-testid="filter-showcase-catalog-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="entrance">Входные</SelectItem>
                    <SelectItem value="interior">Межкомнатные</SelectItem>
                    <SelectItem value="other">Другое / не определено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Быстрые фильтры</Label>
                <Select value={preset} onValueChange={(v) => setPreset(v as CatalogFilterPreset)}>
                  <SelectTrigger className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все модели</SelectItem>
                    <SelectItem value="selected">Только выбранные</SelectItem>
                    <SelectItem value="unselected">Только не выбранные</SelectItem>
                    <SelectItem value="required">Только обязательные по матрице</SelectItem>
                    <SelectItem value="deficit">Только дефицит / нужно поставить</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {portalWarn ? (
              <p className="text-sm text-amber-900" data-testid="text-showcase-portal-warning">
                Выбрано моделей больше, чем указано порталов. Проверьте витрину.
              </p>
            ) : null}
            {countsLine ? <p className="text-xs text-muted-foreground">{countsLine}</p> : null}

            <div className={gridClass}>{filteredCatalog.map(renderProductCard)}</div>
            {filteredCatalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет моделей по текущим фильтрам.</p>
            ) : null}
          </TabsContent>

          <TabsContent value="matrix" className="mt-3 space-y-3" data-testid="section-trade-point-showcase-matrix">
            {matrixClientCategory == null ? (
              <p className="text-sm text-muted-foreground" data-testid="text-showcase-category-missing">
                Категория не указана. Укажите категорию клиента (или ТОП в паспорте клиента), чтобы рассчитать обязательную матрицу.
              </p>
            ) : matrixEmptyConfigured ? (
              <p className="text-sm text-muted-foreground" data-testid="text-showcase-matrix-empty">
                Для этой категории матрица пока не настроена. Вы всё равно можете отметить модели на витрине во вкладке «Каталог».
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Обязательные модели для категории клиента. Дефицит: обязательные минус отмеченные на витрине.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {requiredDefs.map((def) => {
                    const sel = selectedIds.has(def.id);
                    const p = getProductById(def.id);
                    const name = p?.name ?? def.name;
                    const imgSrc = p?.image ?? def.imageUrl;
                    const status = sel ? "Стоит" : "Нужно поставить";
                    const hasTask = showcaseMatrixTasks.some((t) => t.productId === def.id && t.status === "new");
                    return (
                      <div
                        key={def.id}
                        data-testid={`card-showcase-matrix-product-${def.id}`}
                        className="flex gap-3 rounded-lg border border-border/70 bg-card p-3"
                      >
                        {imgSrc ? (
                          <img src={imgSrc} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
                        ) : (
                          <div className="h-20 w-16 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-medium leading-snug">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {def.type === "entrance" ? "Входная" : "Межкомнатная"} · {def.typeLabelRu}
                          </p>
                          <p className="text-xs font-medium">{sel ? "Обязательная · на витрине" : "Обязательная · нужно поставить"}</p>
                          <p className="text-xs" data-testid={`text-showcase-product-status-${def.id}`}>
                            {status}
                          </p>
                          {!sel && canEdit ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="mt-1"
                              disabled={hasTask}
                              data-testid={`button-showcase-create-task-${def.id}`}
                              onClick={() => addMatrixTask(def.id, name)}
                            >
                              {hasTask ? "Задача создана" : "Создать задачу"}
                            </Button>
                          ) : null}
                          {sel ? <p className="text-xs text-muted-foreground">Не обязательна к доставке — уже стоит.</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
