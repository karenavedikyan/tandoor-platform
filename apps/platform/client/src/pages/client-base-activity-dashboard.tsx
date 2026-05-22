/**
 * Дашборд активности команды по актуализации клиентской базы (РОП / директор).
 */

import type { ReactElement, ReactNode } from "react";
import { Component, useMemo, useRef, useState } from "react";
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
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { cn } from "@/lib/utils";
import {
  ACTIVITY_UNKNOWN_DISPLAY,
  activityChartManagerLabel,
  aggregateByManager,
  activityPeriodToRange,
  activityStatusForManager,
  bucketEventsByDay,
  collectActivityBuckets,
  computeProblemLines,
  computeQualityMetrics,
  computeTopKpis,
  filterEventsForDashboard,
  isActivityUnknownUserId,
  normalizeText,
  previousActivityRange,
  type ActivityEvent,
  type ActivityPeriodPreset,
  type ActivityTypeFilter,
} from "@/lib/client-base-activity-metrics";

const PERIOD_LABELS: Record<ActivityPeriodPreset, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  "7d": "7 дней",
  "30d": "30 дней",
  all: "Всё время",
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

function deltaLabel(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "новое" : "—";
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return "0% к пред. периоду";
  return `${d > 0 ? "+" : ""}${d}% к пред. периоду`;
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

function KpiCard({
  title,
  value,
  hint,
  caption,
  onActivate,
  className,
}: {
  title: string;
  value: string | number;
  hint?: string;
  /** Короткая подпись под числом (до подсказки с дельтой). */
  caption?: string;
  onActivate?: () => void;
  className?: string;
}): ReactElement {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
      {caption ? <p className="text-[11px] leading-snug text-muted-foreground">{caption}</p> : null}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </>
  );

  if (onActivate) {
    return (
      <Card
        className={cn(
          "rounded-2xl border border-border/80 bg-card shadow-sm transition hover:border-primary/35 hover:shadow-md",
          className,
        )}
      >
        <button
          type="button"
          className="w-full rounded-2xl p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={onActivate}
          data-testid="kpi-active-managers-trigger"
        >
          <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">{body}</CardHeader>
        </button>
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-2xl border border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">{body}</CardHeader>
    </Card>
  );
}

function ChartEmptyPlaceholder({ title, text }: { title: string; text: string }): ReactElement {
  return (
    <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center">
      <BarChart3 className="h-8 w-8 shrink-0 text-primary/50" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{text}</p>
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(true);
  const [detailManagerId, setDetailManagerId] = useState<string | null>(null);
  const managersSectionRef = useRef<HTMLDivElement | null>(null);

  const { activityState, diagnostics, teamLoading, teamError } = useClientBaseActivityTeamState({
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

  const activityBuckets = useMemo(() => collectActivityBuckets(state, mergedAll), [state, mergedAll]);
  const allEvents = activityBuckets.events;

  const range = useMemo(() => activityPeriodToRange(period), [period]);
  const prevRange = useMemo(() => previousActivityRange(range), [range]);

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

  const filteredEvents = useMemo(
    () => filterEventsForDashboard(allEvents, range, typeFilter, filterOptsBase),
    [allEvents, range, typeFilter, filterOptsBase],
  );

  const filteredExcludedTechnical = useMemo(
    () => filterEventsForDashboard(activityBuckets.excludedTechnical, range, typeFilter, filterOptsBase),
    [activityBuckets.excludedTechnical, range, typeFilter, filterOptsBase],
  );

  const prevFiltered = useMemo(
    () =>
      prevRange
        ? filterEventsForDashboard(allEvents, prevRange, typeFilter, {
            act: state,
            scopedDealerIds: scopedIds,
            ropTeamId: ropTeam,
            managerId,
            regionalManager,
            city,
            dealerById,
          })
        : [],
    [allEvents, prevRange, typeFilter, state, scopedIds, ropTeam, managerId, regionalManager, city, dealerById],
  );

  const managerRows = useMemo(() => aggregateByManager(filteredEvents, roster), [filteredEvents, roster]);
  const visibleManagers = useMemo(
    () => (onlyActiveManagers ? managerRows.filter((m) => m.totalActions > 0) : managerRows),
    [managerRows, onlyActiveManagers],
  );

  const kpiScope = useMemo(() => ({ scopedDealerIds: scopedIds }), [scopedIds]);

  const kpis = useMemo(
    () => computeTopKpis(state, profile, range, managerRows, kpiScope),
    [state, profile, range, managerRows, kpiScope],
  );
  const prevKpis = useMemo(
    () =>
      prevRange ? computeTopKpis(state, profile, prevRange, aggregateByManager(prevFiltered, roster), kpiScope) : null,
    [state, profile, prevRange, prevFiltered, roster, kpiScope],
  );

  const byDay = useMemo(() => bucketEventsByDay(filteredEvents), [filteredEvents]);
  const quality = useMemo(() => computeQualityMetrics(state, profile, scopedRows), [state, profile, scopedRows]);
  const problems = useMemo(() => computeProblemLines(state, profile, scopedRows), [state, profile, scopedRows]);

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

  const managerChartData = useMemo(
    () =>
      visibleManagers
        .filter((m) => m.score > 0)
        .slice(0, 12)
        .map((m) => ({ name: activityChartManagerLabel(m), score: m.score, id: m.managerId }))
        .reverse(),
    [visibleManagers],
  );

  const detailEvents = useMemo(() => {
    if (!detailManagerId) return [];
    return filteredEvents.filter((e) => e.userId === detailManagerId).slice(0, 80);
  }, [detailManagerId, filteredEvents]);

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
    const ids = diagnostics.requestedUserIds;
    const idsShort =
      ids.length > 8 ? `${ids.slice(0, 8).join(", ")}… (+${ids.length - 8})` : ids.join(", ") || "—";
    const modeRu = diagnostics.mode === "team" ? "объединение командных userId" : "текущий пользователь";
    const fail = diagnostics.failedSnapshots > 0 ? `, ошибок загрузки ${diagnostics.failedSnapshots}` : "";
    const tech = filteredExcludedTechnical.length;
    const lu = diagnostics.lastMergedUpdatedAt
      ? new Date(diagnostics.lastMergedUpdatedAt).toLocaleString("ru-RU")
      : "—";
    return `Источники: ${modeRu} · userId: ${idsShort} · снимков state загружено ${diagnostics.loadedSnapshots}/${Math.max(ids.length, 1)}${fail} · manual dealers (сумма по снимкам / после merge): ${diagnostics.sumManualDealersAcrossSources} / ${diagnostics.mergedManualDealers} · manual ТТ (merge): ${diagnostics.mergedManualTradePoints} · технические исключения (в периоде и фильтрах): ${tech} · обновлено (merged updatedAt): ${lu}`;
  }, [diagnostics, filteredExcludedTechnical.length]);

  const showManagersAccountsHint =
    diagnostics.mode === "team" &&
    !teamLoading &&
    diagnostics.loadedSnapshots > 0 &&
    diagnostics.sumManualDealersAcrossSources === 0 &&
    diagnostics.mergedManualDealers === 0 &&
    diagnostics.mergedManualTradePoints === 0;

  const activeManagersCaption = useMemo(() => {
    if (!hasFilteredActivity) return "Нет активности за период";
    const activeRows = managerRows.filter((m) => m.totalActions > 0);
    if (activeRows.length === 0) return "Нет активности за период";
    const known = activeRows.filter((m) => !isActivityUnknownUserId(m.managerId));
    const hasUnknown = activeRows.some((m) => isActivityUnknownUserId(m.managerId));
    if (known.length > 0) {
      const first = known[0].displayName;
      return known.length === 1 ? `Например: ${first}` : `Например: ${first} и др.`;
    }
    if (hasUnknown) return "Есть активность без автора";
    return "Нет активности за период";
  }, [hasFilteredActivity, managerRows]);

  const scrollToManagersSection = (): void => {
    managersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const detailDialogTitle = useMemo(() => {
    if (!detailManagerId) return "";
    if (isActivityUnknownUserId(detailManagerId)) return ACTIVITY_UNKNOWN_DISPLAY;
    return visibleManagers.find((m) => m.managerId === detailManagerId)?.displayName ?? "Менеджер";
  }, [detailManagerId, visibleManagers]);

  if (!actx.enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8 sm:px-6" data-testid="page-client-base-activity-dashboard">
        <h1 className="text-xl font-semibold">Актуализация базы</h1>
        <p className="text-sm text-muted-foreground">Дашборд доступен при включённой актуализации клиентской базы.</p>
      </div>
    );
  }

  const primaryFill = "hsl(var(--primary))";
  const mutedFill = "hsl(var(--muted-foreground) / 0.35)";

  return (
    <div className="min-w-0 space-y-4 px-3 pb-10 pt-1 sm:space-y-6 sm:px-0 sm:pb-8 sm:pt-0" data-testid="page-client-base-activity-dashboard">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Актуализация базы</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Контроль активности менеджеров по заполнению клиентов, торговых точек, юрлиц, фото и витрин.
          </p>
          {teamLoading ? (
            <p className="text-xs text-muted-foreground">Загрузка состояния актуализации по менеджерам команды…</p>
          ) : null}
          {teamError ? (
            <p className="text-xs text-primary" role="status">
              {teamError}
            </p>
          ) : null}
          <p className="max-w-4xl text-[11px] leading-snug text-muted-foreground" data-testid="text-activity-data-sources">
            {dataSourcesLine}
          </p>
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
      {!hasFilteredActivity && !hasExcludedOnly && !teamLoading ? (
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
        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">Фильтры</CardTitle>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="sm:hidden">
                {mobileFiltersOpen ? "Свернуть" : "Развернуть"}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent className="data-[state=closed]:hidden sm:data-[state=closed]:block">
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 lg:p-4">
              <div className="space-y-1">
                <Label className="text-xs">Период</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as ActivityPeriodPreset)}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERIOD_LABELS) as ActivityPeriodPreset[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {PERIOD_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">РОП / команда</Label>
                <Select value={ropTeam} onValueChange={setRopTeam}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-rop">
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
                <Label className="text-xs">Менеджер</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-manager">
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
                <Label className="text-xs">Региональный менеджер</Label>
                <Select value={regionalManager} onValueChange={setRegionalManager}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-regional-manager">
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
                <Label className="text-xs">Город</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-city">
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
                <Label className="text-xs">Тип активности</Label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ActivityTypeFilter)}>
                  <SelectTrigger className="min-h-10" data-testid="select-activity-type">
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
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="switch-activity-only-active" className="text-sm">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Клиентов создано" value={kpis.manualDealers} hint={prevKpis ? deltaLabel(kpis.manualDealers, prevKpis.manualDealers) : undefined} />
        <KpiCard title="Клиентов обновлено" value={kpis.updatedDealers} hint={prevKpis ? deltaLabel(kpis.updatedDealers, prevKpis.updatedDealers) : undefined} />
        <KpiCard title="ТТ добавлено" value={kpis.manualTradePoints} hint={prevKpis ? deltaLabel(kpis.manualTradePoints, prevKpis.manualTradePoints) : undefined} />
        <KpiCard title="Юрлиц (изменения)" value={kpis.legalTouches} hint={prevKpis ? deltaLabel(kpis.legalTouches, prevKpis.legalTouches) : undefined} />
        <KpiCard title="Фото загружено" value={kpis.photos} hint={prevKpis ? deltaLabel(kpis.photos, prevKpis.photos) : undefined} />
        <KpiCard title="Витрин заполнено (ТТ)" value={kpis.showcasesFilled} />
        <KpiCard title="ТТ с дефицитом" value={kpis.deficitTradePoints} />
        <KpiCard title="Активных менеджеров" value={kpis.activeManagers} caption={activeManagersCaption} onActivate={scrollToManagersSection} />
      </div>

      <Card
        ref={managersSectionRef}
        id="section-activity-managers"
        className="scroll-mt-4 rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Активность по менеджерам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-4">
          {isMobile ? (
            <div className="flex flex-col gap-2 p-3">
              {visibleManagers.map((m) => {
                const unknown = isActivityUnknownUserId(m.managerId);
                return (
                  <div
                    key={m.managerId}
                    className="rounded-xl border border-border bg-card p-3 shadow-sm"
                    data-testid={`row-activity-manager-${m.managerId}`}
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
                        <p className="text-xs text-muted-foreground">{m.teamLabel}</p>
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
                          {activityStatusForManager(m) === "active" ? "Активно" : activityStatusForManager(m) === "weak" ? "Слабо" : "Нет активности"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => setDetailManagerId(m.managerId)}
                          data-testid={`btn-activity-manager-detail-${m.managerId}`}
                        >
                          Детали
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Действий: {m.totalActions} · score: {m.score}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full min-w-[780px] text-sm" data-testid="table-activity-managers">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="p-2">Менеджер</th>
                  <th className="p-2">Зона</th>
                  <th className="p-2 text-right">Созд. клиентов</th>
                  <th className="p-2 text-right">Обн. клиентов</th>
                  <th className="p-2 text-right">ТТ +</th>
                  <th className="p-2 text-right">ТТ обн.</th>
                  <th className="p-2 text-right">Юрлица</th>
                  <th className="p-2 text-right">Фото</th>
                  <th className="p-2 text-right">Витрины</th>
                  <th className="p-2 text-right">Архивы</th>
                  <th className="p-2 text-right">Всего</th>
                  <th className="p-2 text-right">Score</th>
                  <th className="p-2">Статус</th>
                  <th className="p-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {visibleManagers.map((m) => {
                  const unknown = isActivityUnknownUserId(m.managerId);
                  return (
                    <tr key={m.managerId} className="border-b border-border/60 hover:bg-muted/20" data-testid={`row-activity-manager-${m.managerId}`}>
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
                      <td className="p-2 text-muted-foreground">{m.teamLabel}</td>
                      <td className="p-2 text-right tabular-nums">{m.createdDealers}</td>
                      <td className="p-2 text-right tabular-nums">{m.updatedDealers}</td>
                      <td className="p-2 text-right tabular-nums">{m.addedTradePoints}</td>
                      <td className="p-2 text-right tabular-nums">{m.updatedTradePoints}</td>
                      <td className="p-2 text-right tabular-nums">{m.legalEntities}</td>
                      <td className="p-2 text-right tabular-nums">{m.photos}</td>
                      <td className="p-2 text-right tabular-nums">{m.showcases}</td>
                      <td className="p-2 text-right tabular-nums">{m.archives}</td>
                      <td className="p-2 text-right tabular-nums">{m.totalActions}</td>
                      <td className="p-2 text-right font-semibold tabular-nums text-primary">{m.score}</td>
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            activityStatusForManager(m) === "active" && "border-primary/50 bg-primary/10",
                          )}
                          data-testid={`badge-activity-status-${m.managerId}`}
                        >
                          {activityStatusForManager(m) === "active" ? "Активно" : activityStatusForManager(m) === "weak" ? "Слабо" : "Нет активности"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => setDetailManagerId(m.managerId)}
                          data-testid={`btn-activity-manager-detail-${m.managerId}`}
                        >
                          Детали
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Динамика по дням</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] w-full min-w-0" data-testid="chart-activity-by-day">
            {byDay.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis width={28} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="dealers" stackId="a" fill={primaryFill} name="Клиенты" />
                  <Bar dataKey="tradePoints" stackId="a" fill="hsl(var(--primary) / 0.65)" name="ТТ" />
                  <Bar dataKey="legal" stackId="a" fill="hsl(var(--primary) / 0.45)" name="Юрлица" />
                  <Bar dataKey="photos" stackId="a" fill="hsl(var(--muted-foreground) / 0.4)" name="Фото" />
                  <Bar dataKey="showcase" stackId="a" fill="hsl(var(--foreground) / 0.25)" name="Витрина" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyPlaceholder
                title="Нет данных по дням"
                text="Нет событий в выбранном периоде — график появится после действий менеджеров."
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Активность по менеджерам (score)</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] w-full min-w-0" data-testid="chart-activity-by-manager">
            {managerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={managerChartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal className="stroke-border/50" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill={primaryFill} radius={[0, 4, 4, 0]} name="Score" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyPlaceholder
                title="Нет данных по менеджерам"
                text="Нет действий с ненулевым score в выбранном периоде."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Структура действий</CardTitle>
          </CardHeader>
          <CardContent className="mx-auto h-[220px] w-full max-w-sm" data-testid="chart-activity-breakdown">
            {breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? primaryFill : mutedFill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyPlaceholder
                title="Нет структуры действий"
                text="Нет событий для круговой диаграммы в текущих фильтрах."
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm" data-testid="section-activity-quality">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Качество базы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
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
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium">{row.v}%</span>
                </div>
                <Progress value={row.v} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-border/80 bg-card shadow-sm" data-testid="section-activity-problems">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Проблемные зоны</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {idleManagers.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Менеджеры без активности (7 дней)</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {idleManagers.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ul className="max-h-72 space-y-1 overflow-y-auto text-muted-foreground">
            {problems.slice(0, 40).map((p) => (
              <li key={p.id} className="text-xs leading-snug">
                {p.text}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={detailManagerId != null} onOpenChange={(o) => !o && setDetailManagerId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" data-testid="dialog-activity-manager-detail">
          <DialogHeader>
            <DialogTitle>Детали — {detailDialogTitle}</DialogTitle>
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
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {detailManagerId != null && isActivityUnknownUserId(detailManagerId) ? "Учтённые в рейтинге" : "События"}
            </p>
            <ul className="space-y-2 text-sm" data-testid="list-activity-manager-events">
              {detailEvents.map((e: ActivityEvent) => (
                <li key={e.id} className="border-b border-border/60 pb-2" data-testid={`row-activity-event-${e.id}`}>
                  <p className="font-medium text-foreground">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.atMs).toLocaleString("ru-RU")}</p>
                </li>
              ))}
            </ul>
          </div>
          {detailManagerId != null && isActivityUnknownUserId(detailManagerId) && detailExcludedTechnical.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Не в рейтинге</p>
              <ul className="max-h-52 space-y-2 overflow-y-auto text-sm text-muted-foreground">
                {detailExcludedTechnical.slice(0, 40).map((e: ActivityEvent) => (
                  <li key={e.id} className="border-b border-border/40 pb-2" data-testid={`row-activity-excluded-${e.id}`}>
                    <p>{e.label}</p>
                    <p className="text-xs">{new Date(e.atMs).toLocaleString("ru-RU")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
