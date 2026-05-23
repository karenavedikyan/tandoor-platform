import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { MainPlanExecutionChart } from "@/components/main-plan-execution-chart";
import { TeamSummaryCard } from "@/components/team-summary-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canAccessPath, salesControlHomeHref } from "@/lib/auth-access";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  dealerNeedsAttention,
  roleScopedDealerRows,
} from "@/lib/dealer-base-role-views";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { getAllMatrixTasks, getManagementFactualShowcaseTasksForDealers, getShowcaseBackedTasksForDealers } from "@/lib/trade-point-task-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { getShowcaseOnlyTasks } from "@/lib/task-classification";
import {
  getAllSalesManagers,
  getSalesUserById,
  getTeamManagers,
  type SalesRole,
} from "@/lib/sales-control-data";
import { currentMonthPeriodLabel, type PlanExecutionScope } from "@/lib/sales-manager-kpi-data";
import { buildTeamSummaries, buildTeamSummaryFromRows } from "@/lib/team-summary";

function countOpenTasksForDealers(
  dealerIds: Set<string>,
  opts: {
    mode: "all_matrix" | "showcase_backed" | "management_factual";
    dealersForTasks: DealerRow[];
    mergedState?: ActualizationState;
  },
): number {
  const pool =
    opts.mode === "management_factual" && opts.mergedState
      ? getManagementFactualShowcaseTasksForDealers(opts.dealersForTasks, opts.mergedState)
      : opts.mode === "showcase_backed"
        ? getShowcaseBackedTasksForDealers(opts.dealersForTasks)
        : getAllMatrixTasks();
  return getShowcaseOnlyTasks(pool).filter((t) => dealerIds.has(t.dealerId) && t.status !== "done").length;
}

type MainLink = { href: string; label: string; testId: string };

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

export function MainRoleDashboard() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const role = (user?.role ?? profile.role) as SalesRole;

  const baseRowsForDashboard = useMemo(() => {
    if (actx.enabled) {
      return buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, { includeArchivedDealers: false });
    }
    if (role === "team_lead" || role === "sales_director") return [];
    return DEALER_BASE_ROWS;
  }, [actx.enabled, managementPlane.mergedState, profile, role]);
  const scopedClients = useMemo(
    () => roleScopedDealerRows(baseRowsForDashboard, profile),
    [baseRowsForDashboard, profile],
  );
  const dealerIds = useMemo(() => new Set(scopedClients.map((r) => r.id)), [scopedClients]);
  const dashboardLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && managementPlane.teamFetchLoading);
  const workingBaseEmpty = !dashboardLoading && scopedClients.length === 0;

  const useMgmtFactualTasks = actx.enabled && shouldUseTeamMergedActualizationPlane(profile);

  const { totalClients, activeClients, attentionClients, openTasks, extraKpiLabel, extraKpiValue } = useMemo(() => {
    const total = scopedClients.length;
    const active = scopedClients.filter((r) => r.status === "активный").length;
    const attention = scopedClients.filter(dealerNeedsAttention).length;
    const tasks = countOpenTasksForDealers(dealerIds, {
      mode: useMgmtFactualTasks ? "management_factual" : actx.enabled ? "showcase_backed" : "all_matrix",
      dealersForTasks: actx.enabled ? scopedClients : DEALER_BASE_ROWS,
      mergedState: useMgmtFactualTasks ? managementPlane.mergedState : undefined,
    });
    if (role === "team_lead") {
      const tid = getEffectiveTeamLeadTeamId(profile);
      const mgrs = getTeamManagers(tid).length;
      return {
        totalClients: total,
        activeClients: active,
        attentionClients: attention,
        openTasks: tasks,
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
        extraKpiLabel: "Команд (РОПы)",
        extraKpiValue: String(teams),
      };
    }
    return {
      totalClients: total,
      activeClients: active,
      attentionClients: attention,
      openTasks: tasks,
      extraKpiLabel: null as string | null,
      extraKpiValue: null as string | null,
    };
  }, [scopedClients, dealerIds, role, profile, actx.enabled, useMgmtFactualTasks, managementPlane.mergedState]);

  const can = (path: string) => Boolean(user && canAccessPath(user.role, path));

  const planHref = salesControlHomeHref(role);

  const planExecutionScope: PlanExecutionScope =
    role === "sales_manager" ? "manager" : role === "team_lead" ? "team" : "all";

  const planExecutionManagerCount = useMemo(() => {
    if (role === "sales_manager") return 1;
    if (role === "team_lead") return getTeamManagers(getEffectiveTeamLeadTeamId(profile)).length || 1;
    return getAllSalesManagers().length || 1;
  }, [role, profile]);

  const planExecutionPeriodLabel = useMemo(() => currentMonthPeriodLabel(), []);

  const teamSummaries = useMemo(() => {
    if (!actx.enabled) return buildTeamSummaries(profile);
    if (role === "sales_director") {
      return getRopOptions().map((o) =>
        buildTeamSummaryFromRows(
          o.teamId,
          scopedClients.filter((r) => r.releaseTeamId === o.teamId),
        ),
      );
    }
    if (role === "team_lead") {
      const tid = getEffectiveTeamLeadTeamId(profile);
      return [buildTeamSummaryFromRows(tid, scopedClients.filter((r) => r.releaseTeamId === tid))];
    }
    return [];
  }, [actx.enabled, profile, role, scopedClients]);

  const kpiHrefs = useMemo(() => {
    const u = getSalesUserById(profile.personaUserId);
    if (role === "sales_manager") {
      const mid = u?.id ?? "";
      return {
        clients: buildBrowserHashAppHref("/dealer-base"),
        active: buildBrowserHashAppHref("/dealer-base", { quick: "active", view: "my_clients", manager: mid }),
        attention: buildBrowserHashAppHref("/dealer-base", { quick: "attention", view: "my_clients", manager: mid }),
        tasks: buildBrowserHashAppHref("/tasks"),
        extra: "",
      };
    }
    if (role === "team_lead") {
      const tid = getEffectiveTeamLeadTeamId(profile);
      return {
        clients: buildBrowserHashAppHref("/dealer-base", { view: "table_team", team: tid }),
        active: buildBrowserHashAppHref("/dealer-base", { quick: "active", view: "table_team", team: tid }),
        attention: buildBrowserHashAppHref("/dealer-base", { quick: "attention", view: "table_team", team: tid }),
        tasks: buildBrowserHashAppHref("/tasks"),
        extra: buildBrowserHashAppHref("/dealer-base", { view: "by_manager", team: tid }),
      };
    }
    if (role === "sales_director") {
      return {
        clients: buildBrowserHashAppHref("/dealer-base"),
        active: buildBrowserHashAppHref("/dealer-base", { quick: "active", view: "table_all" }),
        attention: buildBrowserHashAppHref("/dealer-base", { quick: "attention", view: "table_all" }),
        tasks: buildBrowserHashAppHref("/tasks"),
        extra: buildBrowserHashAppHref("/dealer-base", { view: "teams" }),
      };
    }
    return { clients: "/", active: "/", attention: "/", tasks: "/", extra: "" };
  }, [role, profile.personaUserId]);

  const links: MainLink[] = useMemo(() => {
    const out: MainLink[] = [];
    const push = (href: string, label: string, testId: string) => {
      if (can(href)) out.push({ href, label, testId });
    };

    if (role === "sales_manager") {
      push("/dealer-base", "Мои клиенты", "button-main-open-clients");
      push("/client-map", "Карта клиентов", "button-main-open-client-map");
      push("/tasks", "Задачи по витрине", "button-main-open-tasks");
      push("/catalog", "Каталог", "button-main-open-catalog");
      push("/training", "Обучение", "button-main-open-training");
      push(planHref, "План-факт", "button-main-open-sales-control");
      push("/marketing-briefs", "Брифы", "button-main-open-marketing-briefs");
      return out;
    }

    if (role === "team_lead") {
      push("/dealer-base", "Клиенты команды", "button-main-open-clients");
      push("/client-map", "Карта клиентов", "button-main-open-client-map");
      push("/tasks", "Задачи по витрине", "button-main-open-tasks");
      push(planHref, "План-факт команды", "button-main-open-sales-control");
      push("/sales-control/performance", "Выполнение", "button-main-open-sales-performance");
      push("/catalog", "Каталог", "button-main-open-catalog");
      push("/training", "Обучение", "button-main-open-training");
      push("/marketing-briefs", "Брифы", "button-main-open-marketing-briefs");
      if (can("/analytics-workspace")) {
        push("/analytics-workspace", "Аналитика команды", "button-main-open-analytics-workspace");
      }
      return out;
    }

    if (role === "sales_director") {
      push("/territory-card", "Территория", "button-main-open-territory");
      push("/dealer-base", "Клиентская база", "button-main-open-clients");
      push("/client-map", "Карта клиентов", "button-main-open-client-map");
      push("/tasks", "Задачи по витрине", "button-main-open-tasks");
      push("/sales-control/director", "План-факт продаж", "button-main-open-sales-control");
      push("/sales-control/performance", "Выполнение", "button-main-open-sales-performance");
      push("/catalog", "Каталог", "button-main-open-catalog");
      push("/training", "Обучение", "button-main-open-training");
      push("/marketing-briefs", "Брифы", "button-main-open-marketing-briefs");
      if (can("/analytics-workspace")) {
        push("/analytics-workspace", "Аналитика команды", "button-main-open-analytics-workspace");
      }
      return out;
    }

    return out;
  }, [role, user, planHref]);

  const headline =
    role === "sales_director"
      ? "Главная руководителя продаж"
      : "Главная";

  const subline =
    role === "sales_manager"
      ? "Рабочий стол менеджера: мои клиенты, задачи, обучение и план-факт."
      : role === "team_lead"
        ? "Рабочий стол РОПа: команда, клиенты, задачи и выполнение плана."
        : role === "sales_director"
          ? "Сводка по отделу продаж: команды, клиенты, задачи, план-факт."
          : "Главная страница платформы.";

  const contextLine =
    role === "sales_manager"
      ? `Показатели по вашим клиентам (${user?.name ?? "менеджер"}) и связанным задачам — те же данные, что в «Клиентской базе» и «Задачах».`
      : role === "team_lead"
        ? `Показатели по команде РОП (${user?.name ?? "РОП"}) — те же данные, что в «Клиентской базе» и «Задачах» с фильтром команды.${
            actx.enabled ? " Источник KPI: актуальная активная база (актуализация, без архива)." : ""
          }`
        : role === "sales_director"
          ? `Показатели по всей клиентской базе и задачам по витрине отдела продаж.${
              actx.enabled ? " Источник KPI: актуальная активная база (актуализация, без архива)." : ""
            }`
          : "";

  const kpiClientsLabel =
    role === "sales_manager"
      ? "Мои клиенты"
      : role === "team_lead"
        ? "Клиентов команды"
        : "Всего клиентов";

  const kpiTasksLabel =
    role === "sales_manager"
      ? "Открытые задачи по витрине"
      : role === "team_lead"
        ? "Открытые задачи по витрине (команда)"
        : "Витрины (открытые)";

  if (role !== "sales_manager" && role !== "team_lead" && role !== "sales_director") {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden space-y-4" data-testid="page-main">
        <p className="text-sm text-muted-foreground">Раздел «Главная» для вашей роли не настроен. Используйте меню слева.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6 pb-10 sm:space-y-8" data-testid="page-main">
      <section className="space-y-4" data-testid="section-main-role-dashboard">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{headline}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">{subline}</p>
          {contextLine ? (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground" data-testid="text-main-role-context">
              {contextLine}
            </p>
          ) : null}
        </div>

        <div
          className={
            extraKpiLabel
              ? "grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
              : "grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          }
        >
          <MainKpiLink href={kpiHrefs.clients} testId="link-main-kpi-clients">
            <Card className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm" data-testid="card-main-kpi-clients">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiClientsLabel}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.active} testId="link-main-kpi-active">
            <Card className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm" data-testid="card-main-kpi-active">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Активные клиенты</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{activeClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.attention} testId="link-main-kpi-attention">
            <Card className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm" data-testid="card-main-kpi-attention">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Требуют внимания</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{attentionClients}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
          <MainKpiLink href={kpiHrefs.tasks} testId="link-main-kpi-tasks">
            <div {...(useMgmtFactualTasks ? { "data-testid": "section-management-task-summary" } : {})} className="block min-w-0">
              <Card className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm" data-testid="card-main-kpi-tasks">
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiTasksLabel}</p>
                  <p
                    className="mt-1 text-2xl font-semibold tabular-nums text-foreground"
                    {...(useMgmtFactualTasks ? { "data-testid": "metric-management-tasks-open" } : {})}
                  >
                    {openTasks}
                  </p>
                  {useMgmtFactualTasks && openTasks === 0 ? (
                    <p className="mt-2 text-[10px] leading-tight text-muted-foreground" data-testid="text-management-task-empty">
                      Фактических задач нет. Учитываются только сохранённые задачи актуализации; локальные черновики не входят в сводку.
                    </p>
                  ) : null}
                  {useMgmtFactualTasks ? (
                    <p className="mt-2 text-[10px] leading-tight text-muted-foreground" data-testid="text-management-task-source-note">
                      Источник: сохранённые задачи актуализации
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </MainKpiLink>
          {extraKpiLabel && extraKpiValue && kpiHrefs.extra ? (
            <MainKpiLink href={kpiHrefs.extra} testId="link-main-kpi-extra">
              <Card
                className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm sm:col-span-1"
                data-testid={role === "team_lead" ? "card-main-kpi-managers" : "card-main-kpi-teams"}
              >
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{extraKpiLabel}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{extraKpiValue}</p>
                </CardContent>
              </Card>
            </MainKpiLink>
          ) : null}
        </div>

        {workingBaseEmpty ? (
          <Card
            className="rounded-xl border border-dashed border-border/80 bg-card"
            data-testid="card-main-empty-working-base"
          >
            <CardContent className="space-y-1 p-4">
              <p className="text-sm font-semibold text-foreground">
                Рабочая база пуста после актуализации.
              </p>
              <p className="text-sm text-muted-foreground">
                План-факт и сводки скрыты до появления реальных клиентов. Создайте клиента вручную
                или верните клиента из архива в «Клиентской базе».
              </p>
            </CardContent>
          </Card>
        ) : actx.enabled && (role === "team_lead" || role === "sales_director") ? (
          <Card
            className="rounded-xl border border-dashed border-border/80 bg-muted/10"
            data-testid="card-main-plan-placeholder-management"
          >
            <CardContent className="space-y-1 p-4">
              <p className="text-sm font-semibold text-foreground">План-факт в этом блоке не подключён</p>
              <p className="text-sm text-muted-foreground">
                Показатели выполнения плана здесь были демонстрационными. Используйте раздел «План-факт продаж»; KPI клиентской базы
                выше — из актуальной активной базы.
              </p>
            </CardContent>
          </Card>
        ) : (
          <MainPlanExecutionChart
            scope={planExecutionScope}
            managerCount={planExecutionManagerCount}
            periodLabel={planExecutionPeriodLabel}
          />
        )}

        <div className="flex min-w-0 flex-wrap gap-2">
          {links.map((l) => (
            <MainLinkButton key={l.href + l.label} {...l} />
          ))}
        </div>
      </section>

      {(role === "sales_director" || role === "team_lead") && teamSummaries.length > 0 && !workingBaseEmpty ? (
        <section className="space-y-3 border-t border-border pt-6" data-testid="section-main-team-summaries">
          <h2 className="text-lg font-semibold text-foreground">
            {role === "sales_director" ? "Команды РОПов" : "Моя команда"}
          </h2>
          <div
            className={
              role === "sales_director"
                ? "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                : "grid min-w-0 grid-cols-1 gap-4"
            }
          >
            {teamSummaries.map((s) => (
              <TeamSummaryCard
                key={s.teamId}
                summary={s}
                variant="full"
                showTeamMetricLinks={role === "sales_director" || role === "team_lead"}
                footnote={
                  actx.enabled && (role === "sales_director" || role === "team_lead")
                    ? "Показаны только активные клиенты и точки команды (архив не учитывается)."
                    : undefined
                }
                ctaHref={
                  role === "sales_director"
                    ? buildBrowserHashAppHref("/dealer-base", { team: s.teamId })
                    : buildBrowserHashAppHref("/dealer-base", { team: s.teamId, view: "table_team" })
                }
                ctaLabel={role === "sales_director" ? "Открыть команду" : "К клиентам команды"}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
