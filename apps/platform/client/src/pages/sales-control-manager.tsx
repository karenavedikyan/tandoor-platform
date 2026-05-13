import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import { getEffectiveSalesManagerId } from "@/lib/release-demo-profile";
import {
  applyManagerActualsSave,
  formatRub,
  formatSalesMetricValue,
  getActualValue,
  getDefaultSalesPeriodId,
  getGrossProfitActual,
  getPublishedAtIso,
  getPublishedTeamPeriodComment,
  hasPublishedManagerPlan,
  loadSalesControlStoredState,
  managerKpiProgressTone,
  rollupManager,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
} from "@/lib/sales-control-data";
import { cn } from "@/lib/utils";

function progressBarClass(tone: ReturnType<typeof managerKpiProgressTone>): string {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "yellow") return "bg-amber-400";
  return "bg-red-500";
}

export default function SalesControlManagerPage() {
  const [stored, setStored] = useSalesControlStoredState();
  const { profile } = useReleaseDemoProfile();
  const managerId = useMemo(() => getEffectiveSalesManagerId(profile), [profile]);
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());

  const rollupDraft = useMemo(() => rollupManager(managerId, periodId, stored, "draft"), [managerId, periodId, stored]);
  const rollupPublished = useMemo(
    () => rollupManager(managerId, periodId, stored, "published"),
    [managerId, periodId, stored],
  );
  const publishedGrossTone = useMemo(
    () => (rollupPublished ? managerKpiProgressTone(rollupPublished.gross.pct) : "red"),
    [rollupPublished],
  );
  const teamId = rollupDraft?.teamId;
  const publishedTeamNote = useMemo(() => {
    if (!teamId || !hasPublishedManagerPlan(periodId, managerId, stored)) return undefined;
    return getPublishedTeamPeriodComment(periodId, teamId, stored);
  }, [managerId, periodId, stored, teamId]);

  const [actualDraft, setActualDraft] = useState<Record<string, string>>({});
  const [grossActualDraft, setGrossActualDraft] = useState("");

  useEffect(() => {
    const st = loadSalesControlStoredState();
    const next: Record<string, string> = {};
    for (const m of SALES_KPI_METRICS_SORTED) {
      next[m.id] = String(getActualValue(periodId, managerId, m.id, st));
    }
    setActualDraft(next);
    setGrossActualDraft(String(getGrossProfitActual(periodId, managerId, st)));
  }, [managerId, periodId]);

  function saveActuals() {
    const metricActuals: Record<string, number> = {};
    for (const met of SALES_KPI_METRICS_SORTED) {
      const raw = actualDraft[met.id] ?? "0";
      const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
      metricActuals[met.id] = Number.isFinite(n) ? n : 0;
    }
    const gn = Number(String(grossActualDraft).replace(/\s/g, "").replace(",", "."));
    const next = applyManagerActualsSave(
      stored,
      periodId,
      managerId,
      metricActuals,
      Number.isFinite(gn) ? gn : 0,
    );
    setStored(next);
    const nd: Record<string, string> = {};
    for (const m of SALES_KPI_METRICS_SORTED) {
      nd[m.id] = String(getActualValue(periodId, managerId, m.id, next));
    }
    setActualDraft(nd);
    setGrossActualDraft(String(getGrossProfitActual(periodId, managerId, next)));
  }

  if (!rollupDraft) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-sales-manager-dashboard">
        <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-manager-missing" />
        <p className="text-sm text-muted-foreground">Менеджер не найден в mock-структуре.</p>
      </div>
    );
  }

  const publishedAtIso = getPublishedAtIso(periodId, managerId, stored);
  const publishedAtLabel =
    publishedAtIso != null
      ? new Date(publishedAtIso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
      : null;

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-hidden pb-24" data-testid="page-sales-manager-dashboard">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-manager" />
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Мой план-факт</h1>
        <p className="text-sm text-muted-foreground">
          {rollupDraft.managerName} · {rollupDraft.teamName}. Факт и валовая прибыль сохраняются локально в браузере.
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

      <section className="min-w-0 space-y-3" data-testid="section-manager-published-plan">
        <h2 className="text-lg font-semibold text-foreground">План от руководителя</h2>
        {!rollupPublished ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-sm text-muted-foreground" data-testid="text-manager-plan-empty">
            План ещё не выгружен руководителем.
          </p>
        ) : (
          <div className="space-y-3">
            {publishedAtLabel ? (
              <p className="text-xs text-muted-foreground" data-testid="text-manager-plan-published-at">
                Дата выгрузки: <span className="font-medium text-foreground">{publishedAtLabel}</span>
              </p>
            ) : null}
            {publishedTeamNote ? (
              <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Комментарий по команде: </span>
                {publishedTeamNote}
              </p>
            ) : null}
            <div className="grid gap-3">
              {rollupPublished.metrics.map(({ metric, target, actual, pct }) => {
                const tone = managerKpiProgressTone(pct);
                const barW = Math.min(100, Math.max(0, pct));
                return (
                  <Card
                    key={metric.id}
                    className="min-w-0 rounded-2xl border border-border/80 shadow-sm"
                    data-testid={`card-manager-kpi-progress-${metric.id}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{metric.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        План: <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, target)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Факт: <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, actual)}</span>
                      </p>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Выполнение</span>
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            tone === "green" && "text-emerald-600",
                            tone === "yellow" && "text-amber-600",
                            tone === "red" && "text-red-600",
                          )}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" data-testid={`progress-manager-kpi-${metric.id}`}>
                        <div className={cn("h-2 rounded-full transition-all", progressBarClass(tone))} style={{ width: `${barW}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <Card
                className="min-w-0 rounded-2xl border border-border/80 shadow-sm"
                data-testid="card-manager-kpi-progress-gross-profit"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Валовая прибыль</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    План: <span className="font-semibold text-foreground">{formatRub(rollupPublished.gross.target)}</span>
                  </p>
                  <p>
                    Факт: <span className="font-semibold text-foreground">{formatRub(rollupPublished.gross.actual)}</span>
                  </p>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Выполнение</span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        publishedGrossTone === "green" && "text-emerald-600",
                        publishedGrossTone === "yellow" && "text-amber-600",
                        publishedGrossTone === "red" && "text-red-600",
                      )}
                    >
                      {rollupPublished.gross.pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" data-testid="progress-manager-kpi-gross-profit">
                    <div
                      className={cn("h-2 rounded-full transition-all", progressBarClass(publishedGrossTone))}
                      style={{ width: `${Math.min(100, Math.max(0, rollupPublished.gross.pct))}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            {rollupPublished.comment ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Комментарий руководителя</Label>
                <Textarea readOnly rows={3} className="resize-y bg-muted/30 text-sm" value={rollupPublished.comment} />
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-3" data-testid="section-manager-actuals">
        <h2 className="text-lg font-semibold text-foreground">Текущее выполнение</h2>
        <p className="text-xs text-muted-foreground">Внесите факт по показателям и сохраните.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SALES_KPI_METRICS_SORTED.map((met) => (
            <div key={met.id} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{met.label}</Label>
              <Input
                type="number"
                className="font-mono text-sm tabular-nums"
                value={actualDraft[met.id] ?? ""}
                data-testid={`input-sales-actual-${managerId}-${met.id}`}
                onChange={(e) => setActualDraft((prev) => ({ ...prev, [met.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Валовая прибыль, факт (₽)</Label>
          <Input
            type="number"
            className="max-w-md font-mono text-sm tabular-nums"
            value={grossActualDraft}
            data-testid={`input-sales-gross-profit-actual-${managerId}`}
            onChange={(e) => setGrossActualDraft(e.target.value)}
          />
        </div>
        <Button type="button" className="min-h-10" data-testid={`button-sales-save-actuals-${managerId}`} onClick={saveActuals}>
          Сохранить факт
        </Button>
      </section>
    </div>
  );
}
