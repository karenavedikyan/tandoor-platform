import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPlanExecutionRows,
  planExecutionRowFormat,
  type PlanExecutionRow,
  type PlanExecutionScope,
} from "@/lib/sales-manager-kpi-data";

type Props = {
  scope: PlanExecutionScope;
  managerCount: number;
  periodLabel: string;
};

function deltaSign(value: number): string {
  if (value > 0) return "+";
  if (value < 0) return "−";
  return "";
}

function deltaColor(value: number): string {
  if (value > 0.5) return "text-emerald-700";
  if (value < -0.5) return "text-red-700";
  return "text-muted-foreground";
}

function formatPctSigned(value: number): string {
  const sign = deltaSign(value);
  const v = Math.abs(value);
  const rounded = Math.round(v * 10) / 10;
  const s = Number.isInteger(rounded) ? String(Math.round(rounded)) : String(rounded).replace(".", ",");
  return `${sign}${s}%`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function PlanExecutionBar({ row }: { row: PlanExecutionRow }) {
  const factPct = clamp(row.completionPercent);
  const forecastPct = clamp(row.forecastPercent);
  return (
    <div
      className="space-y-2 rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"
      data-testid={`card-dashboard-plan-execution-${row.category}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground" data-testid={`text-dashboard-plan-execution-label-${row.category}`}>
          {row.label}
        </p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {row.unit === "units" ? "штук" : "оборот, ₽"}
        </p>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
          style={{ width: `${forecastPct}%` }}
          data-testid={`bar-dashboard-plan-execution-forecast-${row.category}`}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${factPct}%` }}
          data-testid={`bar-dashboard-plan-execution-fact-${row.category}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">План</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-dashboard-plan-${row.category}`}
          >
            {planExecutionRowFormat(row, row.plan)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Факт</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-dashboard-plan-fact-${row.category}`}
          >
            {planExecutionRowFormat(row, row.fact)}{" "}
            <span className="font-normal text-muted-foreground">({Math.round(row.completionPercent)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Прогноз</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-dashboard-plan-forecast-${row.category}`}
          >
            {planExecutionRowFormat(row, row.forecast)}{" "}
            <span className="font-normal text-muted-foreground">({Math.round(row.forecastPercent)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Прошлый мес. на эту дату</p>
          <p
            className="font-semibold tabular-nums text-foreground"
            data-testid={`text-dashboard-plan-prev-mtd-${row.category}`}
          >
            {planExecutionRowFormat(row, row.previousMonthMtdFact)}{" "}
            <span className={`font-normal ${deltaColor(row.factVsPrevMtdPercent)}`}>
              {formatPctSigned(row.factVsPrevMtdPercent)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function MainPlanExecutionChart({ scope, managerCount, periodLabel }: Props) {
  const rows = useMemo(() => getPlanExecutionRows(scope, managerCount), [scope, managerCount]);
  const scopeHint =
    scope === "manager"
      ? "По вашим продажам"
      : scope === "team"
        ? "Сумма по команде"
        : "Сумма по отделу продаж";

  return (
    <Card
      className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm"
      data-testid="section-dashboard-plan-execution-chart"
    >
      <CardHeader className="space-y-1 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Выполнение плана за месяц</CardTitle>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{periodLabel}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {scopeHint}. Сплошная заливка — факт на сегодня, светлая — прогноз на конец месяца.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <PlanExecutionBar key={row.category} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}
