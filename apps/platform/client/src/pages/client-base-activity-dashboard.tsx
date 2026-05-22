/**
 * Дашборд активности команды по актуализации клиентской базы (РОП / директор).
 */

import type { ReactElement, ReactNode } from "react";
import { Component, Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActivityTeamState } from "@/hooks/use-client-base-activity-team-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { getDealerRegionalManagerDisplay } from "@/lib/dealer-base-mock-data";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getSalesUserById, getTeamById } from "@/lib/sales-control-data";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_UNKNOWN_DISPLAY,
  ACTIVITY_NO_CALENDAR_TIME_MS,
  activityChartManagerLabel,
  aggregateByManager,
  activityPeriodToRange,
  activityStatusForManager,
  bucketEventsByDay,
  collectActivityBucketsFromSources,
  computeManagerCreatedSummary,
  computeProblemLines,
  computeQualityMetrics,
  filterEventsForDashboard,
  isActivityUnknownUserId,
  listContributionAddedClientsForManager,
  listContributionAddedTradePointsForManager,
  managerTeamAndRopLabel,
  normalizeText,
  type ActivityEvent,
  type ActivityPeriodPreset,
  type ActivityTypeFilter,
  type DashboardGeoFilterPack,
  type ManagerActivityAgg,
  type ManagerCreatedSummaryRow,
} from "@/lib/client-base-activity-metrics";

type ContributionQuickFilter = "all" | "with_additions" | "no_activity" | "has_clients" | "has_tps";

function meaningfulManagerTouches(m: ManagerActivityAgg): number {
  return m.updatedDealers + m.updatedTradePoints + m.legalEntities + m.photos + m.showcases + m.contacts;
}

function passesContributionQuickFilter(m: ManagerActivityAgg, f: ContributionQuickFilter): boolean {
  const adds = m.createdDealers > 0 || m.addedTradePoints > 0;
  const touch = meaningfulManagerTouches(m);
  switch (f) {
    case "all":
      return true;
    case "with_additions":
      return adds || touch > 0;
    case "no_activity":
      return m.totalActions === 0;
    case "has_clients":
      return m.createdDealers > 0;
    case "has_tps":
      return m.addedTradePoints > 0;
    default:
      return true;
  }
}

const PERIOD_LABELS: Record<ActivityPeriodPreset, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  "7d": "7 дней",
  "30d": "30 дней",
  all: "Всё время",
};

/** Пресеты периода в главном сценарии контроля (без «Вчера»). */
const MAIN_PERIOD_PRESETS = ["today", "7d", "30d", "all"] as const satisfies readonly ActivityPeriodPreset[];

/** Палитра Tandoor для страницы активности (строго по ТЗ). */
const C = {
  text: "#222631",
  muted: "#8F96B0",
  border: "#E3E6F3",
  surface: "#EEEFF6",
  primary: "#9ACA3C",
  primaryHover: "#86B832",
  white: "#FFFFFF",
  tpStack: "rgba(154, 202, 60, 0.38)",
} as const;

const RATING_MODE_LS_KEY = "tandoor-client-base-activity-rating-mode-v1";

type RatingDisplayMode = "flat" | "rop";

function managerRopTeamId(managerId: string): string {
  const u = getSalesUserById(managerId);
  return u?.teamId ?? "__no_rop__";
}

function ropGroupDisplayTitle(teamId: string): string {
  if (teamId === "__no_rop__") return "Без РОП";
  return getTeamById(teamId)?.name ?? getRopOptions().find((o) => o.teamId === teamId)?.label ?? teamId;
}

function sortCreatedSummaryRows(rows: ManagerCreatedSummaryRow[]): ManagerCreatedSummaryRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.newClients + a.newTradePoints;
    const tb = b.newClients + b.newTradePoints;
    if (tb !== ta) return tb - ta;
    if (b.newClients !== a.newClients) return b.newClients - a.newClients;
    if (b.newTradePoints !== a.newTradePoints) return b.newTradePoints - a.newTradePoints;
    return b.lastAddedAtMs - a.lastAddedAtMs;
  });
}

type RopLeaderboardGroup = {
  ropId: string;
  title: string;
  members: ManagerCreatedSummaryRow[];
  totalClients: number;
  totalTp: number;
  totalSum: number;
  activeCount: number;
  idleCount: number;
  leader: { name: string; total: number } | null;
};

const TYPE_LABELS: Record<ActivityTypeFilter, string> = {
  all: "Все типы",
  dealers: "Клиенты",
  trade_points: "Торговые точки",
  legal: "Юрлица",
  photos: "Фото",
  showcase: "Витрина",
  archive: "Архив",
};

function formatManagerLastActivity(lastAtMs: number): string {
  if (lastAtMs <= 0) return "—";
  return new Date(lastAtMs).toLocaleString("ru-RU");
}

function formatLastManualAddition(lastAddedAtMs: number, totalManual: number): string {
  if (lastAddedAtMs > 0) return new Date(lastAddedAtMs).toLocaleString("ru-RU");
  if (totalManual > 0) return "Дата не указана";
  return "—";
}

type ActivityBoundaryState = { error: Error | null };

class ClientBaseActivityDashboardBoundary extends Component<{ children: ReactNode }, ActivityBoundaryState> {
  state: ActivityBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ActivityBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="mx-auto max-w-lg space-y-4 px-4 py-8 sm:px-6"
          data-testid="page-client-base-activity-dashboard"
        >
          <h1 className="text-xl font-semibold">Актуализация базы</h1>
          <p className="text-sm text-muted-foreground">
            Не удалось отобразить дашборд. Обновите страницу или откройте раздел позже.
          </p>
          <p className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const UNKNOWN_ACTOR_HELP =
  "Эти события записаны без автора. Проверьте createdBy/updatedBy и имена при сохранении клиента, торговой точки, юрлица и фото (actorUserId / actorLabel в формах).";

const UNKNOWN_TECH_HELP =
  "Ниже — записи без пользователя, которые не входят в рейтинг (массовый архив без archivedBy, юрлица без updatedBy/createdBy в snapshot и т. п.).";

function ChartEmptyPlaceholder({ title, text }: { title: string; text: string }): ReactElement {
  return (
    <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center">
      <BarChart3 className="h-8 w-8 shrink-0 text-primary/50" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

type LeaderboardFilterKey = "all" | "with_additions" | "no_activity" | "top";

type ManagerCreatedMobileCardProps = {
  row: ManagerCreatedSummaryRow;
  rankLabel: string;
  globalRank: number;
  showGlobalRankSubtitle: boolean;
  showTeamLine: boolean;
  isGlobalTop: boolean;
  leaderMaxManualTotal: number;
  leaderboardFilter: LeaderboardFilterKey;
  onOpenDetail: (id: string) => void;
};

function ManagerCreatedMobileCard({
  row,
  rankLabel,
  globalRank,
  showGlobalRankSubtitle,
  showTeamLine,
  isGlobalTop,
  leaderMaxManualTotal,
  leaderboardFilter,
  onOpenDetail,
}: ManagerCreatedMobileCardProps): ReactElement {
  const unknown = isActivityUnknownUserId(row.managerId);
  const total = row.newClients + row.newTradePoints;
  const isInactive = total === 0;
  const compact = leaderboardFilter === "all" && isInactive;
  const progress = Math.min(100, Math.round((total / leaderMaxManualTotal) * 100));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 shadow-sm",
        compact && "py-2",
        isGlobalTop && "border-[rgba(154,202,60,0.45)] bg-[rgba(154,202,60,0.1)]",
        !isGlobalTop &&
          !isInactive &&
          "relative border-[#E3E6F3] bg-white pl-3 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-[#9ACA3C] before:content-['']",
        isInactive && "border-[#E3E6F3] bg-[#EEEFF6]/80",
      )}
      style={!isGlobalTop && !isInactive ? { borderColor: C.border } : isInactive ? { borderColor: C.border } : {}}
      data-testid={`card-manager-contribution-${row.managerId}`}
    >
      <div data-testid={`card-manager-leader-${row.managerId}`} className="flex gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center pt-0.5">
          <span className="text-xs font-bold tabular-nums" style={{ color: isInactive ? C.muted : C.text }}>
            {rankLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {unknown ? (
                <Badge variant="outline" className="text-[10px]" title={UNKNOWN_ACTOR_HELP} style={{ borderColor: C.border, color: C.muted }}>
                  {ACTIVITY_UNKNOWN_DISPLAY}
                </Badge>
              ) : (
                <p className="truncate text-base font-semibold leading-tight" style={{ color: isInactive ? C.muted : C.text }}>
                  {row.displayName}
                </p>
              )}
              {showTeamLine ? (
                <p className="truncate text-[11px] leading-snug" style={{ color: C.muted }}>
                  {managerTeamAndRopLabel(row.managerId)}
                </p>
              ) : null}
              {showGlobalRankSubtitle ? (
                <p className="mt-0.5 text-[10px] leading-snug" style={{ color: C.muted }}>
                  {globalRank > 0 ? `В общем рейтинге #${globalRank}` : "В общем рейтинге —"}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-bold tabular-nums leading-none" style={{ color: isInactive ? C.muted : C.text }}>
                {total}
              </p>
              {isGlobalTop ? (
                <Badge className="mt-1 border-0 px-1.5 py-0 text-[9px] font-semibold" style={{ background: C.primary, color: C.white }} data-testid={`badge-manager-leader-${row.managerId}`}>
                  Лидер
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-[11px] tabular-nums" style={{ color: isInactive ? C.muted : C.text }} data-testid={`text-manager-clients-added-${row.managerId}`}>
            Клиенты: {row.newClients}
          </p>
          <p className="text-[11px] tabular-nums" style={{ color: isInactive ? C.muted : C.text }} data-testid={`text-manager-trade-points-added-${row.managerId}`}>
            ТТ: {row.newTradePoints}
          </p>
          {!isInactive ? (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: C.surface }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: C.primary }} />
            </div>
          ) : null}
          <p className="mt-2 text-[10px]" style={{ color: C.muted }}>
            Последняя активность: {formatLastManualAddition(row.lastAddedAtMs, total)}
          </p>
          {isInactive ? (
            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" disabled style={{ borderColor: C.border, color: C.muted }}>
              Нет добавлений
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full border-0 font-medium text-white hover:opacity-95"
              style={{ background: C.primary }}
              onClick={() => onOpenDetail(row.managerId)}
              data-testid={`button-manager-contribution-open-${row.managerId}`}
            >
              Смотреть карточки
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientBaseActivityDashboardPage(): ReactElement {
  return (
    <ClientBaseActivityDashboardBoundary>
      <ClientBaseActivityDashboardInner />
    </ClientBaseActivityDashboardBoundary>
  );
}

function ClientBaseActivityDashboardInner(): ReactElement {
  const actx = useClientBaseActualization();
  const { profile } = useReleaseDemoProfile();
  const isMobile = useIsMobile();

  const [period, setPeriod] = useState<ActivityPeriodPreset>("7d");
  const [ropTeam, setRopTeam] = useState<string>("__all__");
  const [managerId, setManagerId] = useState<string>("__all__");
  const [regionalManager, setRegionalManager] = useState<string>("__all__");
  const [city, setCity] = useState<string>("__all__");
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");
  const [onlyActiveManagers, setOnlyActiveManagers] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<"all" | "with_additions" | "no_activity" | "top">("all");
  const [contributionQuickFilter, setContributionQuickFilter] = useState<ContributionQuickFilter>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [technicalDiagnosticsOpen, setTechnicalDiagnosticsOpen] = useState(false);
  const [scoreSectionOpen, setScoreSectionOpen] = useState(false);
  const [pieSectionOpen, setPieSectionOpen] = useState(false);
  const [idleGroupOpen, setIdleGroupOpen] = useState(false);
  const [showAllProblems, setShowAllProblems] = useState(false);
  const [detailManagerId, setDetailManagerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<string>("clients");
  const managersSectionRef = useRef<HTMLDivElement | null>(null);
  const [ratingMode, setRatingMode] = useState<RatingDisplayMode>(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(RATING_MODE_LS_KEY) : null;
      if (v === "rop") return "rop";
    } catch {
      /* noop */
    }
    return "flat";
  });
  const [expandedRopIds, setExpandedRopIds] = useState<Set<string>>(() => new Set());

  const { activityState, activitySources, diagnostics, teamLoading, teamError } = useClientBaseActivityTeamState({
    enabled: actx.enabled,
    profile,
    dashboardRopTeamId: ropTeam,
    contextState: actx.state,
  });

  const state = actx.enabled ? activityState : createEmptyActualizationState();

  const mergedAll = useMemo(
    () => buildDealerBaseRowsWithActualization(state, profile, { includeArchivedDealers: true }),
    [state, profile],
  );
  const scopedRows = useMemo(() => roleScopedDealerRows(mergedAll, profile), [mergedAll, profile]);
  const dealerById = useMemo(() => new Map(scopedRows.map((r) => [r.id, r])), [scopedRows]);
  const scopedIds = useMemo(() => new Set(scopedRows.map((r) => r.id)), [scopedRows]);

  const cityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of scopedRows) {
      const c = normalizeText(r.city);
      if (c && c !== "—") s.add(c);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scopedRows]);

  const rmOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of scopedRows) {
      const rm = normalizeText(getDealerRegionalManagerDisplay(r));
      if (rm && rm !== "—") s.add(rm);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scopedRows]);

  const roster = useMemo(() => getManagersForRopTeam(isRopOrManagerAllFilter(ropTeam) ? undefined : ropTeam), [ropTeam]);

  const activityBuckets = useMemo(() => {
    if (activitySources.length === 0) return { events: [] as ActivityEvent[], excludedTechnical: [] as ActivityEvent[] };
    return collectActivityBucketsFromSources(activitySources, mergedAll);
  }, [activitySources, mergedAll]);
  const allEvents = activityBuckets.events;

  useEffect(() => {
    if (period === "yesterday") setPeriod("7d");
  }, [period]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RATING_MODE_LS_KEY, ratingMode);
    } catch {
      /* noop */
    }
  }, [ratingMode]);

  useEffect(() => {
    if (ratingMode === "flat") setExpandedRopIds(new Set());
  }, [ratingMode]);

  const range = useMemo(() => activityPeriodToRange(period), [period]);

  const filterOptsBase = useMemo(
    () => ({
      act: state,
      scopedDealerIds: scopedIds,
      ropTeamId: ropTeam,
      managerId,
      regionalManager,
      city,
      dealerById,
    }),
    [state, scopedIds, ropTeam, managerId, regionalManager, city, dealerById],
  );

  const kpiBaseEvents = useMemo(
    () => filterEventsForDashboard(allEvents, range, "all", filterOptsBase),
    [allEvents, range, filterOptsBase],
  );

  const filteredEvents = useMemo(
    () => filterEventsForDashboard(allEvents, range, typeFilter, filterOptsBase),
    [allEvents, range, typeFilter, filterOptsBase],
  );

  const filteredExcludedTechnical = useMemo(
    () => filterEventsForDashboard(activityBuckets.excludedTechnical, range, typeFilter, filterOptsBase),
    [activityBuckets.excludedTechnical, range, typeFilter, filterOptsBase],
  );

  const managerRows = useMemo(() => aggregateByManager(filteredEvents, roster), [filteredEvents, roster]);
  const visibleManagers = useMemo(
    () => (onlyActiveManagers ? managerRows.filter((m) => m.totalActions > 0) : managerRows),
    [managerRows, onlyActiveManagers],
  );

  const contributionFilteredManagers = useMemo(
    () => visibleManagers.filter((m) => passesContributionQuickFilter(m, contributionQuickFilter)),
    [visibleManagers, contributionQuickFilter],
  );

  const quality = useMemo(() => computeQualityMetrics(state, profile, scopedRows), [state, profile, scopedRows]);
  const problems = useMemo(() => computeProblemLines(state, profile, scopedRows), [state, profile, scopedRows]);

  const geoPack: DashboardGeoFilterPack = useMemo(
    () => ({
      act: state,
      scopedDealerIds: scopedIds,
      ropTeamId: ropTeam,
      regionalManager,
      city,
      dealerById,
    }),
    [state, scopedIds, ropTeam, regionalManager, city, dealerById],
  );

  const createdManagerSummaryRows: ManagerCreatedSummaryRow[] = useMemo(
    () => computeManagerCreatedSummary(activitySources, geoPack, range, roster, managerId),
    [activitySources, geoPack, range, roster, managerId],
  );

  const kpiManualDealersFromSources = useMemo(
    () => createdManagerSummaryRows.reduce((s, r) => s + r.newClients, 0),
    [createdManagerSummaryRows],
  );

  const kpiManualTpFromSources = useMemo(
    () => createdManagerSummaryRows.reduce((s, r) => s + r.newTradePoints, 0),
    [createdManagerSummaryRows],
  );

  const kpiActiveManagersFromCreated = useMemo(
    () => createdManagerSummaryRows.filter((r) => r.newClients + r.newTradePoints > 0).length,
    [createdManagerSummaryRows],
  );

  const visibleCreatedSummaryRows = useMemo(() => {
    const rows = createdManagerSummaryRows;
    switch (leaderboardFilter) {
      case "with_additions":
        return rows.filter((r) => r.newClients + r.newTradePoints > 0);
      case "no_activity":
        return rows.filter((r) => r.newClients + r.newTradePoints === 0);
      case "top":
        return rows.filter((r) => r.newClients + r.newTradePoints > 0).slice(0, 10);
      default:
        return rows;
    }
  }, [createdManagerSummaryRows, leaderboardFilter]);

  const globalRankByManagerId = useMemo(() => {
    const m = new Map<string, number>();
    createdManagerSummaryRows.forEach((r, i) => {
      m.set(r.managerId, i + 1);
    });
    return m;
  }, [createdManagerSummaryRows]);

  const ropModeGroups = useMemo((): RopLeaderboardGroup[] => {
    if (ratingMode !== "rop") return [];
    const byTeam = new Map<string, ManagerCreatedSummaryRow[]>();
    for (const row of visibleCreatedSummaryRows) {
      const tid = managerRopTeamId(row.managerId);
      const arr = byTeam.get(tid) ?? [];
      arr.push(row);
      byTeam.set(tid, arr);
    }

    const out: RopLeaderboardGroup[] = [];
    for (const [ropId, raw] of Array.from(byTeam.entries())) {
      const members = sortCreatedSummaryRows(raw);
      let totalClients = 0;
      let totalTp = 0;
      let activeCount = 0;
      let idleCount = 0;
      for (const m of members) {
        totalClients += m.newClients;
        totalTp += m.newTradePoints;
        const t = m.newClients + m.newTradePoints;
        if (t > 0) activeCount += 1;
        else idleCount += 1;
      }
      const totalSum = totalClients + totalTp;
      let leader: { name: string; total: number } | null = null;
      for (const m of members) {
        const t = m.newClients + m.newTradePoints;
        if (!leader || t > leader.total) leader = { name: m.displayName, total: t };
      }
      if (!leader || leader.total <= 0) leader = null;
      out.push({
        ropId,
        title: ropGroupDisplayTitle(ropId),
        members,
        totalClients,
        totalTp,
        totalSum,
        activeCount,
        idleCount,
        leader,
      });
    }
    out.sort((a, b) => {
      if (b.totalSum !== a.totalSum) return b.totalSum - a.totalSum;
      if (b.totalClients !== a.totalClients) return b.totalClients - a.totalClients;
      if (b.totalTp !== a.totalTp) return b.totalTp - a.totalTp;
      return a.title.localeCompare(b.title, "ru");
    });
    return out;
  }, [ratingMode, visibleCreatedSummaryRows]);

  const maxRopGroupTotal = useMemo(
    () => Math.max(1, ...ropModeGroups.map((g) => g.totalSum)),
    [ropModeGroups],
  );

  const toggleRopGroup = (ropId: string): void => {
    setExpandedRopIds((prev) => {
      const next = new Set(prev);
      if (next.has(ropId)) next.delete(ropId);
      else next.add(ropId);
      return next;
    });
  };

  const leaderMaxManualTotal = useMemo(() => {
    const withAdds = createdManagerSummaryRows.filter((r) => r.newClients + r.newTradePoints > 0);
    return Math.max(1, ...withAdds.map((r) => r.newClients + r.newTradePoints));
  }, [createdManagerSummaryRows]);

  const topLeaderboardBarData = useMemo(
    () =>
      createdManagerSummaryRows
        .filter((r) => r.newClients + r.newTradePoints > 0)
        .slice(0, 10)
        .map((r) => ({
          name: r.displayName.length > 16 ? `${r.displayName.slice(0, 16)}…` : r.displayName,
          clients: r.newClients,
          tradePoints: r.newTradePoints,
          id: r.managerId,
        }))
        .reverse(),
    [createdManagerSummaryRows],
  );

  const kpiInactiveManagersFromCreated = useMemo(
    () => createdManagerSummaryRows.filter((r) => r.newClients + r.newTradePoints === 0).length,
    [createdManagerSummaryRows],
  );

  const byDayManual = useMemo(() => {
    const manualEvents = filteredEvents.filter((e) => e.kind === "manual_dealer" || e.kind === "manual_trade_point");
    return bucketEventsByDay(manualEvents).map((d) => ({
      day: d.day,
      clients: d.dealers,
      tradePoints: d.tradePoints,
    }));
  }, [filteredEvents]);

  const detailAddedClients = useMemo(() => {
    if (!detailManagerId) return [];
    return listContributionAddedClientsForManager(detailManagerId, activitySources, geoPack, range);
  }, [detailManagerId, activitySources, geoPack, range]);

  const detailAddedTradePoints = useMemo(() => {
    if (!detailManagerId) return [];
    return listContributionAddedTradePointsForManager(detailManagerId, activitySources, geoPack, range);
  }, [detailManagerId, activitySources, geoPack, range]);

  useEffect(() => {
    if (detailManagerId) setDetailTab("clients");
  }, [detailManagerId]);

  const breakdown = useMemo(() => {
    let d = 0;
    let tp = 0;
    let le = 0;
    let ph = 0;
    let sh = 0;
    for (const ev of filteredEvents) {
      if (ev.kind === "manual_dealer" || ev.kind === "dealer_updated") d += 1;
      else if (ev.kind === "manual_trade_point" || ev.kind === "trade_point_updated") tp += 1;
      else if (ev.kind === "legal_entity" || ev.kind === "archive_legal") le += 1;
      else if (ev.kind === "photo") ph += 1;
      else if (ev.kind === "showcase" || ev.kind === "matrix_task") sh += 1;
    }
    return [
      { name: "Клиенты", value: d, key: "d" },
      { name: "ТТ", value: tp, key: "tp" },
      { name: "Юрлица", value: le, key: "le" },
      { name: "Фото", value: ph, key: "ph" },
      { name: "Витрина", value: sh, key: "sh" },
    ].filter((x) => x.value > 0);
  }, [filteredEvents]);

  const managerScoreChartData = useMemo(
    () =>
      contributionFilteredManagers
        .filter((m) => m.score > 0)
        .slice(0, 12)
        .map((m) => ({ name: activityChartManagerLabel(m), score: m.score, id: m.managerId }))
        .reverse(),
    [contributionFilteredManagers],
  );

  const managerClientsTpChartData = useMemo(
    () =>
      createdManagerSummaryRows
        .filter((m) => m.newClients > 0 || m.newTradePoints > 0)
        .map((m) => ({
          name: m.displayName,
          clients: m.newClients,
          tradePoints: m.newTradePoints,
          id: m.managerId,
        }))
        .sort((a, b) => b.clients + b.tradePoints - (a.clients + a.tradePoints))
        .slice(0, 14)
        .reverse(),
    [createdManagerSummaryRows],
  );

  const noCalendarEventCount = useMemo(
    () => kpiBaseEvents.filter((e) => e.atMs === ACTIVITY_NO_CALENDAR_TIME_MS).length,
    [kpiBaseEvents],
  );

  const detailExcludedTechnical = useMemo(() => {
    if (!detailManagerId || !isActivityUnknownUserId(detailManagerId)) return [];
    return filteredExcludedTechnical;
  }, [detailManagerId, filteredExcludedTechnical]);

  const last7Ids = useMemo(() => {
    const pr = activityPeriodToRange("7d");
    if (!pr) return new Set<string>();
    return new Set(filterEventsForDashboard(allEvents, pr, "all", { act: state, scopedDealerIds: scopedIds, ropTeamId: ropTeam, managerId: "__all__", regionalManager: "__all__", city: "__all__", dealerById }).map((e) => e.userId));
  }, [allEvents, state, scopedIds, ropTeam, dealerById]);

  const idleManagers = useMemo(() => roster.filter((m) => !last7Ids.has(m.id)), [roster, last7Ids]);

  const hasFilteredActivity = filteredEvents.length > 0;
  const hasExcludedOnly = filteredEvents.length === 0 && filteredExcludedTechnical.length > 0;

  const dataSourcesLine = useMemo(() => {
    const idsN = Math.max(diagnostics.requestedUserIds.length, 1);
    const periodLabel = PERIOD_LABELS[period];
    const fail = diagnostics.failedSnapshots > 0 ? ` · ошибок загрузки: ${diagnostics.failedSnapshots}` : "";
    const noCal =
      noCalendarEventCount > 0
        ? ` · событий без даты (только «Всё время»): ${noCalendarEventCount}`
        : "";
    return `Источники: user states ${diagnostics.loadedSnapshots}/${idsN}${fail} · manual dealers ${diagnostics.mergedManualDealers} · manual ТТ ${diagnostics.mergedManualTradePoints} · период: ${periodLabel} · техн. исключения в фильтрах: ${filteredExcludedTechnical.length}${noCal}`;
  }, [diagnostics, period, filteredExcludedTechnical.length, noCalendarEventCount]);

  const showManagersAccountsHint =
    diagnostics.mode === "team" &&
    !teamLoading &&
    diagnostics.loadedSnapshots > 0 &&
    diagnostics.sumManualDealersAcrossSources === 0 &&
    diagnostics.mergedManualDealers === 0 &&
    diagnostics.mergedManualTradePoints === 0;

  const filterChipTeamLabel = useMemo(
    () => (ropTeam === "__all__" ? "Все команды" : getRopOptions().find((o) => o.teamId === ropTeam)?.label ?? "Команда"),
    [ropTeam],
  );
  const filterChipManagerLabel = useMemo(
    () => (managerId === "__all__" ? "Все менеджеры" : roster.find((m) => m.id === managerId)?.name ?? "Менеджер"),
    [managerId, roster],
  );

  const scrollToManagersSection = (): void => {
    managersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const detailDialogTitle = useMemo(() => {
    if (!detailManagerId) return "";
    if (isActivityUnknownUserId(detailManagerId)) return ACTIVITY_UNKNOWN_DISPLAY;
    return (
      createdManagerSummaryRows.find((r) => r.managerId === detailManagerId)?.displayName ??
      visibleManagers.find((m) => m.managerId === detailManagerId)?.displayName ??
      "Менеджер"
    );
  }, [detailManagerId, createdManagerSummaryRows, visibleManagers]);

  if (!actx.enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8 sm:px-6" data-testid="page-client-base-activity-dashboard">
        <h1 className="text-xl font-semibold">Актуализация базы</h1>
        <p className="text-sm text-muted-foreground">Дашборд доступен при включённой актуализации клиентской базы.</p>
      </div>
    );
  }

  const primaryFill = C.primary;
  const mutedFill = C.tpStack;

  return (
    <div
      className="min-w-0 space-y-4 px-3 pb-10 pt-1 sm:space-y-6 sm:px-0 sm:pb-8 sm:pt-0"
      data-testid="page-client-base-activity-dashboard"
      style={{ color: C.text }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 shrink-0" style={{ color: C.primary }} aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: C.text }}>
              Актуализация базы
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-snug" style={{ color: C.muted }}>
            Сводка по новым клиентам и торговым точкам команды за период. Рейтинг и детализация по каждому менеджеру.
          </p>
          {teamLoading ? (
            <p className="text-xs" style={{ color: C.muted }}>
              Загрузка состояния актуализации по менеджерам команды…
            </p>
          ) : null}
          {teamError ? (
            <p className="text-xs font-medium" style={{ color: C.primary }} role="status">
              {teamError}
            </p>
          ) : null}
        </div>
      </div>

      {showManagersAccountsHint ? (
        <Card className="rounded-2xl border border-border/80 bg-muted/10 shadow-sm" data-testid="section-activity-managers-empty-hint">
          <CardContent className="px-4 py-4 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Нет данных по менеджерам в объединённом state: не найдено ручных клиентов и ТТ. Убедитесь, что менеджеры
              сохраняли актуализацию под своими аккаунтами (каждый userId — отдельный снимок на сервере). Под директором
              дашборд загружает state всех менеджеров команды; пустые снимки не считаются ошибкой.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {!hasFilteredActivity && !hasExcludedOnly && !teamLoading && kpiManualDealersFromSources + kpiManualTpFromSources === 0 ? (
        <Card className="rounded-2xl border border-border/80 bg-muted/10 shadow-sm" data-testid="section-activity-empty">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
            <BarChart3 className="h-12 w-12 text-primary/60" aria-hidden />
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">Пока нет активности по актуализации базы</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                В выбранном периоде и с учётом фильтров нет зафиксированных действий. Когда менеджеры начнут заполнять
                клиентов, торговые точки, юрлица, фото и витрины, здесь появятся графики и рейтинг.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasExcludedOnly && !teamLoading ? (
        <Card className="rounded-2xl border border-border/80 bg-muted/10 shadow-sm" data-testid="section-activity-excluded-only">
          <CardContent className="space-y-2 px-4 py-6 sm:px-6">
            <p className="text-sm font-medium text-foreground">Нет действий менеджеров в рейтинге за период</p>
            <p className="text-sm text-muted-foreground">
              В выбранном периоде и с учётом фильтров есть{" "}
              <span className="font-medium text-foreground">{filteredExcludedTechnical.length}</span> системных записей
              без автора (архив без archivedBy, юрлица без updatedBy и т. д.). Они намеренно не входят в score и в
              таблицу менеджеров. Откройте фильтр типа «Архив» или расширьте период, если ожидаете активность команды.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Collapsible open={isMobile ? mobileFiltersOpen : true} onOpenChange={(o) => isMobile && setMobileFiltersOpen(o)}>
        <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
          <CardHeader className="flex flex-col gap-2 space-y-0 pb-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold" style={{ color: C.text }}>
                Фильтры
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 sm:hidden"
                  style={{ borderColor: C.border, color: C.text }}
                >
                  {mobileFiltersOpen ? "Свернуть" : "Развернуть"}
                </Button>
              </CollapsibleTrigger>
            </div>
            {isMobile && !mobileFiltersOpen ? (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    [PERIOD_LABELS[period], "chip-period"],
                    [filterChipTeamLabel, "chip-team"],
                    [filterChipManagerLabel, "chip-manager"],
                    [TYPE_LABELS[typeFilter], "chip-type"],
                  ] as const
                ).map(([label, key]) => (
                  <span
                    key={key}
                    className="inline-flex max-w-[48%] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ borderColor: C.border, color: C.muted, background: C.surface }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CollapsibleContent className="data-[state=closed]:hidden sm:data-[state=closed]:block">
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 lg:p-4">
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  Период
                </Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as ActivityPeriodPreset)}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-period" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_PERIOD_PRESETS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {PERIOD_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  РОП / команда
                </Label>
                <Select value={ropTeam} onValueChange={setRopTeam}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-rop" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue placeholder="Все команды" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все команды</SelectItem>
                    {getRopOptions().map((o) => (
                      <SelectItem key={o.teamId} value={o.teamId}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  Менеджер
                </Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-manager" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue placeholder="Все менеджеры" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все менеджеры</SelectItem>
                    {roster.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  Региональный менеджер
                </Label>
                <Select value={regionalManager} onValueChange={setRegionalManager}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-regional-manager" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все</SelectItem>
                    {rmOptions.map((rm) => (
                      <SelectItem key={rm} value={rm}>
                        {rm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  Город
                </Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-city" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue placeholder="Все города" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все города</SelectItem>
                    {cityOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: C.muted }}>
                  Тип активности
                </Label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ActivityTypeFilter)}>
                  <SelectTrigger className="min-h-10 border bg-white" data-testid="select-activity-type" style={{ borderColor: C.border, color: C.text }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as ActivityTypeFilter[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TYPE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 sm:col-span-2 lg:col-span-3"
                style={{ borderColor: C.border, background: C.surface }}
              >
                <Label htmlFor="switch-activity-only-active" className="text-sm" style={{ color: C.text }}>
                  Только менеджеры с активностью
                </Label>
                <Switch
                  id="switch-activity-only-active"
                  checked={onlyActiveManagers}
                  onCheckedChange={(v) => setOnlyActiveManagers(v === true)}
                  data-testid="switch-activity-only-active"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={technicalDiagnosticsOpen} onOpenChange={setTechnicalDiagnosticsOpen}>
        <div
          className="rounded-2xl border bg-white px-3 py-2 shadow-sm sm:px-4"
          style={{ borderColor: C.border }}
          data-testid="section-activity-technical-diagnostics"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-2 px-1 py-2 text-left text-xs font-medium hover:bg-transparent"
              style={{ color: C.muted }}
              data-testid="button-activity-technical-diagnostics-toggle"
            >
              Техническая диагностика
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", technicalDiagnosticsOpen && "rotate-180")}
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: C.muted }} data-testid="text-activity-data-sources">
              {dataSourcesLine}
            </p>
            <p className="mt-2 text-[10px] leading-snug" style={{ color: C.muted }}>
              Счётчики рейтинга и KPI «Итоги периода» используют поля{" "}
              <code className="rounded px-1" style={{ background: C.surface }}>
                manuallyCreatedDealersById
              </code>{" "}
              и{" "}
              <code className="rounded px-1" style={{ background: C.surface }}>
                manuallyCreatedTradePointsById
              </code>{" "}
              в каждом user state; автор записи — владелец снимка.
            </p>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <section className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: C.border }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          Итоги периода
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: C.border, background: C.white }}>
            <p className="text-[11px] font-medium leading-tight" style={{ color: C.muted }}>
              Клиентов добавлено
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: C.text }}>
              {kpiManualDealersFromSources}
            </p>
          </div>
          <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: C.border, background: C.white }}>
            <p className="text-[11px] font-medium leading-tight" style={{ color: C.muted }}>
              ТТ добавлено
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: C.text }}>
              {kpiManualTpFromSources}
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border p-3 text-left transition hover:opacity-95 sm:p-4"
            style={{ borderColor: C.border, background: C.surface }}
            onClick={scrollToManagersSection}
            data-testid="kpi-active-managers-trigger"
          >
            <p className="text-[11px] font-medium leading-tight" style={{ color: C.muted }}>
              Активных менеджеров
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: C.primary }}>
              {kpiActiveManagersFromCreated}
            </p>
          </button>
          <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: C.border, background: C.surface }}>
            <p className="text-[11px] font-medium leading-tight" style={{ color: C.muted }}>
              Без активности
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: C.muted }}>
              {kpiInactiveManagersFromCreated}
            </p>
          </div>
        </div>
      </section>

      <Card
        ref={managersSectionRef}
        data-testid="section-manager-created-summary"
        className="scroll-mt-4 rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: C.border }}
      >
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-lg font-semibold sm:text-xl" style={{ color: C.text }}>
            {ratingMode === "rop" ? "Рейтинг по РОП" : "Рейтинг менеджеров"}
          </CardTitle>
          <p className="text-sm leading-snug" style={{ color: C.muted }}>
            {ratingMode === "rop"
              ? "Команды сгруппированы по руководителям продаж. Раскройте РОП, чтобы увидеть менеджеров и перейти к добавленным карточкам."
              : "Показываем, сколько новых клиентов и торговых точек добавил каждый менеджер за выбранный период."}
          </p>
          <div
            className="flex flex-wrap gap-2"
            data-testid="section-manager-rating-mode-toggle"
            role="group"
            aria-label="Режим отображения рейтинга"
          >
            <Button
              type="button"
              size="sm"
              variant={ratingMode === "flat" ? "default" : "outline"}
              className={cn("h-8 text-xs", ratingMode === "flat" && "border-transparent")}
              style={
                ratingMode === "flat"
                  ? { background: C.primary, color: C.white }
                  : { borderColor: C.border, color: C.text, background: C.white }
              }
              onClick={() => setRatingMode("flat")}
              data-testid="button-manager-rating-flat"
            >
              Общий рейтинг
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ratingMode === "rop" ? "default" : "outline"}
              className={cn("h-8 text-xs", ratingMode === "rop" && "border-transparent")}
              style={
                ratingMode === "rop"
                  ? { background: C.primary, color: C.white }
                  : { borderColor: C.border, color: C.text, background: C.white }
              }
              onClick={() => setRatingMode("rop")}
              data-testid="button-manager-rating-by-rop"
            >
              По РОП
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Все"],
                ["with_additions", "С добавлениями"],
                ["no_activity", "Без активности"],
                ["top", "Топ"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={leaderboardFilter === key ? "default" : "outline"}
                className={cn("h-8 text-xs", leaderboardFilter === key && "border-transparent")}
                style={
                  leaderboardFilter === key
                    ? { background: C.primary, color: C.white }
                    : { borderColor: C.border, color: C.text, background: C.white }
                }
                onClick={() => setLeaderboardFilter(key)}
                data-testid={`button-created-summary-filter-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto p-0 sm:p-4">
          <div className="space-y-4" data-testid="section-manager-leaderboard">
            {!isMobile && ratingMode === "flat" && topLeaderboardBarData.length > 0 ? (
              <div className="hidden h-[220px] w-full min-w-0 px-3 sm:block sm:px-0" data-testid="chart-manager-leaderboard-top">
                <p className="mb-2 text-xs font-semibold" style={{ color: C.muted }}>
                  Топ менеджеров по добавлениям
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topLeaderboardBarData}
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: C.muted }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="clients" stackId="lb" fill={C.primary} name="Клиенты" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="tradePoints" stackId="lb" fill={C.tpStack} name="ТТ" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {ratingMode === "flat" ? (
              isMobile ? (
                <div className="flex flex-col gap-2 p-3">
                  {visibleCreatedSummaryRows.map((row) => {
                    const total = row.newClients + row.newTradePoints;
                    const gr = globalRankByManagerId.get(row.managerId) ?? 0;
                    const isGlobalTop = gr <= 3 && total > 0;
                    return (
                      <ManagerCreatedMobileCard
                        key={row.managerId}
                        row={row}
                        rankLabel={`#${gr}`}
                        globalRank={gr}
                        showGlobalRankSubtitle={false}
                        showTeamLine
                        isGlobalTop={isGlobalTop}
                        leaderMaxManualTotal={leaderMaxManualTotal}
                        leaderboardFilter={leaderboardFilter}
                        onOpenDetail={(id) => setDetailManagerId(id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm" data-testid="table-manager-created-summary">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase" style={{ borderColor: C.border, color: C.muted, background: C.surface }}>
                        <th className="p-2">#</th>
                        <th className="p-2">Менеджер</th>
                        <th className="p-2">Команда</th>
                        <th className="p-2 text-right">Клиенты</th>
                        <th className="p-2 text-right">ТТ</th>
                        <th className="p-2 text-right">Всего</th>
                        <th className="p-2 text-right">Последняя активность</th>
                        <th className="p-2 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCreatedSummaryRows.map((row) => {
                        const unknown = isActivityUnknownUserId(row.managerId);
                        const total = row.newClients + row.newTradePoints;
                        const rank = globalRankByManagerId.get(row.managerId) ?? 0;
                        const isTop = rank <= 3 && total > 0;
                        const isInactive = total === 0;
                        return (
                          <tr
                            key={row.managerId}
                            className="border-b transition-colors hover:bg-[#EEEFF6]"
                            style={{
                              borderColor: C.border,
                              background: isTop ? "rgba(154, 202, 60, 0.1)" : undefined,
                              color: isInactive ? C.muted : C.text,
                            }}
                            data-testid={`card-manager-contribution-${row.managerId}`}
                          >
                            <td className="p-2 tabular-nums" style={{ color: C.muted }}>
                              {rank}
                            </td>
                            <td className="p-2">
                              <div data-testid={`card-manager-leader-${row.managerId}`}>
                                {unknown ? (
                                  <Badge variant="outline" className="text-[10px]" title={UNKNOWN_ACTOR_HELP} style={{ borderColor: C.border }}>
                                    {ACTIVITY_UNKNOWN_DISPLAY}
                                  </Badge>
                                ) : (
                                  <span className="font-medium">{row.displayName}</span>
                                )}
                                {isTop ? (
                                  <Badge className="ml-2 align-middle border-0 px-1.5 py-0 text-[9px]" style={{ background: C.primary, color: C.white }} data-testid={`badge-manager-leader-${row.managerId}`}>
                                    Лидер
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="max-w-[200px] p-2 text-xs" style={{ color: C.muted }}>
                              {managerTeamAndRopLabel(row.managerId)}
                            </td>
                            <td className="p-2 text-right tabular-nums" data-testid={`text-manager-clients-added-${row.managerId}`}>
                              {row.newClients}
                            </td>
                            <td className="p-2 text-right tabular-nums" data-testid={`text-manager-trade-points-added-${row.managerId}`}>
                              {row.newTradePoints}
                            </td>
                            <td className="p-2 text-right tabular-nums font-semibold">{total}</td>
                            <td className="p-2 text-right text-xs" style={{ color: C.muted }}>
                              {formatLastManualAddition(row.lastAddedAtMs, total)}
                            </td>
                            <td className="p-2 text-right">
                              {isInactive ? (
                                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled style={{ borderColor: C.border, color: C.muted }}>
                                  Нет добавлений
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-0 text-xs font-medium text-white hover:opacity-95"
                                  style={{ background: C.primary }}
                                  onClick={() => setDetailManagerId(row.managerId)}
                                  data-testid={`button-manager-contribution-open-${row.managerId}`}
                                >
                                  Смотреть
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div data-testid="section-manager-rop-groups">
                {isMobile ? (
                  <div className="flex flex-col gap-2 p-3">
                    {ropModeGroups.map((g, groupIdx) => {
                      const expanded = expandedRopIds.has(g.ropId);
                      const isTopTeam = groupIdx < 3 && g.totalSum > 0;
                      const isMutedTeam = g.totalSum === 0;
                      const teamProg = Math.min(100, Math.round((g.totalSum / maxRopGroupTotal) * 100));
                      return (
                        <Collapsible
                          key={g.ropId}
                          open={expanded}
                          onOpenChange={(open) => {
                            setExpandedRopIds((prev) => {
                              const next = new Set(prev);
                              if (open) next.add(g.ropId);
                              else next.delete(g.ropId);
                              return next;
                            });
                          }}
                        >
                          <div
                            data-testid={`card-manager-rop-group-${g.ropId}`}
                            className={cn(
                              "overflow-hidden rounded-xl border shadow-sm",
                              isTopTeam && "border-[rgba(154,202,60,0.45)] bg-[rgba(154,202,60,0.1)]",
                              !isTopTeam && !isMutedTeam && "bg-white",
                              isMutedTeam && "bg-[#EEEFF6]/80",
                            )}
                            style={{ borderColor: C.border }}
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="w-full p-3 text-left transition hover:opacity-95"
                                data-testid={`button-manager-rop-toggle-${g.ropId}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 flex-1 text-sm font-semibold leading-snug" style={{ color: isMutedTeam ? C.muted : C.text }}>
                                    {g.title}
                                  </p>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: isMutedTeam ? C.muted : C.text }}>
                                      {g.totalSum}
                                    </span>
                                    <ChevronDown
                                      className={cn("h-5 w-5 shrink-0 transition-transform", expanded && "rotate-180")}
                                      style={{ color: C.muted }}
                                      aria-hidden
                                    />
                                  </div>
                                </div>
                                <p className="mt-2 text-[11px] leading-snug" style={{ color: C.muted }}>
                                  <span data-testid={`text-manager-rop-clients-added-${g.ropId}`}>Клиенты: {g.totalClients}</span>
                                  <span className="mx-1">·</span>
                                  <span data-testid={`text-manager-rop-trade-points-added-${g.ropId}`}>ТТ: {g.totalTp}</span>
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span
                                    className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums"
                                    style={{ borderColor: C.border, color: C.text, background: C.white }}
                                    data-testid={`text-manager-rop-active-count-${g.ropId}`}
                                  >
                                    Активных {g.activeCount}
                                  </span>
                                  <span
                                    className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums"
                                    style={{ borderColor: C.border, color: C.muted, background: C.surface }}
                                    data-testid={`text-manager-rop-idle-count-${g.ropId}`}
                                  >
                                    Без активности {g.idleCount}
                                  </span>
                                </div>
                                {g.totalSum > 0 ? (
                                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: C.surface }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${teamProg}%`, background: C.primary }} />
                                  </div>
                                ) : null}
                                <p className="mt-2 text-[11px] leading-snug" style={{ color: C.muted }}>
                                  Лидер:{" "}
                                  {g.leader ? (
                                    <span style={{ color: C.text }}>
                                      {g.leader.name} · всего {g.leader.total}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </p>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: C.border }} data-testid={`section-manager-rop-members-${g.ropId}`}>
                                {g.members.map((row, idx) => {
                                  const total = row.newClients + row.newTradePoints;
                                  const gr = globalRankByManagerId.get(row.managerId) ?? 0;
                                  const isGlobalTop = gr <= 3 && total > 0;
                                  return (
                                    <ManagerCreatedMobileCard
                                      key={row.managerId}
                                      row={row}
                                      rankLabel={`#${idx + 1}`}
                                      globalRank={gr}
                                      showGlobalRankSubtitle
                                      showTeamLine={false}
                                      isGlobalTop={isGlobalTop}
                                      leaderMaxManualTotal={leaderMaxManualTotal}
                                      leaderboardFilter={leaderboardFilter}
                                      onOpenDetail={(id) => setDetailManagerId(id)}
                                    />
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                ) : (
                  <div className="hidden overflow-x-auto px-3 pb-3 sm:block sm:px-0">
                    <table className="w-full min-w-[760px] text-sm" data-testid="table-manager-rop-created-summary">
                      <thead>
                        <tr className="border-b text-left text-[11px] font-semibold uppercase" style={{ borderColor: C.border, color: C.muted, background: C.surface }}>
                          <th className="p-2">#</th>
                          <th className="p-2">Менеджер</th>
                          <th className="p-2 text-right">Клиенты</th>
                          <th className="p-2 text-right">ТТ</th>
                          <th className="p-2 text-right">Всего</th>
                          <th className="p-2 text-right">Последняя активность</th>
                          <th className="p-2 text-right">Действие</th>
                        </tr>
                      </thead>
                      {ropModeGroups.map((g, groupIdx) => {
                        const expanded = expandedRopIds.has(g.ropId);
                        const isTopTeam = groupIdx < 3 && g.totalSum > 0;
                        const isMutedTeam = g.totalSum === 0;
                        const teamProg = Math.min(100, Math.round((g.totalSum / maxRopGroupTotal) * 100));
                        return (
                          <Fragment key={g.ropId}>
                            <tbody>
                              <tr
                                data-testid={`card-manager-rop-group-${g.ropId}`}
                                className="border-b"
                                style={{
                                  borderColor: C.border,
                                  background: isTopTeam ? "rgba(154, 202, 60, 0.1)" : isMutedTeam ? "rgba(238, 239, 246, 0.95)" : C.white,
                                  color: isMutedTeam ? C.muted : C.text,
                                }}
                              >
                                <td colSpan={7} className="p-0 align-top">
                                  <button
                                    type="button"
                                    className="flex w-full flex-col gap-2 p-3 text-left transition hover:opacity-95"
                                    data-testid={`button-manager-rop-toggle-${g.ropId}`}
                                    onClick={() => toggleRopGroup(g.ropId)}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="flex min-w-0 flex-1 items-start gap-2">
                                        <ChevronDown
                                          className={cn("mt-0.5 h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
                                          style={{ color: C.muted }}
                                          aria-hidden
                                        />
                                        <span className="text-sm font-semibold leading-snug">{g.title}</span>
                                      </div>
                                      <span className="shrink-0 text-xl font-bold tabular-nums">{g.totalSum}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 pl-6 text-xs" style={{ color: C.muted }}>
                                      <span data-testid={`text-manager-rop-clients-added-${g.ropId}`}>Клиенты: {g.totalClients}</span>
                                      <span data-testid={`text-manager-rop-trade-points-added-${g.ropId}`}>ТТ: {g.totalTp}</span>
                                      <span data-testid={`text-manager-rop-active-count-${g.ropId}`}>Активных: {g.activeCount}</span>
                                      <span data-testid={`text-manager-rop-idle-count-${g.ropId}`}>Без активности: {g.idleCount}</span>
                                    </div>
                                    {g.totalSum > 0 ? (
                                      <div className="pl-6">
                                        <div className="h-1 w-full max-w-md overflow-hidden rounded-full" style={{ background: C.surface }}>
                                          <div className="h-full rounded-full" style={{ width: `${teamProg}%`, background: C.primary }} />
                                        </div>
                                      </div>
                                    ) : null}
                                    <p className="pl-6 text-xs leading-snug" style={{ color: C.muted }}>
                                      Лидер:{" "}
                                      {g.leader ? (
                                        <span className="font-medium" style={{ color: C.text }}>
                                          {g.leader.name} · всего {g.leader.total}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </p>
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                            {expanded ? (
                              <tbody data-testid={`section-manager-rop-members-${g.ropId}`}>
                                {g.members.map((row, idx) => {
                                  const unknown = isActivityUnknownUserId(row.managerId);
                                  const total = row.newClients + row.newTradePoints;
                                  const gr = globalRankByManagerId.get(row.managerId) ?? 0;
                                  const isGlobalTop = gr <= 3 && total > 0;
                                  const isInactive = total === 0;
                                  return (
                                    <tr
                                      key={row.managerId}
                                      className="border-b transition-colors hover:bg-[#EEEFF6]"
                                      style={{
                                        borderColor: C.border,
                                        background: isGlobalTop ? "rgba(154, 202, 60, 0.08)" : undefined,
                                        color: isInactive ? C.muted : C.text,
                                      }}
                                      data-testid={`card-manager-contribution-${row.managerId}`}
                                    >
                                      <td className="p-2 pl-6 tabular-nums" style={{ color: C.muted }}>
                                        {idx + 1}
                                      </td>
                                      <td className="p-2">
                                        <div data-testid={`card-manager-leader-${row.managerId}`}>
                                          {unknown ? (
                                            <Badge variant="outline" className="text-[10px]" title={UNKNOWN_ACTOR_HELP} style={{ borderColor: C.border }}>
                                              {ACTIVITY_UNKNOWN_DISPLAY}
                                            </Badge>
                                          ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                              <div>
                                                <span className="font-medium">{row.displayName}</span>
                                                <p className="text-[10px] leading-snug" style={{ color: C.muted }}>
                                                  {gr > 0 ? `В общем рейтинге #${gr}` : "В общем рейтинге —"}
                                                </p>
                                              </div>
                                              {isGlobalTop ? (
                                                <Badge className="border-0 px-1.5 py-0 text-[9px]" style={{ background: C.primary, color: C.white }} data-testid={`badge-manager-leader-${row.managerId}`}>
                                                  Лидер
                                                </Badge>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2 text-right tabular-nums" data-testid={`text-manager-clients-added-${row.managerId}`}>
                                        {row.newClients}
                                      </td>
                                      <td className="p-2 text-right tabular-nums" data-testid={`text-manager-trade-points-added-${row.managerId}`}>
                                        {row.newTradePoints}
                                      </td>
                                      <td className="p-2 text-right tabular-nums font-semibold">{total}</td>
                                      <td className="p-2 text-right text-xs" style={{ color: C.muted }}>
                                        {formatLastManualAddition(row.lastAddedAtMs, total)}
                                      </td>
                                      <td className="p-2 text-right">
                                        {isInactive ? (
                                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled style={{ borderColor: C.border, color: C.muted }}>
                                            Нет добавлений
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-0 text-xs font-medium text-white hover:opacity-95"
                                            style={{ background: C.primary }}
                                            onClick={() => setDetailManagerId(row.managerId)}
                                            data-testid={`button-manager-contribution-open-${row.managerId}`}
                                          >
                                            Смотреть
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold" style={{ color: C.text }}>
            Динамика по дням
          </CardTitle>
          <p className="text-xs" style={{ color: C.muted }}>
            Новые клиенты и торговые точки (ручные записи)
          </p>
        </CardHeader>
        <CardContent className="h-[260px] w-full min-w-0 px-2 sm:px-4" data-testid="chart-activity-by-day">
          {byDayManual.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDayManual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis width={32} tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clients" stackId="day" fill={C.primary} name="Клиенты" />
                <Bar dataKey="tradePoints" stackId="day" fill={C.tpStack} name="ТТ" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyPlaceholder
              title="Нет данных по дням"
              text="В выбранном периоде нет ручных клиентов или ТТ с датой по дням."
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold" style={{ color: C.text }}>
            Клиенты и ТТ по менеджерам
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] w-full min-w-0 px-2 sm:px-4" data-testid="chart-manager-added-clients-trade-points">
          {managerClientsTpChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={managerClientsTpChartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal stroke={C.border} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clients" stackId="add" fill={C.primary} name="Клиенты" radius={[0, 0, 0, 0]} />
                <Bar dataKey="tradePoints" stackId="add" fill={C.tpStack} name="ТТ" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyPlaceholder title="Нет добавлений" text="Нет ручных клиентов или торговых точек по менеджерам за период." />
          )}
        </CardContent>
      </Card>

      <Collapsible open={scoreSectionOpen} onOpenChange={setScoreSectionOpen}>
        <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left sm:px-6"
              style={{ color: C.text }}
            >
              <span className="text-sm font-semibold">Score по менеджерам (вторично)</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", scoreSectionOpen && "rotate-180")} style={{ color: C.muted }} aria-hidden />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="h-[200px] w-full min-w-0 px-2 pb-4 sm:px-4" data-testid="chart-activity-by-manager">
              {managerScoreChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={managerScoreChartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                    <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10, fill: C.muted }} />
                    <Tooltip />
                    <Bar dataKey="score" fill={C.primary} radius={[0, 4, 4, 0]} name="Score" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyPlaceholder title="Нет score" text="Нет действий с ненулевым score в выбранном периоде." />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={pieSectionOpen} onOpenChange={setPieSectionOpen}>
        <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left sm:px-6"
              style={{ color: C.text }}
            >
              <span className="text-sm font-semibold">Структура действий (все типы)</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", pieSectionOpen && "rotate-180")} style={{ color: C.muted }} aria-hidden />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="mx-auto h-[220px] w-full max-w-sm px-2 pb-4 sm:px-4" data-testid="chart-activity-breakdown">
              {breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {breakdown.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? C.primary : C.tpStack} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyPlaceholder title="Нет структуры действий" text="Нет событий для диаграммы в текущих фильтрах." />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }} data-testid="section-activity-quality">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold" style={{ color: C.text }}>
            Качество базы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:max-w-xl">
          {[
            { label: "Клиенты с ИНН", v: quality.dealersWithInnPct },
            { label: "Клиенты с телефоном", v: quality.dealersWithPhonePct },
            { label: "Клиенты с email", v: quality.dealersWithEmailPct },
            { label: "Клиенты с юрлицом", v: quality.dealersWithLegalPct },
            { label: "Клиенты с ТТ", v: quality.dealersWithTpPct },
            { label: "ТТ с адресом", v: quality.tradePointsWithAddressPct },
            { label: "ТТ с фото", v: quality.tradePointsWithPhotoPct },
            { label: "ТТ с заполненной витриной", v: quality.tradePointsShowcaseFilledPct },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between gap-2 text-xs">
                <span style={{ color: C.muted }}>{row.label}</span>
                <span className="tabular-nums font-medium" style={{ color: C.text }}>
                  {row.v}%
                </span>
              </div>
              <Progress value={row.v} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }} data-testid="section-activity-problems">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold" style={{ color: C.text }}>
            Проблемные зоны
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {idleManagers.length ? (
            <Collapsible open={idleGroupOpen} onOpenChange={setIdleGroupOpen}>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.border, background: C.surface }}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
                    style={{ color: C.text }}
                  >
                    <span>{idleManagers.length} менеджеров без активности за 7 дней</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", idleGroupOpen && "rotate-180")} style={{ color: C.muted }} aria-hidden />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-xs" style={{ color: C.muted }}>
                    {idleManagers.map((m) => (
                      <li key={m.id}>{m.name}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ) : null}
          <ul className="space-y-2">
            {(showAllProblems ? problems : problems.slice(0, 7)).map((p) => (
              <li key={p.id} className="text-xs leading-snug" style={{ color: C.muted }}>
                {p.text}
              </li>
            ))}
          </ul>
          {problems.length > 7 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              style={{ borderColor: C.border, color: C.primary }}
              onClick={() => setShowAllProblems((v) => !v)}
            >
              {showAllProblems ? "Свернуть" : "Показать все"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card id="section-activity-managers" className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-base font-semibold" style={{ color: C.muted }}>
            Расширенная сводка (события и score)
          </CardTitle>
          <p className="text-xs leading-snug" style={{ color: C.muted }}>
            Лента всех типов действий. Основной контроль добавлений — блок «Рейтинг менеджеров» выше.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Все"],
                ["with_additions", "С добавлениями"],
                ["no_activity", "Без активности"],
                ["has_clients", "Есть клиенты"],
                ["has_tps", "Есть ТТ"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={contributionQuickFilter === key ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setContributionQuickFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-4">
          {isMobile ? (
            <div className="flex flex-col gap-2 p-3">
              {contributionFilteredManagers.map((m) => {
                const unknown = isActivityUnknownUserId(m.managerId);
                return (
                  <div
                    key={m.managerId}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    data-testid={`card-manager-events-${m.managerId}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        {unknown ? (
                          <Badge
                            variant="outline"
                            className="border-border/80 bg-muted/30 text-[10px] font-medium text-foreground"
                            title={UNKNOWN_ACTOR_HELP}
                            data-testid={`badge-activity-author-unknown-${m.managerId}`}
                          >
                            {ACTIVITY_UNKNOWN_DISPLAY}
                          </Badge>
                        ) : (
                          <p className="font-semibold text-foreground">{m.displayName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{managerTeamAndRopLabel(m.managerId)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            activityStatusForManager(m) === "active" && "border-primary/50 bg-primary/10 text-foreground",
                            activityStatusForManager(m) === "weak" && "border-border text-muted-foreground",
                            activityStatusForManager(m) === "none" && "border-border text-muted-foreground",
                          )}
                          data-testid={`badge-activity-status-${m.managerId}`}
                        >
                          {activityStatusForManager(m) === "active"
                            ? "Активно"
                            : activityStatusForManager(m) === "weak"
                              ? "Слабо"
                              : "Нет активности"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => setDetailManagerId(m.managerId)}
                          data-testid={`button-manager-events-open-${m.managerId}`}
                        >
                          Открыть
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground" data-testid={`text-manager-events-clients-${m.managerId}`}>
                      Клиенты: {m.createdDealers}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-manager-events-tps-${m.managerId}`}>
                      ТТ: {m.addedTradePoints}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Обновления: {m.updatedDealers + m.updatedTradePoints + m.legalEntities}
                    </p>
                    <p className="text-xs text-muted-foreground">Последняя активность: {formatManagerLastActivity(m.lastAtMs)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full min-w-[1100px] text-sm" data-testid="table-manager-contribution">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="p-2">Менеджер</th>
                  <th className="p-2">Команда / РОП</th>
                  <th className="p-2 text-right">Клиентов добавлено</th>
                  <th className="p-2 text-right">ТТ добавлено</th>
                  <th className="p-2 text-right">Клиентов обновлено</th>
                  <th className="p-2 text-right">Юрлиц</th>
                  <th className="p-2 text-right">Фото</th>
                  <th className="p-2 text-right">Витрины</th>
                  <th className="p-2 text-right">Последняя активность</th>
                  <th className="p-2">Статус</th>
                  <th className="p-2 text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {contributionFilteredManagers.map((m) => {
                  const unknown = isActivityUnknownUserId(m.managerId);
                  return (
                    <tr
                      key={m.managerId}
                      className="border-b border-border/60 hover:bg-muted/20"
                      data-testid={`card-manager-events-${m.managerId}`}
                    >
                      <td className="p-2">
                        {unknown ? (
                          <Badge
                            variant="outline"
                            className="border-border/80 bg-muted/30 text-[10px] font-medium text-foreground"
                            title={UNKNOWN_ACTOR_HELP}
                            data-testid={`badge-activity-author-unknown-${m.managerId}`}
                          >
                            {ACTIVITY_UNKNOWN_DISPLAY}
                          </Badge>
                        ) : (
                          <span className="font-medium">{m.displayName}</span>
                        )}
                      </td>
                      <td className="max-w-[220px] p-2 text-xs text-muted-foreground">{managerTeamAndRopLabel(m.managerId)}</td>
                      <td className="p-2 text-right tabular-nums" data-testid={`text-manager-events-clients-${m.managerId}`}>
                        {m.createdDealers}
                      </td>
                      <td className="p-2 text-right tabular-nums" data-testid={`text-manager-events-tps-${m.managerId}`}>
                        {m.addedTradePoints}
                      </td>
                      <td className="p-2 text-right tabular-nums">{m.updatedDealers}</td>
                      <td className="p-2 text-right tabular-nums">{m.legalEntities}</td>
                      <td className="p-2 text-right tabular-nums">{m.photos}</td>
                      <td className="p-2 text-right tabular-nums">{m.showcases}</td>
                      <td className="p-2 text-right text-xs text-muted-foreground">{formatManagerLastActivity(m.lastAtMs)}</td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            activityStatusForManager(m) === "active" && "border-primary/50 bg-primary/10",
                          )}
                          data-testid={`badge-activity-status-${m.managerId}`}
                        >
                          {activityStatusForManager(m) === "active"
                            ? "Активно"
                            : activityStatusForManager(m) === "weak"
                              ? "Слабо"
                              : "Нет активности"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setDetailManagerId(m.managerId)}
                          data-testid={`button-manager-events-open-${m.managerId}`}
                        >
                          Открыть
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailManagerId != null} onOpenChange={(o) => !o && setDetailManagerId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border bg-white sm:max-w-2xl" style={{ borderColor: C.border }} data-testid="dialog-manager-created-detail">
          <DialogHeader>
            <DialogTitle>{detailDialogTitle}</DialogTitle>
            {detailManagerId != null && !isActivityUnknownUserId(detailManagerId) ? (
              <>
                <p className="text-sm" style={{ color: C.muted }}>
                  {managerTeamAndRopLabel(detailManagerId)}
                </p>
                <p className="text-sm font-semibold" style={{ color: C.text }}>
                  Клиенты {createdManagerSummaryRows.find((r) => r.managerId === detailManagerId)?.newClients ?? 0} · ТТ{" "}
                  {createdManagerSummaryRows.find((r) => r.managerId === detailManagerId)?.newTradePoints ?? 0} · Всего{" "}
                  {(createdManagerSummaryRows.find((r) => r.managerId === detailManagerId)?.newClients ?? 0) +
                    (createdManagerSummaryRows.find((r) => r.managerId === detailManagerId)?.newTradePoints ?? 0)}
                </p>
                <p className="text-xs" style={{ color: C.muted }}>
                  {PERIOD_LABELS[period]}
                </p>
              </>
            ) : null}
          </DialogHeader>
          {detailManagerId != null && isActivityUnknownUserId(detailManagerId) ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">
                {UNKNOWN_ACTOR_HELP}
              </p>
              {detailExcludedTechnical.length > 0 ? (
                <div className="rounded-lg border border-border/80 bg-card p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Исключено из рейтинга (системные записи без автора)</p>
                  <p className="mt-1 leading-relaxed">{UNKNOWN_TECH_HELP}</p>
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                    Записей в периоде и фильтрах: {detailExcludedTechnical.length}
                    {detailExcludedTechnical.length > 40 ? " · ниже первые 40" : ""}
                  </p>
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Учтённые в рейтинге</p>
                <ul className="max-h-52 space-y-2 overflow-y-auto text-sm" data-testid="list-activity-manager-events">
                  {kpiBaseEvents
                    .filter((e) => isActivityUnknownUserId(e.userId))
                    .slice(0, 40)
                    .map((e: ActivityEvent) => (
                      <li key={e.id} className="border-b border-border/60 pb-2" data-testid={`row-activity-event-${e.id}`}>
                        <p className="font-medium text-foreground">{e.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.atMs === ACTIVITY_NO_CALENDAR_TIME_MS
                            ? "дата не указана"
                            : new Date(e.atMs).toLocaleString("ru-RU")}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
              {detailExcludedTechnical.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Не в рейтинге</p>
                  <ul className="max-h-52 space-y-2 overflow-y-auto text-sm text-muted-foreground">
                    {detailExcludedTechnical.slice(0, 40).map((e: ActivityEvent) => (
                      <li key={e.id} className="border-b border-border/40 pb-2" data-testid={`row-activity-excluded-${e.id}`}>
                        <p>{e.label}</p>
                        <p className="text-xs">
                          {e.atMs === ACTIVITY_NO_CALENDAR_TIME_MS
                            ? "дата не указана"
                            : new Date(e.atMs).toLocaleString("ru-RU")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1">
                <TabsTrigger value="clients" className="text-xs" data-testid="tab-manager-created-clients">
                  Клиенты
                </TabsTrigger>
                <TabsTrigger value="tps" className="text-xs" data-testid="tab-manager-created-trade-points">
                  Торговые точки
                </TabsTrigger>
              </TabsList>
              <TabsContent value="clients" className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {detailAddedClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет клиентов за период и фильтры.</p>
                ) : (
                  detailAddedClients.map((c) => (
                    <div
                      key={c.dealerId}
                      className="rounded-lg border p-2.5 text-sm"
                      style={{ borderColor: C.border, background: C.surface }}
                      data-testid={`card-manager-created-client-${c.dealerId}`}
                    >
                      <p className="font-medium leading-snug" style={{ color: C.text }}>
                        {c.title}
                      </p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        {c.city}
                        {c.inn && c.inn !== "—" ? ` · ИНН ${c.inn}` : ""}
                      </p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        Добавлено: {c.savedAtLabel}
                      </p>
                      <Link
                        href={`/dealers/${encodeURIComponent(c.dealerId)}`}
                        className="mt-2 inline-block text-xs font-semibold underline-offset-4 hover:underline"
                        style={{ color: C.primary }}
                        data-testid={`link-manager-created-client-${c.dealerId}`}
                      >
                        Открыть карточку
                      </Link>
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="tps" className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {detailAddedTradePoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет торговых точек за период и фильтры.</p>
                ) : (
                  detailAddedTradePoints.map((tp) => (
                    <div
                      key={tp.tradePointId}
                      className="rounded-lg border p-2.5 text-sm"
                      style={{ borderColor: C.border, background: C.surface }}
                      data-testid={`card-manager-created-trade-point-${tp.tradePointId}`}
                    >
                      <p className="font-medium leading-snug" style={{ color: C.text }}>
                        {tp.tpTitle}
                      </p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        Клиент: {tp.dealerTitle}
                      </p>
                      <p className="text-xs" style={{ color: C.muted }}>
                        {tp.city} · {tp.address}
                      </p>
                      {tp.phone && tp.phone !== "—" ? (
                        <p className="text-xs" style={{ color: C.muted }}>
                          {tp.phone}
                        </p>
                      ) : null}
                      <p className="text-xs" style={{ color: C.muted }}>
                        Добавлено: {tp.savedAtLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <Link
                          href={`/dealers/${encodeURIComponent(tp.dealerId)}/trade-points/${encodeURIComponent(tp.tradePointId)}`}
                          className="text-xs font-semibold underline-offset-4 hover:underline"
                          style={{ color: C.primary }}
                          data-testid={`link-manager-created-trade-point-${tp.tradePointId}`}
                        >
                          Открыть карточку
                        </Link>
                        <Link
                          href={`/dealers/${encodeURIComponent(tp.dealerId)}`}
                          className="text-xs underline-offset-4 hover:underline"
                          style={{ color: C.muted }}
                        >
                          К клиенту
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
