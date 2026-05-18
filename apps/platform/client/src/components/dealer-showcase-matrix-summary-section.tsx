import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  canViewTradePointShowcaseMatrix,
  computeDealerShowcaseMatrixSummary,
  computeTradePointShowcaseMatrixStats,
  loadShowcaseMatrixStorage,
  SHOWCASE_MATRIX_CHANGED_EVENT,
} from "@/lib/trade-point-showcase-matrix-storage";
import { buildHashPath } from "@/lib/hash-route-utils";

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
};

export function DealerShowcaseMatrixSummarySection({ row, profile }: Props) {
  const canView = useMemo(() => canViewTradePointShowcaseMatrix(profile, row), [profile, row]);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
    return () => window.removeEventListener(SHOWCASE_MATRIX_CHANGED_EVENT, fn);
  }, []);

  const storage = useMemo(() => {
    void bump;
    return loadShowcaseMatrixStorage();
  }, [bump]);

  const summary = useMemo(() => computeDealerShowcaseMatrixSummary(row, storage), [row, storage]);
  const singleTp = row.tradePoints.length === 1 ? row.tradePoints[0] : null;
  const singleStats = useMemo(() => {
    if (!singleTp) return null;
    return computeTradePointShowcaseMatrixStats(row, singleTp, storage);
  }, [row, singleTp, storage]);

  if (!canView) return null;

  return (
    <section data-testid="section-dealer-showcase-summary" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Сводка по матрице витрины точек</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Целевые модели для выкладки: агрегаты по точкам и список с дефицитом, без полного перечня по всем точкам.
        </p>
      </div>

      <Card className="rounded-2xl border border-border/80 shadow-md">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Торговых точек</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{summary.totalTradePoints}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80">Полное выполнение</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-900">{summary.pointsFull}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950/80">С дефицитом</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-950">{summary.pointsWithDeficit}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-900/80">Нет на витрине, всего</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-red-900">{summary.totalMissingModels}</p>
          </div>
        </CardContent>
      </Card>

      {summary.topMissingModels.length > 0 ? (
        <Card className="rounded-2xl border border-border/80 shadow-md">
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Топ отсутствующих моделей</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-foreground">
              {summary.topMissingModels.map((m) => (
                <li key={m.modelId}>
                  <span className="font-medium">{m.modelName}</span>
                  <span className="text-muted-foreground"> — {m.missingPoints} точ.</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {singleTp && singleStats ? (
        <Card className="rounded-2xl border border-border/80 shadow-md">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-foreground">Одна торговая точка</p>
            <p className="text-sm text-muted-foreground">
              {singleTp.name} · выполнение {singleStats.completionPct}% · не на витрине: {singleStats.missing}
            </p>
            <Progress value={singleStats.completionPct} className="h-2 bg-muted" />
            <Button asChild variant="default" className="min-h-10 w-full font-semibold sm:w-auto">
              <Link
                href={buildHashPath(`/dealers/${row.id}/trade-points/${singleTp.id}`, { tradePointShowcase: "1" })}
              >
                Открыть витрину точки
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {summary.deficitPoints.length > 0 ? (
        <Card className="rounded-2xl border border-border/80 shadow-md">
          <CardContent className="divide-y divide-border p-0">
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Точки с дефицитом</p>
            </div>
            {summary.deficitPoints.map((p) => (
              <div
                key={p.tradePointId}
                data-testid={`row-dealer-showcase-deficit-point-${p.tradePointId}`}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium leading-snug text-foreground">{p.tradePointName}</p>
                  <p className="text-xs text-muted-foreground">{p.addressLine}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {p.completionPct}% выполнено
                    </Badge>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] font-medium text-red-900">
                      Нет: {p.missingCount}
                    </Badge>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="min-h-9 shrink-0 border-border bg-card font-semibold">
                  <Link href={buildHashPath(`/dealers/${row.id}/trade-points/${p.tradePointId}`, { tradePointShowcase: "1" })}>
                    Открыть точку
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Дефицита по матрице не зафиксировано.</p>
      )}
    </section>
  );
}
