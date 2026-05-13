import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import { toast } from "@/hooks/use-toast";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import {
  applyTeamLeadPlanSave,
  applyTeamLeadTeamCommentDraft,
  completionPercent,
  formatRub,
  formatSalesMetricValue,
  getActualValue,
  getDefaultSalesPeriodId,
  getDraftTeamPeriodComment,
  getGrossProfitActual,
  getGrossProfitTarget,
  getManagerPlanPublishStatus,
  getPlanComment,
  getTargetValue,
  getTeamById,
  getTeamManagers,
  publishTeamPlansForTeam,
  rollupManager,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  loadSalesControlStoredState,
  type ManagerPlanPublishStatus,
  type SalesControlStoredState,
} from "@/lib/sales-control-data";

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

function statusBadgeLabel(status: ManagerPlanPublishStatus): string {
  if (status === "draft") return "Черновик";
  if (status === "published") return "Выгружено";
  return "Есть изменения, не выгружено";
}

function statusBadgeVariant(status: ManagerPlanPublishStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "published") return "default";
  if (status === "changed_after_publish") return "destructive";
  return "secondary";
}

export default function SalesControlTeamLeadPage() {
  const [stored, setStored] = useSalesControlStoredState();
  const { profile } = useReleaseDemoProfile();
  const activeTeamId = useMemo(() => getEffectiveTeamLeadTeamId(profile), [profile]);
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const managers = useMemo(() => getTeamManagers(activeTeamId), [activeTeamId]);
  const team = getTeamById(activeTeamId);

  const [drafts, setDrafts] = useState<Record<string, ManagerDraft>>({});
  const [teamCommentDraft, setTeamCommentDraft] = useState("");

  useEffect(() => {
    const st = loadSalesControlStoredState();
    const next: Record<string, ManagerDraft> = {};
    for (const m of managers) {
      next[m.id] = buildDraft(periodId, m.id, st);
    }
    setDrafts(next);
    setTeamCommentDraft(getDraftTeamPeriodComment(periodId, activeTeamId, st));
  }, [managers, periodId, activeTeamId]);

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

  const persistTeamComment = useCallback(() => {
    setStored((prev) => applyTeamLeadTeamCommentDraft(prev, periodId, activeTeamId, teamCommentDraft));
  }, [activeTeamId, periodId, setStored, teamCommentDraft]);

  const saveManagerDraft = useCallback(
    (managerId: string) => {
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
    },
    [drafts, managers, periodId, setStored, stored],
  );

  const publishAll = useCallback(() => {
    let next = applyTeamLeadTeamCommentDraft(stored, periodId, activeTeamId, teamCommentDraft);
    next = publishTeamPlansForTeam(next, periodId, activeTeamId);
    setStored(next);
    const nd: Record<string, ManagerDraft> = {};
    for (const m of managers) {
      nd[m.id] = buildDraft(periodId, m.id, next);
    }
    setDrafts(nd);
    toast({ title: "Планы выгружены менеджерам" });
  }, [activeTeamId, managers, periodId, setStored, stored, teamCommentDraft]);

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 overflow-x-hidden pb-24" data-testid="page-sales-team-lead-dashboard">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-team-lead" />
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Руководитель команды</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Команда: <span className="font-medium text-foreground">{team?.name ?? activeTeamId}</span>. Черновики планов сохраняются в браузере;
          после «Выгрузить менеджерам» менеджеры видят опубликованную версию в личном кабинете.
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

      <section className="min-w-0 space-y-4" data-testid="section-team-lead-plan-editor">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Планы команды</h2>
          <Button
            type="button"
            className="min-h-10 shrink-0"
            data-testid="button-sales-publish-team-plans"
            onClick={publishAll}
          >
            Выгрузить менеджерам
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Общий комментарий по команде за период</Label>
          <Textarea
            rows={2}
            className="min-h-[72px] max-w-2xl resize-y text-sm"
            value={teamCommentDraft}
            onChange={(e) => setTeamCommentDraft(e.target.value)}
            onBlur={persistTeamComment}
            data-testid="textarea-sales-team-period-comment"
          />
        </div>

        <div className="min-w-0 overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-[1] min-w-[140px] bg-card font-medium">Менеджер</TableHead>
                {SALES_KPI_METRICS_SORTED.map((met) => (
                  <TableHead key={met.id} className="min-w-[100px] whitespace-nowrap text-xs font-medium">
                    {met.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-[120px] whitespace-nowrap text-xs font-medium">Валовая прибыль (план)</TableHead>
                <TableHead className="min-w-[180px] text-xs font-medium">Комментарий</TableHead>
                <TableHead className="min-w-[120px] text-xs font-medium">Статус</TableHead>
                <TableHead className="min-w-[140px] text-xs font-medium">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((mgr) => {
                const d = drafts[mgr.id];
                if (!d) return null;
                const status = getManagerPlanPublishStatus(periodId, mgr.id, stored);
                return (
                  <TableRow key={mgr.id}>
                    <TableCell className="sticky left-0 z-[1] bg-card align-top font-medium">{mgr.name}</TableCell>
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <TableCell key={met.id} className="align-top p-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="h-9 min-w-[88px] font-mono text-xs tabular-nums"
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
                      </TableCell>
                    ))}
                    <TableCell className="align-top p-2">
                      <Input
                        type="number"
                        className="h-9 min-w-[100px] font-mono text-xs tabular-nums"
                        value={d.gross}
                        data-testid={`input-sales-gross-profit-target-${mgr.id}`}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [mgr.id]: { ...prev[mgr.id]!, gross: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top p-2">
                      <Textarea
                        rows={2}
                        className="min-h-[64px] min-w-[160px] resize-y text-xs"
                        value={d.comment}
                        data-testid={`input-sales-plan-comment-${mgr.id}`}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [mgr.id]: { ...prev[mgr.id]!, comment: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top p-2">
                      <Badge
                        variant={statusBadgeVariant(status)}
                        className="max-w-[200px] whitespace-normal text-left text-[11px] font-normal leading-snug"
                        data-testid={`badge-sales-plan-status-${mgr.id}`}
                      >
                        {statusBadgeLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full min-w-0"
                        data-testid={`button-sales-save-plan-draft-${mgr.id}`}
                        onClick={() => saveManagerDraft(mgr.id)}
                      >
                        Сохранить черновик
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" className="min-h-10" onClick={publishAll}>
            Выгрузить менеджерам
          </Button>
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
            const r = rollupManager(mgr.id, periodId, stored, "draft");
            if (!r) return null;
            return (
              <Card key={mgr.id} className="rounded-2xl border border-border/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{r.managerName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {r.metrics.map(({ metric, target, actual, pct }) => (
                    <div
                      key={metric.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
                    >
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
