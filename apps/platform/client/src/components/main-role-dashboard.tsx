import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Home } from "lucide-react";
import { ActualizationRace } from "@/components/home/actualization-race";
import { PlanFactSummary } from "@/components/home/plan-fact-summary";
import { PageHeader, DataFreshness } from "@/components/ui-platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import { canAccessPath, salesControlHomeHref } from "@/lib/auth-access";
import { userRoleToSalesRole } from "@/lib/role-mapping";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import {
  realEffectiveTeamLeadTeamIdFromSnap,
  realRowsForManagerByUUID,
  realRowsForRopTeam,
  roleScopedDealerRowsForReal,
  teamUuidForRopUserId,
} from "@/lib/dealer-base-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  dealerNeedsAttention,
  mapSalesRoleToDealerBaseAccess,
  roleScopedDealerRows,
} from "@/lib/dealer-base-role-views";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import { computeMainDashboardScopeMetrics, type MainDashboardScopeMetrics } from "@/lib/main-dashboard-scope-metrics";
import { DrilldownList, DrilldownListRow, MainScopeBreakdownKpiGrid } from "@/components/main-dashboard-scope-kpi";
import { orderManagersWithHeat } from "@/lib/manager-load-heat";
import { MainFocusTilesSection } from "@/components/main-focus-tiles-section";
import type { MainFocusTileId } from "@/lib/main-focus-tiles";
import { MainDashboardCityCoverage } from "@/components/main-dashboard-city-coverage";
import { MainDashboardFocusClientsPanel } from "@/components/main-dashboard-focus-clients-panel";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getAllMatrixTasks, getManagementFactualShowcaseTasksForDealers, getShowcaseBackedTasksForDealers } from "@/lib/trade-point-task-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { getShowcaseOnlyTasks } from "@/lib/task-classification";
import { getSalesUserById, getTeamManagers, type SalesRole } from "@/lib/sales-control-data";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";

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



function teamNameForRopUser(snap: OrgSnapshot, ropUserId: string): string | null {
  const teamUuid = teamUuidForRopUserId(snap, ropUserId);
  if (!teamUuid) return null;
  return snap.teams.find((t) => t.id === teamUuid)?.name?.trim() ?? null;
}

function DirectorRopsDrilldownList({
  snap,
  profile,
  actState,
  metricsEnabled,
}: {
  snap: OrgSnapshot;
  profile: ReleaseDemoProfile;
  actState: ActualizationState;
  metricsEnabled: boolean;
}) {
  const rops = useMemo(() => {
    const ropIds = new Set(snap.teams.map((t) => t.ropUserId).filter(Boolean) as string[]);
    return snap.users
      .filter((u) => u.role === "rop" && ropIds.has(u.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  }, [snap.teams, snap.users]);

  const metricsByRopId = useMemo(() => {
    const map = new Map<string, MainDashboardScopeMetrics>();
    if (!metricsEnabled) return map;
    for (const r of rops) {
      const scope = (rows: Parameters<typeof realRowsForRopTeam>[0]) => realRowsForRopTeam(rows, snap, r.id);
      map.set(r.id, computeMainDashboardScopeMetrics(actState, profile, scope));
    }
    return map;
  }, [rops, snap, actState, profile, metricsEnabled]);

  if (rops.length === 0) return null;

  return (
    <section className="min-w-0 space-y-2" data-testid="section-main-company-rops">
      <h2 className="text-sm font-semibold text-foreground">РОПы компании</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rops.map((r) => {
          const teamName = teamNameForRopUser(snap, r.id);
          return (
            <DrilldownListRow
              key={r.id}
              href={`/main/rop/${r.id}`}
              testId={`link-main-rop-${r.id}`}
              title={r.fullName}
              subtitle={teamName ? `Команда: ${teamName}` : null}
              metrics={metricsByRopId.get(r.id) ?? null}
            />
          );
        })}
      </ul>
    </section>
  );
}

function TeamManagersDrilldownList({
  snap,
  profile,
  actState,
  metricsEnabled,
}: {
  snap: OrgSnapshot;
  profile: ReleaseDemoProfile;
  actState: ActualizationState;
  metricsEnabled: boolean;
}) {
  const teamUuid = realEffectiveTeamLeadTeamIdFromSnap(snap);
  const managersRaw = useMemo(() => {
    if (!teamUuid) return [];
    return snap.users.filter(
      (u) => u.teamId === teamUuid && (u.role === "manager" || u.role === "regional_manager"),
    );
  }, [snap.users, teamUuid]);

  const metricsByManagerId = useMemo(() => {
    const map = new Map<string, MainDashboardScopeMetrics>();
    if (!metricsEnabled) return map;
    for (const m of managersRaw) {
      const scope = (rows: Parameters<typeof realRowsForManagerByUUID>[0]) => realRowsForManagerByUUID(rows, snap, m.id);
      map.set(m.id, computeMainDashboardScopeMetrics(actState, profile, scope));
    }
    return map;
  }, [managersRaw, snap, actState, profile, metricsEnabled]);

  const { managers, heatMap } = useMemo(() => {
    if (!metricsEnabled || managersRaw.length === 0) {
      const sorted = [...managersRaw].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
      return { managers: sorted, heatMap: {} as Record<string, never> };
    }
    return orderManagersWithHeat(managersRaw, metricsByManagerId);
  }, [managersRaw, metricsByManagerId, metricsEnabled]);

  if (managers.length === 0) return null;

  return (
    <section className="min-w-0 space-y-2" data-testid="section-main-team-managers">
      <h2 className="text-sm font-semibold text-foreground">Менеджеры команды</h2>
      <DrilldownList>
        {managers.map((m) => (
          <DrilldownListRow
            key={m.id}
            href={`/main/manager/${m.id}`}
            testId={`link-main-manager-${m.id}`}
            title={m.fullName}
            metrics={metricsByManagerId.get(m.id) ?? null}
            heatLevel={metricsEnabled ? (heatMap[m.id] ?? null) : null}
          />
        ))}
      </DrilldownList>
    </section>
  );
}

export function MainRoleDashboard() {
  const { user } = useCurrentUser();
  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const role = (user ? userRoleToSalesRole(user.role) : profile.role) as SalesRole;

  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const snap = orgSnapQ.data ?? null;
  const useReal = Boolean(isRealUser && !authLoading && !authError && snap && !orgSnapQ.isError);

  const access = useMemo(() => {
    if (isRealUser && me?.role) return mapUserRoleToDealerBaseAccess(me.role);
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [isRealUser, me?.role, profile.role]);

  const scopeRows = useMemo(() => {
    return (rows: DealerRow[]) =>
      useReal && snap ? roleScopedDealerRowsForReal(rows, snap, access) : roleScopedDealerRows(rows, profile);
  }, [useReal, snap, access, profile]);

  const scopeMetrics = useMemo(() => {
    if (!actx.enabled) return null;
    return computeMainDashboardScopeMetrics(managementPlane.mergedState, profile, scopeRows);
  }, [actx.enabled, managementPlane.mergedState, profile, scopeRows]);

  const baseRowsForDashboard = useMemo(() => {
    if (actx.enabled) {
      return buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, { includeArchivedDealers: false });
    }
    if (role === "team_lead" || role === "sales_director") return [];
    return DEALER_BASE_ROWS;
  }, [actx.enabled, managementPlane.mergedState, profile, role]);

  const scopedClients = useMemo(() => scopeRows(baseRowsForDashboard), [baseRowsForDashboard, scopeRows]);
  const dealerIds = useMemo(() => new Set(scopedClients.map((r) => r.id)), [scopedClients]);
  const dashboardLoading =
    (actx.enabled && actx.loading) ||
    (actx.enabled && shouldUseTeamMergedActualizationPlane(profile) && managementPlane.teamFetchLoading);
  const workingBaseEmpty = !dashboardLoading && scopedClients.length === 0;

  const useMgmtFactualTasks = actx.enabled && shouldUseTeamMergedActualizationPlane(profile);
  const showScopeKpi = actx.enabled && !dashboardLoading;
  const activeTradePoints = scopeMetrics?.activeTradePoints ?? 0;

  const { totalClients, activeClients, attentionClients, openTasks, extraKpiLabel, extraKpiValue } = useMemo(() => {
    const total = scopeMetrics?.activeClients ?? scopedClients.length;
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
  }, [
    scopedClients,
    scopeMetrics?.activeClients,
    dealerIds,
    role,
    profile,
    actx.enabled,
    useMgmtFactualTasks,
    managementPlane.mergedState,
  ]);

  const can = (path: string) => Boolean(user && canAccessPath(userRoleToSalesRole(user.role), path));

  const planHref = salesControlHomeHref(role);

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
      push(planHref, "План-факт продаж", "button-main-open-sales-control");
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
    role === "sales_director" ? "Главная руководителя" : role === "team_lead" ? "Главная РОПа" : "Моя главная";

  const subline =
    role === "sales_manager"
      ? "Мои клиенты, задачи и план месяца."
      : role === "team_lead"
        ? "Моя команда, клиенты и выполнение плана."
        : "Команды, клиенты, задачи и план-факт.";

  const kpiClientsLabel =
    role === "sales_manager"
      ? "Мои клиенты"
      : role === "team_lead"
        ? "Клиентов по команде"
        : "Всего клиентов";

  const kpiTasksLabel =
    role === "sales_manager"
      ? "Открытые задачи по витрине"
      : role === "team_lead"
        ? "Открытые задачи по витрине (команда)"
        : "Витрины (открытые)";

  const tradePointsSubline =
    showScopeKpi && (role === "sales_manager" || role === "team_lead" || role === "sales_director")
      ? `ТТ: ${activeTradePoints}`
      : null;

  const showScopeBreakdownKpi =
    (role === "team_lead" || role === "sales_director") && showScopeKpi && scopeMetrics != null;

  const mainFocusListCtx = useMemo(() => {
    if (!useReal || !snap || role === "sales_manager") return undefined;
    return {
      enabled: true,
      showManagerColumn: role === "team_lead" || role === "sales_director",
      showRopColumn: role === "sales_director",
      snap,
    };
  }, [useReal, snap, role]);

  const [selectedSegment, setSelectedSegment] = useState<MainFocusTileId | null>(null);
  const focusTableRef = useRef<HTMLDivElement>(null);

  const handleFocusTileClick = useCallback((segment: MainFocusTileId) => {
    setSelectedSegment((prev) => (prev === segment ? null : segment));
    setTimeout(() => {
      focusTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  if (role !== "sales_manager" && role !== "team_lead" && role !== "sales_director") {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden space-y-4" data-testid="page-main">
        <p className="text-sm text-muted-foreground">Раздел «Главная» для вашей роли не настроен. Используйте меню слева.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6 pb-10 sm:space-y-8" data-testid="page-main">
      <PageHeader title={headline} description={subline} icon={Home} />
      <DataFreshness updatedAt={actx.meta?.updatedAt ?? null} sourceLabel="Postgres" />

      {showScopeBreakdownKpi && scopeMetrics ? (
        <section
          className="grid min-w-0 grid-cols-2 gap-3"
          data-testid="section-main-scope-breakdown-kpi"
        >
          <MainScopeBreakdownKpiGrid
            metrics={scopeMetrics}
            clientsHref={kpiHrefs.clients}
            tradePointsHref={buildBrowserHashAppHref("/trade-points")}
          />
        </section>
      ) : null}

      {showScopeBreakdownKpi && role === "team_lead" ? (
        <MainFocusTilesSection
          title="Фокус команды"
          rows={scopedClients}
          act={managementPlane.mergedState}
          selectedSegment={selectedSegment}
          onTileClick={handleFocusTileClick}
          testId="section-main-focus-team"
        />
      ) : null}

      {showScopeBreakdownKpi && role === "sales_director" ? (
        <MainFocusTilesSection
          title="Фокус компании"
          rows={scopedClients}
          act={managementPlane.mergedState}
          selectedSegment={selectedSegment}
          onTileClick={handleFocusTileClick}
          testId="section-main-focus-company"
        />
      ) : null}

      {showScopeBreakdownKpi && actx.enabled && (role === "team_lead" || role === "sales_director") ? (
        <MainDashboardFocusClientsPanel
          rows={scopedClients}
          act={managementPlane.mergedState}
          profile={profile}
          role={role}
          focusList={mainFocusListCtx}
          selectedSegment={selectedSegment}
          onClearSegment={() => setSelectedSegment(null)}
          panelRef={focusTableRef}
        />
      ) : null}

      {showScopeBreakdownKpi && actx.enabled && (role === "team_lead" || role === "sales_director") ? (
        <MainDashboardCityCoverage rows={scopedClients} act={managementPlane.mergedState} />
      ) : null}

      <section
        className={
          extraKpiLabel
            ? "grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-5"
            : "grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4"
        }
        data-testid="section-main-role-dashboard"
      >
        {!showScopeBreakdownKpi ? (
          <MainKpiLink href={kpiHrefs.clients} testId="link-main-kpi-clients">
            <Card className="min-w-0 rounded-xl border border-border bg-card" data-testid="card-main-kpi-clients">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiClientsLabel}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground" data-testid="metric-main-total-clients">
                  {totalClients}
                </p>
                {tradePointsSubline ? (
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums" data-testid="metric-main-trade-points">
                    {tradePointsSubline}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </MainKpiLink>
        ) : null}
        <MainKpiLink href={kpiHrefs.active} testId="link-main-kpi-active">
          <Card className="min-w-0 rounded-xl border border-border bg-card" data-testid="card-main-kpi-active">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Активные клиенты</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{activeClients}</p>
            </CardContent>
          </Card>
        </MainKpiLink>
        <MainKpiLink href={kpiHrefs.attention} testId="link-main-kpi-attention">
          <Card className="min-w-0 rounded-xl border border-border bg-card" data-testid="card-main-kpi-attention">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Требуют внимания</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{attentionClients}</p>
            </CardContent>
          </Card>
        </MainKpiLink>
        <MainKpiLink href={kpiHrefs.tasks} testId="link-main-kpi-tasks">
          <div
            {...(useMgmtFactualTasks ? { "data-testid": "section-management-task-summary" } : {})}
            className="block min-w-0"
          >
            <Card className="min-w-0 rounded-xl border border-border bg-card" data-testid="card-main-kpi-tasks">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kpiTasksLabel}</p>
                <p
                  className="mt-0.5 text-xl font-semibold tabular-nums text-foreground"
                  {...(useMgmtFactualTasks ? { "data-testid": "metric-management-tasks-open" } : {})}
                >
                  {openTasks}
                </p>
              </CardContent>
            </Card>
          </div>
        </MainKpiLink>
        {extraKpiLabel && extraKpiValue && kpiHrefs.extra ? (
          <MainKpiLink href={kpiHrefs.extra} testId="link-main-kpi-extra">
            <Card
              className="min-w-0 rounded-xl border border-border bg-card sm:col-span-1"
              data-testid={role === "team_lead" ? "card-main-kpi-managers" : "card-main-kpi-teams"}
            >
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{extraKpiLabel}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{extraKpiValue}</p>
              </CardContent>
            </Card>
          </MainKpiLink>
        ) : null}
      </section>

      {role === "team_lead" && useReal && snap ? (
        <TeamManagersDrilldownList
          snap={snap}
          profile={profile}
          actState={managementPlane.mergedState}
          metricsEnabled={actx.enabled}
        />
      ) : null}

      {role === "sales_director" && useReal && snap ? (
        <DirectorRopsDrilldownList
          snap={snap}
          profile={profile}
          actState={managementPlane.mergedState}
          metricsEnabled={actx.enabled}
        />
      ) : null}

      <ActualizationRace />

      <PlanFactSummary />

      <div className="flex min-w-0 flex-wrap gap-2" data-testid="section-main-quick-links">
        <Button asChild className="min-h-10 font-semibold" data-testid="button-main-quick-dealer-base">
          <Link href="/dealer-base">Клиентская база</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-10 font-semibold" data-testid="button-main-quick-trade-points">
          <Link href="/trade-points">Торговые точки</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-10 font-semibold" data-testid="button-main-quick-plan-fact">
          <Link href={planHref}>План-факт</Link>
        </Button>
      </div>
    </div>
  );
}
