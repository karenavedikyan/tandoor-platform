import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { Camera, ChevronRight, MapPin, PieChart, Plus, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getDealerById, getTradePointByIds, type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getTradePointProductPreview, tradePointShowcaseStatusForProduct } from "@/lib/catalog-data";
import {
  filterMatrix,
  getTradePointMatrix,
  summarizeMatrix,
  type MatrixFilterId,
  type MatrixPresenceStatus,
  type TradePointProductMatrixItem,
} from "@/lib/trade-point-matrix-data";

const SECTION_IDS = ["overview", "matrix", "showcase", "distribution", "tasks", "history", "photos"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-overview",
  matrix: "section-trade-point-matrix",
  showcase: "trade-point-section-showcase",
  distribution: "trade-point-section-distribution",
  tasks: "trade-point-section-tasks",
  history: "trade-point-section-history",
  photos: "trade-point-section-photos",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Общее",
  matrix: "Матрица",
  showcase: "Витрина",
  distribution: "Дистрибуция",
  tasks: "Задачи",
  history: "История",
  photos: "Фото",
};

const NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-nav-overview",
  matrix: "trade-point-section-nav-matrix",
  showcase: "trade-point-section-nav-showcase",
  distribution: "trade-point-section-nav-distribution",
  tasks: "trade-point-section-nav-tasks",
  history: "trade-point-section-nav-history",
  photos: "trade-point-section-nav-photos",
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

function priorityClass(p: "Высокий" | "Средний" | "Низкий") {
  if (p === "Высокий") return "border-red-200 bg-red-50 text-red-900";
  if (p === "Средний") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

const MATRIX_FILTERS: { id: MatrixFilterId; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-trade-point-matrix-all" },
  { id: "present", label: "Есть на витрине", testId: "filter-trade-point-matrix-present" },
  { id: "missing", label: "Нет на витрине", testId: "filter-trade-point-matrix-missing" },
  { id: "zone-a", label: "Зона A", testId: "filter-trade-point-matrix-zone-a" },
  { id: "entrance", label: "Входные", testId: "filter-trade-point-matrix-entrance" },
  { id: "interior", label: "Межкомнатные", testId: "filter-trade-point-matrix-interior" },
];

function presenceTone(p: MatrixPresenceStatus) {
  if (p === "есть на витрине") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (p === "нужно добавить") return "border-red-200 bg-red-50 text-red-900";
  if (p === "на проверке") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function zoneTone(zone: "A" | "B" | "C") {
  if (zone === "A") return "border-primary/40 bg-primary/10 text-primary";
  if (zone === "B") return "border-border bg-muted text-foreground";
  return "border-border bg-muted/60 text-muted-foreground";
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

function TradePointSectionNav({ active, variant }: { active: SectionId; variant: "sidebar" | "chips" }) {
  const onNav = useCallback((id: SectionId) => scrollToSection(id), []);

  if (variant === "sidebar") {
    return (
      <nav
        className="sticky top-24 space-y-1 rounded-2xl border border-border/80 bg-card p-3 shadow-md"
        aria-label="Разделы торговой точки"
        data-testid="trade-point-section-nav"
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
      data-testid="trade-point-section-nav"
    >
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Разделы торговой точки"
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

function TradePointNotFound({ dealerId }: { dealerId?: string }) {
  const dealer = dealerId ? getDealerById(dealerId) : undefined;
  const showDealerBack = Boolean(dealer);

  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-trade-point-not-found">
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card" data-testid="button-back-to-dealer-base">
          <Link href="/dealer-base">К клиентской базе</Link>
        </Button>
        {showDealerBack && dealer ? (
          <Button asChild variant="default" className="min-h-11 w-full font-semibold" data-testid="button-back-to-dealer-card">
            <Link href={`/dealers/${dealer.id}`}>К карточке дилера</Link>
          </Button>
        ) : null}
      </div>
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Торговая точка не найдена</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Проверьте номер точки или вернитесь к карточке дилера.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function distributionConclusion(d: DealerTradePoint["distribution"]) {
  if (d.total >= 70) return "Показатели в комфортной зоне, поддерживаем текущий уровень.";
  if (d.total >= 50) return "Есть резерв по ВХ и полноте линейки на точке.";
  return "Нужны меры по усилению дистрибуции и контролю выкладки.";
}

function MatrixSummary({ items }: { items: TradePointProductMatrixItem[] }) {
  const summary = useMemo(() => summarizeMatrix(items), [items]);
  const tiles = [
    { label: "Должно быть", value: summary.totalRequired, tone: "border-border bg-muted/40 text-foreground" },
    { label: "На витрине", value: summary.totalPresent, tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
    { label: "Отсутствует", value: summary.totalMissing, tone: "border-red-200 bg-red-50 text-red-900" },
    { label: "На проверке", value: summary.totalUnderReview, tone: "border-amber-200 bg-amber-50 text-amber-950" },
  ];

  return (
    <SurfaceCard data-testid="card-trade-point-matrix-summary">
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Портал входных дверей
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <span className="tabular-nums">{summary.entrancePresent}</span>
              <span className="text-muted-foreground"> / {summary.entranceRequired}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Портал межкомнатных дверей
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              <span className="tabular-nums">{summary.interiorPresent}</span>
              <span className="text-muted-foreground"> / {summary.interiorRequired}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

function MatrixItemCard({ item }: { item: TradePointProductMatrixItem }) {
  return (
    <SurfaceCard data-testid={`card-trade-point-matrix-item-${item.productId}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-foreground">{item.productName}</p>
            <p className="font-mono text-xs text-muted-foreground">{item.productArticle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="outline" className={cn("font-medium", presenceTone(item.presence))}>
              {item.presence}
            </Badge>
            <Badge variant="outline" className={cn("font-medium", zoneTone(item.zone))}>
              Зона {item.zone}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Категория</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{item.doorCategory}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Портал</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{item.portal}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Образцы</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {item.actualSamples} / {item.targetSamples}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Действие</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{item.action}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Приоритет</p>
            <p className="mt-0.5">
              <Badge variant="outline" className={cn("font-medium", priorityClass(item.priority))}>
                {item.priority}
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Проверено</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{item.lastCheckedAt}</p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          className="min-h-10 w-full border-border bg-card sm:w-auto"
          data-testid={`button-open-matrix-product-${item.productId}`}
        >
          <Link href={`/catalog/${item.productId}`}>Открыть модель</Link>
        </Button>
      </CardContent>
    </SurfaceCard>
  );
}

function TradePointDetailContent({ dealer, point }: { dealer: DealerRow; point: DealerTradePoint }) {
  const activeSection = useActiveSection();
  const dist = point.distribution;
  const conclusion = useMemo(() => distributionConclusion(dist), [dist]);
  const showcaseComment = useMemo(
    () => (dealer.hasProblem ? "Есть вопросы по витрине — согласовать с РМ план работ." : "Состояние в норме для текущего цикла."),
    [dealer.hasProblem],
  );
  const tpProducts = useMemo(() => getTradePointProductPreview(dealer.id, point.id, 5), [dealer.id, point.id]);
  const matrixItems = useMemo(() => getTradePointMatrix(dealer.id, point.id), [dealer.id, point.id]);
  const matrixSummary = useMemo(() => summarizeMatrix(matrixItems), [matrixItems]);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilterId>("all");
  const filteredMatrix = useMemo(() => filterMatrix(matrixItems, matrixFilter), [matrixItems, matrixFilter]);

  const breadcrumbDealerLabel = `Дилер №${dealer.id}`;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="page-trade-point-detail">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card sm:w-auto" data-testid="button-back-to-dealer-card">
          <Link href={`/dealers/${dealer.id}`}>Назад к дилеру</Link>
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
        <Link href={`/dealers/${dealer.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
          {breadcrumbDealerLabel}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-foreground">Торговая точка</span>
      </nav>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-border bg-muted/50 px-2.5 py-0.5 font-medium">
              № {point.id}
            </Badge>
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-950">
              {point.status}
            </Badge>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <Store className="mt-1 h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{point.name}</h1>
              <p className="mt-1 break-words text-base text-muted-foreground sm:text-lg">
                {point.city} · {point.address}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Формат: </span>
              <span className="font-medium text-foreground">{point.format}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Ответственный РМ: </span>
              <span className="font-medium text-foreground">{point.responsibleRegionalManager}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Ближайший визит: </span>
              <span className="font-medium text-foreground">{point.nextVisitDate}</span>
            </p>
          </div>
        </div>
      </div>

      <TradePointSectionNav active={activeSection} variant="chips" />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
          <section
            id={SECTION_DOM_IDS.overview}
            data-testid="section-trade-point-overview"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Основные сведения по точке.">Общее</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-0 pt-5">
                <FieldRow label="Адрес" value={point.address} icon={MapPin} />
                <FieldRow label="Город" value={point.city} />
                <FieldRow label="Формат" value={point.format} />
                <FieldRow label="Статус" value={point.status} />
                <FieldRow label="Склад фурнитуры" value={point.hardwareStockStatus} />
                <FieldRow label="Склад дверей" value={point.doorsStockStatus} />
                <FieldRow label="Оборудование" value={point.equipment} />
                <FieldRow label="Ответственный РМ" value={point.responsibleRegionalManager} />
                <FieldRow label="Последний визит" value={point.lastVisitDate} />
                <FieldRow label="Следующий визит" value={point.nextVisitDate} />
              </CardContent>
            </SurfaceCard>
          </section>

          <section
            id={SECTION_DOM_IDS.matrix}
            data-testid="section-trade-point-matrix"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Позиции каталога, которые должны быть представлены в этой торговой точке.">
              Матрица товаров
            </SectionTitle>
            <MatrixSummary items={matrixItems} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Выберите модель в каталоге и добавьте её в матрицу точки.
              </p>
              <Button
                asChild
                variant="default"
                className="min-h-10 font-semibold"
                data-testid="button-add-products-from-catalog"
              >
                <Link href="/catalog">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Добавить из каталога
                </Link>
              </Button>
            </div>

            <div
              className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
              role="tablist"
              aria-label="Фильтры матрицы товаров"
            >
              <div className="flex gap-2 pb-1">
                {MATRIX_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={matrixFilter === f.id}
                    onClick={() => setMatrixFilter(f.id)}
                    data-testid={f.testId}
                    className={cn(
                      "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
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

            {filteredMatrix.length === 0 ? (
              <SurfaceCard>
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  По выбранному фильтру позиций нет.
                </CardContent>
              </SurfaceCard>
            ) : (
              <div className="space-y-3">
                {filteredMatrix.map((item) => (
                  <MatrixItemCard key={item.productId} item={item} />
                ))}
              </div>
            )}
          </section>

          <section
            id={SECTION_DOM_IDS.showcase}
            data-testid="section-trade-point-showcase"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Состояние витрины и план по точке.">Витрина</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-0 pt-5">
                <FieldRow label="Статус витрины" value={point.showcaseStatus} />
                <FieldRow label="Что нужно добавить" value={point.showcaseNeeds} />
                <FieldRow label="Оборудование" value={point.equipment} />
                <FieldRow label="Комментарий" value={showcaseComment} />
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Должно быть
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                      {matrixSummary.totalRequired}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80">
                      На витрине
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-900">
                      {matrixSummary.totalPresent}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-900/80">
                      Отсутствует
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-red-900">
                      {matrixSummary.totalMissing}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">Зона A</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{matrixSummary.zoneA}</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <p className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">Ближайшее действие: </span>
                  {dealer.nextAction}
                </p>
              </CardContent>
            </SurfaceCard>

            <div className="mt-6" data-testid="section-trade-point-products">
              <SectionTitle subtitle="Позиции каталога на витрине точки.">Модели на витрине</SectionTitle>
              <div className="mt-3 space-y-3">
                {tpProducts.map((p) => (
                  <SurfaceCard key={p.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold leading-snug text-foreground">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.article}</p>
                        <Badge variant="outline" className="w-fit border-border bg-muted/50 text-xs font-medium">
                          {tradePointShowcaseStatusForProduct(p)}
                        </Badge>
                      </div>
                      <Button asChild variant="outline" className="min-h-10 shrink-0 border-border bg-card" data-testid={`button-open-product-${p.id}`}>
                        <Link href={`/catalog/${p.id}`}>Открыть модель</Link>
                      </Button>
                    </CardContent>
                  </SurfaceCard>
                ))}
              </div>
            </div>
          </section>

          <section
            id={SECTION_DOM_IDS.distribution}
            data-testid="section-trade-point-distribution"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Показатели по линейке на точке.">Дистрибуция</SectionTitle>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {[
                { label: "МК", pct: dist.mk },
                { label: "ВХ", pct: dist.vh },
                { label: "Общее", pct: dist.total },
              ].map((item) => (
                <SurfaceCard key={item.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-primary" aria-hidden />
                      <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-foreground">{item.pct}%</span>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <Progress value={item.pct} className="h-2.5 bg-muted" />
                  </CardContent>
                </SurfaceCard>
              ))}
            </div>
            <SurfaceCard>
              <CardContent className="pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Вывод</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{conclusion}</p>
              </CardContent>
            </SurfaceCard>
          </section>

          <section id={SECTION_DOM_IDS.tasks} data-testid="section-trade-point-tasks" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Задачи по этой торговой точке.">Задачи</SectionTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {point.tasks.map((task, idx) => (
                <SurfaceCard key={`${point.id}-task-${idx}`}>
                  <CardHeader className="space-y-2 pb-2 pt-4">
                    <CardTitle className="text-base font-semibold leading-snug">{task.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("font-medium", priorityClass(task.priority))}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-muted/60 font-medium">
                        {task.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4 text-sm text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Срок:</span> {task.due}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Ответственный:</span> {task.assignee}
                    </p>
                  </CardContent>
                </SurfaceCard>
              ))}
            </div>
          </section>

          <section id={SECTION_DOM_IDS.history} data-testid="section-trade-point-history" className="scroll-mt-28 space-y-4 sm:scroll-mt-32">
            <SectionTitle subtitle="Визиты и изменения по точке.">История</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="divide-y divide-border pt-2">
                {point.activityHistory.map((ev, idx) => (
                  <div
                    key={`${point.id}-act-${idx}`}
                    className="flex flex-col gap-1 py-4 first:pt-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm font-medium text-foreground">{ev.text}</p>
                    <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{ev.date}</time>
                  </div>
                ))}
              </CardContent>
            </SurfaceCard>
            <SurfaceCard>
              <CardContent className="pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Комментарии и внимание</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{point.issues}</p>
              </CardContent>
            </SurfaceCard>
          </section>

          <section id={SECTION_DOM_IDS.photos} data-testid="section-trade-point-photos" className="scroll-mt-28 space-y-4 pb-2 sm:scroll-mt-32">
            <SectionTitle subtitle="Визуальные материалы по точке.">Фото</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/50 p-6">
                  <Camera className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Фотографии не прикреплены</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Здесь будут фото торговой точки, витрины и оборудования.
                    </p>
                  </div>
                </div>
              </CardContent>
            </SurfaceCard>
          </section>
        </div>

        <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
          <TradePointSectionNav active={activeSection} variant="sidebar" />
        </aside>
      </div>
    </div>
  );
}

export function TradePointDetailPage() {
  const params = useParams<{ dealerId: string; pointId: string }>();
  const rawDealer = params.dealerId ?? "";
  const rawPoint = params.pointId ?? "";
  const result = getTradePointByIds(rawDealer, rawPoint);

  if (!result) {
    return <TradePointNotFound dealerId={rawDealer} />;
  }

  return <TradePointDetailContent dealer={result.dealer} point={result.point} />;
}
