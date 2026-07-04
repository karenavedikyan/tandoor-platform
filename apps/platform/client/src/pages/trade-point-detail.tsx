import type { ComponentProps, ComponentType, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Camera, ChevronDown, ChevronRight, MapPin, Store, BookOpen, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  isTradePointAddressEmpty,
  TRADE_POINT_ADDRESS_EMPTY_DETAIL_LABEL,
} from "@/lib/trade-point-address-empty";
import { BackNav } from "@/components/navigation/back-nav";
import { TradePointDetailSkeleton } from "@/components/skeletons/trade-point-detail-skeleton";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { TradePointContactsSection } from "@/components/trade-point-contacts-section";
import { type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getCatalogDealerById } from "@/lib/dealer-base-source";
import { invalidateMatrixTasksCache } from "@/lib/trade-point-task-data";
import {
  getTradePointTrainingAttentionSignal,
  tradePointProductTrainingStorageKey,
  trainingAttentionLevelBadgeClass,
} from "@/lib/training-attention";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useDealerTpOverridesHydration } from "@/hooks/use-dealer-tp-overrides-hydration";
import { useTradePointsActualizationHydration } from "@/hooks/use-trade-points-actualization-hydration";
import { useOverridesRuntimeVersion } from "@/lib/dealer-overrides-runtime";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase, canArchiveTradePointDuringActualization } from "@/lib/client-base-actualization-permissions";
import { CLIENT_BASE_ACTUALIZATION_CLEAN_MODE } from "@/lib/client-base-actualization-config";
import {
  resolveActualizationTradePointDetail,
  resolveActualizationTradePointDetailFromDbOverlay,
} from "@/lib/client-base-actualization-data-merge";
import { hydrateDealerTradePointsFromDb } from "@/lib/trade-points-actualization-hydration";
import { TradePointManualActualizationView } from "@/components/trade-point-manual-actualization-view";
import { displayUserName, useCurrentUser } from "@/hooks/use-current-user";
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
import { mergeActualizationState } from "@/lib/client-base-actualization-state";
import { trashTradePointStrict } from "@/lib/trade-point-overrides-api";
import { saveTradePointTrainingField } from "@/lib/use-dealer-field-saver";
import { handleOverridesStrictResult } from "@/lib/overrides-save-feedback";
import { makePendingId } from "@/lib/overrides-pending-sync";
import { DealerTpOverridesSyncStatus } from "@/components/dealer-tp-overrides-sync-status";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { patchTradePointTrashRuntime } from "@/lib/dealer-overrides-runtime";
import { makeTrashedTradePointInfo, snapshotTradePointFromRow } from "@/lib/trash-dealer-helper";
import {
  canEditDealerTradePoints,
  DEALER_TRADE_POINTS_EVENT,
  getMergedDealerTradePoints,
  getResolvedTradePointByIds,
  isVirtualDefaultTradePointId,
  updateTradePoint,
  type MergedTradePointEntry,
} from "@/lib/dealer-trade-points-overrides";
import {
  computeTradePointAutoDisplayName,
  displayNameContextFromDealerPoint,
  resolveTradePointDisplayName,
  tradePointManualNameForEdit,
} from "@/lib/trade-point-display-labels";
import { getDealerRowWithProfileOverrides, DEALER_PROFILE_OVERRIDES_EVENT } from "@/lib/dealer-profile-overrides";
import { DEALER_SHIPMENT_DAY_LABELS, DEALER_SHIPMENT_DAY_ORDER, type DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { TradePointShowcaseAssignmentsPanel } from "@/components/distribution/trade-point-showcase-assignments-panel";
import { TradePointResponsiblesSection } from "@/components/trade-point-responsibles-section";
import { TradePointPhotoBlock } from "@/components/trade-point-photo-block";
import { TradePointLegalEntitiesSection } from "@/components/trade-point-legal-entities-section";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import {
  getShowcaseMatrixTpHistoryEvents,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
} from "@/lib/trade-point-showcase-matrix-storage";

const SECTION_IDS = ["overview", "responsibles", "training", "matrix", "showcase", "tasks", "comments", "history", "photos"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_DOM_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-overview",
  responsibles: "section-trade-point-responsibles",
  training: "section-trade-point-training-attention",
  matrix: "section-trade-point-matrix",
  showcase: "section-trade-point-showcase-matrix",
  tasks: "section-trade-point-showcase-open-tasks",
  comments: "section-trade-point-comments",
  history: "trade-point-section-history",
  photos: "trade-point-section-photos",
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Общее",
  responsibles: "Ответственные",
  training: "Обучение",
  matrix: "Матрица",
  showcase: "Витрина",
  tasks: "Задачи по витрине",
  comments: "Комментарии",
  history: "История",
  photos: "Фото",
};

const NAV_TEST_IDS: Record<SectionId, string> = {
  overview: "trade-point-section-nav-overview",
  responsibles: "trade-point-section-nav-responsibles",
  training: "trade-point-section-nav-training",
  matrix: "trade-point-section-nav-matrix",
  showcase: "trade-point-section-nav-showcase",
  tasks: "trade-point-section-nav-tasks",
  comments: "trade-point-section-nav-comments",
  history: "trade-point-section-nav-history",
  photos: "trade-point-section-nav-photos",
};

function SectionTitle({ children, subtitle, className }: { children: ReactNode; subtitle?: string; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{children}</h2>
      {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function CollapsibleSection({
  id,
  domId,
  title,
  subtitle,
  open,
  onToggle,
  className,
  testId,
  children,
}: {
  id: SectionId;
  domId: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  className?: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section id={domId} data-testid={testId} className={cn("scroll-mt-28 sm:scroll-mt-32", className)}>
      <Collapsible open={open} onOpenChange={() => onToggle(id)} className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-full justify-between gap-2 text-sm font-semibold"
            data-testid={`button-section-toggle-${id}`}
          >
            <span className="truncate">{title}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-1">
          {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
          {children}
        </CollapsibleContent>
      </Collapsible>
    </section>
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

const SCROLL_SPY_OFFSET = 140;

function useActiveSection(): {
  active: SectionId;
  setActiveManually: (id: SectionId) => void;
} {
  const [active, setActive] = useState<SectionId>("overview");
  const lockUntilRef = useRef(0);

  const computeActive = useCallback(() => {
    if (Date.now() < lockUntilRef.current) return;
    let bestId: SectionId | null = null;
    let bestTop = Number.NEGATIVE_INFINITY;
    for (const sid of SECTION_IDS) {
      if (sid === "matrix") continue;
      const el = document.getElementById(SECTION_DOM_IDS[sid]);
      if (!el) continue;
      const top = el.getBoundingClientRect().top - SCROLL_SPY_OFFSET;
      if (top <= 0 && top > bestTop) {
        bestTop = top;
        bestId = sid;
      }
    }
    if (!bestId) bestId = "overview";
    setActive((prev) => (prev === bestId ? prev : bestId));
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        computeActive();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const t = window.setTimeout(computeActive, 0);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [computeActive]);

  const setActiveManually = useCallback((id: SectionId) => {
    setActive(id);
    lockUntilRef.current = Date.now() + 900;
  }, []);

  return { active, setActiveManually };
}

function TradePointSectionNav({
  active,
  variant,
  onNavigate,
}: {
  active: SectionId;
  variant: "sidebar" | "chips";
  onNavigate: (id: SectionId) => void;
}) {
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
            onClick={() => onNavigate(id)}
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
            onClick={() => onNavigate(id)}
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
  const dealer = dealerId ? getCatalogDealerById(dealerId) : undefined;
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
  const { active: activeSection, setActiveManually } = useActiveSection();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set());
  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const openSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const handleNavigate = useCallback(
    (id: SectionId) => {
      const target: SectionId = id === "matrix" ? "showcase" : id;
      openSection(target);
      setActiveManually(target);
      requestAnimationFrame(() => {
        document.getElementById(SECTION_DOM_IDS[id])?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [openSection, setActiveManually],
  );
  const [commentsBump, setCommentsBump] = useState(0);
  const [contactsBump, setContactsBump] = useState(0);
  const [matrixBump, setMatrixBump] = useState(0);
  const routeQs = useRouteSearchParams();
  const [commentDraft, setCommentDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [eName, setEName] = useState(() => tradePointManualNameForEdit(point.name, point.city));
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
  const tpEditSave = useSectionSaveFeedback();

  const displayName = useMemo(() => resolveTradePointDisplayName(dealer, point), [dealer, point]);
  const defaultAutoDisplayName = useMemo(
    () => computeTradePointAutoDisplayName(displayNameContextFromDealerPoint(dealer, point)) ?? displayName,
    [dealer, point, displayName],
  );

  useEffect(() => {
    setEName(tradePointManualNameForEdit(point.name, point.city));
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
    const fn = () => {
      setMatrixBump((n) => n + 1);
      invalidateMatrixTasksCache();
    };
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  const dealerForRbac = useMemo(() => getCatalogDealerById(dealer.id) ?? dealer, [dealer]);
  const isVirtualDefaultPoint = useMemo(
    () => isVirtualDefaultTradePointId(dealer.id, point.id),
    [dealer.id, point.id],
  );
  const useCleanTradePointAnketa =
    CLIENT_BASE_ACTUALIZATION_CLEAN_MODE &&
    !isVirtualDefaultPoint &&
    actx.enabled &&
    canActualizeClientBase(profile);
  const canEditTp = useMemo(
    () => !isVirtualDefaultPoint && canEditDealerTradePoints(profile, dealerForRbac),
    [profile, dealerForRbac, isVirtualDefaultPoint],
  );
  const canEditTpComments = useMemo(
    () => canEditTradePointComments(profile, dealer, user?.role),
    [profile, dealer, user?.role],
  );
  const canCreateBitrix24Task = useMemo(
    () => canEditClientNextStep(profile, dealer, user?.role),
    [profile, dealer, user?.role],
  );
  const tpComments = useMemo(() => getTradePointComments(dealer.id, point.id), [dealer.id, point.id, commentsBump]);
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
    openSection("showcase");
    setActiveManually("showcase");
    requestAnimationFrame(() => {
      document.getElementById("section-trade-point-showcase-matrix")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [routeQs, dealer.id, point.id, openSection, setActiveManually]);
  const mapSearch = useMemo(() => mapSearchTextForPoint(point), [point]);
  const yandexMapHref = useMemo(() => `https://yandex.ru/maps/?text=${encodeURIComponent(mapSearch || "Россия")}`, [mapSearch]);
  const clientMapHref = useMemo(() => {
    const c = point.city.trim();
    if (!c || c === "—") return null;
    return buildHashPath("/client-map", { city: c });
  }, [point.city]);
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
    const s = sessionStorage.getItem(tpTrainingStorageKey);
    if (s === "1") setTpTrainingDone(true);
    else if (s === "0") setTpTrainingDone(false);
    else setTpTrainingDone(point.productTrainingCompleted);
  }, [dealer.id, point.id, point.productTrainingCompleted, tpTrainingStorageKey]);

  const showcaseStatusOptions = useMemo(() => {
    const b = ["Хорошо", "Норма", "Требует внимания", "Плохо", "На контроле", "—"];
    const c = point.showcaseStatus?.trim();
    if (c && !b.includes(c)) return [c, ...b];
    return b;
  }, [point.showcaseStatus]);

  const toggleShipmentDay = useCallback((day: DealerShipmentDayId) => {
    setEShipmentDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    tpEditSave.markDirty();
  }, [tpEditSave]);

  const handleSaveEdit = useCallback((): boolean => {
    setEditErr("");
    if (!eCity.trim() || !eAddress.trim()) {
      setEditErr("Укажите город и адрес.");
      toast({ title: "Укажите город и адрес.", variant: "destructive" });
      return false;
    }
    void updateTradePoint(
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
    return true;
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
    setEName(tradePointManualNameForEdit(point.name, point.city));
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

  const handleConfirmDelete = useCallback(async () => {
    if (actx.enabled) {
      const info = makeTrashedTradePointInfo({
        tradePointId: point.id,
        dealerId: dealer.id,
        by: { userId: profile.personaUserId, userName: userLabelFromProfile(profile) },
        snapshot: snapshotTradePointFromRow({
          name: point.name,
          address: point.address,
          city: point.city,
          tradePointCode: point.releaseCode ?? null,
          dealerFullName: dealer.name,
        }),
        source: "client_card_delete",
      });
      patchTradePointTrashRuntime(point.id, info);
      const result = await trashTradePointStrict(point.id);
      setArchiveOpen(false);
      if (
        handleOverridesStrictResult(result, {
          pendingId: makePendingId("tp-trash", point.id),
          pendingKind: "tp-trash",
          pendingPayload: { tp_id: point.id },
          fieldLabel: "Удаление торговой точки",
        })
      ) {
        toast({
          title: "Торговая точка перемещена в корзину",
          description: "Восстановить можно из раздела «Корзина».",
        });
      } else {
        patchTradePointTrashRuntime(point.id, null);
        toast({ title: "Не удалось удалить", variant: "destructive" });
      }
      return;
    }
    setArchiveOpen(false);
  }, [actx, dealer.id, dealer.name, point, profile]);

  const breadcrumbDealerLabel = dealer.name;

  if (useCleanTradePointAnketa) {
    const canTrashTpClean =
      canEditTp && canArchiveTradePointDuringActualization(profile, dealerForRbac, point);
    return (
      <>
        <TradePointManualActualizationView
          dealer={dealer}
          point={point}
          profile={profile}
          onRequestArchive={canTrashTpClean ? () => setArchiveOpen(true) : undefined}
        />
        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-trade-point-archive-confirm">
            <DialogHeader>
              <DialogTitle className="text-base">Удалить торговую точку?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Торговая точка уйдёт в корзину на 30 дней. Восстановить можно из раздела «Корзина».
            </p>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" className="min-h-9" onClick={() => setArchiveOpen(false)}>
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-9 font-semibold"
                data-testid="button-trade-point-delete-confirm"
                onClick={() => void handleConfirmDelete()}
              >
                Удалить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] space-y-4 sm:space-y-6"
      data-testid="page-trade-point-detail"
    >
      <BackNav
        breadcrumbs={breadcrumbsFor(`/dealers/${dealer.id}/trade-points/${point.id}`, {
          dealer: dealer.name,
          tradePoint: displayName,
        })}
        fallbackHref={`/dealers/${dealer.id}`}
      />

      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground">Клиент</p>
        <p className="text-sm font-semibold text-foreground" data-testid="text-trade-point-dealer-name">
          {dealer.name}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Торговая точка</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl" data-testid="text-trade-point-name">
          {displayName}
        </h1>
        {point.releaseCode ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid={`text-trade-point-internal-code-${point.id}`}>
            Код ТТ: {point.releaseCode}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px] font-medium">
            № {point.id}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-950">
            {point.status}
          </Badge>
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
            Точки не заведены отдельно — работаем как с одной основной торговой точкой. Чтобы
            редактировать — нажмите «Редактировать» в карточке клиента.
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
            {actx.enabled ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-9 w-full font-semibold text-destructive sm:w-auto"
                data-testid={`button-trade-point-delete-${point.id}`}
                onClick={() => setArchiveOpen(true)}
              >
                Удалить
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {isTradePointAddressEmpty(point.address) ? (
            <span
              className="inline-flex items-center gap-1.5 font-medium text-destructive"
              data-testid="text-trade-point-address"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {TRADE_POINT_ADDRESS_EMPTY_DETAIL_LABEL}
            </span>
          ) : (
            <span data-testid="text-trade-point-address">{point.address}</span>
          )}
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
          <DistributionCardHeaderBlock
            externalKeys={[point.id]}
            act={actx.state}
            testId="trade-point-header-distribution"
          />
        </div>
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
            <DealerTpOverridesSyncStatus dealerId={dealer.id} tpId={point.id} compact className="mt-2" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {editErr ? <p className="text-xs font-medium text-destructive">{editErr}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Название</Label>
                <Input
                  className="min-h-10"
                  value={eName}
                  placeholder={defaultAutoDisplayName ? `По умолчанию: ${defaultAutoDisplayName}` : undefined}
                  onChange={(e) => {
                    setEName(e.target.value);
                    tpEditSave.markDirty();
                  }}
                  data-testid="input-trade-point-edit-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  className="min-h-10"
                  value={eCity}
                  onChange={(e) => {
                    setECity(e.target.value);
                    tpEditSave.markDirty();
                  }}
                  data-testid="input-trade-point-edit-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус витрины</Label>
                <Select
                  value={eShowcase}
                  onValueChange={(v) => {
                    setEShowcase(v);
                    tpEditSave.markDirty();
                  }}
                >
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
                  onChange={(e) => {
                    setEAddress(e.target.value);
                    tpEditSave.markDirty();
                  }}
                  data-testid="textarea-trade-point-edit-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  className="min-h-10"
                  value={eContactName}
                  onChange={(e) => {
                    setEContactName(e.target.value);
                    tpEditSave.markDirty();
                  }}
                  data-testid="input-trade-point-edit-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  className="min-h-10"
                  value={eContactPhone}
                  onChange={(e) => {
                    setEContactPhone(e.target.value);
                    tpEditSave.markDirty();
                  }}
                  data-testid="input-trade-point-edit-contact-phone"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  value={eComment}
                  onChange={(e) => {
                    setEComment(e.target.value);
                    tpEditSave.markDirty();
                  }}
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
                <Checkbox checked={eMainWh} onCheckedChange={(v) => { setEMainWh(v === true); tpEditSave.markDirty(); }} data-testid="checkbox-trade-point-edit-main-warehouse" />
                <span>Склад дверей</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={eHwWh}
                  onCheckedChange={(v) => {
                    setEHwWh(v === true);
                    tpEditSave.markDirty();
                  }}
                  data-testid="checkbox-trade-point-edit-hardware-warehouse"
                />
                <span>Склад фурнитуры</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <SectionSaveButton
                testId="button-trade-point-section-save-main"
                statusTestId="text-save-status-trade-point-detail-edit"
                phase={tpEditSave.phase}
                onSave={() => void tpEditSave.runSave(async () => Promise.resolve(handleSaveEdit()))}
              />
              <Button type="button" variant="ghost" size="sm" className="min-h-9" data-testid="button-trade-point-edit-cancel" onClick={handleCancelEdit}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </SurfaceCard>
      ) : null}

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-trade-point-delete-confirm">
          <DialogHeader>
            <DialogTitle className="text-base">Удалить торговую точку?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Торговая точка уйдёт в корзину на 30 дней. Восстановить можно из раздела «Корзина».
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="min-h-9" onClick={() => setArchiveOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-9 font-semibold"
              data-testid="button-trade-point-delete-confirm"
              onClick={() => void handleConfirmDelete()}
            >
              Удалить
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

      <TradePointSectionNav active={activeSection} variant="chips" onNavigate={handleNavigate} />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
          <CollapsibleSection
            id="overview"
            domId={SECTION_DOM_IDS.overview}
            title={SECTION_LABELS.overview}
            subtitle="Основные сведения по точке."
            open={openSections.has("overview")}
            onToggle={toggleSection}
            testId="section-trade-point-overview"
          >
            <SurfaceCard className="overflow-hidden border border-border border-l-4 border-l-primary p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <ShowcaseCoverPhotoSlot kind="trade_point" dealer={dealer} tradePoint={point} profile={profile} size="hero" rounded="xl" className="w-full shrink-0 sm:max-w-[15rem]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground">{displayName}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">
                    {[point.city, isTradePointAddressEmpty(point.address) ? null : point.address?.trim()]
                      .filter(Boolean)
                      .join(" · ")}
                    {isTradePointAddressEmpty(point.address) ? (
                      <span className="mt-0.5 block font-medium text-destructive">
                        {TRADE_POINT_ADDRESS_EMPTY_DETAIL_LABEL}
                      </span>
                    ) : null}
                  </p>
                  <TradePointLegalEntitiesSection dealerId={dealer.id} tradePointId={point.id} canEdit={canEditTp} />
                </div>
              </div>
            </SurfaceCard>
            <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:items-start">
              <SurfaceCard>
                <CardContent className="space-y-0 pt-5">
                  {isTradePointAddressEmpty(point.address) ? (
                    <div className="flex gap-3 border-b border-border py-3 sm:items-start sm:gap-4">
                      <span className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive sm:flex">
                        <MapPin className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Адрес</p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 break-words text-sm font-medium leading-snug text-destructive sm:text-[15px]">
                          <AlertTriangle className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
                          {TRADE_POINT_ADDRESS_EMPTY_DETAIL_LABEL}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <FieldRow label="Адрес" value={point.address} icon={MapPin} />
                  )}
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
          </CollapsibleSection>

          <CollapsibleSection
            id="responsibles"
            domId={SECTION_DOM_IDS.responsibles}
            title={SECTION_LABELS.responsibles}
            subtitle="Ответственные за точку по ролям."
            open={openSections.has("responsibles")}
            onToggle={toggleSection}
            testId="section-trade-point-responsibles-wrap"
          >
            <TradePointResponsiblesSection tradePointId={point.id} currentUserRole={user?.role} />
          </CollapsibleSection>

          <CollapsibleSection
            id="training"
            domId={SECTION_DOM_IDS.training}
            title={SECTION_LABELS.training}
            subtitle="Нужен ли визит с продуктовым блоком для персонала точки."
            open={openSections.has("training")}
            onToggle={toggleSection}
            testId="section-trade-point-training-attention"
          >
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
                        const prev = tpTrainingDone;
                        setTpTrainingDone(next);
                        sessionStorage.setItem(tpTrainingStorageKey, next ? "1" : "0");
                        void saveTradePointTrainingField(point.id, { product_training_done: next }, {
                          fieldLabel: "Обучение по продукту",
                          source: "trade-point-detail",
                        }).then((result) => {
                          if (!result.ok) {
                            setTpTrainingDone(prev);
                            sessionStorage.setItem(tpTrainingStorageKey, prev ? "1" : "0");
                          }
                        });
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
          </CollapsibleSection>

          <CollapsibleSection
            id="showcase"
            domId={SECTION_DOM_IDS.showcase}
            title={SECTION_LABELS.showcase}
            open={openSections.has("showcase")}
            onToggle={toggleSection}
            testId="section-trade-point-showcase"
          >
            <span id={SECTION_DOM_IDS.matrix} className="block scroll-mt-28 sm:scroll-mt-32" aria-hidden />
            <DistributionTradePointMatrixEntry
              dealer={dealer}
              point={point}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorName={displayUserName(user) ?? userLabelFromProfile(profile)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="tasks"
            domId={SECTION_DOM_IDS.tasks}
            title={SECTION_LABELS.tasks}
            open={openSections.has("tasks")}
            onToggle={toggleSection}
            testId="section-trade-point-tasks"
          >
            <TradePointShowcaseAssignmentsPanel
              dealerId={dealer.id}
              tradePointId={point.id}
              tradePointName={displayName}
              actorUserId={user?.id ?? profile.personaUserId}
              actorName={displayUserName(user) ?? userLabelFromProfile(profile)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="comments"
            domId={SECTION_DOM_IDS.comments}
            title={SECTION_LABELS.comments}
            subtitle="Сохраняются в базе и отображаются в истории точки."
            open={openSections.has("comments")}
            onToggle={toggleSection}
            testId="section-trade-point-comments"
          >
            <SurfaceCard>
              <CardContent className="space-y-3 p-4">
                {canEditTpComments ? (
                  <div className="space-y-2" data-testid="section-trade-point-comment-form">
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
                        void addTradePointComment(dealer.id, point.id, {
                          body: commentDraft,
                          createdBy: user?.id ?? profile.personaUserId,
                          createdByName: displayUserName(user) ?? userLabelFromProfile(profile),
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
          </CollapsibleSection>

          <CollapsibleSection
            id="history"
            domId={SECTION_DOM_IDS.history}
            title={SECTION_LABELS.history}
            subtitle="Визиты и изменения по точке."
            open={openSections.has("history")}
            onToggle={toggleSection}
            testId="section-trade-point-history"
          >
            <SurfaceCard>
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
          </CollapsibleSection>

          <CollapsibleSection
            id="photos"
            domId={SECTION_DOM_IDS.photos}
            title={SECTION_LABELS.photos}
            subtitle="Визуальные материалы по точке."
            open={openSections.has("photos")}
            onToggle={toggleSection}
            className="pb-2"
            testId="section-trade-point-photos"
          >
            <SurfaceCard>
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
          </CollapsibleSection>
        </div>

        <aside className="mt-6 hidden lg:col-span-4 lg:mt-0 lg:block">
          <TradePointSectionNav active={activeSection} variant="sidebar" onNavigate={handleNavigate} />
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
  const overridesVersion = useOverridesRuntimeVersion();
  const { ready: overridesReady } = useDealerTpOverridesHydration({
    dealerId: rawDealer || undefined,
    tpId: rawPoint || undefined,
  });
  const [pageReady, setPageReady] = useState(false);
  const dbFallbackAttemptedRef = useRef(false);
  const tpDbHydration = useTradePointsActualizationHydration(
    actx.enabled ? rawDealer || undefined : undefined,
    profile,
    actx.enabled,
  );

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setPageReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
      if (tpDbHydration.ready) {
        const dbResolved = resolveActualizationTradePointDetailFromDbOverlay(
          rawDealer,
          rawPoint,
          actx.state,
          profile,
          tpDbHydration.dbTradePoints,
        );
        if (dbResolved) {
          return {
            dealer: getDealerRowWithProfileOverrides(dbResolved.dealer),
            point: dbResolved.point,
            entry: dbResolved.entry,
          };
        }
      }
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
  }, [
    rawDealer,
    rawPoint,
    dataBump,
    actx.enabled,
    actx.state,
    profile,
    overridesVersion,
    tpDbHydration.ready,
    tpDbHydration.dbTradePoints,
    tpDbHydration.hydrationVersion,
  ]);

  const actxResolveMissing = actx.enabled && tpDbHydration.ready && !result;

  useEffect(() => {
    if (!pageReady || !overridesReady || !actxResolveMissing) return;
    if (dbFallbackAttemptedRef.current) return;
    dbFallbackAttemptedRef.current = true;

    void hydrateDealerTradePointsFromDb({
      dealerId: rawDealer,
      profile,
      persist: actx.persist,
    }).then(() => {
      setDataBump((n) => n + 1);
    });
  }, [pageReady, overridesReady, actxResolveMissing, rawDealer, rawPoint, profile, actx.persist]);

  if (!pageReady || !overridesReady) {
    return <TradePointDetailSkeleton />;
  }

  if (actx.enabled && !tpDbHydration.ready) {
    return <TradePointDetailSkeleton />;
  }

  if (!result) {
    return <TradePointNotFound dealerId={rawDealer} />;
  }

  const isTrashed = actx.enabled && Boolean(actx.state.trashedTradePointsById?.[result.point.id]);

  return (
    <>
      {isTrashed ? <TrashedTradePointBanner /> : null}
      <TradePointDetailContent dealer={result.dealer} point={result.point} tpMeta={result.entry} />
    </>
  );
}

function TrashedTradePointBanner(): ReactElement {
  return (
    <div className="border-b border-border bg-destructive/10 px-3 py-3 sm:px-4" data-testid="banner-trade-point-trashed-region">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <Badge variant="outline" className="w-fit shrink-0 border-destructive/40 text-xs font-medium text-destructive" data-testid="badge-trade-point-trashed">
            <Trash2 className="mr-1 h-3 w-3" aria-hidden />
            В корзине
          </Badge>
          <p className="min-w-0 text-sm leading-snug text-foreground" data-testid="text-trade-point-trashed-hint">
            Торговая точка перемещена в корзину. Хранится 14 дней, восстановить можно из раздела «Корзина».
          </p>
        </div>
        <Button asChild type="button" variant="outline" className="h-10 shrink-0 px-4 text-sm font-semibold sm:min-w-[12rem]">
          <Link href={buildHashPath("/trash")} data-testid="button-trade-point-trashed-open-trash">
            Открыть корзину
          </Link>
        </Button>
      </div>
    </div>
  );
}
