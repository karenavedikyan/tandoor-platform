import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { SalesControlDirectorSkeleton } from "@/components/skeletons/sales-control-director-skeleton";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import {
  aggregateDirectorKpis,
  aggregateGrossProfit,
  applyDirectorTeamPlanSave,
  formatRub,
  formatSalesMetricValue,
  getAllSalesManagers,
  getDefaultSalesPeriodId,
  getPlanComment,
  getTeamManagers,
  getTeamLeadForTeam,
  getTeamPlanPublicationStatus,
  loadSalesControlStoredState,
  publishTeamPlanToRop,
  resolveDirectorTeamDraftFull,
  rollupManager,
  SALES_DIRECTOR_USER_ID,
  SALES_KPI_METRICS_SORTED,
  SALES_PLAN_PERIODS,
  SALES_TEAMS,
  teamPublicationMetrics,
  type TeamPlanDirectorStatus,
} from "@/lib/sales-control-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { cn } from "@/lib/utils";

const ALL = "__all__";

type DirectorTeamForm = {
  metrics: Record<string, string>;
  gross: string;
  comment: string;
};

function directorTeamStatusLabel(s: TeamPlanDirectorStatus): string {
  if (s === "draft") return "Черновик";
  if (s === "published_to_rop") return "Выгружено РОПу";
  return "Есть изменения, не выгружено";
}

function directorTeamStatusBadgeVariant(
  s: TeamPlanDirectorStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "published_to_rop") return "default";
  if (s === "changed_after_publish") return "destructive";
  return "secondary";
}

export default function SalesControlDirectorPage() {
  const [stored, setStored] = useSalesControlStoredState();
  const { profile } = useReleaseDemoProfile();
  const [pageReady, setPageReady] = useState(false);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setPageReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const actorUserId =
    profile.role === "sales_director" ? profile.personaUserId : SALES_DIRECTOR_USER_ID;
  const [periodId, setPeriodId] = useState(getDefaultSalesPeriodId());
  const [teamFilter, setTeamFilter] = useState<string>(ALL);
  const [managerFilter, setManagerFilter] = useState<string>(ALL);

  const managerIdsForAgg = useMemo(() => {
    if (managerFilter !== ALL) return [managerFilter];
    if (teamFilter !== ALL) return getTeamManagers(teamFilter).map((m) => m.id);
    return null;
  }, [managerFilter, teamFilter]);

  const kpis = useMemo(() => aggregateDirectorKpis(periodId, managerIdsForAgg, stored), [periodId, managerIdsForAgg, stored]);
  const gross = useMemo(() => aggregateGrossProfit(periodId, managerIdsForAgg, stored), [periodId, managerIdsForAgg, stored]);

  const pubByTeam = useMemo(
    () => SALES_TEAMS.map((t) => teamPublicationMetrics(t.id, periodId, stored)),
    [periodId, stored],
  );
  const pubTotals = useMemo(() => {
    return pubByTeam.reduce(
      (acc, r) => ({
        managers: acc.managers + r.managerCount,
        published: acc.published + r.published,
        draftOnly: acc.draftOnly + r.draftOnly,
        changedAfterPublish: acc.changedAfterPublish + r.changedAfterPublish,
      }),
      { managers: 0, published: 0, draftOnly: 0, changedAfterPublish: 0 },
    );
  }, [pubByTeam]);

  const [directorTeamForms, setDirectorTeamForms] = useState<Record<string, DirectorTeamForm>>({});

  useEffect(() => {
    const st = loadSalesControlStoredState();
    const next: Record<string, DirectorTeamForm> = {};
    for (const t of SALES_TEAMS) {
      const r = resolveDirectorTeamDraftFull(periodId, t.id, st);
      const metrics: Record<string, string> = {};
      for (const m of SALES_KPI_METRICS_SORTED) {
        metrics[m.id] = String(r.metricTargets[m.id] ?? 0);
      }
      next[t.id] = {
        metrics,
        gross: String(r.grossProfitTarget),
        comment: r.directorComment,
      };
    }
    setDirectorTeamForms(next);
  }, [periodId]);

  const saveDirectorTeam = useCallback(
    (teamId: string) => {
      const f = directorTeamForms[teamId];
      if (!f) return;
      const metricTargets: Record<string, number> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const raw = f.metrics[met.id] ?? "0";
        const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
        metricTargets[met.id] = Number.isFinite(n) ? n : 0;
      }
      const gn = Number(String(f.gross).replace(/\s/g, "").replace(",", "."));
      const next = applyDirectorTeamPlanSave(
        stored,
        periodId,
        teamId,
        metricTargets,
        Number.isFinite(gn) ? gn : 0,
        f.comment,
        actorUserId,
      );
      setStored(next);
      const st2 = next;
      const r = resolveDirectorTeamDraftFull(periodId, teamId, st2);
      const metrics: Record<string, string> = {};
      for (const m of SALES_KPI_METRICS_SORTED) {
        metrics[m.id] = String(r.metricTargets[m.id] ?? 0);
      }
      setDirectorTeamForms((prev) => ({
        ...prev,
        [teamId]: { metrics, gross: String(r.grossProfitTarget), comment: r.directorComment },
      }));
    },
    [actorUserId, directorTeamForms, periodId, setStored, stored],
  );

  const publishDirectorTeam = useCallback(
    (teamId: string) => {
      const f = directorTeamForms[teamId];
      if (!f) return;
      const metricTargets: Record<string, number> = {};
      for (const met of SALES_KPI_METRICS_SORTED) {
        const raw = f.metrics[met.id] ?? "0";
        const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
        metricTargets[met.id] = Number.isFinite(n) ? n : 0;
      }
      const gn = Number(String(f.gross).replace(/\s/g, "").replace(",", "."));
      let next = applyDirectorTeamPlanSave(
        stored,
        periodId,
        teamId,
        metricTargets,
        Number.isFinite(gn) ? gn : 0,
        f.comment,
        actorUserId,
      );
      next = publishTeamPlanToRop(next, periodId, teamId, actorUserId);
      setStored(next);
      const r = resolveDirectorTeamDraftFull(periodId, teamId, next);
      const metrics: Record<string, string> = {};
      for (const m of SALES_KPI_METRICS_SORTED) {
        metrics[m.id] = String(r.metricTargets[m.id] ?? 0);
      }
      setDirectorTeamForms((prev) => ({
        ...prev,
        [teamId]: { metrics, gross: String(r.grossProfitTarget), comment: r.directorComment },
      }));
    },
    [actorUserId, directorTeamForms, periodId, setStored, stored],
  );

  const managersRows = useMemo(() => {
    let list = getAllSalesManagers();
    if (teamFilter !== ALL) list = list.filter((m) => m.teamId === teamFilter);
    if (managerFilter !== ALL) list = list.filter((m) => m.id === managerFilter);
    return list.map((m) => rollupManager(m.id, periodId, stored)).filter(Boolean);
  }, [teamFilter, managerFilter, periodId, stored]);

  const teamRows = useMemo(() => {
    if (managerFilter !== ALL) {
      const m = managersRows[0];
      if (!m) return [];
      return SALES_TEAMS.filter((t) => t.id === m.teamId).map((t) => ({
        team: t,
        kpis: aggregateDirectorKpis(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
        gross: aggregateGrossProfit(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
      }));
    }
    if (teamFilter !== ALL) {
      const t = SALES_TEAMS.find((x) => x.id === teamFilter);
      if (!t) return [];
      return [
        {
          team: t,
          kpis: aggregateDirectorKpis(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
          gross: aggregateGrossProfit(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
        },
      ];
    }
    return SALES_TEAMS.map((t) => ({
      team: t,
      kpis: aggregateDirectorKpis(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
      gross: aggregateGrossProfit(periodId, getTeamManagers(t.id).map((x) => x.id), stored),
    }));
  }, [teamFilter, managerFilter, periodId, stored, managersRows]);

  const comments = useMemo(() => {
    return managersRows
      .map((r) =>
        r
          ? {
              managerId: r.managerId,
              managerName: r.managerName,
              teamName: r.teamName,
              text: getPlanComment(periodId, r.managerId, stored),
            }
          : null,
      )
      .filter(Boolean) as { managerId: string; managerName: string; teamName: string; text: string }[];
  }, [managersRows, periodId, stored]);

  if (!pageReady) {
    return <SalesControlDirectorSkeleton />;
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-24" data-testid="page-sales-director-dashboard">
      <FloatingBackButton href="/sales-control" label="К контуру план-факт" testId="button-floating-back-sales-control-director" />
      <section className="space-y-2" data-testid="section-sales-director-filters">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Руководитель продаж</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Сводка планов и факта по выбранному периоду. Фильтры не меняют исходные данные, только представление.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Период</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-full" data-testid="select-sales-filter-period">
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
            <Label className="text-xs font-medium text-muted-foreground">РОП</Label>
            <Select
              value={teamFilter}
              onValueChange={(v) => {
                setTeamFilter(v);
                setManagerFilter(ALL);
              }}
            >
              <SelectTrigger className="w-full" data-testid="select-sales-filter-team">
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
            <Label className="text-xs font-medium text-muted-foreground">Менеджер</Label>
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="w-full" data-testid="select-sales-filter-manager">
                <SelectValue placeholder="Менеджер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все менеджеры</SelectItem>
                {getAllSalesManagers()
                  .filter((m) => teamFilter === ALL || m.teamId === teamFilter)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-4" data-testid="section-director-team-plans">
        <h2 className="text-lg font-semibold text-foreground">Планы РОПов</h2>
        <div className="min-w-0 space-y-4">
          {SALES_TEAMS.map((team) => {
            const form = directorTeamForms[team.id];
            if (!form) return null;
            const st = getTeamPlanPublicationStatus(periodId, team.id, stored);
            const lead = getTeamLeadForTeam(team.id);
            return (
              <Card
                key={team.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-border/80 shadow-sm"
                data-testid={`row-director-team-plan-${team.id}`}
              >
                <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">{team.name}</CardTitle>
                    {lead ? <p className="text-xs text-muted-foreground">РОП: {lead.name}</p> : null}
                  </div>
                  <Badge
                    variant={directorTeamStatusBadgeVariant(st)}
                    data-testid={`badge-director-team-plan-status-${team.id}`}
                  >
                    {directorTeamStatusLabel(st)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SALES_KPI_METRICS_SORTED.map((met) => (
                      <div key={met.id} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{met.label}</Label>
                        <Input
                          type="number"
                          className="font-mono text-sm tabular-nums"
                          value={form.metrics[met.id] ?? ""}
                          data-testid={`input-director-team-plan-${team.id}-${met.id}`}
                          onChange={(e) =>
                            setDirectorTeamForms((prev) => ({
                              ...prev,
                              [team.id]: {
                                ...prev[team.id]!,
                                metrics: { ...prev[team.id]!.metrics, [met.id]: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs text-muted-foreground">Валовая прибыль (план команды, ₽)</Label>
                      <Input
                        type="number"
                        className="font-mono text-sm tabular-nums"
                        value={form.gross}
                        data-testid={`input-director-team-gross-profit-${team.id}`}
                        onChange={(e) =>
                          setDirectorTeamForms((prev) => ({
                            ...prev,
                            [team.id]: { ...prev[team.id]!, gross: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Комментарий руководителя продаж</Label>
                    <Textarea
                      rows={2}
                      className="min-h-[72px] resize-y text-sm"
                      value={form.comment}
                      data-testid={`input-director-team-comment-${team.id}`}
                      onChange={(e) =>
                        setDirectorTeamForms((prev) => ({
                          ...prev,
                          [team.id]: { ...prev[team.id]!, comment: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`button-director-save-team-plan-${team.id}`}
                      onClick={() => saveDirectorTeam(team.id)}
                    >
                      Сохранить черновик
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid={`button-director-publish-team-plan-${team.id}`}
                      onClick={() => publishDirectorTeam(team.id)}
                    >
                      Выгрузить РОПу
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 space-y-3" data-testid="section-sales-director-plan-publication">
        <h2 className="text-lg font-semibold text-foreground">Статус выгрузки планов</h2>
        <Card className="min-w-0 rounded-2xl border border-border/80 shadow-sm" data-testid="card-director-plan-publication-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">По всем командам</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Менеджеров</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{pubTotals.managers}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Получили план (выгружено)</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-700">{pubTotals.published}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Только черновик</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{pubTotals.draftOnly}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Изменения после выгрузки</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">{pubTotals.changedAfterPublish}</p>
            </div>
          </CardContent>
        </Card>
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Команда</TableHead>
                <TableHead className="text-right tabular-nums">Менеджеров</TableHead>
                <TableHead className="text-right tabular-nums">Выгружено</TableHead>
                <TableHead className="text-right tabular-nums">Черновик</TableHead>
                <TableHead className="text-right tabular-nums">Есть изменения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pubByTeam.map((row) => (
                <TableRow key={row.teamId} data-testid={`row-director-plan-publication-team-${row.teamId}`}>
                  <TableCell className="font-medium">{row.teamName}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{row.managerCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.published}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.draftOnly}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.changedAfterPublish}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3" data-testid="section-sales-director-kpis">
        <h2 className="text-lg font-semibold text-foreground">План и факт по KPI</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => {
            const metric = SALES_KPI_METRICS_SORTED.find((m) => m.id === k.metricId);
            return (
              <Card
                key={k.metricId}
                className="min-w-0 rounded-2xl border border-border/80 shadow-sm"
                data-testid={`card-sales-kpi-${k.metricId}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold leading-snug">{k.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    План:{" "}
                    <span className="font-semibold text-foreground">
                      {metric ? formatSalesMetricValue(metric, k.targetSum) : k.targetSum}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Факт:{" "}
                    <span className="font-semibold text-foreground">
                      {metric ? formatSalesMetricValue(metric, k.actualSum) : k.actualSum}
                    </span>
                  </p>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Выполнение</span>
                      <span className="font-semibold tabular-nums text-foreground">{k.pct}%</span>
                    </div>
                    <Progress value={Math.min(100, k.pct)} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-sm" data-testid="card-sales-kpi-gross-profit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Валовая прибыль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              План: <span className="font-semibold text-foreground">{formatRub(gross.target)}</span>
            </p>
            <p className="text-muted-foreground">
              Факт: <span className="font-semibold text-foreground">{formatRub(gross.actual)}</span>
            </p>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Выполнение</span>
                <span className="font-semibold tabular-nums text-foreground">{gross.pct}%</span>
              </div>
              <Progress value={Math.min(100, gross.pct)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" data-testid="section-sales-director-teams">
        <h2 className="text-lg font-semibold text-foreground">Команды</h2>
        <div className="w-full overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Команда</TableHead>
                {SALES_KPI_METRICS_SORTED.map((m) => (
                  <TableHead key={m.id} className="min-w-[100px] whitespace-nowrap text-right">
                    {m.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px] text-right">Вал. прибыль</TableHead>
                <TableHead className="min-w-[72px] text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamRows.map(({ team, kpis: tk, gross: tg }) => (
                <TableRow key={team.id} data-testid={`row-sales-team-${team.id}`}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  {SALES_KPI_METRICS_SORTED.map((m) => {
                    const cell = tk.find((x) => x.metricId === m.id);
                    const pct = cell?.pct ?? 0;
                    return (
                      <TableCell key={m.id} className="text-right tabular-nums text-muted-foreground">
                        {pct}%
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right text-muted-foreground">{tg.pct}%</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{tg.pct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3" data-testid="section-sales-director-managers">
        <h2 className="text-lg font-semibold text-foreground">Менеджеры</h2>
        <div className="w-full overflow-x-auto rounded-xl border border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Менеджер</TableHead>
                <TableHead className="min-w-[120px]">Команда</TableHead>
                {SALES_KPI_METRICS_SORTED.map((m) => (
                  <TableHead key={m.id} className="min-w-[88px] whitespace-nowrap text-right">
                    {m.label} %
                  </TableHead>
                ))}
                <TableHead className="min-w-[88px] text-right">ВП %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managersRows.map((r) =>
                r ? (
                  <TableRow key={r.managerId} data-testid={`row-sales-manager-${r.managerId}`}>
                    <TableCell className="font-medium">{r.managerName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.teamName}</TableCell>
                    {r.metrics.map(({ metric, pct }) => (
                      <TableCell key={metric.id} className="text-right tabular-nums">
                        {pct}%
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">{r.gross.pct}%</TableCell>
                  </TableRow>
                ) : null,
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Комментарии по планам</h2>
        <div className="grid gap-2">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет строк для выбранных фильтров.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.managerId}
                className={cn("rounded-xl border border-border/70 bg-card p-4 text-sm shadow-sm")}
              >
                <p className="font-semibold text-foreground">
                  {c.managerName}{" "}
                  <span className="font-normal text-muted-foreground">· {c.teamName}</span>
                </p>
                <p className="mt-1 text-muted-foreground">{c.text}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/sales-control/plans">Таблица планов</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/sales-control/performance">Выполнение</Link>
        </Button>
      </div>
    </div>
  );
}
