import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import {
  aggregateDirectorKpis,
  formatRub,
  formatSalesMetricValue,
  getAllSalesManagers,
  getDefaultSalesPeriodId,
  getPlanComment,
  getSalesUserById,
  getTargetValue,
  getActualValue,
  getGrossProfitTarget,
  getGrossProfitActual,
  getTeamById,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  type SalesDirectorAggregate,
  type SalesKpiMetric,
} from "@/lib/sales-control-data";

const ALL = "__all__";

function kpiRowTone(pct: number): string {
  if (pct >= 95) return "bg-emerald-500";
  if (pct >= 80) return "bg-primary";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function formatKpiValue(metric: SalesKpiMetric | undefined, value: number): string {
  if (!metric) return String(Math.round(value));
  return formatSalesMetricValue(metric, value);
}

type KpiSummaryRowProps = {
  row: SalesDirectorAggregate;
  metric: SalesKpiMetric | undefined;
};

function KpiPlanSummaryRow({ row, metric }: KpiSummaryRowProps) {
  const pct = Math.max(0, Math.min(100, Math.round(row.pct)));
  const remaining = Math.max(0, row.targetSum - row.actualSum);
  return (
    <div
      className="space-y-2 rounded-xl border border-border/80 bg-card p-3"
      data-testid={`row-sales-plan-kpi-${row.metricId}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{row.label}</p>
        <p className="text-xs tabular-nums text-muted-foreground" data-testid={`text-sales-plan-kpi-pct-${row.metricId}`}>
          {Math.round(row.pct)}%
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${kpiRowTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">План</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-sales-plan-kpi-plan-${row.metricId}`}
          >
            {formatKpiValue(metric, row.targetSum)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Факт</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-sales-plan-kpi-fact-${row.metricId}`}
          >
            {formatKpiValue(metric, row.actualSum)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">До плана</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-sales-plan-kpi-remaining-${row.metricId}`}
          >
            {formatKpiValue(metric, remaining)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SalesControlPlansPage() {
  const [stored] = useSalesControlStoredState();
  const { profile } = useReleaseDemoProfile();
  const currentUser = useMemo(() => getSalesUserById(profile.personaUserId), [profile.personaUserId]);
  const isManagerScope = currentUser?.role === "sales_manager";

  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const [ropTeam, setRopTeam] = useState<string>(() =>
    currentUser?.role === "sales_manager" && currentUser.teamId ? currentUser.teamId : ALL,
  );
  const [managerFilter, setManagerFilter] = useState<string>(() =>
    currentUser?.role === "sales_manager" && currentUser.id ? currentUser.id : ALL,
  );

  useEffect(() => {
    if (currentUser?.role === "sales_manager") {
      if (currentUser.teamId && ropTeam !== currentUser.teamId) setRopTeam(currentUser.teamId);
      if (currentUser.id && managerFilter !== currentUser.id) setManagerFilter(currentUser.id);
    }
  }, [currentUser?.role, currentUser?.teamId, currentUser?.id, ropTeam, managerFilter]);

  const rowsAll = useMemo(() => getAllSalesManagers(), []);
  const mgrOptions = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);

  const rows = useMemo(() => {
    let list = rowsAll;
    if (isManagerScope && currentUser?.id) {
      return list.filter((m) => m.id === currentUser.id);
    }
    if (!isRopOrManagerAllFilter(ropTeam)) list = list.filter((m) => m.teamId === ropTeam);
    if (!isRopOrManagerAllFilter(managerFilter)) list = list.filter((m) => m.id === managerFilter);
    return list;
  }, [rowsAll, ropTeam, managerFilter, isManagerScope, currentUser?.id]);

  const scopedManagerIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const kpiSummary = useMemo(
    () => aggregateDirectorKpis(periodId, scopedManagerIds, stored),
    [periodId, scopedManagerIds, stored],
  );

  const kpiMetricById = useMemo(() => {
    const map: Record<string, SalesKpiMetric> = {};
    for (const m of SALES_KPI_METRICS_SORTED) map[m.id] = m;
    return map;
  }, []);

  const kpiScopeLabel = useMemo(() => {
    if (!isRopOrManagerAllFilter(managerFilter)) {
      const mgr = rowsAll.find((m) => m.id === managerFilter);
      return mgr ? `по менеджеру: ${mgr.name}` : "по выбранному менеджеру";
    }
    if (!isRopOrManagerAllFilter(ropTeam)) {
      const team = getTeamById(ropTeam);
      return team ? `по команде: ${team.name}` : "по выбранной команде";
    }
    return "по отделу продаж";
  }, [managerFilter, ropTeam, rowsAll]);

  useEffect(() => {
    if (managerFilter === ALL) return;
    if (!mgrOptions.some((m) => m.id === managerFilter)) setManagerFilter(ALL);
  }, [ropTeam, mgrOptions, managerFilter]);

  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6 overflow-x-hidden pb-24" data-testid="page-sales-control-plans">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-plans" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Сводная таблица планов</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">План, факт и валовая прибыль по каждому менеджеру за период.</p>
        </div>
        <div
          className={`grid w-full gap-3 sm:max-w-md ${isManagerScope ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Период</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="min-w-0">
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
          </div>
          {isManagerScope ? null : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">РОП</Label>
                <Select value={ropTeam} onValueChange={setRopTeam}>
                  <SelectTrigger className="min-w-0" data-testid="select-sales-plans-rop">
                    <SelectValue placeholder="РОП" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Все РОПы</SelectItem>
                    {getRopOptions().map((r) => (
                      <SelectItem key={r.teamId} value={r.teamId}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Менеджер</Label>
                <Select value={managerFilter} onValueChange={setManagerFilter}>
                  <SelectTrigger className="min-w-0" data-testid="select-sales-plans-manager">
                    <SelectValue placeholder="Менеджер" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Все менеджеры</SelectItem>
                    {mgrOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Менеджер</TableHead>
              <TableHead className="min-w-[100px]">Команда</TableHead>
              {SALES_KPI_METRICS_SORTED.flatMap((m) => [
                <TableHead key={`${m.id}-t`} className="min-w-[88px] whitespace-nowrap text-right">
                  {m.label} план
                </TableHead>,
                <TableHead key={`${m.id}-a`} className="min-w-[88px] whitespace-nowrap text-right">
                  {m.label} факт
                </TableHead>,
              ])}
              <TableHead className="min-w-[100px] text-right">ВП план</TableHead>
              <TableHead className="min-w-[100px] text-right">ВП факт</TableHead>
              <TableHead className="min-w-[200px]">Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((mgr) => {
              const team = mgr.teamId ? getTeamById(mgr.teamId) : undefined;
              return (
                <TableRow key={mgr.id} data-testid={`row-sales-manager-${mgr.id}`}>
                  <TableCell className="font-medium">{mgr.name}</TableCell>
                  <TableCell className="text-muted-foreground">{team?.name ?? "—"}</TableCell>
                  {SALES_KPI_METRICS_SORTED.flatMap((met) => {
                    const t = getTargetValue(periodId, mgr.id, met.id, stored);
                    const a = getActualValue(periodId, mgr.id, met.id, stored);
                    return [
                      <TableCell key={`${met.id}-t`} className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatSalesMetricValue(met, t)}
                      </TableCell>,
                      <TableCell key={`${met.id}-a`} className="text-right text-xs tabular-nums">
                        {formatSalesMetricValue(met, a)}
                      </TableCell>,
                    ];
                  })}
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatRub(getGrossProfitTarget(periodId, mgr.id, stored))}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{formatRub(getGrossProfitActual(periodId, mgr.id, stored))}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {getPlanComment(periodId, mgr.id, stored)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <section className="space-y-3" data-testid="section-sales-plans-kpi">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Выполнение и план по KPI</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Сводка плана и факта по KPI {kpiScopeLabel}. Учитываются продажи ВХ, МК, фурнитура и активность по клиентам.
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpiSummary.map((row) => (
            <KpiPlanSummaryRow key={row.metricId} row={row} metric={kpiMetricById[row.metricId]} />
          ))}
        </div>
      </section>

      <Link href="/sales-control/director" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        К панели руководителя продаж
      </Link>
    </div>
  );
}
