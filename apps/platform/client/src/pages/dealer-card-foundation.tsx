import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { AlertTriangle, BookOpen, Camera, Handshake, LayoutGrid, MapPin, PieChart, Store, TrendingUp } from "lucide-react";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDealerAnalyticsSignalCards } from "@/lib/dealer-analytics-signals";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  getShowcaseHistoryForDealer,
  getShowcaseKpis,
  getShowcaseTasksForDealerDisplay,
  loadShowcaseStorage,
  mergeDistributionWithOverrides,
  canViewShowcaseDistribution,
  userLabelFromProfile,
} from "@/lib/showcase-distribution-data";
import {
  CLIENT_NEXT_STEP_CHANGED_EVENT,
  clientNextStepActionLabel,
  getClientNextStepForDealer,
  getClientNextStepHistoryForDealer,
  loadClientNextStepsStorage,
} from "@/lib/client-next-step-data";
import { dealerProductTrainingStorageKey, getDealerTrainingAttentionSignal, trainingAttentionLevelBadgeClass } from "@/lib/training-attention";
import { DealerActionFocusSection } from "@/components/dealer-action-focus-section";
import { DealerClientNextStepSection } from "@/components/dealer-client-next-step-section";
import { DealerStaticProfileSection } from "@/components/dealer-static-profile-section";

const SECTION_IDS = [
  "work",
  "showcase_distribution",
  "next_step",
  "history",
  "static_profile",
  "points",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  work: "dealer-section-work",
  points: "dealer-section-points",
  showcase_distribution: "dealer-section-showcase-distribution",
  next_step: "dealer-section-next-step",
  history: "section-dealer-activity-history",
  static_profile: "dealer-section-static-profile",
};

const SECTION_LABELS: Record<SectionId, string> = {
  work: "Работа",
  points: "Точки",
  showcase_distribution: "Витрина",
  next_step: "Шаг",
  history: "История",
  static_profile: "Паспорт",
};

const SECTION_NAV_TEST_IDS: Record<SectionId, string> = {
  work: "dealer-section-nav-work",
  points: "dealer-section-nav-points",
  showcase_distribution: "dealer-section-nav-showcase-distribution",
  next_step: "dealer-section-nav-next-step",
  history: "dealer-section-nav-history",
  static_profile: "dealer-section-nav-static-profile",
};

const NAV_SECTION_IDS = SECTION_IDS.filter((id): id is Exclude<SectionId, "points"> => id !== "points");

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
    <div className="flex gap-2 border-b border-border py-2 last:border-0 sm:items-start sm:gap-3">
      {Icon ? (
        <span className="mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:flex">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{value}</p>
      </div>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
      <CardHeader className="space-y-0.5 px-3 pb-2 pt-3">
        <CardDescription className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{value}</CardTitle>
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
    <Card className={cn("rounded-xl border border-border/70 bg-card shadow-xs", className)} {...rest}>
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

type DealerHistoryEvent = { id: string; meta: string; body: string; at?: string };

function historySortKey(e: DealerHistoryEvent): number {
  if (e.at) {
    const t = new Date(e.at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const m = e.meta.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return 0;
}

function newestHistoryActivityLabel(events: DealerHistoryEvent[], fallback: string): string {
  let best = -Infinity;
  let label = fallback;
  for (const e of events) {
    const k = historySortKey(e);
    if (k >= best) {
      best = k;
      const head = e.meta.split("·")[0]?.trim();
      if (head) label = head;
    }
  }
  return label;
}

function formatIsoDayToRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function isNextStepContactOverdue(contactDate: string): boolean {
  const raw = contactDate.trim();
  if (!raw) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** Реалистичная лента для клиентов менеджера Бойко (команда Купянского). */
function buildHistoryEvents(row: DealerRow): DealerHistoryEvent[] {
  const storage = loadShowcaseStorage();
  const showcaseHist: DealerHistoryEvent[] = getShowcaseHistoryForDealer(row.id, storage).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const nsStorage = loadClientNextStepsStorage();
  const nsHist: DealerHistoryEvent[] = getClientNextStepHistoryForDealer(row.id, nsStorage).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  if (row.releaseManagerId === "mgr-boyko-em") {
    return [
      ...showcaseHist,
      ...nsHist,
      {
        id: `${row.id}-hist-call`,
        meta: "14.05.2026 · Бойко Екатерина",
        body: "Звонок: обсудили обновление витрины, клиент готов поставить 3 новые модели.\nСледующее действие: визит 17.05.",
        at: "2026-05-14T12:00:00.000Z",
      },
      {
        id: `${row.id}-hist-rop`,
        meta: "13.05.2026 · РОП Купянский",
        body: "Комментарий руководителя: взять клиента в фокус, высокий потенциал.",
        at: "2026-05-13T12:00:00.000Z",
      },
      {
        id: `${row.id}-hist-sys`,
        meta: "10.05.2026 · Система",
        body: "Клиент попал в «требует внимания»: нет активности 30 дней.",
        at: "2026-05-10T12:00:00.000Z",
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
    ...nsHist,
    ...templates.map((text, idx) => ({
      id: `${row.id}-hist-${idx}`,
      meta: `${dates[idx % dates.length] ?? row.lastActivity} · Система`,
      body: text,
    })),
  ];
}

function isFilledDataCell(v: string | undefined | null): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function collapseAdjacentDuplicateHistoryBodies(events: DealerHistoryEvent[]): DealerHistoryEvent[] {
  const out: DealerHistoryEvent[] = [];
  for (const ev of events) {
    const key = ev.body.trim();
    const last = out[out.length - 1];
    if (last && last.body.trim() === key && key !== "") {
      out[out.length - 1] = ev;
    } else {
      out.push(ev);
    }
  }
  return out;
}

function DealerTrainingAttentionSection({
  row,
  completed,
  onCompletedChange,
}: {
  row: DealerRow;
  completed: boolean;
  onCompletedChange: (next: boolean) => void;
}) {
  const signal = useMemo(() => getDealerTrainingAttentionSignal(row, completed), [row, completed]);
  const trainingHref =
    signal.suggestedTrainingProgramIds[0] != null
      ? `/training/programs/${signal.suggestedTrainingProgramIds[0]}`
      : "/training";

  return (
    <section
      id="section-dealer-training-attention"
      data-testid="section-dealer-training-attention"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32 lg:scroll-mt-32"
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
                  onCompletedChange(next);
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
  const [active, setActive] = useState<SectionId>("work");

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

function DealerSectionNav({ active }: { active: SectionId }) {
  const onNav = useCallback((id: SectionId) => {
    scrollToSection(id);
  }, []);

  return (
    <nav
      className="sticky top-24 space-y-1 rounded-xl border border-border/70 bg-card p-2 shadow-xs"
      aria-label="Разделы карточки"
      data-testid="dealer-section-nav"
    >
      <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Разделы</p>
      {NAV_SECTION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onNav(id)}
          data-testid={SECTION_NAV_TEST_IDS[id]}
          className={cn(
            "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
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

function DealerCardContent({ row }: { row: DealerRow }) {
  const { profile } = useReleaseDemoProfile();
  const { user } = useCurrentUser();
  const [showcaseBump, setShowcaseBump] = useState(0);
  const [nextStepBump, setNextStepBump] = useState(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [pointsExpanded, setPointsExpanded] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(() => {
    if (typeof window === "undefined") return row.productTrainingCompleted;
    const s = sessionStorage.getItem(dealerProductTrainingStorageKey(row.id));
    if (s === "1") return true;
    if (s === "0") return false;
    return row.productTrainingCompleted;
  });

  useEffect(() => {
    const fn = () => setNextStepBump((n) => n + 1);
    window.addEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
    return () => window.removeEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    setHistoryExpanded(false);
    setPointsExpanded(false);
    if (typeof window === "undefined") return;
    const s = sessionStorage.getItem(dealerProductTrainingStorageKey(row.id));
    if (s === "1") setTrainingCompleted(true);
    else if (s === "0") setTrainingCompleted(false);
    else setTrainingCompleted(row.productTrainingCompleted);
  }, [row.id, row.productTrainingCompleted]);

  const businessCategoryLabel = getClientCategoryLabel(row.clientCategory);
  const activeSection = useActiveSection(row.id);
  const historyEvents = useMemo(() => buildHistoryEvents(row), [row, showcaseBump, nextStepBump]);
  const historyTimeline = useMemo(() => {
    const sorted = [...historyEvents].sort((a, b) => historySortKey(b) - historySortKey(a));
    return collapseAdjacentDuplicateHistoryBodies(sorted);
  }, [historyEvents]);
  const lastHistoryLabel = useMemo(() => newestHistoryActivityLabel(historyEvents, row.lastActivity), [historyEvents, row.lastActivity]);

  const nextStepStored = useMemo(
    () => getClientNextStepForDealer(row.id, loadClientNextStepsStorage()),
    [row.id, nextStepBump],
  );
  const nextStepOverdue = useMemo(
    () => Boolean(nextStepStored && isNextStepContactOverdue(nextStepStored.contactDate)),
    [nextStepStored],
  );

  const showcaseDailySignals = useMemo(() => {
    const s = loadShowcaseStorage();
    const tasks = getShowcaseTasksForDealerDisplay(row, s);
    const rows = mergeDistributionWithOverrides(row, s);
    const kpis = getShowcaseKpis(rows, tasks);
    return { openCt: kpis.openTasks, hasDeficit: kpis.deficitTotal > 0, deficitTotal: kpis.deficitTotal };
  }, [row, showcaseBump]);

  const canViewShowcaseCard = useMemo(() => canViewShowcaseDistribution(profile, row), [profile, row]);

  const primaryLine = useMemo(() => {
    if (!canViewShowcaseDistribution(profile, row)) {
      return "Витрина по этому клиенту недоступна в вашем профиле — откройте клиента из своей базы или свяжитесь с ответственным менеджером.";
    }
    if (nextStepOverdue) return "Просрочен следующий контакт — свяжитесь с клиентом.";
    if (showcaseDailySignals.openCt > 0)
      return `Открыты задачи по витрине (${showcaseDailySignals.openCt}). Завершите их после фактической выкладки образцов.`;
    if (showcaseDailySignals.hasDeficit)
      return `Есть дефицит по витрине (${showcaseDailySignals.deficitTotal} ед.). Доведите категории до плана.`;
    if (nextStepStored)
      return `Ближайший шаг: ${clientNextStepActionLabel(nextStepStored.actionType)} на ${formatIsoDayToRu(nextStepStored.contactDate)}.`;
    return "Срочных сигналов нет — поддерживайте регулярный контакт и актуальность витрины.";
  }, [profile, row, nextStepOverdue, showcaseDailySignals, nextStepStored]);

  const dealerProducts = useMemo(() => getDealerProductPreview(row.id, 5), [row.id]);
  const analyticsSignals = useMemo(() => getDealerAnalyticsSignalCards(row), [row]);

  const trainingSignal = useMemo(
    () => getDealerTrainingAttentionSignal(row, trainingCompleted),
    [row, trainingCompleted],
  );
  const showTrainingSection = trainingSignal.level !== "none" || row.indigoTrainingCandidate;

  const hasTermsBlock = useMemo(
    () =>
      isFilledDataCell(row.terms.tandoorClub) ||
      isFilledDataCell(row.terms.special) ||
      isFilledDataCell(row.terms.payment) ||
      isFilledDataCell(row.terms.edo) ||
      isFilledDataCell(row.terms.limit) ||
      isFilledDataCell(row.terms.bonuses),
    [row],
  );

  const hasCompetitorsBlock = useMemo(
    () =>
      isFilledDataCell(row.competitors.list) ||
      isFilledDataCell(row.competitors.strengths) ||
      isFilledDataCell(row.competitors.mgrComment) ||
      isFilledDataCell(row.competitors.rmComment),
    [row],
  );

  const showProblemsBlock = row.hasProblem || isFilledDataCell(row.issues.summary);

  const hasSalesData = useMemo(
    () =>
      isFilledDataCell(row.salesKpis.quarterRub) ||
      isFilledDataCell(row.salesKpis.mkUnits) ||
      isFilledDataCell(row.salesKpis.vhUnits) ||
      isFilledDataCell(row.salesKpis.furnitureRub),
    [row],
  );

  const showDistributionBlock = row.distributionDetail.total > 0 || row.distributionDetail.mk > 0 || row.distributionDetail.vh > 0;

  const hasShowcaseLegacyBlock = useMemo(
    () =>
      isFilledDataCell(row.showcase.equipment) ||
      isFilledDataCell(row.showcase.todo) ||
      isFilledDataCell(row.showcase.status) ||
      isFilledDataCell(row.showcase.goalLink),
    [row],
  );

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

        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-3 sm:space-y-4 lg:col-span-8">
            <section
              id={SECTION_DOM_IDS.work}
              className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
            >
              <div
                id="dealer-section-overview"
                data-testid="section-dealer-overview"
                className="relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-xs sm:p-4"
              >
                <div className="pointer-events-none absolute left-0 top-0 h-full w-0.5 rounded-l-xl bg-primary" aria-hidden />
                <div className="relative min-w-0 pl-2.5 sm:pl-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusBadgeClass(row.status))}>
                      {row.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", getClientCategoryBadgeClass(row.clientCategory))}
                      data-testid="text-dealer-card-client-category"
                    >
                      {businessCategoryLabel}
                    </Badge>
                    {canViewShowcaseCard && showcaseDailySignals.openCt > 0 ? (
                      <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-950">
                        Задачи по витрине
                      </Badge>
                    ) : null}
                    {canViewShowcaseCard && showcaseDailySignals.hasDeficit ? (
                      <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-950">
                        Дефицит
                      </Badge>
                    ) : null}
                    {nextStepStored?.contactDate ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          nextStepOverdue
                            ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : "border-border bg-muted/60 text-foreground",
                        )}
                      >
                        Контакт: {formatIsoDayToRu(nextStepStored.contactDate)}
                      </Badge>
                    ) : null}
                  </div>
                  <h1 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{row.name}</h1>
                  <p className="mt-0.5 min-w-0 break-words text-xs text-muted-foreground sm:text-sm">
                    {row.city} · {businessCategoryLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" variant="secondary" size="sm" className="min-h-9 h-9 text-xs" asChild>
                      <Link href="/dealer-base">К базе</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 h-9 border-border bg-card text-xs"
                      data-testid="button-quick-open-points"
                      onClick={() => {
                        setPointsExpanded(true);
                        scrollToSection("points");
                      }}
                    >
                      Точки
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 h-9 border-border bg-card text-xs"
                      data-testid="button-quick-open-showcase-distribution"
                      onClick={() => scrollToSection("showcase_distribution")}
                    >
                      Витрина
                    </Button>
                  </div>
                </div>
              </div>

              <DealerActionFocusSection
                row={row}
                profile={profile}
                primaryLine={primaryLine}
                openShowcaseTasks={showcaseDailySignals.openCt}
                hasDeficit={showcaseDailySignals.hasDeficit}
                deficitTotal={showcaseDailySignals.deficitTotal}
                nextStep={nextStepStored}
                nextStepOverdue={nextStepOverdue}
                lastActivityLabel={lastHistoryLabel}
                onScrollToNextStep={() => scrollToSection("next_step")}
                onScrollToShowcase={() => scrollToSection("showcase_distribution")}
              />
            </section>

            <DealerShowcaseDistributionSection
              row={row}
              profile={profile}
              onApplied={() => setShowcaseBump((n) => n + 1)}
            />

            <DealerClientNextStepSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user?.name ?? userLabelFromProfile(profile)}
              onSaved={() => setNextStepBump((n) => n + 1)}
            />

            <section
              id={SECTION_DOM_IDS.history}
              data-testid="section-dealer-activity-history"
              className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="События по витрине, шагам и сопровождению.">История активности</SectionTitle>
              <SurfaceCard>
                <CardContent className="divide-y divide-border px-3 py-0 pt-2 sm:px-4">
                  {(historyExpanded ? historyTimeline : historyTimeline.slice(0, 3)).map((ev) => (
                    <div key={ev.id} className="flex min-w-0 flex-col gap-1 py-3 first:pt-2">
                      <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">{ev.meta}</p>
                      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">{ev.body}</p>
                    </div>
                  ))}
                </CardContent>
              </SurfaceCard>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 w-full text-sm font-semibold sm:w-auto"
                data-testid="button-dealer-history-show-all"
                disabled={historyTimeline.length <= 3}
                title={historyTimeline.length <= 3 ? "Не более трёх событий в истории" : undefined}
                onClick={() => {
                  if (historyTimeline.length <= 3) return;
                  setHistoryExpanded((v) => !v);
                }}
              >
                {historyExpanded ? "Свернуть историю" : "Показать всю историю"}
              </Button>
            </section>

            <DealerStaticProfileSection row={row} categoryLabel={businessCategoryLabel} />

            {analyticsSignals.length > 0 ? (
              <section
                data-testid="section-dealer-analytics-signals"
                className="scroll-mt-28 space-y-2 sm:scroll-mt-32 lg:scroll-mt-32"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle subtitle="Совпадает с разделом аналитики.">Сигналы аналитики</SectionTitle>
                  <Button asChild variant="secondary" size="sm" className="min-h-9 w-full shrink-0 font-semibold sm:w-auto" data-testid="button-dealer-signal-open-tasks">
                    <Link href={buildHashPath("/tasks", { dealerId: row.id })}>К задачам по витрине</Link>
                  </Button>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  {analyticsSignals.map((sig) => (
                    <SurfaceCard key={sig.kind} data-testid={`card-dealer-analytics-signal-${sig.kind}`}>
                      <CardHeader className="space-y-1 px-3 pb-1 pt-3 sm:px-4">
                        <CardDescription className="text-[10px] font-bold uppercase tracking-wide text-primary">
                          {sig.title}
                        </CardDescription>
                        <p className="text-xs leading-relaxed text-muted-foreground">{sig.metric}</p>
                      </CardHeader>
                      <CardContent className="space-y-2 px-3 pb-3 text-sm sm:px-4 sm:pb-4">
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
              </section>
            ) : null}

            {hasTermsBlock ? (
              <div data-testid="section-dealer-terms">
                <SectionTitle subtitle="Условия сотрудничества.">Условия работы</SectionTitle>
                <SurfaceCard className="mt-2">
                  <CardContent className="px-3 py-3 sm:px-4">
                    <FieldRow label="Тандор клуб" value={row.terms.tandoorClub} icon={Handshake} />
                    <FieldRow label="Спец. условия" value={row.terms.special} />
                    <FieldRow label="Тип оплаты" value={row.terms.payment} />
                    <FieldRow label="ЭДО" value={row.terms.edo} />
                    <FieldRow label="Лимит / индивидуальные условия" value={row.terms.limit} />
                    <FieldRow label="Бонусы / мотивация продавцов" value={row.terms.bonuses} />
                  </CardContent>
                </SurfaceCard>
              </div>
            ) : null}

            {hasCompetitorsBlock ? (
              <div data-testid="section-dealer-competitors">
                <SectionTitle subtitle="Обзор конкурентной среды.">Конкуренты</SectionTitle>
                <SurfaceCard className="mt-2">
                  <CardContent className="space-y-0 px-3 py-3 sm:px-4">
                    <FieldRow label="Конкуренты в торговой точке" value={row.competitors.list} />
                    <FieldRow label="Сильные позиции конкурентов" value={row.competitors.strengths} />
                    <FieldRow label="Комментарий менеджера" value={row.competitors.mgrComment} />
                    <FieldRow label="Комментарий регионального менеджера" value={row.competitors.rmComment} />
                  </CardContent>
                </SurfaceCard>
              </div>
            ) : null}

            {showProblemsBlock ? (
              <div data-testid="section-dealer-problems">
                <SectionTitle subtitle="Текущие вопросы по клиенту.">Проблемы и внимание</SectionTitle>
                <SurfaceCard
                  className={cn(
                    "mt-2 border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-card",
                    !row.hasProblem && "border-border from-muted/30",
                  )}
                >
                  <CardContent className="space-y-3 px-3 py-3 sm:px-4">
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
                    <p className={cn("text-sm font-semibold leading-relaxed", row.hasProblem ? "text-red-700" : "text-foreground")}>
                      {row.issues.summary}
                    </p>
                    <div className="grid gap-3 rounded-lg bg-card/80 p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Кто зафиксировал</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.issues.who}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дата</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.issues.date}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий шаг</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.nextAction}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Статус</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.issues.state}</p>
                      </div>
                    </div>
                    {isFilledDataCell(row.comment) ? (
                      <p className="text-xs text-muted-foreground">Комментарий: {row.comment}</p>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              </div>
            ) : null}

            <section
              id={SECTION_DOM_IDS.points}
              data-testid="section-dealer-points"
              className="scroll-mt-28 space-y-2 sm:scroll-mt-32 lg:scroll-mt-32"
            >
              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">
                  Торговые точки: <span className="tabular-nums">{row.outlets}</span>
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-9 w-full shrink-0 font-semibold sm:w-auto"
                  data-testid="button-dealer-expand-trade-points"
                  onClick={() => setPointsExpanded((v) => !v)}
                >
                  {pointsExpanded ? "Свернуть точки" : "Открыть точки"}
                </Button>
              </div>
              {pointsExpanded ? (
                <div className="space-y-2">
                  {row.tradePoints.map((tp, idx) => (
                    <SurfaceCard key={`${row.id}-tp-${idx}`}>
                      <CardHeader className="flex flex-col gap-2 px-3 pb-0 pt-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
                        <div className="flex min-w-0 flex-row items-center gap-2">
                          <Store className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                          <CardTitle className="text-sm font-semibold leading-snug">{tp.name}</CardTitle>
                        </div>
                        <Button
                          asChild
                          variant="default"
                          size="sm"
                          className="min-h-9 w-full shrink-0 sm:w-auto"
                          data-testid={`button-open-trade-point-${tp.id}`}
                        >
                          <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>К точке</Link>
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-0 px-3 pb-3 pt-1 sm:px-4">
                        <FieldRow label="Город" value={tp.city} />
                        <FieldRow label="Адрес" value={tp.address} icon={MapPin} />
                        <FieldRow label="Статус" value={tp.status} />
                        <FieldRow label="Формат точки" value={tp.format} />
                        <FieldRow label="Оборудование" value={tp.equipment} />
                        <FieldRow label="Склад фурнитуры" value={tp.hardwareStockStatus} />
                        <FieldRow label="Склад дверей" value={tp.doorsStockStatus} />
                        <FieldRow label="Последний визит" value={tp.lastVisitDate} />
                        <Separator className="my-3 bg-border" />
                        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
                          <div className="flex items-start gap-2">
                            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Фото ТТ</p>
                              <p className="mt-1 text-xs text-muted-foreground">Фотографии не прикреплены</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </SurfaceCard>
                  ))}
                </div>
              ) : null}
            </section>

            {hasSalesData ? (
              <section data-testid="section-dealer-sales" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
                <SectionTitle subtitle="Средние показатели за квартал.">Продажи</SectionTitle>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
                  <CardContent className="px-3 py-3 sm:px-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Краткий комментарий</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{salesComment}</p>
                  </CardContent>
                </SurfaceCard>

                {dealerProducts.length > 0 ? (
                  <div data-testid="section-dealer-products">
                    <SectionTitle subtitle="Позиции каталога в работе по клиенту.">Модели в работе</SectionTitle>
                    <div className="mt-2 space-y-2">
                      {dealerProducts.map((p) => (
                        <SurfaceCard key={p.id}>
                          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold leading-snug text-foreground">{p.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">{p.article}</p>
                              <Badge variant="outline" className="w-fit border-border bg-muted/50 text-xs font-medium">
                                {dealerRowStatusForProduct(p)}
                              </Badge>
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="min-h-9 shrink-0 border-border bg-card"
                              data-testid={`button-open-product-${p.id}`}
                            >
                              <Link href={`/catalog/${p.id}`}>Открыть модель</Link>
                            </Button>
                          </CardContent>
                        </SurfaceCard>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {showDistributionBlock ? (
              <section data-testid="section-dealer-distribution" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
                <SectionTitle subtitle={`Последняя проверка: ${row.distributionDetail.checkDate}.`}>Дистрибуция</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "МК", pct: row.distributionDetail.mk },
                    { label: "ВХ", pct: row.distributionDetail.vh },
                    { label: "Общая дистрибуция", pct: row.distributionDetail.total },
                  ].map((dist) => (
                    <SurfaceCard key={dist.label}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pb-1 pt-3 sm:px-4">
                        <div className="flex items-center gap-2">
                          <PieChart className="h-3.5 w-3.5 text-primary" aria-hidden />
                          <CardTitle className="text-xs font-semibold">{dist.label}</CardTitle>
                        </div>
                        <span className="text-base font-bold tabular-nums text-foreground">{dist.pct}%</span>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 sm:px-4">
                        <Progress value={dist.pct} className="h-2 bg-muted" />
                      </CardContent>
                    </SurfaceCard>
                  ))}
                </div>
                <SurfaceCard>
                  <CardContent className="px-3 py-3 sm:px-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Вывод</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">{distributionConclusion}</p>
                  </CardContent>
                </SurfaceCard>
              </section>
            ) : null}

            {hasShowcaseLegacyBlock ? (
              <section data-testid="section-dealer-showcases" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
                <SectionTitle subtitle="Витрина и оборудование.">Витрины и оборудование</SectionTitle>
                <SurfaceCard>
                  <CardContent className="space-y-0 px-3 py-3 sm:px-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
                      Состояние витрины и оборудования
                    </div>
                    <FieldRow label="Установленное оборудование" value={row.showcase.equipment} />
                    <FieldRow label="Что нужно добавить" value={row.showcase.todo} />
                    <FieldRow label="Статус витрины" value={row.showcase.status} />
                    <FieldRow label="Связь с целями отдела продаж" value={row.showcase.goalLink} />
                    <FieldRow label="Сводный показатель" value={`${row.distribution}% (обзор)`} />
                    <Separator className="my-3" />
                    <p className="text-sm font-medium text-foreground">{showcaseNext}</p>
                  </CardContent>
                </SurfaceCard>
              </section>
            ) : null}

            {showTrainingSection ? (
              <DealerTrainingAttentionSection
                row={row}
                completed={trainingCompleted}
                onCompletedChange={(next) => {
                  setTrainingCompleted(next);
                  sessionStorage.setItem(dealerProductTrainingStorageKey(row.id), next ? "1" : "0");
                }}
              />
            ) : null}
          </div>

          <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
            <DealerSectionNav active={activeSection} />
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
