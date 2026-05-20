import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AlertTriangle, BookOpen, Handshake, MapPin, PieChart, TrendingUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getClientCategoryBadgeClass, getClientCategoryLabel } from "@/lib/client-category";
import {
  DEALER_BASE_ROWS,
  getDealerById,
  type DealerRow,
  type DealerStatus,
} from "@/lib/dealer-base-mock-data";
import { dealerRowStatusForProduct, getDealerProductPreview } from "@/lib/catalog-data";
import { DealerShowcaseDistributionSection, type ShowcaseCategoryListMode } from "@/components/dealer-showcase-distribution-section";
import { DealerShowcaseMatrixSummarySection } from "@/components/dealer-showcase-matrix-summary-section";
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
  canEditClientNextStep,
  getClientNextStepForDealer,
  getClientNextStepHistoryForDealer,
  loadClientNextStepsStorage,
  saveClientNextStep,
} from "@/lib/client-next-step-data";
import { dealerProductTrainingStorageKey, getDealerTrainingAttentionSignal, trainingAttentionLevelBadgeClass } from "@/lib/training-attention";
import {
  DEALER_TRAINING_FLAGS_EVENT,
  getCompetitorActivityRows,
  getDistributionSnapshotForCard,
  getNewStaffTrainingNeeded,
  getTrainingFlagsHistoryEvents,
  setNewStaffTrainingNeeded,
} from "@/lib/dealer-card-release-signals";
import {
  DEALER_WORK_PLAN_EVENT,
  formatWorkPlanDateRu,
  getDealerScheduledDateForUser,
  isDealerHiddenForUser,
  loadDealerWorkPlanState,
} from "@/lib/dealer-work-plan";
import { getDealerStockSignal } from "@/lib/dealer-stock-signals";
import { getDealerEquipmentSignal } from "@/lib/dealer-equipment-signals";
import {
  addDealerComment,
  canEditDealerCardComments,
  DEALER_CARD_COMMENTS_EVENT,
  getDealerComments,
  getDealerCommentsHistoryEvents,
} from "@/lib/dealer-card-comments";
import {
  getDealerLegalEntityHistoryEvents,
  DEALER_LEGAL_ENTITIES_EVENT,
  getMergedDealerLegalEntities,
} from "@/lib/dealer-legal-entities";
import {
  CLIENT_CONTACTS_EVENT,
  getClientContactDealerHistoryEvents,
  getDealerContacts,
  isClientContactActive,
} from "@/lib/client-contacts";
import {
  DEALER_UNLOADING_ORDER_EVENT,
  getDealerUnloadingOrder,
  getDealerUnloadingOrderHistoryEvents,
  setDealerUnloadingOrder,
} from "@/lib/dealer-unloading-order-storage";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import {
  DEALER_TRADE_POINTS_EVENT,
  getDealerTradePointHistoryEvents,
} from "@/lib/dealer-trade-points-overrides";
import {
  canEditDealerProfile,
  DEALER_PROFILE_OVERRIDES_EVENT,
  getDealerProfileHistoryEvents,
  getDealerRowWithProfileOverrides,
  getMergedDealerProfile,
  updateDealerProfile,
} from "@/lib/dealer-profile-overrides";
import {
  DEALER_CHARACTERISTICS_EVENT,
  getDealerCharacteristicsHistoryEvents,
} from "@/lib/dealer-characteristics";
import { DealerCharacteristicsSection } from "@/components/dealer-characteristics-section";
import { DealerLegalEntitiesSection } from "@/components/dealer-legal-entities-section";
import { DealerTradePointsSection } from "@/components/dealer-trade-points-section";
import { DealerActionFocusSection } from "@/components/dealer-action-focus-section";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { DealerClientNextStepSection } from "@/components/dealer-client-next-step-section";
import { DealerStaticProfileSection } from "@/components/dealer-static-profile-section";
import {
  getShowcaseMatrixDealerHistoryEvents,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
} from "@/lib/trade-point-showcase-matrix-storage";
import { DealerContactsSection } from "@/components/dealer-contacts-section";

const SECTION_IDS = [
  "overview",
  "contacts",
  "work",
  "showcase_distribution",
  "points",
  "legal_entities",
  "next_step",
  "terms_distribution",
  "history",
  "static_profile",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "dealer-section-overview",
  contacts: "dealer-section-contacts",
  work: "dealer-section-work",
  points: "dealer-section-points",
  showcase_distribution: "dealer-section-showcase-distribution",
  legal_entities: "dealer-section-legal-entities",
  next_step: "dealer-section-next-step",
  terms_distribution: "dealer-section-terms-distribution",
  history: "section-dealer-activity-history",
  static_profile: "dealer-section-static-profile",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Обзор",
  contacts: "Контакты",
  work: "Работа",
  points: "Точки",
  showcase_distribution: "Витрина",
  legal_entities: "Юрлица",
  next_step: "Шаг",
  terms_distribution: "Условия",
  history: "История",
  static_profile: "Паспорт",
};

const SECTION_NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "dealer-section-nav-overview",
  contacts: "dealer-section-nav-contacts",
  work: "dealer-section-nav-work",
  points: "dealer-section-nav-points",
  showcase_distribution: "dealer-section-nav-showcase-distribution",
  legal_entities: "dealer-section-nav-legal-entities",
  next_step: "dealer-section-nav-next-step",
  terms_distribution: "dealer-section-nav-terms-distribution",
  history: "dealer-section-nav-history",
  static_profile: "dealer-section-nav-static-profile",
};

/** Правая навигация без «Условия», чтобы не перегружать панель (блок есть на странице). */
const NAV_SECTION_IDS: SectionId[] = [
  "overview",
  "contacts",
  "work",
  "showcase_distribution",
  "points",
  "legal_entities",
  "next_step",
  "history",
  "static_profile",
];

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
    <Card className={cn("rounded-xl border border-border bg-card shadow-xs", className)} {...rest}>
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

function addCalendarDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Лента: витрина, шаги, обучение, комментарии, системные шаблоны; сортировка по дате по убыванию. */
function buildHistoryEvents(row: DealerRow): DealerHistoryEvent[] {
  const storage = loadShowcaseStorage();
  const showcaseHist: DealerHistoryEvent[] = getShowcaseHistoryForDealer(row.id, storage).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const mxStorage = loadShowcaseMatrixStorage();
  const matrixShowcaseHist: DealerHistoryEvent[] = getShowcaseMatrixDealerHistoryEvents(row.id, mxStorage).map((e) => ({
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

  const trainHist: DealerHistoryEvent[] = getTrainingFlagsHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const commentHist: DealerHistoryEvent[] = getDealerCommentsHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const legalHist: DealerHistoryEvent[] = getDealerLegalEntityHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const tpHist: DealerHistoryEvent[] = getDealerTradePointHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const profHist: DealerHistoryEvent[] = getDealerProfileHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const contactHist: DealerHistoryEvent[] = getClientContactDealerHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const charHist: DealerHistoryEvent[] = getDealerCharacteristicsHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const unloadHist: DealerHistoryEvent[] = getDealerUnloadingOrderHistoryEvents(row.id).map((e) => ({
    id: e.id,
    meta: e.meta,
    body: e.body,
    at: e.at,
  }));

  const boykoExtras: DealerHistoryEvent[] =
    row.releaseManagerId === "mgr-boyko-em"
      ? [
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
        ]
      : [];

  const i = parseDealerIndex(row.id);
  const templateBodies = [
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
  const templateEvents: DealerHistoryEvent[] =
    row.releaseManagerId === "mgr-boyko-em"
      ? []
      : templateBodies.map((text, idx) => ({
          id: `${row.id}-hist-${idx}`,
          meta: `${dates[idx % dates.length] ?? row.lastActivity} · Система`,
          body: text,
        }));

  const merged = [
    ...showcaseHist,
    ...matrixShowcaseHist,
    ...nsHist,
    ...trainHist,
    ...commentHist,
    ...legalHist,
    ...tpHist,
    ...profHist,
    ...contactHist,
    ...charHist,
    ...unloadHist,
    ...boykoExtras,
    ...templateEvents,
  ];
  merged.sort((a, b) => historySortKey(b) - historySortKey(a));
  return merged;
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

type DealerHistoryNavTarget = "next_step" | "showcase" | "tasks_page";

function inferHistoryNavTarget(ev: DealerHistoryEvent): DealerHistoryNavTarget | null {
  const id = ev.id.toLowerCase();
  const b = ev.body.toLowerCase();
  if (id.startsWith("ns-")) return "next_step";
  if (id.startsWith("sh-")) return "showcase";
  const trimmed = ev.body.trim();
  if (/^запланирован/i.test(trimmed)) return "next_step";
  if (b.includes("обновил витрину") || b.includes("обновлена витрина")) return "showcase";
  if (b.includes("задач") && (b.includes("витрин") || b.includes("дефицит"))) return "tasks_page";
  if (b.includes("рекомендации") && b.includes("задача")) return "tasks_page";
  return null;
}

function scrollToDataTestId(testId: string) {
  requestAnimationFrame(() => {
    document.querySelector(`[data-testid="${testId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function DealerTrainingAttentionSection({
  row,
  completed,
  onCompletedChange,
  newStaffTrainingNeeded,
  onNewStaffTrainingChange,
}: {
  row: DealerRow;
  completed: boolean;
  onCompletedChange: (next: boolean) => void;
  newStaffTrainingNeeded: boolean;
  onNewStaffTrainingChange: (next: boolean) => void;
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
          <div className="rounded-xl border border-border bg-muted/15 px-3 py-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`dealer-new-staff-training-${row.id}`}
                checked={newStaffTrainingNeeded}
                onCheckedChange={(v) => onNewStaffTrainingChange(v === true)}
                data-testid="checkbox-dealer-new-staff-training-needed"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`dealer-new-staff-training-${row.id}`} className="cursor-pointer text-sm font-medium leading-snug">
                  Нужно обучение новых сотрудников ТТ
                </Label>
                <p className="text-xs text-muted-foreground" data-testid="text-dealer-new-staff-training-status">
                  {newStaffTrainingNeeded
                    ? "Отмечено: запланируйте визит или передачу материалов новым сотрудникам точки."
                    : "Не отмечено — включите, если на точке появились новые сотрудники без обучения."}
                </p>
              </div>
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
  const [, setLocation] = useLocation();
  const [showcaseBump, setShowcaseBump] = useState(0);
  const [showcaseMatrixBump, setShowcaseMatrixBump] = useState(0);
  const [nextStepBump, setNextStepBump] = useState(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showcaseCategoryListMode, setShowcaseCategoryListMode] = useState<ShowcaseCategoryListMode>("all");
  const [trainingFlagsBump, setTrainingFlagsBump] = useState(0);
  const [workPlanBump, setWorkPlanBump] = useState(0);
  const [commentsBump, setCommentsBump] = useState(0);
  const [legalBump, setLegalBump] = useState(0);
  const [dealerDataBump, setDealerDataBump] = useState(0);
  const [unloadBump, setUnloadBump] = useState(0);
  const [historyCommentDraft, setHistoryCommentDraft] = useState("");
  const [problemCommentDraft, setProblemCommentDraft] = useState("");
  const [competitorCommentDraft, setCompetitorCommentDraft] = useState("");
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
    const fn = () => setTrainingFlagsBump((n) => n + 1);
    window.addEventListener(DEALER_TRAINING_FLAGS_EVENT, fn);
    return () => window.removeEventListener(DEALER_TRAINING_FLAGS_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setWorkPlanBump((n) => n + 1);
    window.addEventListener(DEALER_WORK_PLAN_EVENT, fn);
    return () => window.removeEventListener(DEALER_WORK_PLAN_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setShowcaseMatrixBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setCommentsBump((n) => n + 1);
    window.addEventListener(DEALER_CARD_COMMENTS_EVENT, fn);
    return () => window.removeEventListener(DEALER_CARD_COMMENTS_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setLegalBump((n) => n + 1);
    window.addEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
    return () => window.removeEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setDealerDataBump((n) => n + 1);
    window.addEventListener(DEALER_TRADE_POINTS_EVENT, fn);
    window.addEventListener(DEALER_PROFILE_OVERRIDES_EVENT, fn);
    window.addEventListener(CLIENT_CONTACTS_EVENT, fn);
    window.addEventListener(DEALER_CHARACTERISTICS_EVENT, fn);
    return () => {
      window.removeEventListener(DEALER_TRADE_POINTS_EVENT, fn);
      window.removeEventListener(DEALER_PROFILE_OVERRIDES_EVENT, fn);
      window.removeEventListener(CLIENT_CONTACTS_EVENT, fn);
      window.removeEventListener(DEALER_CHARACTERISTICS_EVENT, fn);
    };
  }, []);

  useEffect(() => {
    const fn = () => setUnloadBump((n) => n + 1);
    window.addEventListener(DEALER_UNLOADING_ORDER_EVENT, fn);
    return () => window.removeEventListener(DEALER_UNLOADING_ORDER_EVENT, fn);
  }, []);

  useEffect(() => {
    setHistoryExpanded(false);
    setShowcaseCategoryListMode("all");
    setHistoryCommentDraft("");
    setProblemCommentDraft("");
    setCompetitorCommentDraft("");
    if (typeof window === "undefined") return;
    const s = sessionStorage.getItem(dealerProductTrainingStorageKey(row.id));
    if (s === "1") setTrainingCompleted(true);
    else if (s === "0") setTrainingCompleted(false);
    else setTrainingCompleted(row.productTrainingCompleted);
  }, [row.id, row.productTrainingCompleted]);

  const businessCategoryLabel = getClientCategoryLabel(row.clientCategory);
  const rowView = useMemo(() => getDealerRowWithProfileOverrides(row), [row, dealerDataBump]);
  const activeSection = useActiveSection(row.id);
  const historyEvents = useMemo(
    () => buildHistoryEvents(row),
    [row, showcaseBump, showcaseMatrixBump, nextStepBump, trainingFlagsBump, commentsBump, legalBump, dealerDataBump, unloadBump],
  );
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

  const canEditCardComments = useMemo(() => canEditDealerCardComments(profile, row), [profile, row]);

  const canEditProfile = useMemo(() => canEditDealerProfile(profile, row), [profile, row]);
  const mergedProfView = useMemo(() => getMergedDealerProfile(row), [row, dealerDataBump]);
  const tradePointsCount = useMemo(
    () => getMergedDealerTradePoints(row, { includeArchived: false }).length,
    [row, dealerDataBump],
  );
  const legalEntitiesCount = useMemo(
    () => getMergedDealerLegalEntities(row).filter((e) => e.status !== "archived").length,
    [row, legalBump],
  );
  const storedDealerContacts = useMemo(() => getDealerContacts(row), [row, dealerDataBump]);
  const primaryStoredContact = useMemo(() => {
    const active = storedDealerContacts.filter(isClientContactActive);
    return active.find((c) => c.isPrimary) ?? active[0];
  }, [storedDealerContacts]);
  const quickMainContactLabel = useMemo(() => {
    const n = primaryStoredContact?.fullName?.trim();
    if (n) return n;
    const m = mergedProfView.mainContactName?.trim();
    if (m) return m;
    const l = row.contacts.lpr?.trim();
    if (l && l !== "—" && l !== "-") return l;
    return "";
  }, [primaryStoredContact, mergedProfView.mainContactName, row.contacts.lpr]);
  const quickPhoneLabel = useMemo(() => {
    const p = primaryStoredContact?.phone?.trim();
    if (p && p !== "—" && p !== "-") return p;
    const m = mergedProfView.mainContactPhone?.trim();
    if (m && m !== "—" && m !== "-") return m;
    const r = row.contacts.phone?.trim();
    if (r && r !== "—" && r !== "-") return r;
    return "";
  }, [primaryStoredContact, mergedProfView.mainContactPhone, row.contacts.phone]);
  const quickEmailLabel = useMemo(() => {
    const e = primaryStoredContact?.email?.trim();
    if (e && e !== "—" && e !== "-") return e;
    const m = mergedProfView.mainContactEmail?.trim();
    if (m && m !== "—" && m !== "-") return m;
    const r = row.contacts.email?.trim();
    if (r && r !== "—" && r !== "-") return r;
    return "";
  }, [primaryStoredContact, mergedProfView.mainContactEmail, row.contacts.email]);
  const quickTelegramLabel = useMemo(() => {
    const t = primaryStoredContact?.telegram?.trim();
    if (t && t !== "—" && t !== "-") return t;
    return "";
  }, [primaryStoredContact]);
  const quickWhatsappLabel = useMemo(() => {
    const w = primaryStoredContact?.whatsapp?.trim();
    if (w && w !== "—" && w !== "-") return w;
    return "";
  }, [primaryStoredContact]);
  const quickAddress = useMemo(() => {
    const a = row.releaseAddress?.trim();
    if (a && a !== "—" && a !== "-") return a;
    return "";
  }, [row.releaseAddress]);
  const quickCity = useMemo(() => {
    const c = mergedProfView.city?.trim() || row.city?.trim();
    if (c && c !== "—" && c !== "-") return c;
    return "";
  }, [mergedProfView.city, row.city]);

  const regionalManagerDisplay = useMemo(() => {
    const fromResp = row.responsibles?.regionalManager?.trim();
    if (isFilledDataCell(fromResp)) return fromResp!.trim();
    if (isFilledDataCell(row.regionalManager)) return row.regionalManager.trim();
    return "";
  }, [row.responsibles?.regionalManager, row.regionalManager]);

  const unloadingOrderValue = useMemo(() => getDealerUnloadingOrder(row.id), [row.id, unloadBump]);

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [unloadDialogOpen, setUnloadDialogOpen] = useState(false);
  const [unloadDraft, setUnloadDraft] = useState("");
  const [peName, setPeName] = useState(row.name);
  const [peCity, setPeCity] = useState(row.city);
  const [peContactName, setPeContactName] = useState(row.contacts.lpr);
  const [pePhone, setPePhone] = useState(row.contacts.phone);
  const [peEmail, setPeEmail] = useState(row.contacts.email);
  const [peComment, setPeComment] = useState("");
  const [profileSaveErr, setProfileSaveErr] = useState("");

  const openProfileDialog = useCallback(() => {
    const m = getMergedDealerProfile(row);
    setPeName(m.displayName);
    setPeCity(m.city);
    setPeContactName(m.mainContactName);
    setPePhone(m.mainContactPhone);
    setPeEmail(m.mainContactEmail);
    setPeComment(m.comment ?? "");
    setProfileSaveErr("");
    setProfileEditOpen(true);
  }, [row]);

  const saveProfileDialog = useCallback(() => {
    setProfileSaveErr("");
    if (!peName.trim() || !peCity.trim()) {
      setProfileSaveErr("Укажите название и город.");
      return;
    }
    updateDealerProfile(
      row.id,
      {
        displayName: peName.trim(),
        city: peCity.trim(),
        mainContactName: peContactName.trim() || undefined,
        mainContactPhone: pePhone.trim() || undefined,
        mainContactEmail: peEmail.trim() || undefined,
        comment: peComment.trim() || undefined,
      },
      profile,
    );
    setProfileEditOpen(false);
  }, [row.id, profile, peName, peCity, peContactName, pePhone, peEmail, peComment]);

  const competitorCommentPreview = useMemo(
    () => getDealerComments(row.id).filter((c) => c.type === "competitor").slice(0, 2),
    [row.id, commentsBump],
  );

  const distributionSnap = useMemo(() => getDistributionSnapshotForCard(row), [row]);

  const newStaffTrainingNeeded = useMemo(() => getNewStaffTrainingNeeded(row.id), [row.id, trainingFlagsBump]);

  const competitorActivityRows = useMemo(() => getCompetitorActivityRows(row), [row]);

  const dealerWorkPlanEntry = useMemo(() => {
    const st = loadDealerWorkPlanState();
    return getDealerScheduledDateForUser(profile.personaUserId, row.id, st);
  }, [profile.personaUserId, row.id, workPlanBump]);

  const dealerWorkPlanHidden = useMemo(() => {
    const st = loadDealerWorkPlanState();
    return isDealerHiddenForUser(profile.personaUserId, row.id, st);
  }, [profile.personaUserId, row.id, workPlanBump]);

  const dealerStockSignal = useMemo(() => getDealerStockSignal(row), [row]);

  const equipmentSignal = useMemo(() => getDealerEquipmentSignal(row), [row]);

  const onPlanShowcaseCheck = useCallback(() => {
    const label = user?.name ?? userLabelFromProfile(profile);
    const uid = user?.id ?? profile.personaUserId;
    const iso = addCalendarDaysIso(new Date(), 5);
    if (canEditClientNextStep(profile, row)) {
      saveClientNextStep(row.id, {
        actionType: "showcase_check",
        contactDate: iso,
        comment: "Плановая проверка витрины (срез дистрибуции старше 2 месяцев).",
        updatedByUserId: uid,
        updatedByLabel: label,
      });
      setNextStepBump((n) => n + 1);
    }
    scrollToSection("next_step");
  }, [profile, row, user]);

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

  const showTermsDistributionBlock = showDistributionBlock || hasTermsBlock;

  const termsDistributionSummary = useMemo(() => {
    const parts: string[] = [];
    if (showDistributionBlock) parts.push(distributionConclusion);
    if (isFilledDataCell(row.terms.payment)) parts.push(`Оплата: ${row.terms.payment.trim()}`);
    if (isFilledDataCell(row.terms.edo)) parts.push(`ЭДО: ${row.terms.edo.trim()}`);
    if (isFilledDataCell(row.terms.tandoorClub)) parts.push(`Тандор клуб: ${row.terms.tandoorClub.trim()}`);
    if (isFilledDataCell(row.terms.special)) parts.push(`Спец. условия: ${row.terms.special.trim()}`);
    if (isFilledDataCell(row.terms.limit)) parts.push(`Лимит: ${row.terms.limit.trim()}`);
    if (isFilledDataCell(row.terms.bonuses)) parts.push(`Бонусы: ${row.terms.bonuses.trim()}`);
    return parts.join(" · ");
  }, [
    showDistributionBlock,
    distributionConclusion,
    row.terms.payment,
    row.terms.edo,
    row.terms.tandoorClub,
    row.terms.special,
    row.terms.limit,
    row.terms.bonuses,
  ]);

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
          <div className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-8">
            <section
              id={SECTION_DOM_IDS.overview}
              data-testid="section-dealer-overview"
              className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
            >
              <SurfaceCard className="p-3 sm:p-4">
                <CardContent className="space-y-3 p-0 sm:space-y-4">
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
                  <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{rowView.name}</h1>

                  <div
                    data-testid="section-dealer-quick-info"
                    className="grid gap-x-4 gap-y-2.5 rounded-lg border border-border/80 bg-muted/10 px-3 py-3 sm:grid-cols-2 xl:grid-cols-3"
                  >
                    {quickCity ? (
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Город</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-city">
                          {quickCity}
                        </p>
                      </div>
                    ) : null}
                    {quickAddress ? (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Адрес</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-address">
                          {quickAddress}
                        </p>
                      </div>
                    ) : (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Адрес</p>
                        <p className="mt-0.5 text-sm text-muted-foreground" data-testid="text-dealer-quick-info-address">
                          Адрес не указан
                        </p>
                      </div>
                    )}
                    {isFilledDataCell(row.manager) ? (
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Менеджер</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-manager">
                          {row.manager.trim()}
                        </p>
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Региональный менеджер</p>
                      <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-regional-manager">
                        {regionalManagerDisplay ? regionalManagerDisplay : "Не назначен"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Категория</p>
                      <p className="mt-0.5 break-words text-sm font-medium text-foreground">{businessCategoryLabel}</p>
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Порядок выгрузки</p>
                          <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground" data-testid="text-dealer-unloading-order">
                            {unloadingOrderValue != null ? unloadingOrderValue : "Не указан"}
                          </p>
                        </div>
                        {canEditProfile ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-8 w-full shrink-0 text-xs sm:w-auto"
                            data-testid="button-dealer-unloading-order-edit"
                            onClick={() => {
                              setUnloadDraft(unloadingOrderValue != null ? String(unloadingOrderValue) : "");
                              setUnloadDialogOpen(true);
                            }}
                          >
                            Изменить
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {quickMainContactLabel ? (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Основной контакт</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-main-contact">
                          {quickMainContactLabel}
                        </p>
                      </div>
                    ) : null}
                    {quickPhoneLabel ? (
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Телефон</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground" data-testid="text-dealer-quick-info-phone">
                          {quickPhoneLabel}
                        </p>
                      </div>
                    ) : null}
                    {quickEmailLabel ? (
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground">{quickEmailLabel}</p>
                      </div>
                    ) : null}
                    {quickWhatsappLabel || quickTelegramLabel ? (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Мессенджеры</p>
                        <p className="mt-0.5 break-words text-sm font-medium text-foreground">
                          {quickWhatsappLabel ? `WhatsApp: ${quickWhatsappLabel}` : null}
                          {quickWhatsappLabel && quickTelegramLabel ? " · " : null}
                          {quickTelegramLabel ? `Telegram: ${quickTelegramLabel}` : null}
                        </p>
                      </div>
                    ) : null}
                    {dealerStockSignal.hasMainWarehouse || dealerStockSignal.hasHardwareWarehouse ? (
                      <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Склад</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-foreground">
                          {dealerStockSignal.hasMainWarehouse ? (
                            <span data-testid="text-dealer-card-main-warehouse">Склад дверей: есть</span>
                          ) : null}
                          {dealerStockSignal.hasHardwareWarehouse ? (
                            <span data-testid="text-dealer-card-hardware-warehouse">Склад фурнитуры: есть</span>
                          ) : null}
                        </p>
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Торговые точки</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground" data-testid="text-dealer-quick-info-trade-points-count">
                        {tradePointsCount}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Юрлица</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground" data-testid="text-dealer-quick-info-legal-entities-count">
                        {legalEntitiesCount}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
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
                </CardContent>
              </SurfaceCard>
              <Dialog open={unloadDialogOpen} onOpenChange={setUnloadDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Порядок выгрузки</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-1">
                    <Label htmlFor="dealer-unload-order-input" className="text-xs text-muted-foreground">
                      Номер (целое число, например 1–12)
                    </Label>
                    <Input
                      id="dealer-unload-order-input"
                      inputMode="numeric"
                      value={unloadDraft}
                      onChange={(e) => setUnloadDraft(e.target.value)}
                      className="min-h-10"
                      data-testid="input-dealer-unloading-order"
                    />
                    <p className="text-[11px] text-muted-foreground">Оставьте пустым и сохраните, чтобы сбросить значение.</p>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" data-testid="button-dealer-unloading-order-cancel" onClick={() => setUnloadDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button
                      type="button"
                      data-testid="button-dealer-unloading-order-save"
                      onClick={() => {
                        const raw = unloadDraft.trim();
                        const n = parseInt(raw, 10);
                        const next =
                          raw === "" || raw === "—" || raw === "-"
                            ? null
                            : Number.isFinite(n) && n > 0
                              ? n
                              : null;
                        if (raw !== "" && raw !== "—" && raw !== "-" && !(Number.isFinite(n) && n > 0)) {
                          return;
                        }
                        setDealerUnloadingOrder(row.id, next, profile.personaUserId, user?.name ?? userLabelFromProfile(profile));
                        setUnloadDialogOpen(false);
                      }}
                    >
                      Сохранить
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>

            <section
              id={SECTION_DOM_IDS.contacts}
              data-testid="section-dealer-contacts"
              className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
            >
              <SectionTitle subtitle="Полный список контактов и быстрые действия.">Контакты клиента</SectionTitle>
              <DealerContactsSection row={row} profile={profile} variant="embedded" />
            </section>

            <DealerCharacteristicsSection row={row} profile={profile} />

            <section
              id={SECTION_DOM_IDS.work}
              className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
            >
              {dealerWorkPlanEntry?.date || dealerWorkPlanEntry?.note?.trim() || dealerWorkPlanHidden ? (
                <SurfaceCard>
                  <CardContent className="space-y-1.5 px-3 py-2.5 text-xs sm:px-4">
                    {dealerWorkPlanEntry?.date ? (
                      <p data-testid="text-dealer-card-work-plan-date">Запланирован в работу: {formatWorkPlanDateRu(dealerWorkPlanEntry.date)}</p>
                    ) : null}
                    {dealerWorkPlanEntry?.note?.trim() ? (
                      <p className="text-muted-foreground" data-testid="text-dealer-card-work-plan-note">
                        Комментарий к плану: {dealerWorkPlanEntry.note.trim()}
                      </p>
                    ) : null}
                    {dealerWorkPlanHidden ? (
                      <div className="pt-0.5">
                        <Badge variant="secondary" className="text-[11px] font-medium" data-testid="badge-dealer-card-hidden-from-work-plan">
                          Скрыт из рабочего списка
                        </Badge>
                      </div>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              ) : null}

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
                onScrollToHistory={() => scrollToSection("history")}
                onOpenShowcaseDeficitFilter={() => {
                  setShowcaseCategoryListMode("deficit");
                  scrollToSection("showcase_distribution");
                }}
                distributionSnapshotStale={distributionSnap.isStale}
                distributionSnapshotLabel={distributionSnap.displayLabel}
                equipmentSignal={equipmentSignal}
                onScrollToStaticProfile={() => scrollToSection("static_profile")}
              />
            </section>

            <DealerShowcaseDistributionSection
              row={row}
              profile={profile}
              categoryListMode={showcaseCategoryListMode}
              onCategoryListModeChange={setShowcaseCategoryListMode}
              distributionSnapshotStale={distributionSnap.isStale}
              distributionSnapshotLabel={distributionSnap.displayLabel}
              onPlanShowcaseCheck={onPlanShowcaseCheck}
              onApplied={() => setShowcaseBump((n) => n + 1)}
            />

            <DealerShowcaseMatrixSummarySection row={row} profile={profile} />

            <DealerTradePointsSection row={row} sectionDomId={SECTION_DOM_IDS.points} profile={profile} />

            {competitorActivityRows.length > 0 || canEditCardComments ? (
              <section
                data-testid="section-dealer-competitor-activity"
                className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
              >
                <SectionTitle
                  subtitle={
                    competitorActivityRows.length > 0
                      ? "Кратко по рынку точки (без финансовых данных)."
                      : "Зафиксируйте наблюдения — текст попадёт в историю активности."
                  }
                >
                  Активность конкурентов
                </SectionTitle>
                <SurfaceCard>
                  <CardContent className="space-y-3 px-3 py-3 sm:px-4">
                    {competitorActivityRows.length > 0 ? (
                      <div className="space-y-2">
                        {competitorActivityRows.map((a) => (
                          <div
                            key={a.activityId}
                            data-testid={`row-dealer-competitor-activity-${a.activityId}`}
                            className="rounded-lg border border-border/60 bg-muted/10 px-2.5 py-2 text-sm"
                          >
                            <p className="font-semibold text-foreground">{a.competitorName}</p>
                            <p className="text-xs text-muted-foreground">Акция / условия: {a.promo}</p>
                            <p className="mt-1 text-xs leading-relaxed text-foreground">Комментарий РМ: {a.rmComment}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Обновлено: {a.updatedAtLabel}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {competitorCommentPreview.length > 0 ? (
                      <div className="space-y-2">
                        {competitorCommentPreview.map((c) => {
                          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(c.createdAt.trim());
                          const head = m ? `${m[3]}.${m[2]}.${m[1]} · ${c.createdByName}` : `${c.createdByName}`;
                          return (
                            <div
                              key={c.id}
                              data-testid={`row-dealer-competitor-comment-${c.id}`}
                              className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs leading-relaxed"
                            >
                              <p className="text-[11px] font-semibold text-muted-foreground">{head}</p>
                              <p className="mt-0.5 text-sm text-foreground">{c.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {canEditCardComments ? (
                      <div
                        data-testid="section-dealer-competitor-comment-form"
                        className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/10 p-2.5 sm:p-3"
                      >
                        <Label htmlFor="dealer-competitor-comment" className="text-xs text-muted-foreground">
                          Комментарий по конкурентам
                        </Label>
                        <Textarea
                          id="dealer-competitor-comment"
                          value={competitorCommentDraft}
                          onChange={(e) => setCompetitorCommentDraft(e.target.value)}
                          placeholder="Комментарий по конкурентам"
                          rows={2}
                          className="min-h-[52px] resize-y text-sm"
                          data-testid="textarea-dealer-competitor-comment"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-9 w-full font-semibold sm:w-auto"
                          data-testid="button-dealer-competitor-comment-add"
                          disabled={!competitorCommentDraft.trim()}
                          onClick={() => {
                            addDealerComment(row.id, {
                              type: "competitor",
                              body: competitorCommentDraft,
                              createdBy: user?.id ?? profile.personaUserId,
                              createdByName: user?.name ?? userLabelFromProfile(profile),
                            });
                            setCompetitorCommentDraft("");
                          }}
                        >
                          Добавить комментарий
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              </section>
            ) : null}

            <DealerLegalEntitiesSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user?.name ?? userLabelFromProfile(profile)}
            />

            <DealerClientNextStepSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user?.name ?? userLabelFromProfile(profile)}
              onSaved={() => setNextStepBump((n) => n + 1)}
            />

            <Bitrix24TasksPanel
              scope="dealer"
              dealerId={row.id}
              dealerName={rowView.name}
              canCreate={canEditClientNextStep(profile, row)}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user?.name ?? userLabelFromProfile(profile)}
            />

            {showTermsDistributionBlock ? (
              <section
                id={SECTION_DOM_IDS.terms_distribution}
                data-testid="section-dealer-terms-distribution"
                className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
              >
                <SectionTitle subtitle="Условия сотрудничества и показатели дистрибуции в одном месте.">
                  Условия и дистрибуция
                </SectionTitle>
                <SurfaceCard>
                  <CardContent className="space-y-3 px-3 py-3 sm:px-4">
                    {termsDistributionSummary.trim() ? (
                      <p
                        data-testid="text-dealer-terms-distribution-summary"
                        className="text-sm leading-snug text-muted-foreground"
                      >
                        {termsDistributionSummary}
                      </p>
                    ) : null}
                    {showDistributionBlock ? (
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
                    ) : null}
                    {hasTermsBlock ? (
                      <div className="space-y-0 border-t border-border pt-3">
                        {isFilledDataCell(row.terms.tandoorClub) ? (
                          <FieldRow label="Тандор клуб" value={row.terms.tandoorClub} icon={Handshake} />
                        ) : null}
                        {isFilledDataCell(row.terms.special) ? <FieldRow label="Спец. условия" value={row.terms.special} /> : null}
                        {isFilledDataCell(row.terms.payment) ? <FieldRow label="Тип оплаты" value={row.terms.payment} /> : null}
                        {isFilledDataCell(row.terms.edo) ? <FieldRow label="ЭДО" value={row.terms.edo} /> : null}
                        {isFilledDataCell(row.terms.limit) ? (
                          <FieldRow label="Лимит / индивидуальные условия" value={row.terms.limit} />
                        ) : null}
                        {isFilledDataCell(row.terms.bonuses) ? (
                          <FieldRow label="Бонусы / мотивация продавцов" value={row.terms.bonuses} />
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              </section>
            ) : null}

            <section
              id={SECTION_DOM_IDS.history}
              data-testid="section-dealer-activity-history"
              className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
            >
              <SectionTitle subtitle="События по витрине, шагам, комментариям и сопровождению.">
                История активности
              </SectionTitle>
              <SurfaceCard>
                <CardContent className="px-3 py-0 pt-2 sm:px-4">
                  {canEditCardComments ? (
                    <div
                      data-testid="section-dealer-history-comment-form"
                      className="border-b border-border py-3 first:pt-2"
                    >
                      <Label htmlFor="dealer-history-comment" className="text-xs text-muted-foreground">
                        Комментарий в ленту
                      </Label>
                      <Textarea
                        id="dealer-history-comment"
                        value={historyCommentDraft}
                        onChange={(e) => setHistoryCommentDraft(e.target.value)}
                        placeholder="Добавить комментарий по клиенту"
                        rows={2}
                        className="mt-1.5 min-h-[52px] resize-y text-sm"
                        data-testid="textarea-dealer-history-comment"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 min-h-9 w-full font-semibold sm:w-auto"
                        data-testid="button-dealer-history-comment-add"
                        disabled={!historyCommentDraft.trim()}
                        onClick={() => {
                          addDealerComment(row.id, {
                            type: "general",
                            body: historyCommentDraft,
                            createdBy: user?.id ?? profile.personaUserId,
                            createdByName: user?.name ?? userLabelFromProfile(profile),
                          });
                          setHistoryCommentDraft("");
                        }}
                      >
                        Добавить
                      </Button>
                    </div>
                  ) : null}
                  {(historyExpanded ? historyTimeline : historyTimeline.slice(0, 3)).map((ev) => {
                    const nav = inferHistoryNavTarget(ev);
                    const openLinked = () => {
                      if (nav === "next_step") scrollToDataTestId("section-dealer-next-step");
                      else if (nav === "showcase") scrollToDataTestId("section-dealer-showcase-distribution");
                      else if (nav === "tasks_page") setLocation(buildHashPath("/tasks", { dealerId: row.id }));
                    };
                    return (
                      <div
                        key={ev.id}
                        data-testid={`row-dealer-history-event-${ev.id}`}
                        className="flex min-w-0 items-start gap-2 border-b border-border py-3 last:border-b-0 first:pt-2"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">{ev.meta}</p>
                          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">{ev.body}</p>
                        </div>
                        {nav ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 px-2 text-xs font-semibold"
                            data-testid={`button-dealer-history-event-open-${ev.id}`}
                            onClick={openLinked}
                          >
                            Открыть
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
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

            {mergedProfView.comment ? (
              <p className="scroll-mt-28 text-sm leading-relaxed text-muted-foreground sm:scroll-mt-32">{mergedProfView.comment}</p>
            ) : null}
            <div className="flex justify-end">
              {canEditProfile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 w-full font-semibold sm:w-auto"
                  data-testid="button-dealer-profile-edit"
                  onClick={openProfileDialog}
                >
                  Редактировать данные
                </Button>
              ) : null}
            </div>
            <DealerStaticProfileSection row={rowView} categoryLabel={businessCategoryLabel} />

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
                <SectionTitle subtitle="Только если есть зафиксированные вопросы по клиенту.">Проблемы и внимание</SectionTitle>
                <SurfaceCard
                  className={cn(
                    "mt-2 border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-card",
                    !row.hasProblem && "border-border from-muted/30",
                  )}
                >
                  <CardContent className="space-y-2.5 px-3 py-3 sm:space-y-3 sm:px-4">
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
                    <p className={cn("text-sm font-semibold leading-snug", row.hasProblem ? "text-red-700" : "text-foreground")}>
                      {row.issues.summary}
                    </p>
                    <div className="grid gap-2 rounded-lg bg-card/80 p-2.5 sm:grid-cols-2 sm:gap-3 sm:p-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Кто зафиксировал</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.issues.who}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дата</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{row.issues.date}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Действие в карточке внимания
                        </p>
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
                    {canEditCardComments ? (
                      <div
                        data-testid="section-dealer-problem-comment-form"
                        className="space-y-2 border-t border-border/80 pt-2.5"
                      >
                        <Label htmlFor="dealer-problem-comment" className="text-xs text-muted-foreground">
                          Комментарий по проблеме
                        </Label>
                        <Textarea
                          id="dealer-problem-comment"
                          value={problemCommentDraft}
                          onChange={(e) => setProblemCommentDraft(e.target.value)}
                          placeholder="Комментарий по проблеме"
                          rows={2}
                          className="min-h-[52px] resize-y text-sm"
                          data-testid="textarea-dealer-problem-comment"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-9 w-full font-semibold sm:w-auto"
                          data-testid="button-dealer-problem-comment-add"
                          disabled={!problemCommentDraft.trim()}
                          onClick={() => {
                            addDealerComment(row.id, {
                              type: "problem",
                              body: problemCommentDraft,
                              createdBy: user?.id ?? profile.personaUserId,
                              createdByName: user?.name ?? userLabelFromProfile(profile),
                            });
                            setProblemCommentDraft("");
                          }}
                        >
                          Сохранить комментарий
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </SurfaceCard>
              </div>
            ) : null}

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

            {showTrainingSection ? (
              <DealerTrainingAttentionSection
                row={row}
                completed={trainingCompleted}
                newStaffTrainingNeeded={newStaffTrainingNeeded}
                onNewStaffTrainingChange={(next) => {
                  setNewStaffTrainingNeeded(row.id, next, user?.name ?? userLabelFromProfile(profile));
                }}
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

      <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-dealer-profile-edit">
          <DialogHeader>
            <DialogTitle className="text-base">Редактирование данных клиента</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {profileSaveErr ? <p className="text-xs font-medium text-destructive">{profileSaveErr}</p> : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Название</Label>
              <Input className="min-h-10" value={peName} onChange={(e) => setPeName(e.target.value)} data-testid="input-dealer-profile-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input className="min-h-10" value={peCity} onChange={(e) => setPeCity(e.target.value)} data-testid="input-dealer-profile-city" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Основной контакт</Label>
              <Input
                className="min-h-10"
                value={peContactName}
                onChange={(e) => setPeContactName(e.target.value)}
                data-testid="input-dealer-profile-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input className="min-h-10" value={pePhone} onChange={(e) => setPePhone(e.target.value)} data-testid="input-dealer-profile-contact-phone" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="min-h-10" value={peEmail} onChange={(e) => setPeEmail(e.target.value)} data-testid="input-dealer-profile-contact-email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                rows={3}
                className="min-h-[72px] resize-y text-sm"
                value={peComment}
                onChange={(e) => setPeComment(e.target.value)}
                data-testid="textarea-dealer-profile-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-profile-save" onClick={saveProfileDialog}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
