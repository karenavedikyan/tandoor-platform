import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import {
  completionPercent,
  formatSalesMetricValue,
  getActualValue,
  getDefaultSalesPeriodId,
  getGrossProfitActual,
  getGrossProfitTarget,
  getTargetValue,
  getTeamManagers,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
} from "@/lib/sales-control-data";

export default function SalesControlPerformancePage() {
  const [stored] = useSalesControlStoredState();
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());

  const teamCards = useMemo(() => {
    return SALES_TEAMS.map((team) => {
      const mgrs = getTeamManagers(team.id);
      const ids = mgrs.map((m) => m.id);
      const metrics = SALES_KPI_METRICS_SORTED.map((met) => {
        let target = 0;
        let actual = 0;
        for (const mid of ids) {
          target += getTargetValue(periodId, mid, met.id, stored);
          actual += getActualValue(periodId, mid, met.id, stored);
        }
        return { metric: met, target, actual, pct: completionPercent(target, actual) };
      });
      let gt = 0;
      let ga = 0;
      for (const mid of ids) {
        gt += getGrossProfitTarget(periodId, mid, stored);
        ga += getGrossProfitActual(periodId, mid, stored);
      }
      const grossPct = completionPercent(gt, ga);
      return { team, metrics, gross: { target: gt, actual: ga, pct: grossPct } };
    });
  }, [periodId, stored]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-sales-control-performance">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-performance" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Выполнение по командам</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Сводный прогресс по KPI и валовой прибыли в разрезе команд за выбранный период.</p>
        </div>
        <div className="w-full max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">Период</Label>
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger>
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {teamCards.map(({ team, metrics, gross }) => (
          <Card key={team.id} className="min-w-0 rounded-2xl border border-border/80 shadow-sm" data-testid={`row-sales-team-${team.id}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {metrics.map(({ metric, target, actual, pct }) => (
                <div key={metric.id} className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <p className="text-xs font-medium text-foreground">{metric.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatSalesMetricValue(metric, target)} → {formatSalesMetricValue(metric, actual)}
                  </p>
                  <div className="mt-1.5">
                    <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>%</span>
                      <span className="font-semibold text-foreground">{pct}%</span>
                    </div>
                    <Progress value={Math.min(100, pct)} className="h-1.5" />
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                <p className="text-xs font-semibold text-foreground">Валовая прибыль</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">План и факт в рублях агрегированы по команде.</p>
                <div className="mt-1.5">
                  <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                    <span>%</span>
                    <span className="font-semibold text-foreground">{gross.pct}%</span>
                  </div>
                  <Progress value={Math.min(100, gross.pct)} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href="/sales-control/director" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        К панели руководителя продаж
      </Link>
    </div>
  );
}
