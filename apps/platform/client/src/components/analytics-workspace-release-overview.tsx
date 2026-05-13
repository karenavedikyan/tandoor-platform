import { useMemo } from "react";
import { Link } from "wouter";
import { CityConcentrationBlock } from "@/components/city-concentration-block";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { buildHashPath } from "@/lib/hash-route-utils";
import { buildDealerBaseAllCitiesHref, buildDealerBaseCityDrillHref, getTopCityConcentrationRows } from "@/lib/city-concentration";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { dealerNeedsAttention, isDealerTop, roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { getEffectiveTeamLeadTeamId, releaseDemoRoleLabel, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { TaskCategoryId } from "@/lib/task-classification";
import { TASK_CATEGORIES, getTaskCategoryCounts, getTaskCategoryLabel } from "@/lib/task-classification";
import { getTaskPresetCounts, type TaskPresetId } from "@/lib/task-presets";
import { getAllMatrixTasks } from "@/lib/trade-point-task-data";
import { aggregateManagersForTeam, buildTeamSummaries, type TeamSummary } from "@/lib/team-summary";
import { getSalesUserById, type SalesRole } from "@/lib/sales-control-data";
import { cn } from "@/lib/utils";

const PRESET_ROW_META: { id: TaskPresetId; label: string; testId?: string }[] = [
  { id: "urgent", label: "Горящие" },
  { id: "overdue", label: "Просроченные" },
  { id: "training", label: "Обучение", testId: "link-analytics-task-training" },
  { id: "showcase", label: "Витрины", testId: "link-analytics-task-showcase" },
];

function dealerBaseScope(role: SalesRole, profile: ReleaseDemoProfile): Record<string, string> {
  const u = getSalesUserById(profile.personaUserId);
  if (role === "sales_manager") {
    return { view: "my_clients", manager: u?.id ?? "" };
  }
  if (role === "team_lead") {
    return { view: "table_team", team: getEffectiveTeamLeadTeamId(profile) };
  }
  return { view: "table_all" };
}

function tasksScope(role: SalesRole, profile: ReleaseDemoProfile): Record<string, string> {
  if (role === "team_lead") {
    return { team: getEffectiveTeamLeadTeamId(profile) };
  }
  return {};
}

function MetricRow({
  label,
  count,
  total,
  href,
  testId,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  href?: string;
  testId?: string;
  barClass?: string;
}) {
  const pct = total > 0 ? Math.round((100 * count) / total) : 0;
  const body = (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-transparent px-1 py-2 transition hover:border-border hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">{count.toLocaleString("ru-RU")}</span>
          <span> ({pct}%)</span>
        </p>
      </div>
      <div className="h-2 w-full min-w-0 shrink-0 overflow-hidden rounded-full bg-muted sm:max-w-[160px] sm:flex-1">
        <div className={cn("h-full rounded-full", barClass ?? "bg-primary/75")} style={{ width: `${Math.min(100, Math.max(pct, 0))}%` }} />
      </div>
    </div>
  );
  if (!href) return <div className="min-w-0">{body}</div>;
  return (
    <Link href={href} className="block min-w-0 no-underline outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId}>
      {body}
    </Link>
  );
}

function roleSummaryLine(role: SalesRole): string {
  if (role === "sales_director") return "Данные по всему отделу продаж: все команды и клиенты в контуре Release 1.";
  if (role === "analyst") return "Полный аналитический контур: все команды и клиенты (роль аналитика).";
  if (role === "team_lead") return "Данные только вашей команды: клиенты и задачи в границах РОП.";
  return "Данные в вашем персональном контуре.";
}

export function AnalyticsWorkspaceReleaseOverview() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const role = (user?.role ?? profile.role) as SalesRole;
  const presetClock = useMemo(() => new Date(), []);

  const scopedRows = useMemo(() => roleScopedDealerRows(DEALER_BASE_ROWS, profile), [profile]);
  const topCityRows = useMemo(() => getTopCityConcentrationRows(scopedRows, 10), [scopedRows]);
  const dealerIds = useMemo(() => new Set(scopedRows.map((r) => r.id)), [scopedRows]);

  const dbScope = useMemo(() => dealerBaseScope(role, profile), [role, profile]);
  const taskScope = useMemo(() => tasksScope(role, profile), [role, profile]);

  const clientStats = useMemo(() => {
    const total = scopedRows.length;
    const active = scopedRows.filter((r) => r.status === "активный").length;
    const potential = scopedRows.filter((r) => r.status === "потенциальный").length;
    const top = scopedRows.filter(isDealerTop).length;
    const attention = scopedRows.filter(dealerNeedsAttention).length;
    return { total, active, potential, top, attention };
  }, [scopedRows]);

  const openTasks = useMemo(() => {
    return getAllMatrixTasks().filter((t) => dealerIds.has(t.dealerId) && t.status !== "done");
  }, [dealerIds]);

  const categoryCounts = useMemo(() => getTaskCategoryCounts(openTasks), [openTasks]);
  const presetCounts = useMemo(() => getTaskPresetCounts(openTasks, presetClock), [openTasks, presetClock]);

  const teamSummaries = useMemo(() => {
    if (role === "sales_director" || role === "analyst" || role === "team_lead") {
      return buildTeamSummaries(profile);
    }
    return [] as TeamSummary[];
  }, [profile, role]);

  const teamRows = useMemo(() => {
    return [...teamSummaries].sort((a, b) => a.teamDisplayName.localeCompare(b.teamDisplayName, "ru"));
  }, [teamSummaries]);

  const managerRows = useMemo(() => {
    if (role !== "team_lead") return [];
    const tid = getEffectiveTeamLeadTeamId(profile);
    return aggregateManagersForTeam(tid)
      .filter((m) => m.total > 0)
      .sort((a, b) => {
        const pa = a.total > 0 ? a.attention / a.total : 0;
        const pb = b.total > 0 ? b.attention / b.total : 0;
        if (pb !== pa) return pb - pa;
        return b.attention - a.attention;
      });
  }, [role, profile]);

  const topAttentionClients = useMemo(() => {
    return [...scopedRows]
      .filter(dealerNeedsAttention)
      .sort((a, b) => {
        if (a.hasProblem !== b.hasProblem) return a.hasProblem ? -1 : 1;
        if (b.outlets !== a.outlets) return b.outlets - a.outlets;
        return a.name.localeCompare(b.name, "ru");
      })
      .slice(0, 5);
  }, [scopedRows]);

  const topAttentionTeams = useMemo(() => {
    if (role !== "sales_director" && role !== "analyst") return [];
    return [...teamSummaries]
      .filter((s) => s.totalClients > 0)
      .sort((a, b) => b.pctAttention - a.pctAttention || b.attentionClients - a.attentionClients)
      .slice(0, 5);
  }, [role, teamSummaries]);

  const topAttentionManagers = useMemo(() => {
    if (role !== "team_lead") return [];
    const tid = getEffectiveTeamLeadTeamId(profile);
    return aggregateManagersForTeam(tid)
      .filter((m) => m.total > 0)
      .sort((a, b) => {
        const pa = a.attention / a.total;
        const pb = b.attention / b.total;
        if (pb !== pa) return pb - pa;
        return b.attention - a.attention;
      })
      .slice(0, 5);
  }, [role, profile]);

  const isDept = role === "sales_director" || role === "analyst";
  const isRop = role === "team_lead";

  const segmented = useMemo(() => {
    const t = clientStats.total;
    if (t <= 0) return [];
    return [
      { key: "active", pct: (100 * clientStats.active) / t, className: "bg-emerald-500/90" },
      { key: "potential", pct: (100 * clientStats.potential) / t, className: "bg-sky-500/85" },
      { key: "top", pct: (100 * clientStats.top) / t, className: "bg-amber-500/85" },
      { key: "attention", pct: (100 * clientStats.attention) / t, className: "bg-rose-500/85" },
    ].filter((x) => x.pct > 0);
  }, [clientStats]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <section className="min-w-0 space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-4" data-testid="section-analytics-role-summary">
        <p className="text-sm font-semibold text-foreground">{releaseDemoRoleLabel(role)}</p>
        <p className="text-sm text-muted-foreground">{roleSummaryLine(role)}</p>
      </section>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80 shadow-sm" data-testid="card-analytics-client-structure">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Структура клиентской базы</CardTitle>
            <CardDescription>Распределение по ключевым сегментам в текущем доступе.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Всего клиентов:{" "}
              <Link href={buildHashPath("/dealer-base", dbScope)} className="font-semibold text-primary underline-offset-2 hover:underline">
                <span className="tabular-nums">{clientStats.total.toLocaleString("ru-RU")}</span>
              </Link>
            </p>
            {clientStats.total > 0 ? (
              <div className="flex h-3 w-full min-w-0 overflow-hidden rounded-full bg-muted">
                {segmented.map((s) => (
                  <div key={s.key} className={cn("min-w-[3px]", s.className)} style={{ width: `${s.pct}%` }} title={s.key} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет клиентов в выбранном контуре.</p>
            )}
            <div className="min-w-0 divide-y divide-border/60">
              <MetricRow
                label="Активные"
                count={clientStats.active}
                total={clientStats.total}
                href={buildHashPath("/dealer-base", { ...dbScope, quick: "active" })}
                testId="link-analytics-active-clients"
                barClass="bg-emerald-500/80"
              />
              <MetricRow
                label="Потенциальные"
                count={clientStats.potential}
                total={clientStats.total}
                href={buildHashPath("/dealer-base", { ...dbScope, quick: "potential" })}
                barClass="bg-sky-500/75"
              />
              <MetricRow label="TOP" count={clientStats.top} total={clientStats.total} href={buildHashPath("/dealer-base", { ...dbScope, quick: "top" })} barClass="bg-amber-500/75" />
              <MetricRow
                label="Требуют внимания"
                count={clientStats.attention}
                total={clientStats.total}
                href={buildHashPath("/dealer-base", { ...dbScope, quick: "attention" })}
                testId="link-analytics-attention-clients"
                barClass="bg-rose-500/75"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80 shadow-sm" data-testid="card-analytics-team-comparison">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isDept ? "Команды (РОПы)" : isRop ? "Менеджеры команды" : "Показатели"}</CardTitle>
            <CardDescription>
              {isDept ? "Сравнение команд по клиентам и качеству портфеля." : isRop ? "Нагрузка и внимание по менеджерам вашей команды." : "Сводка в вашем контуре."}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-2">
            {isDept ? (
              <div className="flex min-w-0 flex-col gap-2">
                {teamRows.map((s) => (
                  <Link
                    key={s.teamId}
                    href={buildHashPath("/dealer-base", { team: s.teamId, view: "my_team" })}
                    data-testid={`row-analytics-team-${s.teamId}`}
                    className="block min-w-0 rounded-xl border border-border/70 bg-card/80 p-3 no-underline outline-none ring-offset-background transition hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{s.teamDisplayName}</p>
                        <p className="truncate text-xs text-muted-foreground">РОП: {s.ropName}</p>
                      </div>
                      <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-xs sm:max-w-[280px] sm:text-right">
                        <span className="text-muted-foreground">Клиенты</span>
                        <span className="tabular-nums text-foreground">{s.totalClients}</span>
                        <span className="text-muted-foreground">Активные %</span>
                        <span className="tabular-nums text-foreground">{s.pctActive}%</span>
                        <span className="text-muted-foreground">Внимание %</span>
                        <span className="tabular-nums text-foreground">{s.pctAttention}%</span>
                        <span className="text-muted-foreground">Средняя нагрузка</span>
                        <span className="tabular-nums text-foreground">{s.avgClientsPerManager}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : isRop ? (
              <div className="flex min-w-0 flex-col gap-2">
                {managerRows.map((m) => (
                  <Link
                    key={m.id}
                    href={buildHashPath("/dealer-base", {
                      team: getEffectiveTeamLeadTeamId(profile),
                      manager: m.id,
                      view: "my_clients",
                    })}
                    data-testid={`row-analytics-manager-${m.id}`}
                    className="block min-w-0 rounded-xl border border-border/70 bg-card/80 p-3 no-underline outline-none ring-offset-background transition hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-xs sm:max-w-[240px] sm:text-right">
                        <span className="text-muted-foreground">Клиенты</span>
                        <span className="tabular-nums text-foreground">{m.total}</span>
                        <span className="text-muted-foreground">Активные %</span>
                        <span className="tabular-nums text-foreground">{m.total > 0 ? Math.round((100 * m.active) / m.total) : 0}%</span>
                        <span className="text-muted-foreground">Внимание %</span>
                        <span className="tabular-nums text-foreground">{m.total > 0 ? Math.round((100 * m.attention) / m.total) : 0}%</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Сравнение команд для этой роли не отображается.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80 shadow-sm md:col-span-1" data-testid="card-analytics-task-structure">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Задачи</CardTitle>
            <CardDescription>Открытые задачи в контуре клиентов с быстрым переходом в список.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">Всего открытых:</span>
              <Link
                href={buildHashPath("/tasks", { ...taskScope, preset: "all" })}
                className="text-lg font-semibold tabular-nums text-primary underline-offset-2 hover:underline"
              >
                {openTasks.length.toLocaleString("ru-RU")}
              </Link>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">По категориям</p>
              <div className="min-w-0 divide-y divide-border/60">
                {TASK_CATEGORIES.map((c) => {
                  const id = c.id as TaskCategoryId;
                  const n = categoryCounts[id];
                  return (
                    <Link
                      key={id}
                      href={buildHashPath("/tasks", { ...taskScope, preset: "all", category: id })}
                      className="flex min-w-0 items-center justify-between gap-2 py-2 text-sm no-underline outline-none ring-offset-background transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 truncate text-foreground">{getTaskCategoryLabel(id)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{n}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">По пресетам</p>
              <div className="min-w-0 divide-y divide-border/60">
                {PRESET_ROW_META.map((row) => (
                  <Link
                    key={row.id}
                    href={buildHashPath("/tasks", { ...taskScope, preset: row.id, category: "all" })}
                    data-testid={row.testId}
                    className="flex min-w-0 items-center justify-between gap-2 py-2 text-sm no-underline outline-none ring-offset-background transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{presetCounts[row.id]}</span>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80 shadow-sm md:col-span-1" data-testid="card-analytics-focus">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Фокус внимания</CardTitle>
            <CardDescription>Топ клиентов по вниманию и узкие места по командам или менеджерам.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Топ‑5 клиентов</p>
              {topAttentionClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет клиентов, отмеченных как требующие внимания.</p>
              ) : (
                <ul className="min-w-0 space-y-1">
                  {topAttentionClients.map((d) => (
                    <li key={d.id} className="min-w-0">
                      <Link
                        href={`/dealers/${d.id}`}
                        data-testid={`row-analytics-focus-client-${d.id}`}
                        className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-transparent px-1 py-2 text-sm no-underline outline-none ring-offset-background transition hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{d.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{d.city}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isDept ? (
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Топ‑5 команд по доле внимания</p>
                <ul className="min-w-0 space-y-1">
                  {topAttentionTeams.map((s) => (
                    <li key={s.teamId} className="min-w-0">
                      <Link
                        href={buildHashPath("/dealer-base", { team: s.teamId, quick: "attention", view: "table_team" })}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-transparent px-1 py-2 text-sm no-underline outline-none ring-offset-background transition hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 truncate text-foreground">{s.teamDisplayName}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{s.pctAttention}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : isRop ? (
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Топ‑5 менеджеров по доле внимания</p>
                <ul className="min-w-0 space-y-1">
                  {topAttentionManagers.map((m) => (
                    <li key={m.id} className="min-w-0">
                      <Link
                        href={buildHashPath("/dealer-base", {
                          team: getEffectiveTeamLeadTeamId(profile),
                          manager: m.id,
                          quick: "attention",
                          view: "my_clients",
                        })}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-transparent px-1 py-2 text-sm no-underline outline-none ring-offset-background transition hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 truncate text-foreground">{m.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{m.total > 0 ? Math.round((100 * m.attention) / m.total) : 0}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <CityConcentrationBlock
        variant="analytics"
        rows={topCityRows}
        showAllHref={buildDealerBaseAllCitiesHref(profile.role, profile)}
        cityHref={(c) => buildDealerBaseCityDrillHref(profile.role, profile, c)}
        activeHref={(c) => buildDealerBaseCityDrillHref(profile.role, profile, c, { quick: "active" })}
        attentionHref={(c) => buildDealerBaseCityDrillHref(profile.role, profile, c, { quick: "attention" })}
      />
    </div>
  );
}
