import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { TeamSummaryCard } from "@/components/team-summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useSalesControlStoredState } from "@/hooks/use-sales-control-stored-state";
import { canAccessPath, salesControlHomeHref } from "@/lib/auth-access";
import { isClientTopTier } from "@/lib/client-category";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { dealerNeedsAttention, roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { buildHashPath } from "@/lib/hash-route-utils";
import { getEffectiveSalesManagerId, getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import { getRopOptions } from "@/lib/rop-manager-filters";
import {
  formatRub,
  formatSalesMetricValue,
  getDefaultSalesPeriodId,
  getManagerPlanPublishStatus,
  getPublishedDirectorTeamPlan,
  getTeamDistributionSummary,
  getTeamPlanPublicationStatus,
  hasPublishedDirectorTeamPlan,
  managerKpiProgressTone,
  rollupManager,
  type ManagerPlanPublishStatus,
  type SalesControlStoredState,
  type TeamPlanDirectorStatus,
  getTeamManagers,
  getSalesUserById,
  type SalesRole,
} from "@/lib/sales-control-data";
import { matrixTaskContextHref } from "@/lib/sales-manager-workspace-data";
import { filterTasksByPreset, taskMatchesPreset } from "@/lib/task-presets";
import { aggregateManagersForTeam, buildTeamSummaries, getAttentionLevel, getLoadLevel, type TeamSummary } from "@/lib/team-summary";
import { getAllMatrixTasks, type MatrixTaskWithContext } from "@/lib/trade-point-task-data";
import { cn } from "@/lib/utils";

type MainLink = { href: string; label: string; testId: string };

function countOpenTasksForDealers(dealerIds: Set<string>, tasks: MatrixTaskWithContext[]): number {
  return tasks.filter((t) => dealerIds.has(t.dealerId) && t.status !== "done").length;
}

function dealerSetForManager(teamId: string, managerId: string, managerName: string): Set<string> {
  const s = new Set<string>();
  for (const r of DEALER_BASE_ROWS) {
    if (r.releaseTeamId !== teamId) continue;
    if (r.releaseManagerId === managerId || managerDisplayMatchesCatalogName(r.manager, managerName)) s.add(r.id);
  }
  return s;
}

function directorPlanStatusRu(s: TeamPlanDirectorStatus): { label: string; className: string } {
  if (s === "published_to_rop") return { label: "Выгружено РОПу", className: "border-emerald-300 bg-emerald-50 text-emerald-950" };
  if (s === "changed_after_publish") return { label: "Изменено после выгрузки", className: "border-amber-300 bg-amber-50 text-amber-950" };
  return { label: "Не выгружено РОПу", className: "border-border bg-muted text-muted-foreground" };
}

function managerPlanStatusRu(s: ManagerPlanPublishStatus): { label: string; className: string } {
  if (s === "published") return { label: "Выгружено менеджеру", className: "border-emerald-300 bg-emerald-50 text-emerald-950" };
  if (s === "changed_after_publish") return { label: "Изменено после выгрузки", className: "border-amber-300 bg-amber-50 text-amber-950" };
  return { label: "Черновик", className: "border-border bg-muted text-muted-foreground" };
}

function progressBarClass(tone: ReturnType<typeof managerKpiProgressTone>): string {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "yellow") return "bg-amber-400";
  return "bg-red-500";
}

function MainKpiLink({ href, testId, children }: { href: string; testId: string; children: ReactNode }) {
  return (
    <a
      href={href}
      data-testid={testId}
      className="block min-w-0 rounded-xl no-underline outline-none ring-offset-background transition hover:opacity-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </a>
  );
}

function MainLinkButton({ href, label, testId }: MainLink) {
  return (
    <Button asChild variant="secondary" className="min-h-10 min-w-0 shrink font-semibold" data-testid={testId}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

function teamFocusScore(
  summary: TeamSummary,
  periodId: string,
  teamId: string,
  stored: SalesControlStoredState,
): number {
  let score = 0;
  const att = getAttentionLevel(summary.pctAttention);
  if (att === "critical") score += 4;
  else if (att === "warning") score += 2;
  const load = getLoadLevel(summary.avgClientsPerManager);
  if (load !== "ok") score += 2;
  const dist = getTeamDistributionSummary(periodId, teamId, stored);
  if (dist) {
    const bad = dist.rows.filter((r) => r.tone !== "green").length + (dist.gross.tone !== "green" ? 1 : 0);
    if (bad > 0) score += 3;
  } else if (!hasPublishedDirectorTeamPlan(periodId, teamId, stored)) {
    score += 1;
  }
  return score;
}

export function MainRoleDashboard() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const [stored] = useSalesControlStoredState();
  const role = (user?.role ?? profile.role) as SalesRole;
  const periodId = useMemo(() => getDefaultSalesPeriodId(), []);

  const scopedClients = useMemo(() => roleScopedDealerRows(DEALER_BASE_ROWS, profile), [profile]);
  const dealerIds = useMemo(() => new Set(scopedClients.map((r) => r.id)), [scopedClients]);

  const allTasks = useMemo(() => getAllMatrixTasks(), []);
  const presetClock = useMemo(() => new Date(), []);

  const scopedTaskPool = useMemo(() => {
    return allTasks.filter((t) => dealerIds.has(t.dealerId));
  }, [allTasks, dealerIds]);

  const can = (path: string) => Boolean(user && canAccessPath(user.role, path));

  const planHref = salesControlHomeHref(role);

  const teamSummaries = useMemo(() => buildTeamSummaries(profile), [profile]);

  const { totalClients, activeClients, attentionClients, openTasks, extraKpiLabel, extraKpiValue, potentialClients, topClients } =
    useMemo(() => {
      const total = scopedClients.length;
      const active = scopedClients.filter((r) => r.status === "активный").length;
      const attention = scopedClients.filter(dealerNeedsAttention).length;
      const potential = scopedClients.filter((r) => r.status === "потенциальный").length;
      const top = scopedClients.filter((r) => isClientTopTier(r.clientCategory)).length;
      const tasks = countOpenTasksForDealers(dealerIds, allTasks);
      if (role === "team_lead") {
        const tid = getEffectiveTeamLeadTeamId(profile);
        const mgrs = getTeamManagers(tid).length;
        return {
          totalClients: total,
          activeClients: active,
          attentionClients: attention,
          openTasks: tasks,
          potentialClients: potential,
          topClients: top,
          extraKpiLabel: "Менеджеров в команде",
          extraKpiValue: String(mgrs),
        };
      }
      if (role === "sales_director") {
        const teams = getRopOptions().length;
        return {
          totalClients: total,
          activeClients: active,
          attentionClients: attention,
          openTasks: tasks,
          potentialClients: potential,
          topClients: top,
          extraKpiLabel: "Команд (РОПы)",
          extraKpiValue: String(teams),
        };
      }
      return {
        totalClients: total,
        activeClients: active,
        attentionClients: attention,
        openTasks: tasks,
        potentialClients: potential,
        topClients: top,
        extraKpiLabel: null as string | null,
        extraKpiValue: null as string | null,
      };
    }, [scopedClients, dealerIds, allTasks, role, profile]);

  const kpiHrefs = useMemo(() => {
    const u = getSalesUserById(profile.personaUserId);
    if (role === "sales_manager") {
      const mid = u?.id ?? "";
      return {
        clients: buildHashPath("/dealer-base"),
        active: buildHashPath("/dealer-base", { quick: "active", view: "my_clients", manager: mid }),
        attention: buildHashPath("/dealer-base", { quick: "attention", view: "my_clients", manager: mid }),
        potential: buildHashPath("/dealer-base", { quick: "potential", view: "my_clients", manager: mid }),
        top: buildHashPath("/dealer-base", { quick: "top", view: "my_clients", manager: mid }),
        tasks: buildHashPath("/tasks", { preset: "all" }),
        extra: "",
      };
    }
    if (role === "team_lead") {
      const tid = getEffectiveTeamLeadTeamId(profile);
      return {
        clients: buildHashPath("/dealer-base", { view: "table_team", team: tid }),
        active: buildHashPath("/dealer-base", { quick: "active", view: "table_team", team: tid }),
        attention: buildHashPath("/dealer-base", { quick: "attention", view: "table_team", team: tid }),
        potential: buildHashPath("/dealer-base", { quick: "potential", view: "table_team", team: tid }),
        top: buildHashPath("/dealer-base", { quick: "top", view: "table_team", team: tid }),
        tasks: buildHashPath("/tasks", { preset: "all" }),
        extra: buildHashPath("/dealer-base", { view: "by_manager", team: tid }),
      };
    }
    if (role === "sales_director") {
      return {
        clients: buildHashPath("/dealer-base"),
        active: buildHashPath("/dealer-base", { quick: "active", view: "table_all" }),
        attention: buildHashPath("/dealer-base", { quick: "attention", view: "table_all" }),
        potential: buildHashPath("/dealer-base", { quick: "potential", view: "table_all" }),
        top: buildHashPath("/dealer-base", { quick: "top", view: "table_all" }),
        tasks: buildHashPath("/tasks", { preset: "all" }),
        extra: buildHashPath("/dealer-base", { view: "teams" }),
      };
    }
    return { clients: "/", active: "/", attention: "/", potential: "/", top: "/", tasks: "/", extra: "" };
  }, [role, profile.personaUserId]);

  const urgentTasksScoped = useMemo(
    () => filterTasksByPreset(scopedTaskPool, "urgent", presetClock).slice(0, 8),
    [scopedTaskPool, presetClock],
  );

  const urgentCount = useMemo(
    () => scopedTaskPool.filter((t) => taskMatchesPreset(t, "urgent", undefined, presetClock)).length,
    [scopedTaskPool, presetClock],
  );

  const ropTeamId = role === "team_lead" ? getEffectiveTeamLeadTeamId(profile) : "";

  const managerIdForPlan = useMemo(() => {
    if (role !== "sales_manager") return "";
    return getEffectiveSalesManagerId(profile);
  }, [role, profile]);

  const rollupPublishedManager = useMemo(() => {
    if (role !== "sales_manager" || !managerIdForPlan) return null;
    return rollupManager(managerIdForPlan, periodId, stored, "published");
  }, [role, managerIdForPlan, periodId, stored]);

  const directorFocusTeams = useMemo(() => {
    if (role !== "sales_director") return [];
    const opts = getRopOptions();
    const scored = opts
      .map((o) => {
        const summary = teamSummaries.find((s) => s.teamId === o.teamId);
        if (!summary) return null;
        return { teamId: o.teamId, label: o.label, summary, score: teamFocusScore(summary, periodId, o.teamId, stored) };
      })
      .filter(Boolean) as { teamId: string; label: string; summary: TeamSummary; score: number }[];
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((x) => x.score > 0).slice(0, 4);
  }, [role, teamSummaries, periodId, stored]);

  const riskClientsDirector = useMemo(() => {
    if (role !== "sales_director") return [];
    const ranked = [...scopedClients].sort((a, b) => {
      const sa = dealerNeedsAttention(a) ? 2 : a.hasProblem ? 1 : 0;
      const sb = dealerNeedsAttention(b) ? 2 : b.hasProblem ? 1 : 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name, "ru");
    });
    return ranked.filter((d) => dealerNeedsAttention(d) || d.hasProblem).slice(0, 8);
  }, [role, scopedClients]);

  const managerRiskClients = useMemo(() => {
    if (role !== "sales_manager") return { attention: [] as DealerRow[], inactive: [] as DealerRow[] };
    const att = scopedClients.filter((d) => dealerNeedsAttention(d)).slice(0, 6);
    const ina = scopedClients.filter((d) => !d.hasRecentActivity && !dealerNeedsAttention(d)).slice(0, 6);
    return { attention: att, inactive: ina };
  }, [role, scopedClients]);

  const ropFocusClients = useMemo(() => {
    if (role !== "team_lead") return [];
    return scopedClients
      .filter((d) => dealerNeedsAttention(d) || !d.hasRecentActivity)
      .slice(0, 8);
  }, [role, scopedClients]);

  const ropManagerRows = useMemo(() => {
    if (role !== "team_lead") return [];
    const tid = ropTeamId;
    const mgrs = getTeamManagers(tid);
    const aggs = aggregateManagersForTeam(tid);
    return mgrs.map((m) => {
      const agg = aggs.find((a) => a.id === m.id) ?? { id: m.id, name: m.name, total: 0, active: 0, attention: 0 };
      const dset = dealerSetForManager(tid, m.id, m.name);
      const taskOpen = countOpenTasksForDealers(dset, allTasks);
      const st = getManagerPlanPublishStatus(periodId, m.id, stored);
      return { ...agg, taskOpen, planStatus: st };
    });
  }, [role, ropTeamId, periodId, stored, allTasks]);

  const links: MainLink[] = useMemo(() => {
    const out: MainLink[] = [];
    const push = (path: string, label: string, testId: string) => {
      if (can(path)) out.push({ href: path, label, testId });
    };

    if (role === "sales_manager") {
      push("/dealer-base", "Мои клиенты", "link-main-role-action-clients");
      push("/tasks", "Мои задачи", "link-main-role-action-tasks");
      push(planHref, "План-факт", "link-main-role-action-plans");
      push("/catalog", "Каталог", "link-main-role-action-catalog");
      push("/training", "Обучение", "link-main-role-action-training");
      push("/marketing-briefs", "Брифы", "link-main-role-action-briefs");
      return out;
    }

    if (role === "team_lead") {
      const tid = getEffectiveTeamLeadTeamId(profile);
      push("/dealer-base", "Клиенты команды", "link-main-role-action-clients");
      push(buildHashPath("/tasks", { team: tid }), "Задачи команды", "link-main-role-action-tasks");
      push(planHref, "План-факт", "link-main-role-action-plans");
      push("/client-map", "Карта клиентов", "link-main-role-action-map");
      push("/analytics-workspace", "Аналитика команды", "link-main-role-action-analytics");
      return out;
    }

    if (role === "sales_director") {
      push("/territory-card", "Карточка территории", "link-main-role-action-territory");
      push("/dealer-base", "Клиентская база", "link-main-role-action-clients");
      push("/tasks", "Задачи отдела", "link-main-role-action-tasks");
      push(planHref, "План-факт продаж", "link-main-role-action-plans");
      return out;
    }

    return out;
  }, [role, user, planHref, profile]);

  const headline =
    role === "sales_director"
      ? "Главная: отдел продаж"
      : role === "team_lead"
        ? "Главная: команда"
        : role === "sales_manager"
          ? "Главная: моя работа"
          : "Главная";

  const subline =
    role === "sales_manager"
      ? "План, задачи и клиенты в одном экране — дальше по ссылкам в детальные разделы."
      : role === "team_lead"
        ? "План директора, распределение по менеджерам и оперативные сигналы по команде."
        : role === "sales_director"
          ? "Сводка по отделу: планы команд, риски и горящие задачи."
          : "Главная страница платформы.";

  const kpiClientsLabel =
    role === "sales_manager"
      ? "Мои клиенты"
      : role === "team_lead"
        ? "Клиентов команды"
        : "Всего клиентов";

  const kpiTasksLabel =
    role === "sales_manager"
      ? "Открытые задачи"
      : role === "team_lead"
        ? "Открытые задачи команды"
        : "Открытые задачи";

  if (role !== "sales_manager" && role !== "team_lead" && role !== "sales_director") {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden space-y-4" data-testid="page-main-role-dashboard">
        <p className="text-sm text-muted-foreground">Раздел «Главная» для вашей роли не настроен. Используйте меню слева.</p>
      </div>
    );
  }

  const tasksUrgentHref =
    role === "team_lead"
      ? buildHashPath("/tasks", { preset: "urgent", team: ropTeamId })
      : role === "sales_manager"
        ? buildHashPath("/tasks", {
            preset: "urgent",
            manager: getSalesUserById(profile.personaUserId)?.id ?? "",
          })
        : buildHashPath("/tasks", { preset: "urgent" });

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-10 sm:space-y-8" data-testid="page-main-role-dashboard">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{headline}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{subline}</p>
      </header>

      <section className="space-y-3" data-testid="section-main-role-kpis">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ключевые показатели</h2>
        <div
          className={cn(
            "grid min-w-0 gap-3",
            role === "sales_manager"
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              : extraKpiLabel
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          <MainKpiLink href={kpiHrefs.clients} testId="link-main-role-kpi-clients">
            <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-clients">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiClientsLabel}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.active} testId="link-main-role-kpi-active">
            <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-active">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Активные</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{activeClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.attention} testId="link-main-role-kpi-attention">
            <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-attention">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Внимание</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{attentionClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.tasks} testId="link-main-role-kpi-tasks-open">
            <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-tasks-open">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiTasksLabel}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{openTasks}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          {role === "sales_manager" ? (
            <>
              <MainKpiLink href={kpiHrefs.potential} testId="link-main-role-kpi-potential">
                <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-potential">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Потенциальные</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{potentialClients}</p>
                  </CardContent>
                </Card>
              </MainKpiLink>
              <MainKpiLink href={kpiHrefs.top} testId="link-main-role-kpi-top">
                <Card className="min-w-0 rounded-xl border border-border/80 shadow-sm" data-testid="card-main-role-kpi-top">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ТОП-сегмент</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{topClients}</p>
                  </CardContent>
                </Card>
              </MainKpiLink>
            </>
          ) : null}
          {extraKpiLabel && extraKpiValue && kpiHrefs.extra ? (
            <MainKpiLink href={kpiHrefs.extra} testId="link-main-role-kpi-extra">
              <Card
                className="min-w-0 rounded-xl border border-border/80 shadow-sm sm:col-span-1"
                data-testid={role === "team_lead" ? "card-main-role-kpi-managers" : "card-main-role-kpi-teams"}
              >
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{extraKpiLabel}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{extraKpiValue}</p>
                </CardContent>
              </Card>
            </MainKpiLink>
          ) : null}
        </div>
      </section>

      {role === "sales_director" ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-plan">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Планы РОПов</h2>
            {can("/sales-control/director") ? (
              <Link
                href="/sales-control/director"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                data-testid="link-main-role-plan-director-hub"
              >
                Управление планами
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Статус выгрузки командного плана руководителем продаж (период: текущий контурный месяц в план-факте).
          </p>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {getRopOptions().map((o) => {
              const st = getTeamPlanPublicationStatus(periodId, o.teamId, stored);
              const meta = directorPlanStatusRu(st);
              return (
                <Card
                  key={o.teamId}
                  className="min-w-0 rounded-xl border border-border/80"
                  data-testid={`card-main-role-team-plan-${o.teamId}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{o.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("text-xs font-medium", meta.className)}>
                      {meta.label}
                    </Badge>
                    {can("/sales-control/director") ? (
                      <Link
                        href={buildHashPath("/sales-control/director", { team: o.teamId })}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                        data-testid={`link-main-role-plan-team-${o.teamId}`}
                      >
                        Открыть план команды
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {role === "team_lead" ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-plan">
          <h2 className="text-lg font-semibold text-foreground">План команды от руководителя продаж</h2>
          {(() => {
            const pub = getPublishedDirectorTeamPlan(periodId, ropTeamId, stored);
            if (!pub) {
              return (
                <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                  План команды ещё не выгружен руководителем продаж. Когда документ появится, здесь отобразятся цели и
                  комментарий.
                </p>
              );
            }
            const dist = getTeamDistributionSummary(periodId, ropTeamId, stored);
            return (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Выгружено:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(pub.publishedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </p>
                {pub.directorComment ? (
                  <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{pub.directorComment}</p>
                ) : null}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Сверка с черновиками менеджеров</h3>
                  {!dist ? (
                    <p className="mt-1 text-sm text-muted-foreground">Нет данных для сверки.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {dist.rows.slice(0, 4).map((r) => (
                        <li
                          key={r.metricId}
                          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 font-medium text-foreground">{r.metricLabel}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-xs",
                              r.tone === "green" && "border-emerald-300 bg-emerald-50 text-emerald-950",
                              r.tone === "yellow" && "border-amber-300 bg-amber-50 text-amber-950",
                              r.tone === "red" && "border-red-300 bg-red-50 text-red-950",
                            )}
                          >
                            {r.summaryLabel}
                          </Badge>
                        </li>
                      ))}
                      <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{dist.gross.metricLabel}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            dist.gross.tone === "green" && "border-emerald-300 bg-emerald-50 text-emerald-950",
                            dist.gross.tone === "yellow" && "border-amber-300 bg-amber-50 text-amber-950",
                            dist.gross.tone === "red" && "border-red-300 bg-red-50 text-red-950",
                          )}
                        >
                          {dist.gross.summaryLabel}
                        </Badge>
                      </li>
                    </ul>
                  )}
                </div>
                {can(planHref) ? (
                  <Button asChild variant="outline" className="w-full sm:w-auto" data-testid="link-main-role-plan-team-lead-hub">
                    <Link href={planHref}>Открыть план-факт команды</Link>
                  </Button>
                ) : null}
                {ropManagerRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Менеджер</th>
                          <th className="px-3 py-2 tabular-nums">Клиенты</th>
                          <th className="px-3 py-2 tabular-nums">Активн.</th>
                          <th className="px-3 py-2 tabular-nums">Внимание</th>
                          <th className="px-3 py-2 tabular-nums">Задачи</th>
                          <th className="px-3 py-2">План</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ropManagerRows.map((row) => {
                          const st = managerPlanStatusRu(row.planStatus);
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-border/50 last:border-0"
                              data-testid={`card-main-role-manager-${row.id}`}
                            >
                              <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                              <td className="px-3 py-2 tabular-nums">{row.total}</td>
                              <td className="px-3 py-2 tabular-nums">{row.active}</td>
                              <td className="px-3 py-2 tabular-nums">{row.attention}</td>
                              <td className="px-3 py-2 tabular-nums">{row.taskOpen}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className={cn("text-[10px]", st.className)}>
                                  {st.label}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </section>
      ) : null}

      {role === "sales_manager" ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-plan">
          <h2 className="text-lg font-semibold text-foreground">Мой план от РОПа</h2>
          {rollupPublishedManager ? (
            <>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {rollupPublishedManager.metrics.map(({ metric, target, actual, pct }) => {
                  const tone = managerKpiProgressTone(pct);
                  const barW = Math.min(100, Math.max(0, pct));
                  return (
                    <Card
                      key={metric.id}
                      className="min-w-0 rounded-xl border border-border/80"
                      data-testid={`card-main-role-kpi-progress-${metric.id}`}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{metric.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                          <span>План</span>
                          <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, target)}</span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                          <span>Факт</span>
                          <span className="font-semibold text-foreground">{formatSalesMetricValue(metric, actual)}</span>
                        </div>
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
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-2 rounded-full", progressBarClass(tone))} style={{ width: `${barW}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(() => {
                  const g = rollupPublishedManager.gross;
                  const tone = managerKpiProgressTone(g.pct);
                  const barW = Math.min(100, Math.max(0, g.pct));
                  return (
                    <Card className="min-w-0 rounded-xl border border-border/80" data-testid="card-main-role-kpi-progress-gross-profit">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Валовая прибыль</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                          <span>План</span>
                          <span className="font-semibold text-foreground">{formatRub(g.target)}</span>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                          <span>Факт</span>
                          <span className="font-semibold text-foreground">{formatRub(g.actual)}</span>
                        </div>
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
                            {g.pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-2 rounded-full", progressBarClass(tone))} style={{ width: `${barW}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
              {can(planHref) ? (
                <Button asChild variant="outline" data-testid="link-main-role-plan-manager-hub">
                  <Link href={planHref}>Детали план-факта</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                План ещё не выгружен руководителем команды. После публикации здесь появятся цели и прогресс по KPI.
              </p>
              {can(planHref) ? (
                <Button asChild variant="outline" data-testid="link-main-role-plan-manager-hub">
                  <Link href={planHref}>Открыть план-факт</Link>
                </Button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {role === "sales_director" ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-focus">
          <h2 className="text-lg font-semibold text-foreground">Команды в фокусе</h2>
          <p className="text-sm text-muted-foreground">
            Команды с повышенной долей внимания, нестандартной нагрузкой или несбалансированным распределением плана.
          </p>
          {directorFocusTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">По текущим порогам все команды без повышенного приоритета.</p>
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {directorFocusTeams.map(({ teamId, label, summary }) => {
                const att = getAttentionLevel(summary.pctAttention);
                const load = getLoadLevel(summary.avgClientsPerManager);
                return (
                  <Card key={teamId} className="min-w-0 rounded-xl border border-border/80" data-testid={`card-main-role-team-focus-${teamId}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Внимание: <span className="font-semibold text-foreground">{summary.pctAttention}%</span>{" "}
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {att === "critical" ? "критично" : att === "warning" ? "на контроле" : "норма"}
                        </Badge>
                      </p>
                      <p>
                        Нагрузка:{" "}
                        <span className="font-semibold text-foreground">
                          {load === "overload" ? "перегруз" : load === "underload" ? "недогруз" : "в норме"}
                        </span>{" "}
                        ({summary.avgClientsPerManager} кл./менедж.)
                      </p>
                      {can("/dealer-base") ? (
                        <Link
                          href={buildHashPath("/dealer-base", { team: teamId, quick: "attention" })}
                          className="inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                          data-testid={`link-main-role-focus-team-${teamId}`}
                        >
                          Клиенты команды
                        </Link>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {role === "team_lead" && teamSummaries[0] ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-focus">
          <h2 className="text-lg font-semibold text-foreground">Сводка команды</h2>
          <div data-testid={`card-main-role-team-${ropTeamId}`}>
            <TeamSummaryCard
              summary={teamSummaries[0]}
              variant="full"
              showTeamMetricLinks
              ctaHref={buildHashPath("/dealer-base", { team: ropTeamId, view: "table_team" })}
              ctaLabel="К клиентам команды"
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-tasks">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {role === "sales_manager" ? "Мои горящие задачи" : role === "team_lead" ? "Горящие задачи команды" : "Горящие задачи отдела"}
          </h2>
          {can("/tasks") ? (
            <Link href={tasksUrgentHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="link-main-role-tasks-urgent-all">
              Все горящие ({urgentCount})
            </Link>
          ) : null}
        </div>
        {urgentTasksScoped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет задач, попадающих в пресет «Горящие».</p>
        ) : (
          <ul className="space-y-2">
            {urgentTasksScoped.map((t) => (
              <li key={t.taskId} className="rounded-lg border border-border/70 bg-card px-3 py-2">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.dueDate} · {t.priority === "high" ? "высокий приоритет" : t.priority}
                    </p>
                  </div>
                  {can(matrixTaskContextHref(t)) ? (
                    <Link
                      href={matrixTaskContextHref(t)}
                      className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      data-testid={`link-main-role-task-${t.taskId}`}
                    >
                      Контекст
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-clients">
        <h2 className="text-lg font-semibold text-foreground">
          {role === "sales_director" ? "Клиенты в зоне риска" : role === "team_lead" ? "Клиенты команды в фокусе" : "Клиенты: внимание и без активности"}
        </h2>
        {role === "sales_director" ? (
          riskClientsDirector.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет клиентов с повышенным сигналом по текущим фильтрам доступа.</p>
          ) : (
            <ul className="space-y-2">
              {riskClientsDirector.map((d) => (
                <li key={d.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.city} · {d.manager}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {can(`/dealers/${d.id}`) ? (
                      <Link href={`/dealers/${d.id}`} className="text-xs font-medium text-primary hover:underline" data-testid={`link-main-role-dealer-${d.id}`}>
                        Карточка
                      </Link>
                    ) : null}
                    {can("/dealer-base") ? (
                      <Link
                        href={buildHashPath("/dealer-base", { search: d.name, city: d.city })}
                        className="text-xs font-medium text-primary hover:underline"
                        data-testid={`link-main-role-dealer-base-${d.id}`}
                      >
                        В базе
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {role === "team_lead" ? (
          ropFocusClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет клиентов с повышенным сигналом или без недавней активности.</p>
          ) : (
            <ul className="space-y-2">
              {ropFocusClients.map((d) => (
                <li key={d.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{dealerNeedsAttention(d) ? "Требует внимания" : "Без недавней активности"}</p>
                  </div>
                  {can(`/dealers/${d.id}`) ? (
                    <Link href={`/dealers/${d.id}`} className="shrink-0 text-xs font-medium text-primary hover:underline" data-testid={`link-main-role-dealer-${d.id}`}>
                      Карточка
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}

        {role === "sales_manager" ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Требуют внимания</h3>
              {managerRiskClients.attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет таких клиентов.</p>
              ) : (
                <ul className="space-y-2">
                  {managerRiskClients.attention.map((d) => (
                    <li key={d.id} className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2">
                      <p className="truncate font-medium text-foreground">{d.name}</p>
                      {can(`/dealers/${d.id}`) ? (
                        <Link href={`/dealers/${d.id}`} className="text-xs font-medium text-primary hover:underline" data-testid={`link-main-role-dealer-${d.id}`}>
                          Карточка
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Без активности</h3>
              {managerRiskClients.inactive.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет таких клиентов.</p>
              ) : (
                <ul className="space-y-2">
                  {managerRiskClients.inactive.map((d) => (
                    <li key={d.id} className="rounded-lg border border-border/70 px-3 py-2">
                      <p className="truncate font-medium text-foreground">{d.name}</p>
                      {can(`/dealers/${d.id}`) ? (
                        <Link href={`/dealers/${d.id}`} className="text-xs font-medium text-primary hover:underline" data-testid={`link-main-role-dealer-${d.id}`}>
                          Карточка
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {role === "sales_director" && teamSummaries.length > 0 ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-teams-overview">
          <h2 className="text-lg font-semibold text-foreground">Команды РОПов</h2>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamSummaries.map((s) => (
              <div key={s.teamId} data-testid={`card-main-role-team-${s.teamId}`}>
                <TeamSummaryCard
                  summary={s}
                  variant="full"
                  showTeamMetricLinks
                  ctaHref={buildHashPath("/dealer-base", { team: s.teamId })}
                  ctaLabel="К клиентам команды"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-role-actions">
        <h2 className="text-lg font-semibold text-foreground">Быстрые действия</h2>
        {role === "sales_director" ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {can("/client-map") ? (
              <Card className="rounded-xl border border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Карта клиентов</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href="/client-map" className="text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="link-main-role-client-map">
                    Открыть карту
                  </Link>
                </CardContent>
              </Card>
            ) : null}
            {can("/analytics-workspace") ? (
              <Card className="rounded-xl border border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Аналитика</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/analytics-workspace"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    data-testid="link-main-role-analytics"
                  >
                    Открыть аналитику
                  </Link>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          {links.map((l) => (
            <MainLinkButton key={l.href + l.label} {...l} />
          ))}
        </div>
      </section>
    </div>
  );
}
