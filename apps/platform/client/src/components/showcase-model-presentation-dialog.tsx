import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LightboxModal } from "@/components/catalog/LightboxModal";
import { catalog1cProductHref } from "@/lib/catalog-1c-product-link";
import { optimizedImage } from "@/lib/catalog-image";
import { priorityLabelRu, type ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const KEY_SPEC_FIELDS: { keys: string[]; label: string }[] = [
  { keys: ["Дизайн"], label: "Дизайн" },
  { keys: ["МТ.Вид двери", "Вид двери"], label: "Тип двери" },
  { keys: ["Размер,мм", "Размер мм", "Размер"], label: "Размер" },
  { keys: ["Толщина стали,мм", "Толщина стали", "МТ. Толщина стали/полотна"], label: "Толщина стали" },
  { keys: ["Толщина полотна,мм", "Толщина полотна"], label: "Толщина полотна" },
  { keys: ["Замок основной"], label: "Основной замок" },
  { keys: ["Замок дополнительный"], label: "Дополнительный замок" },
  { keys: ["Вид утеплителя"], label: "Утеплитель" },
  { keys: ["Тип коробки"], label: "Коробка" },
  { keys: ["Контур уплотнения", "Контуры уплотнения"], label: "Контуры уплотнения" },
  { keys: ["Покрытие"], label: "Покрытие" },
  { keys: ["Цвет"], label: "Цвет" },
  { keys: ["Петли"], label: "Петли" },
  { keys: ["Производитель"], label: "Производитель" },
  { keys: ["Страна"], label: "Страна" },
];

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
  stocks?: { qty: number }[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  model: ShowcaseMatrixModelDefinition | null;
  hideMatrixMeta?: boolean;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function effective1cIdForModel(model: ShowcaseMatrixModelDefinition): string {
  return (model.catalog1cId ?? model.id).trim();
}

type ResolveResponse =
  | { success: true; result: "matched"; productId: string }
  | { success: true; result: "ambiguous" | "not_found" }
  | { success: false };

async function copyText(label: string, text: string, onFallback: (v: string) => void): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const payload = `${label}:\n${trimmed}`;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return;
    }
  } catch {
    /* fallback */
  }
  onFallback(payload);
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

function propIsYes(properties: Catalog1cProperty[], names: string[]): boolean {
  const v = findProperty(properties, names);
  if (!v) return false;
  return /^(да|есть|true|1)$/i.test(v.trim());
}

function parseNumericMm(value: string | null): number | null {
  if (!value) return null;
  const m = value.replace(",", ".").match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function bulletList(lines: string[]): string {
  return lines.map((line) => `• ${line}`).join("\n");
}

function buildCharacteristicsTextFallback(properties: Catalog1cProperty[]): string {
  return properties
    .filter((p) => !isJunkProperty(p.name, p.value))
    .map((p) => `${p.name}: ${p.value.trim()}`)
    .join("\n");
}

function buildCharacteristicsText(properties: Catalog1cProperty[]): string {
  const lines: string[] = [];
  for (const field of KEY_SPEC_FIELDS) {
    const value = findProperty(properties, field.keys);
    if (value) lines.push(`${field.label}: ${value}`);
  }
  if (lines.length > 0) return lines.join("\n");
  return buildCharacteristicsTextFallback(properties);
}

function buildAdvantagesTextFallback(product: Catalog1cProduct): string {
  const props = product.properties ?? [];
  const fromProp = findProperty(props, ["Преимущества", "Описание"]);
  if (fromProp) return fromProp;
  if (product.description?.trim()) return product.description.trim();
  return "";
}

function buildAdvantagesText(product: Catalog1cProduct): string {
  const props = product.properties ?? [];
  const lines: string[] = [];

  const mainLock = findProperty(props, ["Замок основной"]);
  const addLock = findProperty(props, ["Замок дополнительный"]);
  if (mainLock && addLock) {
    lines.push(
      "Два независимых замка — выше класс взломостойкости, чем у бюджетных аналогов с одним замком",
    );
  }

  const steelThickness = findProperty(props, ["Толщина стали,мм", "Толщина стали", "МТ. Толщина стали/полотна"]);
  const steelMm = parseNumericMm(steelThickness);
  if (steelMm != null && steelMm >= 1.5) {
    lines.push(`Усиленная сталь ${steelThickness} — прочнее типовых дверей этого ценового сегмента`);
  }

  const insulator = findProperty(props, ["Вид утеплителя"]);
  if (insulator) {
    lines.push(`Тепло- и шумоизоляция: ${insulator} в стандартной комплектации`);
  }

  if (propIsYes(props, ["Терморазрыв", "ВХ. Терморазрыв"])) {
    lines.push("Терморазрыв — нет промерзания и конденсата, подходит для квартир и частных домов");
  }

  if (propIsYes(props, ["Стеклопакет", "ВХ. Стеклопакет"])) {
    lines.push("Стеклопакет в комплектации — премиальный внешний вид без доплаты");
  }

  if (propIsYes(props, ["Ковка", "ВХ. Ковка"])) {
    lines.push("Декоративная ковка — статусный внешний вид");
  }

  if (propIsYes(props, ["Ночная задвижка", "ВХ. Ночная задвижка"])) {
    lines.push("Ночная задвижка — дополнительная защита изнутри");
  }

  const contourRaw = findProperty(props, ["Контур уплотнения", "Контуры уплотнения"]);
  const contourN = parseNumericMm(contourRaw);
  if (contourN != null && contourN >= 2) {
    lines.push(`${contourRaw} контура уплотнения — лучшая герметичность против сквозняков и шума`);
  }

  const hinges = findProperty(props, ["Петли"]);
  if (hinges && hinges.toLowerCase().includes("подшипник")) {
    lines.push("Петли на подшипнике — плавный ход и долговечность даже у тяжёлого полотна");
  }

  const manufacturer = findProperty(props, ["Производитель"]);
  const country = findProperty(props, ["Страна"]);
  if (manufacturer && country) {
    lines.push(`Производство ${manufacturer}, ${country} — гарантия и наличие запчастей`);
  } else if (manufacturer) {
    lines.push(`Производство ${manufacturer} — гарантия и наличие запчастей`);
  }

  if (lines.length > 0) return bulletList(lines);
  return buildAdvantagesTextFallback(product);
}

function getStockQty(product: Catalog1cProduct): number {
  const fromProp = findProperty(product.properties, ["Актуальный остаток"]);
  if (fromProp) {
    const n = parseNumericMm(fromProp);
    if (n != null) return Math.floor(n);
  }
  if (product.stocks?.length) {
    return product.stocks.reduce((sum, row) => sum + (row.qty > 0 ? row.qty : 0), 0);
  }
  return 0;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function buildBenefitsBuyerFromProduct(product: Catalog1cProduct): string {
  const props = product.properties ?? [];
  const lines: string[] = [];

  const mainLock = findProperty(props, ["Замок основной"]);
  const addLock = findProperty(props, ["Замок дополнительный"]);
  const hasTwoLocks = Boolean(mainLock && addLock);
  const hasNightLatch = propIsYes(props, ["Ночная задвижка", "ВХ. Ночная задвижка"]);
  if (hasTwoLocks || hasNightLatch) {
    const parts: string[] = [];
    if (hasTwoLocks) parts.push("два замка");
    if (hasNightLatch) parts.push("ночная задвижка");
    lines.push(`Спокойствие за безопасность семьи: ${parts.join(", ")}`);
  }

  const insulator = findProperty(props, ["Вид утеплителя"]);
  const contourRaw = findProperty(props, ["Контур уплотнения", "Контуры уплотнения"]);
  const hasThermalBreak = propIsYes(props, ["Терморазрыв", "ВХ. Терморазрыв"]);
  const warmthParts: string[] = [];
  if (insulator) warmthParts.push(insulator);
  if (contourRaw) warmthParts.push(`${contourRaw} контура уплотнения`);
  if (hasThermalBreak) warmthParts.push("терморазрыв");
  if (warmthParts.length > 0) {
    lines.push(`Тишина и тепло в доме: ${warmthParts.join(", ")}`);
  }

  const coating = findProperty(props, ["Покрытие"]);
  const color = findProperty(props, ["Цвет"]);
  const hasForging = propIsYes(props, ["Ковка", "ВХ. Ковка"]);
  const hasGlazing = propIsYes(props, ["Стеклопакет", "ВХ. Стеклопакет"]);
  const lookParts: string[] = [];
  if (coating) lookParts.push(coating);
  if (color) lookParts.push(color);
  if (hasForging) lookParts.push("ковка");
  if (hasGlazing) lookParts.push("стеклопакет");
  if (lookParts.length > 0) {
    lines.push(`Красивый вид, который не стыдно показать гостям: ${lookParts.join(" ")}`);
  }

  const leafThickness = findProperty(props, ["Толщина полотна,мм", "Толщина полотна"]);
  const steelThickness = findProperty(props, ["Толщина стали,мм", "Толщина стали"]);
  const reliability = leafThickness ?? steelThickness;
  if (reliability) {
    lines.push(`Надёжность на годы: усиленное полотно ${reliability}`);
  }

  if (findProperty(props, ["Гарантийный срок"])) {
    lines.push("Заводская гарантия от производителя");
  }

  return lines.length > 0 ? bulletList(lines) : "";
}

function buildBenefitsDealerFromProduct(product: Catalog1cProduct): string {
  const props = product.properties ?? [];
  const lines: string[] = [];

  if (propIsYes(props, ["Акция"])) {
    lines.push("В акции — повышенная маржинальность и аргумент «выгодная цена» для клиента");
  }

  const stock = getStockQty(product);
  if (stock > 0) {
    lines.push(`В наличии (${stock} шт) — продаёте сразу, без ожидания поставки`);
  }

  const mainLock = findProperty(props, ["Замок основной"]);
  const addLock = findProperty(props, ["Замок дополнительный"]);
  const richKit =
    Boolean(mainLock && addLock) ||
    propIsYes(props, ["Стеклопакет", "ВХ. Стеклопакет"]) ||
    propIsYes(props, ["Ковка", "ВХ. Ковка"]) ||
    propIsYes(props, ["Терморазрыв", "ВХ. Терморазрыв"]);
  if (richKit) {
    lines.push("Высокая комплектация в базе — легко обосновать цену и допродать");
  }

  const manufacturer = findProperty(props, ["Производитель"]);
  if (manufacturer) {
    lines.push("Узнаваемый бренд-производитель — меньше возражений по доверию");
  }

  const side = findProperty(props, ["Сторона"]);
  const nameLower = product.name.toLowerCase();
  const hasSide =
    Boolean(side) || nameLower.includes("левая") || nameLower.includes("правая");
  if (hasSide) {
    lines.push("Готовое решение под типовой проём — быстрый подбор");
  }

  const design = findProperty(props, ["Дизайн"]);
  if (design && /модерн|классик/i.test(design)) {
    lines.push("Подходит под разные интерьеры — шире целевая аудитория");
  }

  return lines.length > 0 ? bulletList(lines) : "";
}

function appendPresentationSection(parts: string[], title: string, body: string): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  parts.push(title, trimmed, "");
}

function buildPresentationText(
  displayTitle: string,
  product: Catalog1cProduct,
  resolvedProductId: string | null,
  characteristicsText: string,
  advantagesText: string,
  benefitsBuyerText: string,
  benefitsDealerText: string,
): string {
  const parts: string[] = [displayTitle, ""];

  const price = product.price_retail_sale ?? product.price_retail;
  if (price != null) {
    parts.push(`💰 Цена: ${fmtPrice(price)}`);
  }

  const stock = getStockQty(product);
  if (stock > 0) {
    parts.push(`📦 Наличие: ${stock} шт`);
  }

  const catalogHref = resolvedProductId ? catalog1cProductHref(resolvedProductId) : null;
  if (catalogHref) {
    const link =
      typeof window !== "undefined" && window.location?.origin
        ? `${window.location.origin}${catalogHref}`
        : catalogHref;
    parts.push(`🔗 Каталог: ${link}`);
  }

  if (parts[parts.length - 1] !== "") parts.push("");

  appendPresentationSection(parts, "ХАРАКТЕРИСТИКИ", characteristicsText);
  appendPresentationSection(parts, "ПРЕИМУЩЕСТВА", advantagesText);
  appendPresentationSection(parts, "ВЫГОДЫ ДЛЯ ПОКУПАТЕЛЯ", benefitsBuyerText);
  appendPresentationSection(parts, "ВЫГОДЫ ДЛЯ ДИЛЕРА", benefitsDealerText);

  return parts.join("\n").trim();
}

function buildObjectionsHandlingText(model: ShowcaseMatrixModelDefinition): string {
  const objections = model.objections.trim();
  const answers = model.objectionAnswers.trim();
  if (objections && answers) {
    return `Возражения:\n${objections}\n\nОтветы:\n${answers}`;
  }
  return objections || answers;
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

export function ShowcaseModelPresentationDialog({ open, onOpenChange, model, hideMatrixMeta }: Props) {
  const [fallbackText, setFallbackText] = useState("");
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set());

  const rawEffectiveId = model ? effective1cIdForModel(model) : "";
  const hasUuidId = Boolean(rawEffectiveId && isUuid(rawEffectiveId));

  useEffect(() => {
    if (!open) {
      setFallbackText("");
      setActiveImg(0);
      setLightboxOpen(false);
      setBrokenImages(new Set());
    }
  }, [open, model?.id]);

  const resolveQuery = useQuery({
    queryKey: ["catalog-resolve-by-name", model?.id, model?.name],
    enabled: open && Boolean(model) && !hasUuidId,
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
    if (hasUuidId) return rawEffectiveId;
    const data = resolveQuery.data;
    if (data?.success && data.result === "matched" && data.productId) return data.productId;
    return null;
  }, [hasUuidId, rawEffectiveId, resolveQuery.data]);

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
        const err = new Error(data.message || `HTTP ${r.status}`) as Error & { status?: number };
        err.status = r.status;
        throw err;
      }
      return data.product as Catalog1cProduct;
    },
    staleTime: 30_000,
    retry: false,
  });

  const product = productQuery.data ?? null;
  const properties = product?.properties ?? [];

  const characteristicsText = useMemo(
    () => (product ? buildCharacteristicsText(properties) : ""),
    [product, properties],
  );
  const advantagesText = useMemo(() => {
    if (model?.advantages.trim()) return model.advantages.trim();
    return product ? buildAdvantagesText(product) : "";
  }, [model?.advantages, product]);
  const benefitsBuyerText = useMemo(() => {
    if (model?.benefitsBuyer.trim()) return model.benefitsBuyer.trim();
    return product ? buildBenefitsBuyerFromProduct(product) : "";
  }, [model?.benefitsBuyer, product]);
  const benefitsDealerText = useMemo(() => {
    if (model?.benefitsDealer.trim()) return model.benefitsDealer.trim();
    return product ? buildBenefitsDealerFromProduct(product) : "";
  }, [model?.benefitsDealer, product]);
  const objectionsText = useMemo(
    () => (model ? buildObjectionsHandlingText(model) : ""),
    [model],
  );

  const displayTitle = product?.display_name?.trim() || product?.name || model?.name || "";

  const presentationText = useMemo(() => {
    if (!product) return "";
    return buildPresentationText(
      displayTitle,
      product,
      resolvedProductId,
      characteristicsText,
      advantagesText,
      benefitsBuyerText,
      benefitsDealerText,
    );
  }, [
    product,
    displayTitle,
    resolvedProductId,
    characteristicsText,
    advantagesText,
    benefitsBuyerText,
    benefitsDealerText,
  ]);

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

  const handleCopyPresentation = useCallback(() => {
    void copyText("Презентация", presentationText, setFallbackText);
  }, [presentationText]);

  const handleCopyChars = useCallback(() => {
    void copyText("Характеристики", characteristicsText, setFallbackText);
  }, [characteristicsText]);

  const handleCopyAdv = useCallback(() => {
    void copyText("Преимущества", advantagesText, setFallbackText);
  }, [advantagesText]);

  const handleCopyBenefitsBuyer = useCallback(() => {
    void copyText("Выгоды клиенту", benefitsBuyerText, setFallbackText);
  }, [benefitsBuyerText]);

  const handleCopyBenefitsDealer = useCallback(() => {
    void copyText("Выгоды дилеру", benefitsDealerText, setFallbackText);
  }, [benefitsDealerText]);

  const handleCopyObjections = useCallback(() => {
    void copyText("Работа с возражениями", objectionsText, setFallbackText);
  }, [objectionsText]);

  if (!model) return null;

  const catalogHref = resolvedProductId ? catalog1cProductHref(resolvedProductId) : null;

  const currentImg = product?.images[activeImg];
  const mainImageUrl = currentImg?.blob_url?.trim();
  const mainImageSrc = mainImageUrl ? optimizedImage(mainImageUrl, 1080, 80) : null;
  const showMainImage = Boolean(mainImageSrc && !brokenImages.has(activeImg));

  const isResolving = !resolvedProductId && resolveQuery.isLoading;
  const isLoadingProduct = Boolean(resolvedProductId) && productQuery.isLoading;
  const productNotFound =
    Boolean(resolvedProductId) &&
    productQuery.isError &&
    ((productQuery.error as Error & { status?: number })?.status === 404 ||
      productQuery.error?.message?.includes("404") ||
      productQuery.error?.message?.toLowerCase().includes("не найден"));
  const resolveData = resolveQuery.data;
  const legacyResolveFailed =
    !hasUuidId &&
    !resolveQuery.isLoading &&
    resolveData?.success === true &&
    resolveData.result !== "matched";
  const showNotFound = legacyResolveFailed || productNotFound;

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

          {showNotFound ? (
            <div
              className="flex flex-col items-center gap-3 py-8 text-center"
              data-testid="page-showcase-presentation-not-found"
            >
              <p className="text-sm text-muted-foreground">Модель не найдена в каталоге 1С</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/catalog">Открыть в каталоге</Link>
              </Button>
            </div>
          ) : null}

          {!showNotFound && !isResolving && !isLoadingProduct && product ? (
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
                  {hideMatrixMeta
                    ? `Тип: ${model.typeLabelRu}`
                    : `Тип: ${model.typeLabelRu} · Приоритет матрицы: ${priorityLabelRu(model.basePriority)}`}
                </p>
              </div>

              {catalogHref ? (
                <Button asChild variant="outline" size="sm" className="h-9 w-full sm:w-auto">
                  <Link href={catalogHref}>Открыть полную карточку</Link>
                </Button>
              ) : null}

              <Separator />
              <Block title="Презентация" children={presentationText} />
              <Block title="Характеристики" children={characteristicsText} />
              <Block title="Преимущества" children={advantagesText} />
              <Block title="Выгоды для покупателя" children={benefitsBuyerText} />
              <Block title="Выгоды для дилера" children={benefitsDealerText} />
              <Block title="Работа с возражениями" children={objectionsText} />

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-message"
                  disabled={!presentationText.trim()}
                  title={!presentationText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyPresentation}
                >
                  Скопировать презентацию
                </Button>
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
                  variant="outline"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-benefits-buyer"
                  disabled={!benefitsBuyerText.trim()}
                  title={!benefitsBuyerText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyBenefitsBuyer}
                >
                  Скопировать выгоды клиенту
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                  data-testid="button-showcase-copy-benefits-dealer"
                  disabled={!benefitsDealerText.trim()}
                  title={!benefitsDealerText.trim() ? "Нет данных" : undefined}
                  onClick={handleCopyBenefitsDealer}
                >
                  Скопировать выгоды дилеру
                </Button>
                {objectionsText ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
                    data-testid="button-showcase-copy-objections"
                    onClick={handleCopyObjections}
                  >
                    Скопировать работу с возражениями
                  </Button>
                ) : null}
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
