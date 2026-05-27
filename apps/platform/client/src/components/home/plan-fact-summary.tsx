/**
 * <PlanFactSummary/> — компактная плитка на главной (Промт 47 Part E).
 *
 * Источник: useSalesPlanFactPersistedState(profile) — тот же state, что и /sales-control/plan-fact.
 * Фильтруем lines по `periodId="p-YYYY-MM"` текущего месяца, суммируем planValue / actualValue.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-platform";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSalesPlanFactPersistedState } from "@/hooks/use-sales-plan-fact-state";
import { buildHashPath } from "@/lib/hash-route-utils";

const MONTH_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function currentPeriodId(now: Date = new Date()): { periodId: string; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  return {
    periodId: `p-${y}-${mm}`,
    label: `${MONTH_RU[m]} ${y}`,
  };
}

function formatThousands(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function PlanFactSummary() {
  const { profile } = useReleaseDemoProfile();
  const { state, loading } = useSalesPlanFactPersistedState(profile);
  const { periodId, label } = useMemo(() => currentPeriodId(), []);

  const summary = useMemo(() => {
    const lines = state.lines.filter((l) => l.periodId === periodId);
    if (lines.length === 0) return { hasPlan: false, planSum: 0, factSum: 0 };
    const planSum = lines.reduce((s, l) => s + (Number.isFinite(l.planValue) ? l.planValue : 0), 0);
    const factSum = lines.reduce((s, l) => s + (l.actualValue != null && Number.isFinite(l.actualValue) ? l.actualValue : 0), 0);
    return { hasPlan: true, planSum, factSum };
  }, [state.lines, periodId]);

  if (loading) {
    return (
      <Card className="rounded-lg border bg-card" data-testid="plan-fact-summary-loading">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!summary.hasPlan) {
    return (
      <Card className="rounded-lg border bg-card" data-testid="plan-fact-summary-empty">
        <CardContent className="p-4">
          <EmptyState
            icon={Receipt}
            title="План на месяц ещё не выставлен"
            hint="Перейдите в раздел «План-факт», чтобы выставить план."
            cta={
              <Button asChild>
                <Link href={buildHashPath("/sales-control/plan-fact")}>Открыть план-факт</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const pct = summary.planSum > 0 ? Math.round((summary.factSum / summary.planSum) * 100) : 0;
  const delta = summary.factSum - summary.planSum;
  const deltaArrow = delta >= 0 ? "▲" : "▼";

  return (
    <Card className="rounded-lg border bg-card" data-testid="plan-fact-summary">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">План-факт · {label}</p>
            <p className="mt-1 text-xs text-muted-foreground">Сводка по выставленным планам и внесённому факту.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={buildHashPath("/sales-control/plan-fact")} data-testid="link-plan-fact-summary-open">
              Открыть план-факт
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] leading-tight text-muted-foreground">План</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {formatThousands(summary.planSum)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] leading-tight text-muted-foreground">Факт</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {formatThousands(summary.factSum)}
              <span className="text-xs text-muted-foreground" data-testid="plan-fact-summary-delta">
                {deltaArrow} {formatThousands(Math.abs(delta))}
              </span>
            </p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Выполнение</span>
            <span className="font-semibold tabular-nums text-foreground">{pct}%</span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
