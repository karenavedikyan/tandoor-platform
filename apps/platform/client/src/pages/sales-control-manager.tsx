import { useEffect, useMemo, useState } from "react";
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
  applyManagerActualsSave,
  completionPercent,
  formatRub,
  formatSalesMetricValue,
  getActualValue,
  getDefaultSalesPeriodId,
  getGrossProfitActual,
  getGrossProfitTarget,
  getPlanComment,
  loadSalesControlStoredState,
  rollupManager,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
} from "@/lib/sales-control-data";

const DEMO_MANAGER_KEY = "sales-control-demo-manager-id";
const DEFAULT_MANAGER = "user-sm-t1-m1";

function readActingManagerId(): string {
  if (typeof window !== "undefined" && window.sessionStorage) {
    const v = window.sessionStorage.getItem(DEMO_MANAGER_KEY);
    if (v) return v;
  }
  return DEFAULT_MANAGER;
}

export default function SalesControlManagerPage() {
  const [stored, setStored] = useSalesControlStoredState();
  const [managerId] = useState(readActingManagerId);
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());

  const rollup = useMemo(() => rollupManager(managerId, periodId, stored), [managerId, periodId, stored]);

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

  if (!rollup) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-sales-manager-dashboard">
        <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-manager-missing" />
        <p className="text-sm text-muted-foreground">Менеджер не найден в mock-структуре.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24" data-testid="page-sales-manager-dashboard">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-manager" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Мой план-факт</h1>
        <p className="text-sm text-muted-foreground">
          {rollup.managerName} · {rollup.teamName}. Факт и валовая прибыль сохраняются локально в браузере.
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

      <section className="space-y-3" data-testid="section-manager-plan">
        <h2 className="text-lg font-semibold text-foreground">План руководителя</h2>
        <div className="grid gap-3">
          {rollup.metrics.map(({ metric, target, actual, pct }) => (
            <Card key={metric.id} className="rounded-2xl border border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  План: <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, target)}</span>
                </p>
                <p className="text-muted-foreground">
                  Факт (текущий):{" "}
                  <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, actual)}</span> · {pct}%
                </p>
                <Progress value={Math.min(100, pct)} className="h-2" />
              </CardContent>
            </Card>
          ))}
          <Card className="rounded-2xl border border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Валовая прибыль</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                План: <span className="font-semibold text-foreground">{formatRub(getGrossProfitTarget(periodId, managerId, stored))}</span>
              </p>
              <p>
                Факт: <span className="font-semibold text-foreground">{formatRub(getGrossProfitActual(periodId, managerId, stored))}</span> ·{" "}
                {completionPercent(getGrossProfitTarget(periodId, managerId, stored), getGrossProfitActual(periodId, managerId, stored))}%
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3" data-testid="section-manager-actuals">
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
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Комментарий руководителя</Label>
          <Textarea
            readOnly
            rows={3}
            className="resize-y bg-muted/30 text-sm"
            value={getPlanComment(periodId, managerId, stored)}
            data-testid={`textarea-sales-plan-comment-${managerId}`}
          />
        </div>
        <Button type="button" className="min-h-10" data-testid={`button-sales-save-actuals-${managerId}`} onClick={saveActuals}>
          Сохранить факт
        </Button>
      </section>
    </div>
  );
}
