import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { Building2, ChevronRight, Clock, MapPin, Package, Store, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { ProductDetailSkeleton } from "@/components/skeletons/product-detail-skeleton";
import { getProductById, type CatalogProduct } from "@/lib/catalog-data";
import {
  getMatrixPresencesForProduct,
  getTradePointMatrix,
  type MatrixPresenceStatus,
} from "@/lib/trade-point-matrix-data";
import {
  getMatrixTaskHintForProductInPoint,
  MATRIX_TASK_TYPE_LABEL,
  type MatrixTaskPriority,
  type MatrixTaskType,
} from "@/lib/trade-point-task-data";
import { getTrainingMaterialsForProduct, getTrainingProgramsForProduct } from "@/lib/training-data";

const SECTION_IDS = ["overview", "specs", "variants", "showcases", "dealers", "tasks", "history"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "product-section-overview",
  specs: "product-section-specs",
  variants: "product-section-variants",
  showcases: "product-section-showcases",
  dealers: "product-section-dealers",
  tasks: "product-section-tasks",
  history: "product-section-history",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Общее",
  specs: "Характеристики",
  variants: "Комплектация и варианты",
  showcases: "Витрины",
  dealers: "Дилеры и точки",
  tasks: "Задачи",
  history: "История",
};

const NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "product-section-nav-overview",
  specs: "product-section-nav-specs",
  variants: "product-section-nav-variants",
  showcases: "product-section-nav-showcases",
  dealers: "product-section-nav-dealers",
  tasks: "product-section-nav-tasks",
  history: "product-section-nav-history",
};

function scrollToSection(id: SectionId) {
  document.getElementById(SECTION_DOM_IDS[id])?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionTitle({ children, subtitle, className }: { children: ReactNode; subtitle?: string; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{children}</h2>
      {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function FieldRow({ label, value, icon: Icon }: { label: string; value: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex gap-3 border-b border-border py-3 last:border-0 sm:items-start sm:gap-4">
      {Icon ? (
        <span className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground sm:text-[15px]">{value}</p>
      </div>
    </div>
  );
}

function SurfaceCard({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<typeof Card>) {
  return (
    <Card className={cn("rounded-2xl border border-border/80 bg-card shadow-md", className)} {...rest}>
      {children}
    </Card>
  );
}

function ProductGallery({ product }: { product: CatalogProduct }) {
  const slides = useMemo(() => {
    if (product.catalogImages?.length) return product.catalogImages;
    if (product.image) return [{ src: product.image, alt: product.name }];
    return [];
  }, [product.catalogImages, product.image, product.name]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [product.id]);

  const current = slides[active] ?? slides[0];

  if (!slides.length || !current) {
    return (
      <div className="flex h-full min-h-[260px] w-full flex-col items-center justify-center bg-muted/50 p-6 text-center">
        <Package className="h-12 w-12 text-muted-foreground/70" aria-hidden />
        <p className="mt-3 text-sm font-medium text-muted-foreground">{product.doorKind} · серия «{product.series}»</p>
        <p className="mt-1 text-xs text-muted-foreground">Файл изображения не прикреплён в каталоге</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="section-product-gallery">
      <div className="relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-[#F7F8FB] px-3 py-4 sm:min-h-[260px] sm:px-5 sm:py-6">
        <img
          src={current.src}
          alt={current.alt}
          className="mx-auto h-auto max-h-[min(52vh,420px)] w-auto max-w-full object-contain md:max-h-[360px]"
          loading="eager"
          decoding="async"
          data-testid="image-product-gallery-main"
        />
      </div>
      {slides.length > 1 ? (
        <div
          className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:gap-2.5 [&::-webkit-scrollbar]:h-1.5"
          aria-label="Дополнительные фото"
        >
          {slides.map((s, idx) => (
            <button
              key={`${s.src}-${idx}`}
              type="button"
              onClick={() => setActive(idx)}
              data-testid={`button-product-gallery-thumb-${idx}`}
              className={cn(
                "shrink-0 rounded-lg border-2 bg-card p-1 transition-colors",
                active === idx ? "border-primary shadow-sm" : "border-border hover:border-primary/40",
              )}
            >
              <img
                src={s.src}
                alt=""
                className="h-14 w-14 object-contain sm:h-16 sm:w-16"
                loading="lazy"
                decoding="async"
                data-testid={`image-product-gallery-thumb-${idx}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useActiveSection() {
  const [active, setActive] = useState<SectionId>("overview");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const first = visible[0];
        if (!first?.target.id) return;
        const found = SECTION_IDS.find((sid) => SECTION_DOM_IDS[sid] === first.target.id);
        if (found) setActive(found);
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );
    SECTION_IDS.forEach((sid) => {
      const el = document.getElementById(SECTION_DOM_IDS[sid]);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

function ProductSectionNav({ active, variant }: { active: SectionId; variant: "sidebar" | "chips" }) {
  const onNav = useCallback((id: SectionId) => scrollToSection(id), []);
  if (variant === "sidebar") {
    return (
      <nav
        className="sticky top-24 space-y-1 rounded-2xl border border-border/80 bg-card p-3 shadow-md"
        aria-label="Разделы карточки товара"
        data-testid="product-section-nav"
      >
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Разделы</p>
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onNav(id)}
            data-testid={NAV_TEST_IDS[id]}
            className={cn(
              "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
              active === id
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {SECTION_LABELS[id]}
          </button>
        ))}
      </nav>
    );
  }
  return (
    <div
      className="sticky top-[4.25rem] z-30 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:-mx-5 sm:px-5 lg:hidden"
      data-testid="product-section-nav"
    >
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Разделы карточки товара"
      >
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => onNav(id)}
            data-testid={NAV_TEST_IDS[id]}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              active === id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {SECTION_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

type ProductTask = { title: string; priority: string; status: string; due: string; assignee: string };

function buildProductTasks(product: CatalogProduct): ProductTask[] {
  const pool: ProductTask[] = [
    { title: "Согласовать выкладку на витрине", priority: "Высокий", status: "В работе", due: "28.05.2026", assignee: "Региональный менеджер" },
    { title: "Проверить наличие на складе", priority: "Средний", status: "Новая", due: "02.06.2026", assignee: "Менеджер продаж" },
    { title: "Обновить материалы для дилеров", priority: "Низкий", status: "Запланирована", due: "10.06.2026", assignee: "Ассистент отдела" },
    { title: "Согласовать фото для каталога", priority: "Средний", status: "В работе", due: "15.06.2026", assignee: "Маркетинг" },
  ];
  const n = Math.min(product.relatedTaskCount, 4);
  if (n <= 0) return pool.slice(0, 2);
  return pool.slice(0, Math.max(2, n));
}

function priorityClass(p: string) {
  if (p === "Высокий") return "border-red-200 bg-red-50 text-red-900";
  if (p === "Средний") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function ProductBadges({ product }: { product: CatalogProduct }) {
  return (
    <div className="flex flex-wrap gap-2">
      {product.isTop ? (
        <Badge variant="outline" className="border-primary/40 bg-primary/15 font-semibold">
          Хит
        </Badge>
      ) : null}
      {product.isNew ? (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-950">
          Новинка
        </Badge>
      ) : null}
      {product.isExclusive ? (
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-950">
          Эксклюзив
        </Badge>
      ) : null}
      {product.isAction ? (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-950">
          Акция
        </Badge>
      ) : null}
      <Badge variant="outline" className="rounded-full border-border bg-muted/50">
        {product.status}
      </Badge>
      <Badge variant="outline" className={cn("rounded-full", product.inStock ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950")}>
        {product.inStock ? "В наличии" : "Под заказ"}
      </Badge>
    </div>
  );
}

function ProductNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-product-not-found">
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Товар не найден</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Проверьте артикул или вернитесь в каталог.</p>
          <Button asChild className="w-full min-h-11 font-semibold" data-testid="button-back-to-catalog">
            <Link href="/catalog">К каталогу</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function presenceTone(p: MatrixPresenceStatus) {
  if (p === "есть на витрине") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (p === "нужно добавить") return "border-red-200 bg-red-50 text-red-900";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function ProductFound({ product }: { product: CatalogProduct }) {
  const active = useActiveSection();
  const tasks = useMemo(() => buildProductTasks(product), [product]);
  const matrixPresences = useMemo(() => getMatrixPresencesForProduct(product.id), [product.id]);
  const presenceByPoint = useMemo(() => {
    const map = new Map<string, { presence: MatrixPresenceStatus; zone: "A" | "B" | "C" }>();
    for (const p of matrixPresences) map.set(p.pointId, { presence: p.presence, zone: p.zone });
    return map;
  }, [matrixPresences]);
  const taskHintByPoint = useMemo(() => {
    const map = new Map<string, { type: MatrixTaskType; priority: MatrixTaskPriority }>();
    for (const tpId of product.relatedTradePointIds) {
      const dealerId = tpId.split("-")[0] ?? "";
      if (!dealerId) continue;
      const matrix = getTradePointMatrix(dealerId, tpId);
      const hint = getMatrixTaskHintForProductInPoint(matrix, product.id);
      if (hint) map.set(tpId, hint);
    }
    return map;
  }, [product.id, product.relatedTradePointIds]);
  const trainingMaterials = useMemo(() => getTrainingMaterialsForProduct(product.id), [product.id]);
  const trainingPrograms = useMemo(() => getTrainingProgramsForProduct(product.id), [product.id]);

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="page-product-detail">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card sm:w-auto" data-testid="button-back-to-catalog">
          <Link href="/catalog">Назад к каталогу</Link>
        </Button>
        <Button asChild variant="secondary" className="min-h-11 w-full border-border sm:w-auto" data-testid="button-back-to-dealer-base">
          <Link href="/dealer-base">К клиентской базе</Link>
        </Button>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm" aria-label="Навигация">
        <Link href="/dealer-base" className="font-medium text-foreground underline-offset-4 hover:underline">
          Клиентская база
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href="/catalog" className="font-medium text-foreground underline-offset-4 hover:underline">
          Каталог
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="min-w-0 truncate font-medium text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:col-span-5">
          <ProductGallery product={product} />
        </div>
        <div className="space-y-4 lg:col-span-7">
          <ProductBadges product={product} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{product.name}</h1>
          <p className="font-mono text-sm text-muted-foreground sm:text-base">Артикул: {product.article}</p>
          <p className="text-sm text-muted-foreground sm:text-base">
            {product.category} · серия «{product.series}» · {product.doorKind.toLowerCase()}
          </p>
          <p className="text-sm text-muted-foreground">
            Покрытие: <span className="font-medium text-foreground">{product.coating}</span>
            {" · "}
            Размеры:{" "}
            <span className="font-medium text-foreground">{product.sizes.length ? product.sizes.join(", ") : "—"}</span>
          </p>
          {typeof product.priceRetailRub === "number" ? (
            <p className="text-sm text-muted-foreground">
              Ориентир по цене с публичной витрины:{" "}
              <span className="font-semibold text-foreground">
                {product.priceRetailRub.toLocaleString("ru-RU")} ₽
              </span>
            </p>
          ) : null}
          {product.sourcePublicUrl ? (
            <p className="text-sm">
              <a
                href={product.sourcePublicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
                data-testid="link-product-public-page"
              >
                Открыть карточку на сайте Tandoor
              </a>
            </p>
          ) : null}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <SurfaceCard>
              <CardContent className="pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Приоритет продаж</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{product.salesPriority}</p>
              </CardContent>
            </SurfaceCard>
            <SurfaceCard>
              <CardContent className="pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Приоритет витрины</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{product.showcasePriority}</p>
              </CardContent>
            </SurfaceCard>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{product.shortDescription}</p>
        </div>
      </div>

      <ProductSectionNav active={active} variant="chips" />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
          <section id={SECTION_DOM_IDS.overview} data-testid="section-product-overview" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Описание и классификация модели.">Общее</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-4 pt-5">
                <FieldRow label="Название" value={product.name} />
                <FieldRow label="Артикул" value={product.article} />
                <FieldRow label="Категория" value={product.category} />
                <FieldRow label="Серия" value={product.series} />
                <FieldRow label="Вид двери" value={product.doorKind} />
                <FieldRow label="Производитель" value={product.manufacturer} />
                <FieldRow label="Гарантия" value={product.warranty} />
                <FieldRow label="Статус" value={product.status} />
                <Separator />
                <p className="text-sm leading-relaxed text-foreground">{product.description}</p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ключевые особенности</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {product.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Рекомендация для витрины</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {product.recommendedForShowcase ? "Рекомендуется к выкладке и обучению продавцов." : "По согласованию с региональным менеджером."}
                  </p>
                </div>
              </CardContent>
            </SurfaceCard>
          </section>

          <section data-testid="section-product-training-materials" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Материалы из раздела обучения, где упоминается эта модель.">Обучение и база знаний</SectionTitle>
            {trainingMaterials.length === 0 ? (
              <SurfaceCard className="mt-3">
                <CardContent className="py-6 text-sm text-muted-foreground">Для этой модели пока нет привязанных материалов в разделе обучения.</CardContent>
              </SurfaceCard>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {trainingMaterials.map((m) => (
                  <SurfaceCard key={m.id}>
                    <CardHeader className="space-y-2 pb-2 pt-4">
                      <CardTitle className="text-base font-semibold leading-snug">{m.title}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {m.readTimeMinutes} мин
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-medium">
                          Прогресс {m.progressPercent}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4 pt-0">
                      <p className="text-sm text-muted-foreground">{m.description}</p>
                      <Button asChild variant="outline" size="sm" className="mt-4 w-full font-semibold sm:w-auto" data-testid={`button-open-product-training-material-${m.id}`}>
                        <Link href={`/training/${m.id}`}>Открыть материал</Link>
                      </Button>
                    </CardContent>
                  </SurfaceCard>
                ))}
              </div>
            )}
          </section>

          {trainingPrograms.length > 0 ? (
            <section data-testid="section-product-training-programs" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
              <SectionTitle subtitle="Программы обучения, где участвует эта модель.">Программы обучения</SectionTitle>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                {trainingPrograms.map((prog) => (
                  <SurfaceCard key={prog.id}>
                    <CardHeader className="space-y-1 pb-2 pt-4">
                      <CardTitle className="text-base font-semibold leading-snug">{prog.title}</CardTitle>
                      <p className="text-xs text-muted-foreground line-clamp-2">{prog.description}</p>
                    </CardHeader>
                    <CardContent className="pb-4 pt-0">
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="mt-2 w-full font-semibold sm:w-auto"
                        data-testid={`button-open-product-training-program-${prog.id}`}
                      >
                        <Link href={`/training/programs/${prog.id}`}>Открыть программу</Link>
                      </Button>
                    </CardContent>
                  </SurfaceCard>
                ))}
              </div>
            </section>
          ) : null}

          <section id={SECTION_DOM_IDS.specs} data-testid="section-product-specs" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Технические параметры полотна и фурнитуры.">Характеристики</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="pt-5">
                {product.specs.map((s) => (
                  <FieldRow key={s.label} label={s.label} value={s.value} />
                ))}
                <Separator className="my-4" />
                <FieldRow label="Покрытие" value={product.coating} />
                <FieldRow label="Тип открывания" value={product.openType} />
                <FieldRow label="Цвета" value={product.colors.join(", ")} />
                <FieldRow label="Размеры / исполнения" value={product.sizes.join(", ")} />
              </CardContent>
            </SurfaceCard>
          </section>

          <section id={SECTION_DOM_IDS.variants} data-testid="section-product-variants" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Состав поставки и варианты исполнения.">Комплектация и варианты</SectionTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SurfaceCard>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base">В комплекте</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <ul className="space-y-2 text-sm text-foreground">
                    {product.equipment.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="text-primary" aria-hidden>·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </SurfaceCard>
              <SurfaceCard>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base">Варианты исполнения</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  {product.variants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Без дополнительных вариантов.</p>
                  ) : (
                    product.variants.map((v) => <FieldRow key={v.label} label={v.label} value={v.value} />)
                  )}
                </CardContent>
              </SurfaceCard>
            </div>
          </section>

          <section id={SECTION_DOM_IDS.showcases} data-testid="section-product-showcases" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Приоритет выкладки и рекомендации мерчандайзинга.">Витрины и мерчандайзинг</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-3 pt-5 text-sm">
                <p>
                  <span className="text-muted-foreground">Приоритет витрины: </span>
                  <span className="font-semibold text-foreground">{product.showcasePriority} из 10</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Рекомендация: </span>
                  <span className="font-medium text-foreground">
                    {product.recommendedForShowcase
                      ? "Включить в основную витрину и стенд серии."
                      : "Использовать точечно или после пополнения склада."}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Связь с продажами: приоритет в отчётах отдела соответствует значению{" "}
                  <span className="font-mono font-medium text-foreground">{product.salesPriority}</span>.
                </p>
                <Separator />
                <p className="text-muted-foreground">
                  Рекомендованная комплектация для стенда: <span className="font-medium text-foreground">{product.equipment.slice(0, 3).join(", ")}</span>
                  {product.equipment.length > 3 ? " и др." : "."}
                </p>
              </CardContent>
            </SurfaceCard>
          </section>

          <section id={SECTION_DOM_IDS.dealers} data-testid="section-product-dealers" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Клиенты и торговые точки, где модель в работе.">Дилеры и торговые точки</SectionTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SurfaceCard>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden />
                    <CardTitle className="text-base">Дилеры</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {product.relatedDealerIds.map((id) => (
                    <Link
                      key={id}
                      href={`/dealers/${id}`}
                      className="flex min-h-10 items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground no-underline transition-colors hover:border-primary/40 hover:bg-muted/50"
                      data-testid={`link-product-dealer-${id}`}
                    >
                      <span>Клиент №{id}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </Link>
                  ))}
                </CardContent>
              </SurfaceCard>
              <SurfaceCard>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" aria-hidden />
                    <CardTitle className="text-base">Торговые точки</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  {product.relatedTradePointIds.map((tpId) => {
                    const dealerId = tpId.split("-")[0] ?? "";
                    const matrixInfo = presenceByPoint.get(tpId);
                    const taskHint = taskHintByPoint.get(tpId);
                    return (
                      <Link
                        key={tpId}
                        href={`/dealers/${dealerId}/trade-points/${tpId}`}
                        className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground no-underline transition-colors hover:border-primary/40 hover:bg-muted/50"
                        data-testid={`link-product-trade-point-${tpId}`}
                      >
                        <span className="min-w-0 flex-1 font-mono text-xs sm:text-sm">ТТ {tpId}</span>
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {matrixInfo ? (
                            <>
                              <Badge variant="outline" className={cn("text-[10px] font-medium", presenceTone(matrixInfo.presence))}>
                                {matrixInfo.presence}
                              </Badge>
                              <Badge variant="outline" className="border-border bg-muted/60 text-[10px] font-medium">
                                Зона {matrixInfo.zone}
                              </Badge>
                            </>
                          ) : null}
                          {taskHint ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-medium",
                                taskHint.priority === "high"
                                  ? "border-red-200 bg-red-50 text-red-900"
                                  : "border-amber-200 bg-amber-50 text-amber-950",
                              )}
                              data-testid={`badge-product-trade-point-task-${tpId}`}
                            >
                              Задача: {MATRIX_TASK_TYPE_LABEL[taskHint.type]}
                            </Badge>
                          ) : null}
                        </span>
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    );
                  })}
                </CardContent>
              </SurfaceCard>
            </div>
          </section>

          <section id={SECTION_DOM_IDS.tasks} data-testid="section-product-tasks" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Задачи по продаже и выставлению модели.">Задачи</SectionTitle>
            <p className="text-xs text-muted-foreground">Всего в учёте: {product.relatedTaskCount}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {tasks.map((t, idx) => (
                <SurfaceCard key={`${product.id}-pt-${idx}`}>
                  <CardHeader className="space-y-2 pb-2 pt-4">
                    <CardTitle className="text-base font-semibold leading-snug">{t.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("font-medium", priorityClass(t.priority))}>
                        {t.priority}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-muted/60 font-medium">
                        {t.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold text-foreground">Ответственный:</span> {t.assignee}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Срок:</span> {t.due}
                    </p>
                  </CardContent>
                </SurfaceCard>
              ))}
            </div>
          </section>

          <section id={SECTION_DOM_IDS.history} data-testid="section-product-history" className="scroll-mt-28 space-y-4 pb-2 sm:scroll-mt-32">
            <SectionTitle subtitle="Изменения по модели и активность отдела.">История</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="pt-5">
                {product.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Записей пока нет.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {product.history.map((h, idx) => (
                      <li key={`${product.id}-h-${idx}`} className="flex gap-3 border-b border-border pb-3 last:border-0">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Clock className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h.date}</p>
                          <p className="mt-0.5 break-words text-sm text-foreground">{h.event}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </SurfaceCard>
          </section>
        </div>

        <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
          <ProductSectionNav active={active} variant="sidebar" />
        </aside>
      </div>

      <FloatingBackButton
        href="/catalog"
        label="К каталогу"
        testId="floating-back-to-catalog"
        ariaLabel="Назад к каталогу"
      />
    </div>
  );
}

export function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const raw = params.productId ?? "";
  const [pageReady, setPageReady] = useState(false);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setPageReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const product = getProductById(raw);
  if (!pageReady) return <ProductDetailSkeleton />;
  if (!product) return <ProductNotFound />;
  return <ProductFound product={product} />;
}
