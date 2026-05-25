import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  getDefaultSalesPeriodId,
  getTeamById,
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
  type SalesRole,
  type SalesUser,
} from "@/lib/sales-control-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";
import { copySalesPlanFactPlansBetweenPeriods, upsertManagerMetricLine, upsertTeamPlanMetrics } from "@/lib/sales-plan-fact-mutations";
import {
  buildAttentionZones,
  buildCityRows,
  buildKpiBars,
  buildPeriodSummary,
  buildProductRows,
  buildRopRows,
  formatManagerPlanFactShort,
  formatPlanFactValue,
  formatRopAggregatePlanFactLine,
  getPreviousSalesPeriodId,
  inScopeManager,
  inScopeTeam,
  periodHasAnyPositivePlan,
  topRopsByCompletion,
  type SalesPlanFactCockpitMode,
} from "@/lib/sales-plan-fact-management-view-model";
import { SalesPlanFactActualEntryDialog, type SalesPlanFactActualInitial } from "@/components/sales-plan-fact-actual-entry-dialog";
import { SalesPlanFactDetailDrawer, type SalesPlanFactDetailTarget } from "@/components/sales-plan-fact-detail-drawer";
import { SalesPlanFactPlanWizardDialog, type SalesPlanFactWizardInitial } from "@/components/sales-plan-fact-plan-wizard-dialog";

const MODE_LS_KEY = "tandoor-sales-plan-fact-mgmt-mode-v1";

function readMode(): SalesPlanFactCockpitMode {
  try {
    const r = localStorage.getItem(MODE_LS_KEY);
    if (
      r === "overview" ||
      r === "by_rop" ||
      r === "managers" ||
      r === "cities" ||
      r === "products" ||
      r === "entry"
    )
      return r;
  } catch {
    /* ignore */
  }
  return "overview";
}

function writeMode(m: SalesPlanFactCockpitMode): void {
  try {
    localStorage.setItem(MODE_LS_KEY, m);
  } catch {
    /* ignore */
  }
}

type Props = {
  profile: ReleaseDemoProfile;
  role: SalesRole;
  persona: SalesUser;
  dealers: DealerRow[];
  state: SalesPlanFactPersistedState;
  onPersist: (next: SalesPlanFactPersistedState) => Promise<void>;
  loading: boolean;
  saving: boolean;
  storageMessage: string | null;
  apiError: string | null;
};

export function SalesPlanFactManagementCockpit({
  profile,
  role,
  persona,
  dealers,
  state,
  onPersist,
  loading,
  saving,
  storageMessage,
  apiError,
}: Props) {
  const [mode, setMode] = useState<SalesPlanFactCockpitMode>(() => readMode());
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const [directorTeamFilter, setDirectorTeamFilter] = useState<string>("__all__");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SalesPlanFactDetailTarget | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitial, setWizardInitial] = useState<SalesPlanFactWizardInitial | null>(null);
  const [actualOpen, setActualOpen] = useState(false);
  const [actualInitial, setActualInitial] = useState<SalesPlanFactActualInitial>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dataSourceOpen, setDataSourceOpen] = useState(false);

  useEffect(() => {
    writeMode(mode);
  }, [mode]);

  const opts = useMemo(() => ({ role, persona, directorTeamFilter: role === "sales_director" ? directorTeamFilter : null }), [role, persona, directorTeamFilter]);

  const periodLabel = SALES_PLAN_PERIODS.find((p) => p.id === periodId)?.label ?? periodId;

  const summary = useMemo(
    () => buildPeriodSummary(state, periodId, periodLabel, opts),
    [state, periodId, periodLabel, opts],
  );
  const kpiBars = useMemo(() => buildKpiBars(state, periodId, opts), [state, periodId, opts]);
  const ropRows = useMemo(() => buildRopRows(state, periodId, dealers, opts), [state, periodId, dealers, opts]);
  const cityRows = useMemo(() => buildCityRows(state, periodId, dealers, opts), [state, periodId, dealers, opts]);
  const productRows = useMemo(() => buildProductRows(state, periodId, opts), [state, periodId, opts]);
  const attention = useMemo(() => buildAttentionZones(state, periodId, opts), [state, periodId, opts]);
  const topRop = useMemo(() => topRopsByCompletion(ropRows, 3), [ropRows]);

  const hasPositivePlanInPeriod = useMemo(
    () => periodHasAnyPositivePlan(state, periodId, opts),
    [state, periodId, opts],
  );
  const previousPeriodId = useMemo(() => getPreviousSalesPeriodId(periodId), [periodId]);
  const previousPeriodHasPlans = useMemo(
    () => (previousPeriodId ? periodHasAnyPositivePlan(state, previousPeriodId, opts) : false),
    [state, previousPeriodId, opts],
  );

  const historyLines = useMemo(() => {
    return [...state.lines]
      .filter((l) => l.periodId === periodId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 80);
  }, [state.lines, periodId]);

  const maxCityPlan = useMemo(() => Math.max(1, ...cityRows.map((c) => c.plan)), [cityRows]);
  const maxProductPlan = useMemo(() => Math.max(1, ...productRows.map((c) => c.plan)), [productRows]);

  const openDetail = useCallback((t: SalesPlanFactDetailTarget) => {
    setDetailTarget(t);
    setDetailOpen(true);
  }, []);

  /** Ввод: локальные строки форм */
  const [teamMetricDraft, setTeamMetricDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const team of SALES_TEAMS) {
      for (const met of SALES_KPI_METRICS_SORTED) {
        const L = state.lines.find(
          (l) =>
            l.periodId === periodId &&
            l.teamId === team.id &&
            l.rollup === "team" &&
            l.metricId === met.id &&
            l.managerId === null,
        );
        next[`${team.id}:${met.id}`] = L ? String(L.planValue) : "";
      }
    }
    setTeamMetricDraft(next);
  }, [state.lines, periodId]);
  const [mgrDraft, setMgrDraft] = useState<Record<string, Record<string, { plan: string; actual: string }>>>({});

  useEffect(() => {
    const nextM: Record<string, Record<string, { plan: string; actual: string }>> = {};
    const all = SALES_TEAMS.flatMap((t) => getTeamManagers(t.id));
    for (const m of all) {
      const o: Record<string, { plan: string; actual: string }> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const L = state.lines.find(
          (l) =>
            l.periodId === periodId &&
            l.managerId === m.id &&
            l.metricId === met.id &&
            l.rollup === "manager",
        );
        o[met.id] = {
          plan: String(L?.planValue ?? ""),
          actual: L?.actualValue === null || L?.actualValue === undefined ? "" : String(L.actualValue),
        };
      }
      nextM[m.id] = o;
    }
    setMgrDraft(nextM);
  }, [state.lines, periodId, role, persona.teamId, directorTeamFilter]);

  const persistWrap = useCallback(
    async (next: SalesPlanFactPersistedState) => {
      await onPersist(next);
    },
    [onPersist],
  );

  const openWizard = useCallback((initial: SalesPlanFactWizardInitial | null) => {
    setWizardInitial(initial);
    setWizardOpen(true);
  }, []);

  const openActual = useCallback((initial: SalesPlanFactActualInitial) => {
    setActualInitial(initial);
    setActualOpen(true);
  }, []);

  const handleCopyPreviousPeriod = useCallback(async () => {
    if (!previousPeriodId || !previousPeriodHasPlans) return;
    const next = copySalesPlanFactPlansBetweenPeriods(state, {
      fromPeriodId: previousPeriodId,
      toPeriodId: periodId,
      actorId: profile.personaUserId,
      includeLine: (l) => {
        if (l.rollup === "team") return inScopeTeam(l.teamId, opts);
        if (l.rollup === "manager" && l.managerId) return inScopeManager(l.managerId, opts);
        return false;
      },
      teamStatus: "published",
      managerStatus: "draft",
    });
    await persistWrap(next);
  }, [previousPeriodId, previousPeriodHasPlans, state, periodId, profile.personaUserId, opts, persistWrap]);

  const handleWizardSubmit = useCallback(
    async (next: SalesPlanFactPersistedState) => {
      await persistWrap(next);
      setWizardOpen(false);
    },
    [persistWrap],
  );

  const handleActualSubmit = useCallback(
    async (next: SalesPlanFactPersistedState) => {
      await persistWrap(next);
      setActualOpen(false);
    },
    [persistWrap],
  );

  const saveTeamPlans = useCallback(async () => {
    if (role !== "sales_director") return;
    let next = state;
    const teams = SALES_TEAMS.filter((t) => directorTeamFilter === "__all__" || t.id === directorTeamFilter);
    for (const team of teams) {
      const metrics: Record<string, number> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const raw = teamMetricDraft[`${team.id}:${met.id}`] ?? "0";
        const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
        metrics[met.id] = Number.isFinite(n) ? n : 0;
      }
      next = upsertTeamPlanMetrics(next, {
        periodId,
        teamId: team.id,
        metricPlans: metrics,
        actorId: profile.personaUserId,
        status: "published",
      });
    }
    await persistWrap(next);
  }, [role, state, teamMetricDraft, periodId, persistWrap, profile.personaUserId, directorTeamFilter]);

  const saveManagerEntry = useCallback(
    async (teamId: string, managerId: string, status: "draft" | "fact_entered" | "confirmed") => {
      const draft = mgrDraft[managerId];
      if (!draft) return;
      let next = state;
      for (const met of SALES_KPI_METRICS_SORTED) {
        const cell = draft[met.id] ?? { plan: "0", actual: "" };
        const pv = Number(String(cell.plan).replace(/\s/g, "").replace(",", "."));
        const avRaw = cell.actual.trim();
        const av = avRaw === "" ? null : Number(avRaw.replace(/\s/g, "").replace(",", "."));
        next = upsertManagerMetricLine(next, {
          periodId,
          teamId,
          managerId,
          metricId: met.id,
          planValue: Number.isFinite(pv) ? pv : 0,
          actualValue: av !== null && Number.isFinite(av) ? av : null,
          status: av === null ? "draft" : status,
          actorId: profile.personaUserId,
        });
      }
      await persistWrap(next);
    },
    [mgrDraft, state, periodId, persistWrap, profile.personaUserId],
  );

  const modeButton = (m: SalesPlanFactCockpitMode, label: string, testId: string) => (
    <Button
      key={m}
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium",
        mode === m
          ? "bg-primary text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] hover:text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
      )}
      data-testid={testId}
      onClick={() => setMode(m)}
    >
      {label}
    </Button>
  );

  const scopedManagers = useMemo(() => {
    const all = SALES_TEAMS.flatMap((t) => getTeamManagers(t.id).map((m) => ({ ...m, teamId: t.id })));
    return all.filter((m) => {
      if (role === "sales_manager") return m.id === persona.id;
      if (role === "team_lead") return m.teamId === persona.teamId;
      if (directorTeamFilter === "__all__") return true;
      return m.teamId === directorTeamFilter;
    });
  }, [role, persona, directorTeamFilter]);

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-hidden pb-12 text-foreground" data-testid="section-sales-plan-fact-cockpit">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">План-факт продаж</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Планируйте продажи, распределяйте KPI по командам и отслеживайте факт за период.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 border-border">
          <Link href="/sales-control">К старым экранам</Link>
        </Button>
      </div>

      {apiError ? (
        <Alert className="border-border bg-muted/30">
          <AlertDescription className="text-foreground">{apiError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-full min-w-0 sm:w-[220px]" aria-label="Период">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            {SALES_PLAN_PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role === "sales_director" ? (
          <Select value={directorTeamFilter} onValueChange={setDirectorTeamFilter}>
            <SelectTrigger className="w-full min-w-0 sm:w-[260px]" aria-label="Команда">
              <SelectValue placeholder="Команда РОП" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все команды</SelectItem>
              {SALES_TEAMS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div
        className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="section-sales-plan-fact-primary-actions"
      >
        <Button
          type="button"
          className="min-h-11 w-full bg-primary font-semibold text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))] sm:min-h-10"
          data-testid="button-sales-plan-fact-create-plan"
          onClick={() => openWizard(null)}
        >
          {hasPositivePlanInPeriod ? "Изменить план" : "+ Выставить план"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full font-semibold sm:min-h-10"
          data-testid="button-sales-plan-fact-add-actual"
          onClick={() => openActual({ periodId })}
        >
          Внести факт
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full font-semibold sm:min-h-10"
          data-testid="button-sales-plan-fact-history"
          onClick={() => setHistoryOpen(true)}
        >
          История
        </Button>
      </div>

      {mode === "overview" && !loading && !hasPositivePlanInPeriod ? (
        <section
          className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 p-4 sm:p-6"
          data-testid="section-sales-plan-fact-empty-plan"
        >
          <h2 className="text-base font-semibold text-foreground">План на {periodLabel} ещё не выставлен</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Начните с плана по РОПам или сразу распределите KPI по менеджерам.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" className="bg-primary text-primary-foreground hover:bg-[hsl(var(--figma-primary-hover))]" data-testid="button-sales-plan-fact-empty-create-plan" onClick={() => openWizard(null)}>
              Выставить план
            </Button>
            {previousPeriodId ? (
              <Button
                type="button"
                variant="outline"
                data-testid="button-sales-plan-fact-copy-previous-period"
                disabled={!previousPeriodHasPlans}
                onClick={() => void handleCopyPreviousPeriod()}
              >
                Скопировать прошлый период
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div
        className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="section-sales-plan-fact-mode-toggle"
      >
        {modeButton("overview", "Обзор", "button-sales-plan-fact-mode-overview")}
        {modeButton("by_rop", "РОПы", "button-sales-plan-fact-mode-rop")}
        {modeButton("managers", "Менеджеры", "button-sales-plan-fact-mode-managers")}
        {modeButton("cities", "Города", "button-sales-plan-fact-mode-cities")}
        {modeButton("products", "Продукты", "button-sales-plan-fact-mode-products")}
        {modeButton("entry", "Планы и факт", "button-sales-plan-fact-mode-entry")}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}

      {mode === "overview" && hasPositivePlanInPeriod ? (
        <>
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" data-testid="section-sales-plan-fact-period-summary">
            <h2 className="text-sm font-semibold text-foreground">Итоги периода · {periodLabel}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">План суммарно</p>
                <p className="text-lg font-semibold tabular-nums">{summary.totalPlan.toLocaleString("ru-RU")}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Факт</p>
                <p className="text-lg font-semibold tabular-nums">
                  {summary.totalActual === null ? "—" : summary.totalActual.toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Выполнение</p>
                <p className="text-lg font-semibold tabular-nums">{summary.completionPct === null ? "—" : `${summary.completionPct}%`}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Осталось</p>
                <p className="text-lg font-semibold tabular-nums">{summary.remaining === null ? "—" : summary.remaining.toLocaleString("ru-RU")}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>РОПов в scope: {summary.ropCount}</span>
              <span>Менеджеров: {summary.managerCount}</span>
              <span>С фактом: {summary.managersWithFact}</span>
              <span>Без факта: {summary.managersWithoutFact}</span>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">План / факт по KPI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {kpiBars.map((k) => (
                  <div key={k.metricId} className="min-w-0 space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{k.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {k.actual === null ? "факт не внесён" : `${k.pct ?? 0}%`}
                      </span>
                    </div>
                    <Progress value={k.pct === null ? 0 : Math.min(100, k.pct)} className="h-2 bg-muted" />
                    <p className="text-xs text-muted-foreground">
                      {k.plan > 0 ? `План ${formatPlanFactValue(k.metricId, k.plan)}` : "План не задан"}
                      {k.actual !== null && k.plan > 0 ? ` · факт ${formatPlanFactValue(k.metricId, k.actual)}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Топ команд по выполнению</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {topRop.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных для рейтинга (нужен факт по всем KPI менеджеров).</p>
                ) : (
                  topRop.map((r, i) => (
                    <div key={r.teamId} className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/50 px-3 py-2">
                      <span className="min-w-0 truncate">
                        {i + 1}. {r.ropName}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{r.completionPct}%</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {mode === "overview" ? (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Зоны внимания</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Критичных сигналов нет.</p>
            ) : (
              attention.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {mode === "by_rop" ? (
        <section data-testid="section-sales-plan-fact-rop-groups" className="space-y-2">
          <Accordion type="multiple" className="min-w-0 space-y-2">
            {ropRows.map((r) => (
              <AccordionItem
                key={r.teamId}
                value={r.teamId}
                className="rounded-xl border border-border bg-card px-3 shadow-sm"
                data-testid={`card-sales-plan-fact-rop-${r.teamId}`}
              >
                <AccordionTrigger
                  className="min-w-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180"
                  data-testid={`button-sales-plan-fact-rop-toggle-${r.teamId}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-semibold">{r.ropName}</span>
                      <span className="text-xs text-muted-foreground">{getTeamById(r.teamId)?.name ?? r.teamName}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatRopAggregatePlanFactLine(r.plan, r.actual, r.completionPct)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3" data-testid={`section-sales-plan-fact-rop-members-${r.teamId}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      data-testid={`button-sales-plan-fact-rop-set-plan-${r.teamId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openWizard({ scope: "team", teamId: r.teamId });
                      }}
                    >
                      Поставить план команде
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      data-testid={`button-sales-plan-fact-rop-distribute-${r.teamId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openWizard({ scope: "team", teamId: r.teamId });
                      }}
                    >
                      Распределить по менеджерам
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      data-testid={`button-sales-plan-fact-rop-add-actual-${r.teamId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailOpen(false);
                        openActual({ periodId, teamId: r.teamId });
                      }}
                    >
                      Внести факт
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full sm:w-auto"
                      data-testid={`button-sales-plan-fact-rop-detail-${r.teamId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail({ kind: "rop", teamId: r.teamId });
                      }}
                    >
                      Детали
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {r.managers.map((m) => (
                      <div
                        key={m.managerId}
                        className="rounded-lg border border-border bg-muted/40 p-3"
                        data-testid={`card-sales-plan-fact-manager-${m.managerId}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{m.name}</p>
                          {m.plan <= 0 ? (
                            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                              План не задан
                            </Badge>
                          ) : null}
                          {m.actual === null ? (
                            <Badge variant="secondary" className="text-muted-foreground">
                              Факт не внесён
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatManagerPlanFactShort(m.plan, m.actual)}</p>
                        {m.plan > 0 && m.actual !== null && m.completionPct !== null ? (
                          <p className="text-xs font-medium text-foreground">Выполнение {m.completionPct}%</p>
                        ) : null}
                        <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                          {m.plan <= 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              data-testid={`button-sales-plan-fact-manager-set-plan-${m.managerId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openWizard({ scope: "manager", teamId: r.teamId, managerId: m.managerId });
                              }}
                            >
                              Задать план
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              data-testid={`button-sales-plan-fact-manager-open-${m.managerId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail({ kind: "manager", teamId: r.teamId, managerId: m.managerId });
                              }}
                            >
                              Открыть план
                            </Button>
                          )}
                          {m.actual === null ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              data-testid={`button-sales-plan-fact-manager-add-actual-${m.managerId}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openActual({ periodId, teamId: r.teamId, managerId: m.managerId });
                              }}
                            >
                              Внести факт
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

      {mode === "managers" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {scopedManagers.map((m) => {
            const row = ropRows.find((x) => x.teamId === m.teamId)?.managers.find((x) => x.managerId === m.id);
            const planUnset = !row || row.plan <= 0;
            return (
              <Card
                key={m.id}
                className="border-border transition hover:border-primary/30"
                data-testid={`card-sales-plan-fact-manager-${m.id}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{getTeamById(m.teamId ?? "")?.name ?? m.teamId}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    План: {planUnset ? "не задан" : row!.plan.toLocaleString("ru-RU")}
                    <br />
                    Факт:{" "}
                    {!row
                      ? "не внесён"
                      : row.actual === null
                        ? "не внесён"
                        : row.actual.toLocaleString("ru-RU")}
                  </p>
                  {!planUnset && row?.actual !== null && row?.completionPct !== null && row?.completionPct !== undefined ? (
                    <>
                      <p className="text-xs font-medium">Выполнение {row.completionPct}%</p>
                      <Progress value={Math.min(100, row.completionPct)} className="h-2 bg-muted" />
                    </>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {planUnset ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto"
                        data-testid={`button-sales-plan-fact-manager-set-plan-${m.id}`}
                        onClick={() => openWizard({ scope: "manager", teamId: m.teamId!, managerId: m.id })}
                      >
                        Задать план
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto"
                        data-testid={`button-sales-plan-fact-manager-open-${m.id}`}
                        onClick={() => openDetail({ kind: "manager", teamId: m.teamId!, managerId: m.id })}
                      >
                        Открыть план
                      </Button>
                    )}
                    {row?.actual === null ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        data-testid={`button-sales-plan-fact-manager-add-actual-${m.id}`}
                        onClick={() => openActual({ periodId, teamId: m.teamId!, managerId: m.id })}
                      >
                        Внести факт
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : null}

      {mode === "cities" ? (
        <section className="space-y-4" data-testid="section-sales-plan-fact-city-chart">
          <div className="space-y-2">
            {cityRows.slice(0, 8).map((c) => (
              <div key={c.cityKey} className="min-w-0 space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{c.cityName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.plan > 0 ? c.plan.toLocaleString("ru-RU") : "не задан"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (c.plan / maxCityPlan) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {cityRows.map((c) => (
              <button
                key={c.cityKey}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                data-testid={`row-sales-plan-fact-city-${c.cityKey}`}
                onClick={() => openDetail({ kind: "city", cityKey: c.cityKey })}
              >
                <span className="truncate">{c.cityName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.actual === null ? "факт —" : `${c.completionPct ?? 0}%`}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "products" ? (
        <section className="space-y-4" data-testid="section-sales-plan-fact-product-chart">
          <div className="space-y-2">
            {productRows.map((p) => (
              <div key={p.productId} className="min-w-0 space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{p.productName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.plan > 0 ? p.plan.toLocaleString("ru-RU") : "не задан"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (p.plan / maxProductPlan) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {productRows.map((p) => (
              <button
                key={p.productId}
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                data-testid={`row-sales-plan-fact-product-${p.productId}`}
                onClick={() => openDetail({ kind: "product", productId: p.productId })}
              >
                <span className="truncate">{p.productName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.actual === null ? "факт —" : `${p.completionPct ?? 0}%`}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "entry" ? (
        <section className="space-y-6">
          {role === "sales_director" ? (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Планы команд (директор)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {SALES_TEAMS.filter((t) => directorTeamFilter === "__all__" || t.id === directorTeamFilter).map((team) => (
                  <div key={team.id} className="space-y-2 rounded-lg border border-border/80 p-3" data-testid={`card-sales-plan-fact-rop-${team.id}`}>
                    <p className="text-sm font-semibold">{team.name}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SALES_KPI_METRICS_SORTED.map((met) => (
                        <div key={met.id}>
                          <Label className="text-xs">{met.label}</Label>
                          <Input
                            inputMode="decimal"
                            className="mt-1"
                            value={teamMetricDraft[`${team.id}:${met.id}`] ?? ""}
                            onChange={(e) =>
                              setTeamMetricDraft((prev) => ({ ...prev, [`${team.id}:${met.id}`]: e.target.value }))
                            }
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" data-testid="button-sales-plan-fact-save-draft" disabled={saving} onClick={() => void saveTeamPlans()}>
                    Сохранить планы команд
                  </Button>
                  <Button type="button" variant="outline" data-testid="button-sales-plan-fact-submit" disabled={saving} onClick={() => void saveTeamPlans()}>
                    Выгрузить в persisted
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">План и факт по менеджерам</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scopedManagers.map((m) => (
                <div key={m.id} className="space-y-2 rounded-lg border border-border/80 p-3" data-testid={`card-sales-plan-fact-manager-${m.id}`}>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <div data-testid="form-sales-plan-fact-plan-entry" className="grid gap-2 sm:grid-cols-2">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id}>
                        <Label className="text-xs">{met.label} — план</Label>
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          value={mgrDraft[m.id]?.[met.id]?.plan ?? ""}
                          onChange={(e) =>
                            setMgrDraft((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [met.id]: { plan: e.target.value, actual: prev[m.id]?.[met.id]?.actual ?? "" } },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div data-testid="form-sales-plan-fact-actual-entry" className="grid gap-2 sm:grid-cols-2">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id}>
                        <Label className="text-xs">{met.label} — факт</Label>
                        <Input
                          className="mt-1"
                          inputMode="decimal"
                          value={mgrDraft[m.id]?.[met.id]?.actual ?? ""}
                          onChange={(e) =>
                            setMgrDraft((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [met.id]: { plan: prev[m.id]?.[met.id]?.plan ?? "", actual: e.target.value } },
                            }))
                          }
                          placeholder="пусто = не внесено"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="button-sales-plan-fact-save-draft"
                      disabled={saving}
                      onClick={() => void saveManagerEntry(m.teamId!, m.id, "draft")}
                    >
                      Черновик
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="button-sales-plan-fact-submit"
                      disabled={saving}
                      onClick={() => void saveManagerEntry(m.teamId!, m.id, "fact_entered")}
                    >
                      Сохранить факт
                    </Button>
                    {(role === "sales_director" || role === "team_lead") && (
                      <Button type="button" variant="outline" size="sm" data-testid="button-sales-plan-fact-approve" disabled={saving} onClick={() => void saveManagerEntry(m.teamId!, m.id, "confirmed")}>
                        Подтвердить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <SalesPlanFactPlanWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        periodId={periodId}
        state={state}
        opts={opts}
        profile={profile}
        initial={wizardInitial}
        onSubmit={handleWizardSubmit}
        saving={saving}
      />
      <SalesPlanFactActualEntryDialog
        open={actualOpen}
        onOpenChange={setActualOpen}
        periodId={periodId}
        state={state}
        opts={opts}
        profile={profile}
        initial={actualInitial}
        onSubmit={handleActualSubmit}
        saving={saving}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>История изменений</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {historyLines.length === 0 ? (
              <li className="text-muted-foreground">Нет сохранённых строк за период.</li>
            ) : (
              historyLines.map((l) => (
                <li key={l.id} className="rounded-md border border-border/70 p-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{l.metricId}</span>
                    <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                      {l.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    План {l.planValue > 0 ? l.planValue : "не задан"} · факт {l.actualValue === null ? "—" : l.actualValue}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(l.updatedAt).toLocaleString("ru-RU")}</p>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <Collapsible open={dataSourceOpen} onOpenChange={setDataSourceOpen} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
          Источник данных
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", dataSourceOpen ? "rotate-180" : "")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 text-xs text-muted-foreground">
          {storageMessage ??
            "Persisted-слой через API /api/sales-plan-fact/state. Синтетические сиды из справочников в показатели не подмешиваются."}
        </CollapsibleContent>
      </Collapsible>

      <SalesPlanFactDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        target={detailTarget}
        periodId={periodId}
        state={state}
        dealers={dealers}
        role={role}
        persona={persona}
        directorTeamFilter={role === "sales_director" ? directorTeamFilter : null}
        onSetPlan={() => {
          if (!detailTarget) return;
          if (detailTarget.kind === "rop") {
            setWizardInitial({ scope: "team", teamId: detailTarget.teamId });
            setWizardOpen(true);
            setDetailOpen(false);
          }
          if (detailTarget.kind === "manager") {
            setWizardInitial({ scope: "manager", teamId: detailTarget.teamId, managerId: detailTarget.managerId });
            setWizardOpen(true);
            setDetailOpen(false);
          }
        }}
        onDistribute={() => {
          if (detailTarget?.kind === "rop") {
            setWizardInitial({ scope: "team", teamId: detailTarget.teamId });
            setWizardOpen(true);
            setDetailOpen(false);
          }
        }}
        onAddActual={() => {
          if (!detailTarget) return;
          if (detailTarget.kind === "rop") {
            openActual({ periodId, teamId: detailTarget.teamId });
            setDetailOpen(false);
          }
          if (detailTarget.kind === "manager") {
            openActual({ periodId, teamId: detailTarget.teamId, managerId: detailTarget.managerId });
            setDetailOpen(false);
          }
        }}
      />
    </div>
  );
}
