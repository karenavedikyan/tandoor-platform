import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Camera,
  Handshake,
  LayoutGrid,
  MapPin,
  Phone,
  PieChart,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getClientCategoryBadgeClass, getClientCategoryLabel } from "@/lib/client-category";
import {
  DEALER_BASE_ROWS,
  getDealerById,
  type DealerRow,
  type DealerStatus,
} from "@/lib/dealer-base-mock-data";
import { dealerRowStatusForProduct, getDealerProductPreview } from "@/lib/catalog-data";
import { DealerShowcaseDistributionSection } from "@/components/dealer-showcase-distribution-section";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { getDealerAnalyticsSignalCards } from "@/lib/dealer-analytics-signals";
import { getShowcaseHistoryForDealer, loadShowcaseStorage } from "@/lib/showcase-distribution-data";
import { dealerProductTrainingStorageKey, getDealerTrainingAttentionSignal, trainingAttentionLevelBadgeClass } from "@/lib/training-attention";

const SECTION_IDS = [
  "overview",
  "points",
  "sales",
  "distribution",
  "showcases",
  "training",
  "showcase_distribution",
  "history",
  "tasks",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "dealer-section-overview",
  points: "dealer-section-points",
  sales: "dealer-section-sales",
  distribution: "dealer-section-distribution",
  showcases: "dealer-section-showcases",
  training: "section-dealer-training-attention",
  showcase_distribution: "dealer-section-showcase-distribution",
  history: "dealer-section-history",
  tasks: "dealer-section-tasks",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Общее",
  points: "Точки",
  sales: "Продажи",
  distribution: "Дистрибуция",
  showcases: "Витрины",
  training: "Обучение",
  showcase_distribution: "Витрина и дистрибуция",
  history: "История",
  tasks: "Задачи по витрине",
};

const SECTION_NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "dealer-section-nav-overview",
  points: "dealer-section-nav-points",
  sales: "dealer-section-nav-sales",
  distribution: "dealer-section-nav-distribution",
  showcases: "dealer-section-nav-showcases",
  training: "dealer-section-nav-training",
  showcase_distribution: "dealer-section-nav-showcase-distribution",
  history: "dealer-section-nav-history",
  tasks: "dealer-section-nav-tasks",
};

type TaskPriority = "Высокий" | "Средний" | "Низкий";
type TaskStatus = "Новая" | "В работе" | "Запланирована" | "Закрыта";

type DealerTask = {
  title: string;
  priority: TaskPriority;
  due: string;
  assignee: string;
  status: TaskStatus;
};

function scrollToSection(id: SectionId) {
  const el = document.getElementById(SECTION_DOM_IDS[id]);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
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

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
      <CardHeader className="space-y-1 pb-2 pt-5">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">{value}</CardTitle>
      </CardHeader>
    </Card>
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

function statusBadgeClass(status: DealerStatus) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function parseDealerIndex(id: string): number {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : 0;
}

type DealerHistoryEvent = { id: string; meta: string; body: string };

/** Реалистичная лента для клиентов менеджера Бойко (команда Купянского). */
function buildHistoryEvents(row: DealerRow): DealerHistoryEvent[] {
  const storage = loadShowcaseStorage();
  const showcaseHist: DealerHistoryEvent[] = getShowcaseHistoryForDealer(row.id, storage).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
  }));

  if (row.releaseManagerId === "mgr-boyko-em") {
    return [
      ...showcaseHist,
      {
        id: `${row.id}-hist-call`,
        meta: "14.05.2026 · Бойко Екатерина",
        body: "Звонок: обсудили обновление витрины, клиент готов поставить 3 новые модели.\nСледующее действие: визит 17.05.",
      },
      {
        id: `${row.id}-hist-rop`,
        meta: "13.05.2026 · РОП Купянский",
        body: "Комментарий руководителя: взять клиента в фокус, высокий потенциал.",
      },
      {
        id: `${row.id}-hist-sys`,
        meta: "10.05.2026 · Система",
        body: "Клиент попал в «требует внимания»: нет активности 30 дней.",
      },
    ];
  }

  const i = parseDealerIndex(row.id);
  const templates = [
    "Обновлена информация по торговой точке",
    "Зафиксирован комментарий менеджера",
    "Проверена дистрибуция",
    "Запланировано следующее действие",
  ];
  const dates = [
    row.lastActivity,
    row.issues.date,
    row.distributionDetail.checkDate,
    `${5 + (i % 20)}.${String((i % 8) + 1).padStart(2, "0")}.2026`,
  ];
  return [
    ...showcaseHist,
    ...templates.map((text, idx) => ({
      id: `${row.id}-hist-${idx}`,
      meta: `${dates[idx % dates.length] ?? row.lastActivity} · Система`,
      body: text,
    })),
  ];
}

function buildTasks(row: DealerRow): DealerTask[] {
  const i = parseDealerIndex(row.id);
  const pool: Omit<DealerTask, "status" | "priority">[] = [
    { title: "Проверить актуальность контактов", due: `${12 + (i % 10)}.05.2026`, assignee: row.responsibles.salesManager },
    { title: "Уточнить условия по витрине", due: `${15 + (i % 8)}.05.2026`, assignee: row.responsibles.regionalManager },
    { title: "Запланировать визит", due: `${18 + (i % 7)}.05.2026`, assignee: row.responsibles.regionalManager },
    { title: "Обновить данные по торговым точкам", due: `${22 + (i % 6)}.05.2026`, assignee: row.responsibles.assistant },
  ];
  const statuses: TaskStatus[] = ["Новая", "В работе", "Запланирована", "Закрыта"];
  const priorities: TaskPriority[] = ["Высокий", "Средний", "Низкий"];
  const count = row.status === "требует внимания" ? 4 : row.status === "потенциальный" ? 3 : 2;
  return pool.slice(0, count).map((t, idx) => ({
    ...t,
    status: statuses[(i + idx) % statuses.length],
    priority: priorities[(i + idx * 2) % priorities.length],
  }));
}

function DealerTrainingAttentionSection({ row }: { row: DealerRow }) {
  const storageKey = dealerProductTrainingStorageKey(row.id);
  const [completed, setCompleted] = useState(() => {
    if (typeof window === "undefined") return row.productTrainingCompleted;
    const s = sessionStorage.getItem(storageKey);
    if (s === "1") return true;
    if (s === "0") return false;
    return row.productTrainingCompleted;
  });

  const signal = useMemo(() => getDealerTrainingAttentionSignal(row, completed), [row, completed]);
  const trainingHref =
    signal.suggestedTrainingProgramIds[0] != null
      ? `/training/programs/${signal.suggestedTrainingProgramIds[0]}`
      : "/training";

  return (
    <section
      id={SECTION_DOM_IDS.training}
      data-testid="section-dealer-training-attention"
      className="scroll-mt-28 space-y-4 sm:space-y-6 lg:scroll-mt-32"
    >
      <SectionTitle subtitle="Продуктовое обучение и внимание к персоналу партнёра.">
        Обучение и внимание к персоналу
      </SectionTitle>
      <SurfaceCard data-testid="card-dealer-training-signal">
        <CardHeader className="space-y-2 pb-2 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("font-semibold", trainingAttentionLevelBadgeClass(signal.level))}
              data-testid="badge-dealer-training-level"
            >
              {signal.label}
            </Badge>
            {row.indigoTrainingCandidate ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 font-medium" data-testid="badge-dealer-indigo-candidate">
                VIP: можно подключить обучение ИНДИГО
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Проведено продуктовое обучение от Tandoor: {completed ? "да, потребность закрыта" : "нет — при необходимости запланируйте визит."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {signal.reasons.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Почему система обращает внимание</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                {signal.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {signal.recommendedActions.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Рекомендуемые шаги</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {signal.recommendedActions.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild className="min-h-11 font-semibold" data-testid="button-dealer-open-training">
              <Link href={trainingHref}>
                <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                К обучению
              </Link>
            </Button>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <Checkbox
                id={`dealer-training-done-${row.id}`}
                checked={completed}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setCompleted(next);
                  sessionStorage.setItem(storageKey, next ? "1" : "0");
                }}
                data-testid="checkbox-dealer-product-training-completed"
              />
              <Label htmlFor={`dealer-training-done-${row.id}`} className="cursor-pointer text-sm font-medium leading-snug">
                Проведено продуктовое обучение от Tandoor
              </Label>
            </div>
          </div>
          {row.indigoTrainingCandidate ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Рекомендуется подборка видеоматериалов и контроль прохождения руководителем партнёра. Интеграция с ИНДИГО — на будущее.
            </p>
          ) : null}
        </CardContent>
      </SurfaceCard>
    </section>
  );
}

function priorityClass(p: TaskPriority) {
  if (p === "Высокий") return "border-red-200 bg-red-50 text-red-900";
  if (p === "Средний") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function DealerNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-dealer-not-found">
      <Button asChild className="w-full min-h-11 font-semibold" data-testid="button-back-to-dealer-base">
        <Link href="/dealer-base">Назад к клиентской базе</Link>
      </Button>
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Клиент не найден</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Проверьте номер клиента или вернитесь к клиентской базе.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function useActiveSection(dealerId: string) {
  const [active, setActive] = useState<SectionId>("overview");

  useEffect(() => {
    const opts: IntersectionObserverInit = { root: null, rootMargin: "-20% 0px -55% 0px", threshold: 0 };
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const first = visible[0];
      if (!first?.target.id) return;
      const found = SECTION_IDS.find((sid) => SECTION_DOM_IDS[sid] === first.target.id);
      if (found) setActive(found);
    }, opts);
    SECTION_IDS.forEach((sid) => {
      const el = document.getElementById(SECTION_DOM_IDS[sid]);
      if (el) obs.observe(el);
    });

    return () => {
      obs.disconnect();
    };
  }, [dealerId]);

  return active;
}

function DealerSectionNav({
  active,
  variant,
}: {
  active: SectionId;
  variant: "sidebar" | "chips";
}) {
  const onNav = useCallback((id: SectionId) => {
    scrollToSection(id);
  }, []);

  if (variant === "sidebar") {
    return (
      <nav
        className="sticky top-24 space-y-1 rounded-2xl border border-border/80 bg-card p-3 shadow-md"
        aria-label="Разделы карточки"
        data-testid="dealer-section-nav"
      >
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Разделы</p>
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onNav(id)}
            data-testid={SECTION_NAV_TEST_IDS[id]}
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
      data-testid="dealer-section-nav"
    >
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Разделы карточки"
      >
        {SECTION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => onNav(id)}
            data-testid={SECTION_NAV_TEST_IDS[id]}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors min-h-10",
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

function DealerCardContent({ row }: { row: DealerRow }) {
  const { profile } = useReleaseDemoProfile();
  const [showcaseBump, setShowcaseBump] = useState(0);
  const businessCategoryLabel = getClientCategoryLabel(row.clientCategory);
  const activeSection = useActiveSection(row.id);
  const historyEvents = useMemo(() => buildHistoryEvents(row), [row, showcaseBump]);
  const tasks = useMemo(() => buildTasks(row), [row]);
  const dealerProducts = useMemo(() => getDealerProductPreview(row.id, 5), [row.id]);
  const analyticsSignals = useMemo(() => getDealerAnalyticsSignalCards(row), [row]);

  const salesComment =
    row.hasProblem
      ? "Есть вопросы по витрине и сопровождению — держим в фокусе команды."
      : "Динамика в пределах плана, продолжаем стандартное сопровождение.";

  const distributionConclusion =
    row.distributionDetail.total >= 70
      ? "Показатели в комфортной зоне, точечные доработки по ВХ."
      : row.distributionDetail.total >= 50
        ? "Есть резерв по выкладке и полноте линейки."
        : "Нужны действия по усилению дистрибуции и контролю на точке.";

  const showcaseNext = `Связано с ближайшим шагом: ${row.nextAction}`;

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6" data-testid="page-dealer-card-foundation">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="outline"
          className="min-h-11 w-full shrink-0 border-border bg-card sm:w-auto sm:self-start"
          data-testid="button-back-to-dealer-base"
        >
          <Link href="/dealer-base">Назад к клиентской базе</Link>
        </Button>

        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
            <section
              id={SECTION_DOM_IDS.overview}
              data-testid="section-dealer-overview"
              className="scroll-mt-28 space-y-4 sm:space-y-6 lg:scroll-mt-32"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
                <div className="relative pl-3 sm:pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusBadgeClass(row.status))}>
                      {row.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getClientCategoryBadgeClass(row.clientCategory))}
                      data-testid="text-dealer-card-client-category"
                    >
                      {businessCategoryLabel}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground">
                      Активность: {row.lastActivity}
                    </Badge>
                  </div>
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{row.name}</h1>
                  <p className="mt-1 text-base font-medium text-muted-foreground sm:text-lg">
                    Код {row.releaseCode ?? "—"} · {row.city} · РОП: {row.regionalManager}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground sm:text-base">Сводная информация по клиенту и торговым точкам</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" className="min-h-10" asChild>
                      <Link href="/dealer-base">Назад к базе</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10 border-border bg-card"
                      data-testid="button-quick-open-points"
                      onClick={() => scrollToSection("points")}
                    >
                      Точки
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10 border-border bg-card"
                      data-testid="button-quick-open-tasks"
                      onClick={() => scrollToSection("tasks")}
                    >
                      Задачи по витрине
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10 border-border bg-card"
                      data-testid="button-quick-open-distribution"
                      onClick={() => scrollToSection("distribution")}
                    >
                      Дистрибуция
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10 border-border bg-card"
                      data-testid="button-quick-open-showcase-distribution"
                      onClick={() => scrollToSection("showcase_distribution")}
                    >
                      Витрина
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-h-10 border-border bg-card"
                      data-testid="button-open-all-tasks"
                    >
                      <Link href="/tasks">Все задачи по витрине</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <DealerSectionNav active={activeSection} variant="chips" />

              <div className="grid gap-6 lg:grid-cols-2">
                <div data-testid="section-dealer-summary">
                  <SectionTitle subtitle="Ключевые реквизиты и классификация.">Сводка клиента</SectionTitle>
                  <SurfaceCard className="mt-3">
                    <CardContent className="pt-5">
                      <FieldRow label="Код (Excel)" value={row.releaseCode ?? "—"} />
                      <FieldRow label="Внутренний id" value={row.id} />
                      <FieldRow label="Название клиента" value={row.name} icon={Building2} />
                      <FieldRow label="Категория клиента" value={businessCategoryLabel} />
                      {row.clientTypeLabel ? <FieldRow label="Тип в данных (Excel)" value={row.clientTypeLabel} /> : null}
                      <FieldRow label="Статус" value={row.status.slice(0, 1).toUpperCase() + row.status.slice(1)} />
                      <FieldRow label="Холдинг / сеть" value={row.holding} />
                      <FieldRow label="Юрлицо / наименование" value={row.legalEntity} />
                      <FieldRow label="Город" value={row.city} icon={MapPin} />
                      <FieldRow label="РОП" value={row.regionalManager} />
                      <FieldRow label="Менеджер" value={row.manager} />
                      {row.releaseAddress ? <FieldRow label="Адрес" value={row.releaseAddress} /> : null}
                      <FieldRow label="Формат" value={row.format} />
                      <FieldRow label="Торговых точек" value={String(row.outlets)} />
                    </CardContent>
                  </SurfaceCard>
                </div>

                <div data-testid="section-dealer-responsibles">
                  <SectionTitle subtitle="Кто ведёт клиента и к кому обращаться.">Ответственные</SectionTitle>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      { role: "Руководитель", name: row.responsibles.director, zone: "Стратегия и контроль команды" },
                      { role: "Менеджер продаж", name: row.responsibles.salesManager, zone: "Сопровождение договорённостей и клиента" },
                      { role: "Региональный менеджер", name: row.responsibles.regionalManager, zone: "Визиты, витрины, отчёты по региону" },
                      { role: "Ассистент", name: row.responsibles.assistant, zone: "Подготовка материалов и координация" },
                    ].map((p) => (
                      <SurfaceCard key={p.role}>
                        <CardHeader className="space-y-1 pb-2 pt-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" aria-hidden />
                            <CardDescription className="text-[11px] font-bold uppercase tracking-wide text-primary">{p.role}</CardDescription>
                          </div>
                          <CardTitle className="text-base font-semibold text-foreground">{p.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{p.zone}</CardContent>
                      </SurfaceCard>
                    ))}
                  </div>
                </div>
              </div>

              <SurfaceCard>
                <CardContent className="space-y-3 pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ближайшее действие</p>
                  <p className="text-sm font-semibold text-foreground sm:text-base">{row.nextAction}</p>
                </CardContent>
              </SurfaceCard>

              <section
                data-testid="section-dealer-analytics-signals"
                className="scroll-mt-28 space-y-3 lg:scroll-mt-32"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle subtitle="Сводка по тем же показателям, что в разделе аналитики.">
                    Сигналы аналитики
                  </SectionTitle>
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="min-h-9 w-full shrink-0 font-semibold sm:w-auto"
                    data-testid="button-dealer-signal-open-tasks"
                  >
                    <Link href="/tasks">К задачам по витрине</Link>
                  </Button>
                </div>
                {analyticsSignals.length === 0 ? (
                  <SurfaceCard>
                    <CardContent className="py-4 text-sm text-muted-foreground">
                      По текущему срезу активных сигналов нет.
                    </CardContent>
                  </SurfaceCard>
                ) : (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {analyticsSignals.map((sig) => (
                      <SurfaceCard
                        key={sig.kind}
                        data-testid={`card-dealer-analytics-signal-${sig.kind}`}
                      >
                        <CardHeader className="space-y-1 pb-2 pt-4">
                          <CardDescription className="text-[11px] font-bold uppercase tracking-wide text-primary">
                            {sig.title}
                          </CardDescription>
                          <p className="text-xs leading-relaxed text-muted-foreground">{sig.metric}</p>
                        </CardHeader>
                        <CardContent className="space-y-3 pb-4 text-sm text-muted-foreground">
                          <p className="text-sm text-foreground">{sig.actionHint}</p>
                          {sig.tradePointId ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="min-h-9 w-full border-border bg-card font-semibold sm:w-auto"
                              data-testid={`button-dealer-signal-open-trade-point-${sig.tradePointId}`}
                            >
                              <Link href={`/dealers/${row.id}/trade-points/${sig.tradePointId}`}>К точке</Link>
                            </Button>
                          ) : null}
                        </CardContent>
                      </SurfaceCard>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <div data-testid="section-dealer-terms">
                  <SectionTitle subtitle="Условия сотрудничества.">Условия работы</SectionTitle>
                  <SurfaceCard className="mt-3">
                    <CardContent className="pt-5">
                      <FieldRow label="Тандор клуб" value={row.terms.tandoorClub} icon={Handshake} />
                      <FieldRow label="Спец. условия" value={row.terms.special} />
                      <FieldRow label="Тип оплаты" value={row.terms.payment} />
                      <FieldRow label="ЭДО" value={row.terms.edo} />
                      <FieldRow label="Лимит / индивидуальные условия" value={row.terms.limit} />
                      <FieldRow label="Бонусы / мотивация продавцов" value={row.terms.bonuses} />
                    </CardContent>
                  </SurfaceCard>
                </div>

                <div data-testid="section-dealer-contacts">
                  <SectionTitle subtitle="ЛПР и каналы связи.">Контакты и ЛПР</SectionTitle>
                  <SurfaceCard className="mt-3">
                    <CardContent className="space-y-1 pt-5">
                      <FieldRow label="ЛПР" value={row.contacts.lpr} />
                      <FieldRow label="Собственник / закупщик" value={row.contacts.buyer} />
                      <FieldRow label="Телефон" value={row.contacts.phone} icon={Phone} />
                      <FieldRow label="Email" value={row.contacts.email} />
                      <FieldRow label="Предпочтительный канал связи" value={row.contacts.channel} />
                    </CardContent>
                  </SurfaceCard>
                </div>
              </div>

              <div data-testid="section-dealer-competitors">
                <SectionTitle subtitle="Обзор конкурентной среды.">Конкуренты</SectionTitle>
                <SurfaceCard className="mt-3">
                  <CardContent className="space-y-1 pt-5">
                    <FieldRow label="Конкуренты в торговой точке" value={row.competitors.list} />
                    <FieldRow label="Сильные позиции конкурентов" value={row.competitors.strengths} />
                    <FieldRow label="Комментарий менеджера" value={row.competitors.mgrComment} />
                    <FieldRow label="Комментарий регионального менеджера" value={row.competitors.rmComment} />
                  </CardContent>
                </SurfaceCard>
              </div>

              <div data-testid="section-dealer-problems">
                <SectionTitle subtitle="Текущие вопросы по клиенту.">Проблемы и внимание</SectionTitle>
                <SurfaceCard
                  className={cn(
                    "mt-3 border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-card",
                    !row.hasProblem && "border-border from-muted/30",
                  )}
                >
                  <CardContent className="space-y-4 pt-5">
                    {row.hasProblem ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-amber-300/80 bg-amber-100/60 font-medium text-amber-950">
                          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                          Требует внимания
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-medium text-emerald-900">
                        Без критичных замечаний
                      </Badge>
                    )}
                    <p className={cn("text-sm font-semibold leading-relaxed sm:text-base", row.hasProblem ? "text-red-700" : "text-foreground")}>
                      {row.issues.summary}
                    </p>
                    <div className="grid gap-4 rounded-xl bg-card/80 p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Кто зафиксировал</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{row.issues.who}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Дата</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{row.issues.date}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий шаг</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{row.nextAction}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Статус</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{row.issues.state}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Комментарий: {row.comment}</p>
                  </CardContent>
                </SurfaceCard>
              </div>
            </section>

            <section
              id={SECTION_DOM_IDS.points}
              data-testid="section-dealer-points"
              className="scroll-mt-28 space-y-4 sm:space-y-6 lg:scroll-mt-32"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <SectionTitle subtitle="Торговые точки клиента.">Торговые точки · {row.outlets}</SectionTitle>
                <p className="text-sm font-medium text-muted-foreground">Всего точек: {row.outlets}</p>
              </div>
              <div className="space-y-4">
                {row.tradePoints.map((tp, idx) => (
                  <SurfaceCard key={`${row.id}-tp-${idx}`}>
                    <CardHeader className="flex flex-col gap-3 pb-0 pt-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-row items-center gap-2">
                        <Store className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        <CardTitle className="text-base font-semibold">{tp.name}</CardTitle>
                      </div>
                      <Button asChild variant="default" className="min-h-10 w-full shrink-0 sm:w-auto" data-testid={`button-open-trade-point-${tp.id}`}>
                        <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>Открыть точку</Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-1 pt-2">
                      <FieldRow label="Город" value={tp.city} />
                      <FieldRow label="Адрес" value={tp.address} icon={MapPin} />
                      <FieldRow label="Статус" value={tp.status} />
                      <FieldRow label="Формат точки" value={tp.format} />
                      <FieldRow label="Оборудование" value={tp.equipment} />
                      <FieldRow label="Склад фурнитуры" value={tp.hardwareStockStatus} />
                      <FieldRow label="Склад дверей" value={tp.doorsStockStatus} />
                      <FieldRow label="Последний визит" value={tp.lastVisitDate} />
                      <Separator className="my-4 bg-border" />
                      <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4">
                        <div className="flex items-start gap-3">
                          <Camera className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фото ТТ снаружи и внутри</p>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Фотографии не прикреплены</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </SurfaceCard>
                ))}
              </div>
            </section>

            <section
              id={SECTION_DOM_IDS.sales}
              data-testid="section-dealer-sales"
              className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="Средние показатели за квартал.">Продажи</SectionTitle>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiTile label="За квартал" value={row.salesKpis.quarterRub} />
                <KpiTile label="МК, шт." value={row.salesKpis.mkUnits} />
                <KpiTile label="ВХ, шт." value={row.salesKpis.vhUnits} />
                <KpiTile label="Фурнитура" value={row.salesKpis.furnitureRub} />
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Последняя активность: {row.lastActivity}
              </p>
              <SurfaceCard>
                <CardContent className="pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Краткий комментарий</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{salesComment}</p>
                </CardContent>
              </SurfaceCard>

              <div className="mt-6" data-testid="section-dealer-products">
                <SectionTitle subtitle="Позиции каталога в работе по клиенту.">Модели в работе</SectionTitle>
                <div className="mt-3 space-y-3">
                  {dealerProducts.map((p) => (
                    <SurfaceCard key={p.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-semibold leading-snug text-foreground">{p.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.article}</p>
                          <Badge variant="outline" className="w-fit border-border bg-muted/50 text-xs font-medium">
                            {dealerRowStatusForProduct(p)}
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
              data-testid="section-dealer-distribution"
              className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
            >
              <SectionTitle subtitle={`Последняя проверка: ${row.distributionDetail.checkDate}.`}>Дистрибуция</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "МК", pct: row.distributionDetail.mk },
                  { label: "ВХ", pct: row.distributionDetail.vh },
                  { label: "Общая дистрибуция", pct: row.distributionDetail.total },
                ].map((dist) => (
                  <SurfaceCard key={dist.label}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                      <div className="flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-primary" aria-hidden />
                        <CardTitle className="text-sm font-semibold">{dist.label}</CardTitle>
                      </div>
                      <span className="text-lg font-bold tabular-nums text-foreground">{dist.pct}%</span>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <Progress value={dist.pct} className="h-2.5 bg-muted" />
                    </CardContent>
                  </SurfaceCard>
                ))}
              </div>
              <SurfaceCard>
                <CardContent className="pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Вывод</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{distributionConclusion}</p>
                </CardContent>
              </SurfaceCard>
            </section>

            <section
              id={SECTION_DOM_IDS.showcases}
              data-testid="section-dealer-showcases"
              className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="Витрина и оборудование.">Витрины и оборудование</SectionTitle>
              <SurfaceCard>
                <CardContent className="space-y-1 pt-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                    <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
                    Состояние витрины и оборудования
                  </div>
                  <FieldRow label="Установленное оборудование" value={row.showcase.equipment} />
                  <FieldRow label="Что нужно добавить" value={row.showcase.todo} />
                  <FieldRow label="Статус витрины" value={row.showcase.status} />
                  <FieldRow label="Связь с целями отдела продаж" value={row.showcase.goalLink} />
                  <FieldRow label="Сводный показатель" value={`${row.distribution}% (обзор)`} />
                  <Separator className="my-4" />
                  <p className="text-sm font-medium text-foreground">{showcaseNext}</p>
                </CardContent>
              </SurfaceCard>
            </section>

            <DealerTrainingAttentionSection row={row} />

            <DealerShowcaseDistributionSection
              row={row}
              profile={profile}
              onApplied={() => setShowcaseBump((n) => n + 1)}
            />

            <section
              id={SECTION_DOM_IDS.history}
              data-testid="section-dealer-history"
              className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="Недавние события по карточке.">История активности</SectionTitle>
              <SurfaceCard>
                <CardContent className="divide-y divide-border pt-2">
                  {historyEvents.map((ev) => (
                    <div key={ev.id} className="flex flex-col gap-1.5 py-4 first:pt-4">
                      <p className="text-xs font-semibold tabular-nums text-muted-foreground">{ev.meta}</p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{ev.body}</p>
                    </div>
                  ))}
                </CardContent>
              </SurfaceCard>
            </section>

            <section
              id={SECTION_DOM_IDS.tasks}
              data-testid="section-dealer-tasks"
              className="scroll-mt-28 space-y-4 pb-2 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="Контрольные действия по клиенту (витрина и сопровождение).">Задачи по витрине</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {tasks.map((task, idx) => (
                  <SurfaceCard key={`${row.id}-task-${idx}`}>
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
          </div>

          <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
            <DealerSectionNav active={activeSection} variant="sidebar" />
          </aside>
        </div>
      </div>

      <FloatingBackButton
        href="/dealer-base"
        label="К базе"
        testId="floating-back-to-dealer-base"
        ariaLabel="Назад к клиентской базе"
      />
    </div>
  );
}

export function DealerCardPage() {
  const params = useParams<{ id: string }>();
  const rawId = params.id ?? "";
  const row = getDealerById(rawId);
  if (!row) {
    return <DealerNotFound />;
  }
  return <DealerCardContent row={row} />;
}

/** Маршрут `/dealer-card-foundation` — превью карточки первого клиента из базы. */
export default function DealerCardFoundation() {
  const first = DEALER_BASE_ROWS[0];
  if (!first) return <DealerNotFound />;
  return <DealerCardContent row={first} />;
}
