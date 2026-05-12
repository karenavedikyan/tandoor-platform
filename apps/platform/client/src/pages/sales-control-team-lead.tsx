import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import {
  applyTeamLeadPlanSave,
  completionPercent,
  formatRub,
  formatSalesMetricValue,
  getActualValue,
  getDefaultSalesPeriodId,
  getGrossProfitActual,
  getGrossProfitTarget,
  getPlanComment,
  getTargetValue,
  getTeamById,
  getTeamManagers,
  rollupManager,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  loadSalesControlStoredState,
  type SalesControlStoredState,
} from "@/lib/sales-control-data";

const DEMO_TEAM_ID = "team-1";

type ManagerDraft = {
  metrics: Record<string, string>;
  gross: string;
  comment: string;
};

function buildDraft(periodId: string, managerId: string, st: SalesControlStoredState): ManagerDraft {
  const metrics: Record<string, string> = {};
  for (const m of SALES_KPI_METRICS_SORTED) {
    metrics[m.id] = String(getTargetValue(periodId, managerId, m.id, st));
  }
  return {
    metrics,
    gross: String(getGrossProfitTarget(periodId, managerId, st)),
    comment: getPlanComment(periodId, managerId, st),
  };
}

export default function SalesControlTeamLeadPage() {
  const [stored, setStored] = useSalesControlStoredState();
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const managers = useMemo(() => getTeamManagers(DEMO_TEAM_ID), []);
  const team = getTeamById(DEMO_TEAM_ID);

  const [drafts, setDrafts] = useState<Record<string, ManagerDraft>>({});

  useEffect(() => {
    const st = loadSalesControlStoredState();
    const next: Record<string, ManagerDraft> = {};
    for (const m of managers) {
      next[m.id] = buildDraft(periodId, m.id, st);
    }
    setDrafts(next);
  }, [managers, periodId]);

  const teamAgg = useMemo(() => {
    const ids = managers.map((m) => m.id);
    return SALES_KPI_METRICS_SORTED.map((met) => {
      let target = 0;
      let actual = 0;
      for (const mid of ids) {
        target += getTargetValue(periodId, mid, met.id, stored);
        actual += getActualValue(periodId, mid, met.id, stored);
      }
      return { metric: met, target, actual, pct: completionPercent(target, actual) };
    });
  }, [managers, periodId, stored]);

  const teamGross = useMemo(() => {
    const ids = managers.map((m) => m.id);
    let gt = 0;
    let ga = 0;
    for (const mid of ids) {
      gt += getGrossProfitTarget(periodId, mid, stored);
      ga += getGrossProfitActual(periodId, mid, stored);
    }
    return { target: gt, actual: ga, pct: completionPercent(gt, ga) };
  }, [managers, periodId, stored]);

  function saveManager(managerId: string) {
    const d = drafts[managerId];
    if (!d) return;
    const metricTargets: Record<string, number> = {};
    for (const met of SALES_KPI_METRICS_SORTED) {
      const raw = d.metrics[met.id] ?? "0";
      const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
      metricTargets[met.id] = Number.isFinite(n) ? n : 0;
    }
    const gn = Number(String(d.gross).replace(/\s/g, "").replace(",", "."));
    const next = applyTeamLeadPlanSave(
      stored,
      periodId,
      managerId,
      metricTargets,
      Number.isFinite(gn) ? gn : 0,
      d.comment,
    );
    setStored(next);
    const nd: Record<string, ManagerDraft> = {};
    for (const m of managers) {
      nd[m.id] = buildDraft(periodId, m.id, next);
    }
    setDrafts(nd);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24" data-testid="page-sales-team-lead-dashboard">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-team-lead" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Руководитель команды</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Команда: <span className="font-medium text-foreground">{team?.name ?? DEMO_TEAM_ID}</span>. Задайте план по KPI и валовой прибыли для каждого менеджера, добавьте комментарий и сохраните — значения фиксируются в браузере (sessionStorage).
        </p>
        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs text-muted-foreground">Период</Label>
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="w-full">
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

      <section className="space-y-4" data-testid="section-team-lead-plan-editor">
        <h2 className="text-lg font-semibold text-foreground">Планы по менеджерам</h2>
        <div className="grid gap-4">
          {managers.map((mgr) => {
            const d = drafts[mgr.id];
            if (!d) return null;
            return (
              <Card key={mgr.id} className="rounded-2xl border border-border/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{mgr.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{met.label}</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="font-mono text-sm tabular-nums"
                          value={d.metrics[met.id] ?? ""}
                          data-testid={`input-sales-plan-target-${mgr.id}-${met.id}`}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [mgr.id]: {
                                ...prev[mgr.id]!,
                                metrics: { ...prev[mgr.id]!.metrics, [met.id]: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Валовая прибыль, план (₽)</Label>
                      <Input
                        type="number"
                        className="font-mono text-sm tabular-nums"
                        value={d.gross}
                        data-testid={`input-sales-gross-profit-target-${mgr.id}`}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [mgr.id]: { ...prev[mgr.id]!, gross: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Комментарий руководителя</Label>
                    <Textarea
                      rows={3}
                      className="min-h-[88px] resize-y text-sm"
                      value={d.comment}
                      data-testid={`textarea-sales-plan-comment-${mgr.id}`}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [mgr.id]: { ...prev[mgr.id]!, comment: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Button type="button" className="min-h-10" data-testid={`button-sales-save-plan-${mgr.id}`} onClick={() => saveManager(mgr.id)}>
                    Сохранить план
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-team-lead-performance">
        <h2 className="text-lg font-semibold text-foreground">Выполнение плана</h2>
        <Card className="rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Команда в целом</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {teamAgg.map(({ metric, target, actual, pct }) => (
              <div key={metric.id} className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm">
                <p className="font-medium text-foreground">{metric.label}</p>
                <p className="mt-1 text-muted-foreground">
                  План {formatSalesMetricValue(metric, target)} · факт {formatSalesMetricValue(metric, actual)}
                </p>
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>%</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                  <Progress value={Math.min(100, pct)} className="h-2" />
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-border/60 bg-card/80 p-3 text-sm sm:col-span-2">
              <p className="font-medium text-foreground">Валовая прибыль</p>
              <p className="mt-1 text-muted-foreground">
                План {formatRub(teamGross.target)} · факт {formatRub(teamGross.actual)}
              </p>
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>%</span>
                  <span className="font-semibold text-foreground">{teamGross.pct}%</span>
                </div>
                <Progress value={Math.min(100, teamGross.pct)} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {managers.map((mgr) => {
            const r = rollupManager(mgr.id, periodId, stored);
            if (!r) return null;
            return (
              <Card key={mgr.id} className="rounded-2xl border border-border/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{r.managerName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {r.metrics.map(({ metric, target, actual, pct }) => (
                    <div key={metric.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
                      <span className="text-muted-foreground">{metric.label}</span>
                      <span className="font-semibold tabular-nums text-foreground">{pct}%</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2 pt-1 font-medium text-foreground">
                    <span>Вал. прибыль</span>
                    <span className="tabular-nums">{r.gross.pct}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Button asChild variant="outline" size="sm">
        <Link href="/sales-control/director">Панель руководителя продаж</Link>
      </Button>
    </div>
  );
}
