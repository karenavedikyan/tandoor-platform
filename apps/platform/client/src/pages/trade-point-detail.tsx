import type { ComponentProps, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { Camera, ChevronDown, ChevronRight, ChevronUp, MapPin, Store, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { TradePointContactsSection } from "@/components/trade-point-contacts-section";
import { getDealerById, type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  filterMatrix,
  getTradePointMatrix,
  summarizeMatrix,
  type MatrixFilterId,
} from "@/lib/trade-point-matrix-data";
import {
  buildRecommendedMatrixTasks,
  summarizeMatrixTasks,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_ROLE_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
  invalidateMatrixTasksCache,
  type MatrixTask,
  type MatrixTaskRecommendation,
  type MatrixTaskStatus,
} from "@/lib/trade-point-task-data";
import {
  getTradePointTrainingAttentionSignal,
  tradePointProductTrainingStorageKey,
  trainingAttentionLevelBadgeClass,
} from "@/lib/training-attention";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import { resolveActualizationTradePointDetail } from "@/lib/client-base-actualization-data-merge";
import { TradePointManualActualizationView } from "@/components/trade-point-manual-actualization-view";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import {
  addTradePointComment,
  canEditTradePointComments,
  getTradePointComments,
  TRADE_POINT_COMMENTS_EVENT,
} from "@/lib/trade-point-comments";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import {
  CLIENT_CONTACTS_EVENT,
  clientContactScopeKeyTradePoint,
  getClientContactScopeHistoryEvents,
} from "@/lib/client-contacts";
import {
  archiveTradePoint,
  canEditDealerTradePoints,
  DEALER_TRADE_POINTS_EVENT,
  getMergedDealerTradePoints,
  getResolvedTradePointByIds,
  isVirtualDefaultTradePointId,
  updateTradePoint,
  type MergedTradePointEntry,
} from "@/lib/dealer-trade-points-overrides";
import { getDealerRowWithProfileOverrides, DEALER_PROFILE_OVERRIDES_EVENT } from "@/lib/dealer-profile-overrides";
import { DEALER_SHIPMENT_DAY_LABELS, DEALER_SHIPMENT_DAY_ORDER, type DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import {
  getShowcaseTasksForDealerDisplay,
  loadShowcaseStorage,
  SHOWCASE_STORAGE_EVENT,
  userLabelFromProfile,
} from "@/lib/showcase-distribution-data";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { TradePointPhotoBlock } from "@/components/trade-point-photo-block";
import { TradePointShowcaseMatrixSection } from "@/components/trade-point-showcase-matrix-section";
import {
  getShowcaseMatrixTpHistoryEvents,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
} from "@/lib/trade-point-showcase-matrix-storage";

const SECTION_IDS = ["overview", "training", "matrix", "showcase", "distribution", "tasks", "history", "photos"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-overview",
  training: "section-trade-point-training-attention",
  matrix: "section-trade-point-matrix",
  showcase: "section-trade-point-showcase-matrix",
  distribution: "section-trade-point-showcase-distribution",
  tasks: "section-trade-point-showcase-open-tasks",
  history: "trade-point-section-history",
  photos: "trade-point-section-photos",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Общее",
  training: "Обучение",
  matrix: "Матрица",
  showcase: "Витрина",
  distribution: "Дистрибуция",
  tasks: "Задачи по витрине",
  history: "История",
  photos: "Фото",
};

const NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-nav-overview",
  training: "trade-point-section-nav-training",
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

type MatrixTaskFilterId = "all" | "new" | "in_progress" | "overdue" | "high";

const MATRIX_TASK_FILTERS: { id: MatrixTaskFilterId; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-trade-point-tasks-matrix-all" },
  { id: "new", label: "Новые", testId: "filter-trade-point-tasks-matrix-new" },
  { id: "in_progress", label: "В работе", testId: "filter-trade-point-tasks-matrix-in-progress" },
  { id: "overdue", label: "Просрочено", testId: "filter-trade-point-tasks-matrix-overdue" },
  { id: "high", label: "Высокий приоритет", testId: "filter-trade-point-tasks-matrix-high" },
];

function taskStatusTone(status: MatrixTaskStatus) {
  if (status === "new") return "border-primary/40 bg-primary/10 text-primary";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function taskPriorityTone(priority: MatrixTask["priority"]) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-900";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
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

function MatrixTaskSummaryCard({
  tasks,
  testId = "card-trade-point-matrix-task-summary",
}: {
  tasks: MatrixTask[];
  testId?: string;
}) {
  const summary = useMemo(() => summarizeMatrixTasks(tasks), [tasks]);
  const tiles = [
    { label: "Всего", value: summary.total, tone: "border-border bg-muted/40 text-foreground" },
    { label: "Новые", value: summary.newCount, tone: "border-primary/40 bg-primary/10 text-primary" },
    { label: "В работе", value: summary.inProgressCount, tone: "border-amber-200 bg-amber-50 text-amber-950" },
    { label: "Просрочено", value: summary.overdueCount, tone: "border-red-200 bg-red-50 text-red-900" },
    { label: "Высокий приоритет", value: summary.highPriorityCount, tone: "border-border bg-card text-foreground" },
  ];
  return (
    <SurfaceCard data-testid={testId}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Сводка по задачам матрицы
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border px-3 py-2.5", t.tone)}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

function MatrixTaskCard({
  task,
  expanded,
  onToggle,
}: {
  task: MatrixTask;
  expanded: boolean;
  onToggle: (taskId: string) => void;
}) {
  return (
    <SurfaceCard data-testid={`card-matrix-task-${task.taskId}`} id={`card-matrix-task-${task.taskId}`}>
      <CardHeader className="space-y-2 pb-2 pt-4">
        <CardTitle className="text-base font-semibold leading-snug">{task.title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("font-medium", taskPriorityTone(task.priority))}>
            {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
          </Badge>
          <Badge variant="outline" className={cn("font-medium", taskStatusTone(task.status))}>
            {MATRIX_TASK_STATUS_LABEL[task.status]}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted/60 font-medium">
            {MATRIX_TASK_TYPE_LABEL[task.type]}
          </Badge>
          <Badge variant="outline" className="border-border bg-card font-medium">
            Зона {task.zone}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 text-sm text-muted-foreground">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground">Срок:</span> {task.dueDate}
          </p>
          <p>
            <span className="font-semibold text-foreground">Ответственный:</span>{" "}
            {MATRIX_TASK_ROLE_LABEL[task.assigneeRole]}
          </p>
          <p>
            <span className="font-semibold text-foreground">Точка:</span> {task.tradePointName}
          </p>
          <p>
            <span className="font-semibold text-foreground">Образцы:</span>{" "}
            <span className="tabular-nums">
              {task.actualSamples} / {task.targetSamples}
            </span>
          </p>
        </div>
        {expanded ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Описание</p>
            <p className="mt-1 text-sm leading-relaxed">{task.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Источник: матрица товаров · {task.portal}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-expand-matrix-task-${task.taskId}`}
            onClick={() => onToggle(task.taskId)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden /> Свернуть
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden /> Подробнее
              </>
            )}
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-open-matrix-task-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Открыть модель</Link>
          </Button>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

function tradePointContactDisplay(dealer: DealerRow, point: DealerTradePoint): string {
  const name = point.contactName?.trim();
  const phone = point.contactPhone?.trim();
  if (name && phone && name !== "—" && phone !== "—") return `${name} · ${phone}`;
  if (phone && phone !== "—" && phone !== "-") return phone;
  if (name && name !== "—" && name !== "-") return name;
  const activeCount = getMergedDealerTradePoints(dealer, { includeArchived: false }).length;
  if (activeCount === 1) {
    const p = dealer.contacts.phone?.trim();
    if (p && p !== "—" && p !== "-") return p;
  }
  return "";
}

function mapSearchTextForPoint(point: DealerTradePoint): string {
  return [point.city, point.address]
    .map((x) => x.trim())
    .filter((x) => x && x !== "—" && x !== "-")
    .join(", ");
}

function TradePointDetailContent({
  dealer,
  point,
  tpMeta,
}: {
  dealer: DealerRow;
  point: DealerTradePoint;
  tpMeta: MergedTradePointEntry;
}) {
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const { user } = useCurrentUser();
  const activeSection = useActiveSection();
  const [commentsBump, setCommentsBump] = useState(0);
  const [contactsBump, setContactsBump] = useState(0);
  const [showcaseBump, setShowcaseBump] = useState(0);
  const [matrixBump, setMatrixBump] = useState(0);
  const routeQs = useRouteSearchParams();
  const [commentDraft, setCommentDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [eName, setEName] = useState(point.name);
  const [eCity, setECity] = useState(point.city);
  const [eAddress, setEAddress] = useState(point.address);
  const [eContactName, setEContactName] = useState(point.contactName ?? "");
  const [eContactPhone, setEContactPhone] = useState(point.contactPhone ?? "");
  const [eComment, setEComment] = useState(point.tpComment ?? point.issues ?? "");
  const [eShowcase, setEShowcase] = useState(point.showcaseStatus);
  const [eShipmentDays, setEShipmentDays] = useState<DealerShipmentDayId[]>(() =>
    (point.shipmentDayIds ?? []).filter((d): d is DealerShipmentDayId =>
      (DEALER_SHIPMENT_DAY_ORDER as readonly string[]).includes(d),
    ),
  );
  const [eMainWh, setEMainWh] = useState(Boolean(point.tpHasMainWarehouse));
  const [eHwWh, setEHwWh] = useState(Boolean(point.tpHasHardwareWarehouse));

  useEffect(() => {
    setEName(point.name);
    setECity(point.city);
    setEAddress(point.address);
    setEContactName(point.contactName ?? "");
    setEContactPhone(point.contactPhone ?? "");
    setEComment(point.tpComment ?? (point.issues && point.issues !== "—" ? point.issues : ""));
    setEShowcase(point.showcaseStatus);
    setEShipmentDays(
      (point.shipmentDayIds ?? []).filter((d): d is DealerShipmentDayId =>
        (DEALER_SHIPMENT_DAY_ORDER as readonly string[]).includes(d),
      ),
    );
    setEMainWh(Boolean(point.tpHasMainWarehouse));
    setEHwWh(Boolean(point.tpHasHardwareWarehouse));
    setEditing(false);
    setEditErr("");
  }, [point]);

  useEffect(() => {
    const fn = () => setCommentsBump((n) => n + 1);
    window.addEventListener(TRADE_POINT_COMMENTS_EVENT, fn);
    return () => window.removeEventListener(TRADE_POINT_COMMENTS_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setContactsBump((n) => n + 1);
    window.addEventListener(CLIENT_CONTACTS_EVENT, fn);
    return () => window.removeEventListener(CLIENT_CONTACTS_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setShowcaseBump((n) => n + 1);
    window.addEventListener(SHOWCASE_STORAGE_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_STORAGE_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => {
      setMatrixBump((n) => n + 1);
      invalidateMatrixTasksCache();
    };
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  const dealerForRbac = useMemo(() => getDealerById(dealer.id) ?? dealer, [dealer]);
  const isVirtualDefaultPoint = useMemo(
    () => isVirtualDefaultTradePointId(dealer.id, point.id),
    [dealer.id, point.id],
  );
  const useManualAnketa =
    tpMeta.isManual &&
    !isVirtualDefaultPoint &&
    actx.enabled &&
    canActualizeClientBase(profile);
  const canEditTp = useMemo(
    () => !isVirtualDefaultPoint && canEditDealerTradePoints(profile, dealerForRbac),
    [profile, dealerForRbac, isVirtualDefaultPoint],
  );
  const canEditTpComments = useMemo(() => canEditTradePointComments(profile, dealer), [profile, dealer]);
  const canCreateBitrix24Task = useMemo(() => canEditClientNextStep(profile, dealer), [profile, dealer]);
  const tpComments = useMemo(() => getTradePointComments(dealer.id, point.id), [dealer.id, point.id, commentsBump]);
  const showcaseTasksOpen = useMemo(() => {
    const storage = loadShowcaseStorage();
    const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
    return tasks.filter((t) => t.status !== "done").slice(0, 8);
  }, [dealer, showcaseBump]);

  const contactLine = useMemo(() => tradePointContactDisplay(dealer, point), [dealer, point]);
  const tpContactScopeKey = useMemo(() => clientContactScopeKeyTradePoint(dealer.id, point.id), [dealer.id, point.id]);
  const tpContactHistory = useMemo(
    () => getClientContactScopeHistoryEvents(tpContactScopeKey),
    [tpContactScopeKey, contactsBump],
  );
  const tpMatrixHistory = useMemo(
    () => getShowcaseMatrixTpHistoryEvents(dealer.id, point.id, loadShowcaseMatrixStorage()),
    [dealer.id, point.id, matrixBump],
  );

  useEffect(() => {
    if (routeQs.get("tradePointShowcase") !== "1") return;
    requestAnimationFrame(() => {
      document.getElementById("section-trade-point-showcase-matrix")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [routeQs, dealer.id, point.id]);
  const mapSearch = useMemo(() => mapSearchTextForPoint(point), [point]);
  const yandexMapHref = useMemo(() => `https://yandex.ru/maps/?text=${encodeURIComponent(mapSearch || "Россия")}`, [mapSearch]);
  const clientMapHref = useMemo(() => {
    const c = point.city.trim();
    if (!c || c === "—") return null;
    return buildHashPath("/client-map", { city: c });
  }, [point.city]);
  const dist = point.distribution;
  const conclusion = useMemo(() => distributionConclusion(dist), [dist]);
  const showcaseComment = useMemo(
    () => (dealer.hasProblem ? "Есть вопросы по витрине — согласовать с РМ план работ." : "Состояние в норме для текущего цикла."),
    [dealer.hasProblem],
  );
  const matrixItems = useMemo(() => getTradePointMatrix(dealer.id, point.id), [dealer.id, point.id]);
  const matrixSummary = useMemo(() => summarizeMatrix(matrixItems), [matrixItems]);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilterId>("all");
  const filteredMatrix = useMemo(() => filterMatrix(matrixItems, matrixFilter), [matrixItems, matrixFilter]);

  const recommendations = useMemo(
    () => buildRecommendedMatrixTasks(dealer.id, point.id, point.name, matrixItems),
    [dealer.id, point.id, point.name, matrixItems],
  );
  const recommendationByProductId = useMemo(() => {
    const map = new Map<string, MatrixTaskRecommendation>();
    for (const r of recommendations) map.set(r.productId, r);
    return map;
  }, [recommendations]);

  const [createdTasks, setCreatedTasks] = useState<MatrixTask[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [matrixTaskFilter, setMatrixTaskFilter] = useState<MatrixTaskFilterId>("all");

  const tpTrainingStorageKey = tradePointProductTrainingStorageKey(dealer.id, point.id);
  const [tpTrainingDone, setTpTrainingDone] = useState(() => {
    if (typeof window === "undefined") return point.productTrainingCompleted;
    const s = sessionStorage.getItem(tpTrainingStorageKey);
    if (s === "1") return true;
    if (s === "0") return false;
    return point.productTrainingCompleted;
  });
  const tpTrainingSignal = useMemo(
    () => getTradePointTrainingAttentionSignal(dealer, point, tpTrainingDone),
    [dealer, point, tpTrainingDone],
  );
  const tpTrainingHref =
    tpTrainingSignal.suggestedTrainingProgramIds[0] != null
      ? `/training/programs/${tpTrainingSignal.suggestedTrainingProgramIds[0]}`
      : "/training";

  useEffect(() => {
    setCreatedTasks([]);
    setExpandedTaskIds(new Set());
    setMatrixTaskFilter("all");
    const s = sessionStorage.getItem(tpTrainingStorageKey);
    if (s === "1") setTpTrainingDone(true);
    else if (s === "0") setTpTrainingDone(false);
    else setTpTrainingDone(point.productTrainingCompleted);
  }, [dealer.id, point.id, point.productTrainingCompleted, tpTrainingStorageKey]);

  const createdTaskByProductId = useMemo(() => {
    const map = new Map<string, MatrixTask>();
    for (const t of createdTasks) map.set(t.productId, t);
    return map;
  }, [createdTasks]);

  const handleCreateTask = useCallback((rec: MatrixTaskRecommendation) => {
    setCreatedTasks((prev) => {
      if (prev.some((t) => t.taskId === rec.taskId)) return prev;
      const created: MatrixTask = { ...rec, recommended: false } as MatrixTask;
      return [...prev, created];
    });
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(rec.taskId);
      return next;
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`card-matrix-task-${rec.taskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleScrollToTask = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`card-matrix-task-${taskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const filteredCreatedTasks = useMemo(() => {
    if (matrixTaskFilter === "all") return createdTasks;
    if (matrixTaskFilter === "high") return createdTasks.filter((t) => t.priority === "high");
    return createdTasks.filter((t) => t.status === matrixTaskFilter);
  }, [createdTasks, matrixTaskFilter]);

  const openShowcaseTasksCount = useMemo(() => {
    const pointOpen = point.tasks.filter((t) => t.status !== "Закрыта").length;
    return pointOpen + showcaseTasksOpen.length;
  }, [point.tasks, showcaseTasksOpen]);

  const showcaseTasksLinkHref = useMemo(() => buildHashPath("/tasks", { dealerId: dealer.id }), [dealer.id]);

  const showcaseStatusOptions = useMemo(() => {
    const b = ["Хорошо", "Норма", "Требует внимания", "Плохо", "На контроле", "—"];
    const c = point.showcaseStatus?.trim();
    if (c && !b.includes(c)) return [c, ...b];
    return b;
  }, [point.showcaseStatus]);

  const toggleShipmentDay = useCallback((day: DealerShipmentDayId) => {
    setEShipmentDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }, []);

  const handleSaveEdit = useCallback(() => {
    setEditErr("");
    if (!eName.trim() || !eCity.trim() || !eAddress.trim()) {
      setEditErr("Укажите название, город и адрес.");
      return;
    }
    updateTradePoint(
      dealer.id,
      point.id,
      {
        name: eName.trim(),
        city: eCity.trim(),
        address: eAddress.trim(),
        contactName: eContactName.trim() || undefined,
        contactPhone: eContactPhone.trim() || undefined,
        comment: eComment.trim() || undefined,
        showcaseStatus: eShowcase.trim(),
        shipmentDayIds: eShipmentDays,
        hasMainWarehouse: eMainWh,
        hasHardwareWarehouse: eHwWh,
      },
      profile,
    );
    setEditing(false);
  }, [
    eName,
    eCity,
    eAddress,
    eContactName,
    eContactPhone,
    eComment,
    eShowcase,
    eShipmentDays,
    eMainWh,
    eHwWh,
    dealer.id,
    point.id,
    profile,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditErr("");
    setEName(point.name);
    setECity(point.city);
    setEAddress(point.address);
    setEContactName(point.contactName ?? "");
    setEContactPhone(point.contactPhone ?? "");
    setEComment(point.tpComment ?? (point.issues && point.issues !== "—" ? point.issues : ""));
    setEShowcase(point.showcaseStatus);
    setEShipmentDays(
      (point.shipmentDayIds ?? []).filter((d): d is DealerShipmentDayId =>
        (DEALER_SHIPMENT_DAY_ORDER as readonly string[]).includes(d),
      ),
    );
    setEMainWh(Boolean(point.tpHasMainWarehouse));
    setEHwWh(Boolean(point.tpHasHardwareWarehouse));
    setEditing(false);
  }, [point]);

  const handleConfirmArchive = useCallback(() => {
    archiveTradePoint(dealer.id, point.id, profile);
    setArchiveOpen(false);
  }, [dealer.id, point.id, profile]);

  const breadcrumbDealerLabel = dealer.name;

  if (useManualAnketa) {
    return <TradePointManualActualizationView dealer={dealer} point={point} profile={profile} />;
  }

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] space-y-4 sm:space-y-6"
      data-testid="page-trade-point-detail"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card sm:w-auto">
          <Link href={`/dealers/${dealer.id}`} data-testid="link-trade-point-back-to-dealer">
            Назад к клиенту
          </Link>
        </Button>
        <Button asChild variant="secondary" className="min-h-11 w-full border-border sm:w-auto" data-testid="button-back-to-dealer-base">
          <Link href="/dealer-base">К клиентской базе</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground">Клиент</p>
        <p className="text-sm font-semibold text-foreground" data-testid="text-trade-point-dealer-name">
          {dealer.name}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Торговая точка</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl" data-testid="text-trade-point-name">
          {point.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px] font-medium">
            № {point.id}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-950">
            {point.status}
          </Badge>
          {tpMeta.isArchived ? (
            <Badge variant="secondary" className="text-[10px] font-medium" data-testid="badge-trade-point-archived">
              Архивная
            </Badge>
          ) : null}
          {isVirtualDefaultPoint ? (
            <Badge
              variant="outline"
              className="text-[10px] font-medium"
              data-testid="badge-trade-point-virtual-default"
            >
              Основная (по дилеру)
            </Badge>
          ) : null}
        </div>
        {isVirtualDefaultPoint ? (
          <p
            className="mt-2 text-xs text-muted-foreground"
            data-testid="text-trade-point-virtual-default-hint"
          >
            Точки не заведены отдельно — работаем как с одной основной торговой точкой.
          </p>
        ) : null}
        {tpMeta.isManual && !isVirtualDefaultPoint ? (
          <p
            className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950"
            data-testid="text-trade-point-empty-state"
          >
            Для этой торговой точки пока нет данных. Заполните основные сведения или добавьте фото / витрину.
          </p>
        ) : null}
        {canEditTp ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-trade-point-edit"
              onClick={() => {
                setEditErr("");
                setEditing(true);
              }}
            >
              Редактировать точку
            </Button>
            {!tpMeta.isArchived ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-9 w-full font-semibold sm:w-auto"
                data-testid={`button-trade-point-archive-${point.id}`}
                onClick={() => setArchiveOpen(true)}
              >
                Архивировать точку
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          <span data-testid="text-trade-point-address">{point.address}</span>
        </p>
        {contactLine ? (
          <p className="mt-2 text-sm font-medium text-foreground" data-testid="text-trade-point-contact">
            {contactLine}
          </p>
        ) : (
          <p className="sr-only" data-testid="text-trade-point-contact">
            —
          </p>
        )}
        <div className="mt-3">
          <Button asChild variant="outline" size="sm" className="min-h-9 w-full font-semibold sm:w-auto">
            {clientMapHref ? (
              <Link href={clientMapHref} data-testid="link-trade-point-open-map">
                Открыть на карте
              </Link>
            ) : (
              <a href={yandexMapHref} target="_blank" rel="noreferrer" data-testid="link-trade-point-open-map">
                Открыть на карте
              </a>
            )}
          </Button>
        </div>
      </div>

      {editing ? (
        <SurfaceCard className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Редактирование точки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {editErr ? <p className="text-xs font-medium text-destructive">{editErr}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Название</Label>
                <Input className="min-h-10" value={eName} onChange={(e) => setEName(e.target.value)} data-testid="input-trade-point-edit-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input className="min-h-10" value={eCity} onChange={(e) => setECity(e.target.value)} data-testid="input-trade-point-edit-city" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус витрины</Label>
                <Select value={eShowcase} onValueChange={setEShowcase}>
                  <SelectTrigger className="min-h-10" data-testid="select-trade-point-edit-showcase-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {showcaseStatusOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  value={eAddress}
                  onChange={(e) => setEAddress(e.target.value)}
                  data-testid="textarea-trade-point-edit-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  className="min-h-10"
                  value={eContactName}
                  onChange={(e) => setEContactName(e.target.value)}
                  data-testid="input-trade-point-edit-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  className="min-h-10"
                  value={eContactPhone}
                  onChange={(e) => setEContactPhone(e.target.value)}
                  data-testid="input-trade-point-edit-contact-phone"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  value={eComment}
                  onChange={(e) => setEComment(e.target.value)}
                  data-testid="textarea-trade-point-edit-comment"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Дни отгрузки</p>
              <div className="flex flex-wrap gap-2">
                {DEALER_SHIPMENT_DAY_ORDER.map((day) => {
                  const on = eShipmentDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      className="min-h-9 text-xs"
                      onClick={() => toggleShipmentDay(day)}
                    >
                      {DEALER_SHIPMENT_DAY_LABELS[day]}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={eMainWh} onCheckedChange={(v) => setEMainWh(v === true)} data-testid="checkbox-trade-point-edit-main-warehouse" />
                <span>Склад дверей</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={eHwWh}
                  onCheckedChange={(v) => setEHwWh(v === true)}
                  data-testid="checkbox-trade-point-edit-hardware-warehouse"
                />
                <span>Склад фурнитуры</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-9 font-semibold" data-testid="button-trade-point-edit-save" onClick={handleSaveEdit}>
                Сохранить
              </Button>
              <Button type="button" variant="ghost" size="sm" className="min-h-9" data-testid="button-trade-point-edit-cancel" onClick={handleCancelEdit}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </SurfaceCard>
      ) : null}

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-trade-point-archive-confirm">
          <DialogHeader>
            <DialogTitle className="text-base">Архивировать точку?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Точка будет скрыта из списка активных. Удаление не выполняется.</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="min-h-9" onClick={() => setArchiveOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" className="min-h-9 font-semibold" data-testid="button-trade-point-archive-confirm" onClick={handleConfirmArchive}>
              В архив
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <TradePointSectionNav active={activeSection} variant="chips" />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
          <section
            id={SECTION_DOM_IDS.overview}
            data-testid="section-trade-point-overview"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Основные сведения по точке.">Общее</SectionTitle>
            <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:items-start">
              <SurfaceCard>
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
              <TradePointContactsSection row={dealer} tradePoint={point} profile={profile} />
            </div>
          </section>

          <section
            id={SECTION_DOM_IDS.training}
            data-testid="section-trade-point-training-attention"
            className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
          >
            <SectionTitle subtitle="Нужен ли визит с продуктовым блоком для персонала точки.">
              Обучение персонала точки
            </SectionTitle>
            <SurfaceCard data-testid="card-trade-point-training-signal">
              <CardHeader className="space-y-2 pb-2 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("font-semibold", trainingAttentionLevelBadgeClass(tpTrainingSignal.level))}>
                    {tpTrainingSignal.level === "none" && tpTrainingDone
                      ? "Потребность закрыта"
                      : tpTrainingSignal.level === "priority"
                        ? "Кандидат на обучение"
                        : tpTrainingSignal.level === "recommended"
                          ? "Рекомендуется провести продуктовое обучение от Tandoor"
                          : tpTrainingSignal.level === "watch"
                            ? "Внимание к персоналу"
                            : "Обучение не требуется по текущему срезу"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                {tpTrainingSignal.reasons.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                    {tpTrainingSignal.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Причины рекомендации отсутствуют по текущему срезу.</p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button asChild variant="default" className="min-h-11 font-semibold" data-testid="button-trade-point-open-training">
                    <Link href={tpTrainingHref}>
                      <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                      К обучению
                    </Link>
                  </Button>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <Checkbox
                      id={`tp-training-${point.id}`}
                      checked={tpTrainingDone}
                      onCheckedChange={(v) => {
                        const next = v === true;
                        setTpTrainingDone(next);
                        sessionStorage.setItem(tpTrainingStorageKey, next ? "1" : "0");
                      }}
                      data-testid="checkbox-trade-point-product-training-completed"
                    />
                    <Label htmlFor={`tp-training-${point.id}`} className="cursor-pointer text-sm font-medium">
                      Проведено продуктовое обучение от Tandoor
                    </Label>
                  </div>
                </div>
              </CardContent>
            </SurfaceCard>
          </section>

          <TradePointShowcaseMatrixSection
            dealer={dealer}
            point={point}
            profile={profile}
            actorUserId={user?.id ?? profile.personaUserId}
            actorName={user?.name ?? userLabelFromProfile(profile)}
            page={{
              matrixSummary,
              showcaseComment,
              distribution: dist,
              distributionConclusion: conclusion,
              productMatrixFiltered: filteredMatrix,
              productMatrixFilter: matrixFilter,
              onProductMatrixFilterChange: setMatrixFilter,
              recommendationByProductId,
              showcaseTasksOpen,
              openTasksCount: openShowcaseTasksCount,
              recommendations,
              createdTaskByProductId,
              onCreateMatrixTask: handleCreateTask,
              onScrollToMatrixTask: handleScrollToTask,
              tasksLinkHref: showcaseTasksLinkHref,
              matrixTasksSlot: (
                <div className="space-y-2" data-testid="section-trade-point-matrix-created-tasks-embedded">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Созданные задачи по матрице товаров
                  </p>
                  <MatrixTaskSummaryCard tasks={createdTasks} testId="card-trade-point-matrix-task-summary" />
                  {createdTasks.length > 0 ? (
                    <div
                      className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
                      role="tablist"
                      aria-label="Фильтры задач по матрице"
                      data-testid="filter-trade-point-tasks-matrix"
                    >
                      <div className="flex flex-wrap gap-2 pb-1">
                        {MATRIX_TASK_FILTERS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            role="tab"
                            aria-selected={matrixTaskFilter === f.id}
                            onClick={() => setMatrixTaskFilter(f.id)}
                            data-testid={f.testId}
                            className={cn(
                              "min-h-9 shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                              matrixTaskFilter === f.id
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {createdTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Пока нет созданных задач по матрице — создайте из блока «Фактическая витрина» ниже.
                    </p>
                  ) : filteredCreatedTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">По выбранному фильтру задач нет.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredCreatedTasks.map((task) => (
                        <MatrixTaskCard
                          key={task.taskId}
                          task={task}
                          expanded={expandedTaskIds.has(task.taskId)}
                          onToggle={handleToggleTask}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ),
            }}
          />

          <Bitrix24TasksPanel
            scope="trade_point"
            dealerId={dealer.id}
            dealerName={dealer.name}
            tradePointId={point.id}
            tradePointName={point.name}
            canCreate={canCreateBitrix24Task}
            actorUserId={user?.id ?? profile.personaUserId}
            actorLabel={user?.name ?? userLabelFromProfile(profile)}
          />

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
                {tpMatrixHistory.map((ev) => (
                  <div
                    key={ev.id}
                    data-testid={`row-trade-point-showcase-matrix-history-${ev.id}`}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <p className="min-w-0 text-sm font-medium text-foreground">{ev.body}</p>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground sm:text-right">{ev.meta}</p>
                  </div>
                ))}
                {tpContactHistory.map((ev) => (
                  <div
                    key={ev.id}
                    data-testid={`row-trade-point-contact-history-${ev.id}`}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <p className="min-w-0 text-sm font-medium text-foreground">{ev.body}</p>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground sm:text-right">{ev.meta}</p>
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

          <section data-testid="section-trade-point-comments" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
            <SectionTitle subtitle="Сохраняются в браузере.">Комментарии по точке</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-3 p-4">
                {canEditTpComments ? (
                  <div className="space-y-2">
                    <Label htmlFor="trade-point-comment-input" className="text-xs text-muted-foreground">
                      Комментарий по торговой точке
                    </Label>
                    <Textarea
                      id="trade-point-comment-input"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      rows={2}
                      className="min-h-[52px] resize-y text-sm"
                      data-testid="textarea-trade-point-comment"
                      placeholder="Комментарий по торговой точке"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-9 font-semibold"
                      data-testid="button-trade-point-comment-add"
                      disabled={!commentDraft.trim()}
                      onClick={() => {
                        addTradePointComment(dealer.id, point.id, {
                          body: commentDraft,
                          createdBy: user?.id ?? profile.personaUserId,
                          createdByName: user?.name ?? userLabelFromProfile(profile),
                        });
                        setCommentDraft("");
                      }}
                    >
                      Добавить
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {tpComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
                  ) : (
                    tpComments.map((c) => {
                      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(c.createdAt.trim());
                      const head = m ? `${m[3]}.${m[2]}.${m[1]} · ${c.createdByName}` : c.createdByName;
                      return (
                        <div
                          key={c.id}
                          data-testid={`row-trade-point-comment-${c.id}`}
                          className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm"
                        >
                          <p className="text-[11px] font-semibold text-muted-foreground">{head}</p>
                          <p className="mt-1 leading-relaxed text-foreground">{c.body}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </SurfaceCard>
          </section>

          <section id={SECTION_DOM_IDS.photos} data-testid="section-trade-point-photos" className="scroll-mt-28 space-y-4 pb-2 sm:scroll-mt-32">
            <SectionTitle subtitle="Визуальные материалы по точке.">Фото</SectionTitle>
            <SurfaceCard className="mt-3">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start gap-3">
                  <Camera className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Фото сохраняются в браузере и доступны в карточке клиента и на этой странице.
                  </p>
                </div>
                <TradePointPhotoBlock dealerId={dealer.id} tradePointId={point.id} canEdit={canEditTp} />
              </CardContent>
            </SurfaceCard>
          </section>
        </div>

        <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
          <TradePointSectionNav active={activeSection} variant="sidebar" />
        </aside>
      </div>

      <FloatingBackButton
        href={`/dealers/${dealer.id}`}
        label="К дилеру"
        testId="floating-back-to-dealer-card"
        ariaLabel="Назад к карточке дилера"
      />
    </div>
  );
}

export function TradePointDetailPage() {
  const params = useParams<{ dealerId: string; pointId: string }>();
  const rawDealer = params.dealerId ?? "";
  const rawPoint = params.pointId ?? "";
  const [dataBump, setDataBump] = useState(0);
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();

  useEffect(() => {
    const fn = () => setDataBump((n) => n + 1);
    window.addEventListener(DEALER_TRADE_POINTS_EVENT, fn);
    window.addEventListener(DEALER_PROFILE_OVERRIDES_EVENT, fn);
    return () => {
      window.removeEventListener(DEALER_TRADE_POINTS_EVENT, fn);
      window.removeEventListener(DEALER_PROFILE_OVERRIDES_EVENT, fn);
    };
  }, []);

  const result = useMemo(() => {
    void dataBump;
    if (actx.enabled) {
      const r = resolveActualizationTradePointDetail(rawDealer, rawPoint, actx.state, profile);
      if (r) {
        return {
          dealer: getDealerRowWithProfileOverrides(r.dealer),
          point: r.point,
          entry: r.entry,
        };
      }
    }
    const base = getResolvedTradePointByIds(rawDealer, rawPoint);
    if (!base) return undefined;
    return {
      dealer: getDealerRowWithProfileOverrides(base.dealer),
      point: base.point,
      entry: base.entry,
    };
  }, [rawDealer, rawPoint, dataBump, actx.enabled, actx.state, profile]);

  if (!result) {
    return <TradePointNotFound dealerId={rawDealer} />;
  }

  return <TradePointDetailContent dealer={result.dealer} point={result.point} tpMeta={result.entry} />;
}
