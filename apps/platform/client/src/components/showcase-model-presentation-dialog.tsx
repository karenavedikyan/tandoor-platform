import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LightboxModal } from "@/components/catalog/LightboxModal";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canManageShowcaseMatrixCatalog } from "@/lib/auth-access";
import { optimizedImage } from "@/lib/catalog-image";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  apiBatchSyncMatrixCatalog,
  type ShowcaseMatrixDefModelDto,
} from "@/lib/showcase-matrix-catalog-api";
import { refreshMatrixDefFromServer } from "@/lib/showcase-matrix-catalog-store";
import {
  catalogHrefForMatrixModel,
  priorityLabelRu,
  resolveCatalog1cId,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";
import { cn } from "@/lib/utils";

const PRESENTATION_PROPERTY_EXCLUDE_PREFIXES = ["Ссылка"] as const;
const PRESENTATION_PROPERTY_EXCLUDE_CONTAINS = ["АкцияДействует"] as const;
const PRESENTATION_PROPERTY_STOP_KEYS = new Set([
  "акция",
  "новинка",
  "хит продаж",
  "описание",
  "описание для сайта",
  "преимущества",
]);

type Catalog1cProperty = { name: string; value: string };

type Catalog1cProduct = {
  id: string;
  name: string;
  display_name: string | null;
  description?: string | null;
  price_retail?: number | null;
  price_retail_sale?: number | null;
  images: { path: string; sort_order: number | null; blob_url: string | null }[];
  properties: Catalog1cProperty[];
};

type CatalogSearchItem = {
  id: string;
  name: string;
  display_name: string | null;
  image_url?: string | null;
};

export type ShowcasePresentationBinding = {
  defId: string;
  modelRow: ShowcaseMatrixDefModelDto;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  model: ShowcaseMatrixModelDefinition | null;
  profile: ReleaseDemoProfile;
  matrixBinding?: ShowcasePresentationBinding | null;
  onBindingSaved?: (catalog1cId: string) => void;
};

type ResolveResponse =
  | { success: true; result: "matched"; productId: string }
  | { success: true; result: "ambiguous" | "not_found" }
  | { success: false };

async function copyText(label: string, text: string, onFallback: (v: string) => void): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trimmed);
      return;
    }
  } catch {
    /* fallback */
  }
  onFallback(`${label}\n\n${trimmed}`);
}

function normalizePropName(name: string): string {
  return name.trim().toLowerCase();
}

function isJunkProperty(name: string, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v === "01.01.0001") return true;
  if (PRESENTATION_PROPERTY_EXCLUDE_PREFIXES.some((p) => name.startsWith(p))) return true;
  if (PRESENTATION_PROPERTY_EXCLUDE_CONTAINS.some((p) => name.includes(p))) return true;
  const n = normalizePropName(name);
  if (PRESENTATION_PROPERTY_STOP_KEYS.has(n)) return true;
  if (/^(да|нет|true|false|0|1)$/i.test(v) && n.length < 24) return true;
  return false;
}

function findProperty(properties: Catalog1cProperty[], names: string[]): string | null {
  const wanted = new Set(names.map(normalizePropName));
  for (const p of properties) {
    if (!wanted.has(normalizePropName(p.name))) continue;
    const v = p.value?.trim();
    if (v) return v;
  }
  return null;
}

function buildCharacteristicsText(properties: Catalog1cProperty[]): string {
  return properties
    .filter((p) => !isJunkProperty(p.name, p.value))
    .map((p) => `${p.name}: ${p.value.trim()}`)
    .join("\n");
}

function buildAdvantagesText(product: Catalog1cProduct): string {
  const props = product.properties ?? [];
  const fromProp = findProperty(props, ["Преимущества", "Описание"]);
  if (fromProp) return fromProp;
  if (product.description?.trim()) return product.description.trim();
  const keys = ["Дизайн", "МТ.Вид двери", "МТ. Толщина стали/полотна", "Гарантийный срок"];
  const lines = keys
    .map((k) => {
      const v = findProperty(props, [k]);
      return v ? `${k}: ${v}` : null;
    })
    .filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function buildMessageText(product: Catalog1cProduct): string {
  const title = product.display_name?.trim() || product.name;
  const props = product.properties ?? [];
  const keyNames = [
    "Дизайн",
    "МТ.Вид двери",
    "МТ. Толщина стали/полотна",
    "Гарантийный срок",
    "Коллекция",
  ];
  const parts = keyNames
    .map((k) => {
      const v = findProperty(props, [k]);
      return v ? `${k.toLowerCase()}: ${v}` : null;
    })
    .filter((p): p is string => Boolean(p))
    .slice(0, 5);
  const price = product.price_retail_sale ?? product.price_retail;
  const pricePart = price != null ? `Цена: ${fmtPrice(price)}` : "";
  return [title, ...parts, pricePart].filter(Boolean).join(". ");
}

function Block({ title, children }: { title: string; children: string }) {
  if (!children.trim()) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="break-words whitespace-pre-wrap text-[13px] leading-relaxed text-foreground sm:text-sm">
        {children}
      </p>
    </div>
  );
}

function PhotoPlaceholder() {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted/30 px-4 text-center text-muted-foreground">
      <Package className="h-10 w-10 shrink-0 opacity-60" aria-hidden />
      <p className="text-xs">Фото появится после синхронизации</p>
    </div>
  );
}

export function ShowcaseModelPresentationDialog({
  open,
  onOpenChange,
  model,
  profile,
  matrixBinding = null,
  onBindingSaved,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const canManage = canManageShowcaseMatrixCatalog(user?.role, profile.role);

  const [fallbackText, setFallbackText] = useState("");
  const [savedCatalog1cId, setSavedCatalog1cId] = useState<string | null>(null);
  const [bindSearch, setBindSearch] = useState("");
  const [debouncedBindSearch, setDebouncedBindSearch] = useState("");
  const [bindingSaving, setBindingSaving] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set());

  const seedCatalog1cId = model ? resolveCatalog1cId(model) : null;

  useEffect(() => {
    if (!open) {
      setFallbackText("");
      setSavedCatalog1cId(null);
      setBindSearch("");
      setDebouncedBindSearch("");
      setBindError(null);
      setActiveImg(0);
      setLightboxOpen(false);
      setBrokenImages(new Set());
    }
  }, [open, model?.id]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBindSearch(bindSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [bindSearch]);

  const resolveQuery = useQuery({
    queryKey: ["catalog-resolve-by-name", model?.id, model?.name],
    enabled: open && Boolean(model) && !seedCatalog1cId && !savedCatalog1cId,
    queryFn: async (): Promise<ResolveResponse> => {
      const r = await fetch(
        `/api/catalog/resolve-by-name?name=${encodeURIComponent(model!.name)}`,
        { credentials: "include" },
      );
      return (await r.json()) as ResolveResponse;
    },
    staleTime: 60_000,
    retry: false,
  });

  const resolvedProductId = useMemo(() => {
    if (savedCatalog1cId) return savedCatalog1cId;
    if (seedCatalog1cId) return seedCatalog1cId;
    const data = resolveQuery.data;
    if (data?.success && data.result === "matched" && data.productId) return data.productId;
    return null;
  }, [resolveQuery.data, savedCatalog1cId, seedCatalog1cId]);

  const needsManualBinding =
    open &&
    Boolean(model) &&
    !resolvedProductId &&
    !resolveQuery.isLoading &&
    (resolveQuery.isError ||
      (resolveQuery.data?.success &&
        (resolveQuery.data.result === "ambiguous" || resolveQuery.data.result === "not_found")));

  const productQuery = useQuery({
    queryKey: ["catalog-product-presentation", resolvedProductId],
    enabled: open && Boolean(resolvedProductId),
    queryFn: async (): Promise<Catalog1cProduct> => {
      const r = await fetch(
        `/api/catalog/product?id=${encodeURIComponent(resolvedProductId!)}`,
        { credentials: "include" },
      );
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      return data.product as Catalog1cProduct;
    },
    staleTime: 30_000,
  });

  const bindSearchQuery = useQuery({
    queryKey: ["catalog-products-bind-search", debouncedBindSearch],
    enabled: open && needsManualBinding && canManage && debouncedBindSearch.length >= 2,
    queryFn: async (): Promise<CatalogSearchItem[]> => {
      const params = new URLSearchParams({ q: debouncedBindSearch, limit: "20", offset: "0" });
      const r = await fetch(`/api/catalog/products?${params}`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      return (data.items ?? []) as CatalogSearchItem[];
    },
    staleTime: 10_000,
  });

  const product = productQuery.data ?? null;
  const properties = product?.properties ?? [];

  const characteristicsText = useMemo(
    () => (product ? buildCharacteristicsText(properties) : ""),
    [product, properties],
  );
  const advantagesText = useMemo(() => (product ? buildAdvantagesText(product) : ""), [product]);
  const messageText = useMemo(() => (product ? buildMessageText(product) : ""), [product]);

  const descriptionText = useMemo(
    () => findProperty(properties, ["Описание", "Описание для сайта"]) ?? product?.description?.trim() ?? "",
    [product?.description, properties],
  );
  const warrantyText = useMemo(
    () => findProperty(properties, ["Гарантийный срок"]) ?? "",
    [properties],
  );
  const operationText = useMemo(
    () => findProperty(properties, ["Условия эксплуатации"]) ?? "",
    [properties],
  );

  const lightboxImages = useMemo(
    () =>
      (product?.images ?? [])
        .filter((img): img is typeof img & { blob_url: string } => Boolean(img.blob_url?.trim()))
        .map((img) => ({
          path: img.path,
          blob_url: optimizedImage(img.blob_url, 1600, 85) ?? img.blob_url,
        })),
    [product?.images],
  );

  const activeBlobIdx = useMemo(() => {
    const path = product?.images[activeImg]?.path;
    if (!path) return 0;
    const idx = lightboxImages.findIndex((i) => i.path === path);
    return idx >= 0 ? idx : 0;
  }, [product?.images, activeImg, lightboxImages]);

  const markImageBroken = useCallback((index: number) => {
    setBrokenImages((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleCopyChars = useCallback(() => {
    void copyText("Характеристики", characteristicsText, setFallbackText);
  }, [characteristicsText]);

  const handleCopyAdv = useCallback(() => {
    void copyText("Преимущества", advantagesText, setFallbackText);
  }, [advantagesText]);

  const handleCopyMsg = useCallback(() => {
    void copyText("Сообщение клиенту", messageText, setFallbackText);
  }, [messageText]);

  const handleBindProduct = useCallback(
    async (productId: string) => {
      if (!matrixBinding || !model) return;
      setBindingSaving(true);
      setBindError(null);
      try {
        const row = matrixBinding.modelRow;
        const result = await apiBatchSyncMatrixCatalog([
          {
            op: "upsertModel",
            defId: matrixBinding.defId,
            model: {
              id: row.id,
              targetKind: row.targetKind,
              targetId: row.targetId,
              priority: row.priority,
              segment: row.segment,
              valueWeight: row.valueWeight,
              sortOrder: row.sortOrder,
              catalog1cId: productId,
            },
          },
        ]);
        if (!result.ok) {
          throw new Error("Не удалось сохранить привязку");
        }
        await refreshMatrixDefFromServer(matrixBinding.defId);
        setSavedCatalog1cId(productId);
        onBindingSaved?.(productId);
        await queryClient.invalidateQueries({ queryKey: ["catalog-product-presentation", productId] });
      } catch (e) {
        setBindError(e instanceof Error ? e.message : String(e));
      } finally {
        setBindingSaving(false);
      }
    },
    [matrixBinding, model, onBindingSaved, queryClient],
  );

  if (!model) return null;

  const displayTitle = product?.display_name?.trim() || product?.name || model.name;
  const catalogHref = resolvedProductId
    ? `/catalog/1c/${resolvedProductId}`
    : catalogHrefForMatrixModel(model);

  const currentImg = product?.images[activeImg];
  const mainImageUrl = currentImg?.blob_url?.trim();
  const mainImageSrc = mainImageUrl ? optimizedImage(mainImageUrl, 1080, 80) : null;
  const showMainImage = Boolean(mainImageSrc && !brokenImages.has(activeImg));

  const isResolving = !resolvedProductId && resolveQuery.isLoading;
  const isLoadingProduct = Boolean(resolvedProductId) && productQuery.isLoading;
  const productError = productQuery.isError
    ? productQuery.error instanceof Error
      ? productQuery.error.message
      : "Не удалось загрузить данные товара"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-h-[min(90vh,720px)] gap-0 overflow-y-auto p-0 sm:w-full sm:max-w-lg"
        data-testid="dialog-showcase-model-presentation"
      >
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 pb-3 pt-4 sm:px-5">
          <DialogTitle className="text-left text-base leading-snug">Презентация модели</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {isResolving || isLoadingProduct ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Загрузка данных каталога
            </div>
          ) : null}

          {needsManualBinding ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              {canManage && matrixBinding ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Товар не найден однозначно. Найдите позицию в каталоге 1С и сохраните привязку.
                  </p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <Input
                      value={bindSearch}
                      onChange={(e) => setBindSearch(e.target.value)}
                      placeholder="Поиск по названию"
                      className="pl-8"
                      data-testid="input-showcase-bind-catalog-search"
                    />
                  </div>
                  {bindError ? <p className="text-xs text-destructive">{bindError}</p> : null}
                  {bindSearchQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Поиск</p>
                  ) : null}
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {(bindSearchQuery.data ?? []).map((item) => {
                      const label = item.display_name?.trim() || item.name;
                      const thumb = item.image_url?.trim()
                        ? optimizedImage(item.image_url, 64)
                        : null;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={bindingSaving}
                            className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm hover:border-border hover:bg-muted/40 disabled:opacity-50"
                            onClick={() => void handleBindProduct(item.id)}
                            data-testid={`button-showcase-bind-product-${item.id}`}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Товар не привязан к каталогу 1С. Обратитесь к администратору матрицы.
                </p>
              )}
            </div>
          ) : null}

          {productError ? (
            <p className="text-sm text-muted-foreground">{productError}</p>
          ) : null}

          {!isResolving && !isLoadingProduct && product ? (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <button
                  type="button"
                  className={cn("block w-full", showMainImage && "cursor-zoom-in")}
                  onClick={() => showMainImage && setLightboxOpen(true)}
                  disabled={!showMainImage}
                >
                  {showMainImage ? (
                    <img
                      src={mainImageSrc!}
                      alt=""
                      className="aspect-[4/3] w-full object-contain bg-muted/30 p-2"
                      loading="lazy"
                      onError={() => markImageBroken(activeImg)}
                    />
                  ) : (
                    <PhotoPlaceholder />
                  )}
                </button>
                {product.images.length > 1 ? (
                  <div className="flex gap-1.5 overflow-x-auto border-t border-border/60 p-2">
                    {product.images.map((img, i) => {
                      const thumbSrc = img.blob_url?.trim() ? optimizedImage(img.blob_url, 96) : null;
                      return (
                        <button
                          key={`${img.path}-${i}`}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={cn(
                            "h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted/40",
                            i === activeImg ? "border-primary" : "border-transparent opacity-80",
                          )}
                        >
                          {thumbSrc && !brokenImages.has(i) ? (
                            <img
                              src={thumbSrc}
                              alt=""
                              className="h-full w-full object-contain"
                              onError={() => markImageBroken(i)}
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                              {i + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <LightboxModal
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                images={lightboxImages}
                activeIdx={activeBlobIdx}
                onActiveIdxChange={(idx) => {
                  const path = lightboxImages[idx]?.path;
                  if (!path) return;
                  const orig = product.images.findIndex((im) => im.path === path);
                  if (orig >= 0) setActiveImg(orig);
                }}
                alt={displayTitle}
              />

              <div>
                <p className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {displayTitle}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  Тип: {model.typeLabelRu} · Приоритет матрицы: {priorityLabelRu(model.basePriority)}
                </p>
              </div>

              <Button asChild variant="outline" size="sm" className="h-9 w-full sm:w-auto">
                <Link href={catalogHref}>Открыть в каталоге</Link>
              </Button>

              <Separator />
              <Block title="Характеристики" children={characteristicsText} />
              <Block title="Преимущества" children={advantagesText} />
              <Block title="Описание" children={descriptionText} />
              <Block title="Гарантийный срок" children={warrantyText} />
              <Block title="Условия эксплуатации" children={operationText} />
              <Block title="Сообщение клиенту" children={messageText} />

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-characteristics"
                  disabled={!characteristicsText.trim()}
                  title={!characteristicsText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyChars}
                >
                  Скопировать характеристики
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-benefits"
                  disabled={!advantagesText.trim()}
                  title={!advantagesText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyAdv}
                >
                  Скопировать преимущества
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-message"
                  disabled={!messageText.trim()}
                  title={!messageText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyMsg}
                >
                  Скопировать сообщение клиенту
                </Button>
              </div>
            </>
          ) : null}

          {fallbackText ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20">
              <Label className="text-xs text-amber-950 dark:text-amber-50">Скопируйте вручную</Label>
              <Textarea
                readOnly
                rows={6}
                className="resize-y text-xs"
                value={fallbackText}
                onFocus={(e) => e.target.select()}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
