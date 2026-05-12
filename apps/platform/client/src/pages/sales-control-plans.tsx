import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
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

const ALL = "__all__";

export default function SalesControlPlansPage() {
  const [stored] = useSalesControlStoredState();
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const [ropTeam, setRopTeam] = useState<string>(ALL);
  const [managerFilter, setManagerFilter] = useState<string>(ALL);

  const rowsAll = useMemo(() => getAllSalesManagers(), []);
  const mgrOptions = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);

  const rows = useMemo(() => {
    let list = rowsAll;
    if (!isRopOrManagerAllFilter(ropTeam)) list = list.filter((m) => m.teamId === ropTeam);
    if (!isRopOrManagerAllFilter(managerFilter)) list = list.filter((m) => m.id === managerFilter);
    return list;
  }, [rowsAll, ropTeam, managerFilter]);

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
        <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-3">
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
