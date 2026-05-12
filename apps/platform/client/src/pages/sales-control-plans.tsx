import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import {
  formatRub,
  formatSalesMetricValue,
  getAllSalesManagers,
  getDefaultSalesPeriodId,
  getPlanComment,
  getTargetValue,
  getActualValue,
  getGrossProfitTarget,
  getGrossProfitActual,
  getTeamById,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
} from "@/lib/sales-control-data";

export default function SalesControlPlansPage() {
  const [stored] = useSalesControlStoredState();
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const rows = useMemo(() => getAllSalesManagers(), []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-sales-control-plans">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-plans" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Сводная таблица планов</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">План, факт и валовая прибыль по каждому менеджеру за период.</p>
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

      <Link href="/sales-control/director" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        К панели руководителя продаж
      </Link>
    </div>
  );
}
