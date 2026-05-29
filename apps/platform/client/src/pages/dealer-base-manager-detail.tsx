/**
 * Штаб менеджера: KPI, внимание, сегментация, города, клиенты.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, useRoute } from "wouter";
import { ChevronLeft, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useMyClientCodes } from "@/hooks/use-my-client-codes";
import { useMyVisibleClientCodes } from "@/lib/use-my-visible-client-codes";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import {
  buildRopGroups,
  teamsForManagementView,
} from "@/lib/dealer-base-management-view-model";
import { assignmentsScopeIsActive, roleScopedDealerRowsForReal } from "@/lib/dealer-base-real-scope";
import { buildAssignmentsMap, getVisibleReleaseClients } from "@/lib/real-client-base";
import { buildDealerRowsFromReleaseClients, DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import {
  dealerBaseSegmentBarClass,
  dealerRowMatchesSegment,
  type DealerBaseSegmentKey,
} from "@/lib/dealer-base-dealer-segment";
import {
  buildManagerDashboardModel,
  findManagerInRopGroups,
} from "@/lib/dealer-base-manager-dashboard-view-model";
import {
  computeManagerHeatMap,
  managerHeatBarClass,
  type ManagerHeatLevel,
} from "@/lib/manager-load-heat";
import { getClientCategoryLabel } from "@/lib/client-category";
import { ClientCategoryBadge } from "@/components/client-category-badge";
import { resolveEffectiveClientCategory } from "@/lib/effective-client-category";
import { EntityListFilters } from "@/components/entity-list/entity-list-filters";
import { ManagerTradePointsTab } from "@/components/trade-points/manager-trade-points-tab";
import {
  buildCategoryOptionsFromRows,
  buildCityOptionsFromRows,
  countActiveEntityListFilters,
  matchesSearch,
} from "@/lib/entity-list-filtering";
import { buildHashPath } from "@/lib/hash-route-utils";
import { resolveManagerApiUserId } from "@/lib/trade-points-overview-view-model";
import { fetchTradePointsOverview } from "@/lib/trade-points-overview-api";
import { cn } from "@/lib/utils";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";

function segmentBadgeClass(tone: string): string {
  if (tone === "destructive") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (tone === "secondary") return "border-primary/30 bg-primary/10 text-foreground";
  return "border-border bg-muted/50 text-foreground";
}

export default function DealerBaseManagerDetailPage() {
  const [, params] = useRoute("/dealer-base/manager/:managerId");
  const managerId = decodeURIComponent(params?.managerId ?? "");

  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();

  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: isRealUser });
  const snap = orgSnapQ.data ?? null;
  const visPayload = visCodesQ.data ?? null;
  const orgTeamCtx = useMemo(
    () => (snap && me?.role ? { snap, access: mapUserRoleToDealerBaseAccess(me.role) } : null),
    [snap, me?.role],
  );

  const useReal = Boolean(
    isRealUser && !authLoading && !authError && snap && visPayload && !orgSnapQ.isError && !visCodesQ.isError,
  );

  const access = useMemo(() => {
    if (orgTeamCtx) return orgTeamCtx.access;
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [orgTeamCtx, profile.role]);

  const myCodesQ = useMyClientCodes({ enabled: actx.enabled });
  const responsibleByCode = myCodesQ.data?.responsibleByCode ?? {};
  const userIdToCatalogMgrId = useMemo(
    () => new Map(Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE)),
    [],
  );

  const assignmentsScope = useMemo(() => {
    if (!myCodesQ.data) return undefined;
    return { ownCodes: myCodesQ.data.ownCodes, teamCodes: myCodesQ.data.teamCodes };
  }, [myCodesQ.data]);

  const scopedRows = useMemo(() => {
    let merged: typeof DEALER_BASE_ROWS;
    if (useReal && snap && visPayload) {
      const clients = getVisibleReleaseClients(
        snap,
        visPayload.all,
        visPayload.codes,
        buildAssignmentsMap(visPayload.assignments),
      );
      const releaseRows = buildDealerRowsFromReleaseClients(clients);
      merged = actx.enabled
        ? buildDealerBaseRowsWithActualization(teamCtx.mergedState, profile, {
            includeArchivedDealers: false,
            releaseDealerRows: releaseRows,
          })
        : releaseRows;
      return roleScopedDealerRowsForReal(
        merged,
        snap,
        access,
        undefined,
        assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
      );
    }
    if (isRealUser && !authLoading && !authError && (!snap || !visPayload)) return [];
    if (!actx.enabled) return roleScopedDealerRows(DEALER_BASE_ROWS, profile);
    return roleScopedDealerRows(
      buildDealerBaseRowsWithActualization(teamCtx.mergedState, profile, { includeArchivedDealers: false }),
      profile,
    );
  }, [
    useReal,
    snap,
    visPayload,
    actx.enabled,
    teamCtx.mergedState,
    profile,
    access,
    assignmentsScope,
    isRealUser,
    authLoading,
    authError,
  ]);

  const teams = useMemo(
    () => teamsForManagementView(profile, teamCtx.dashboardRopTeamId, orgTeamCtx),
    [profile, teamCtx.dashboardRopTeamId, orgTeamCtx],
  );

  const ropGroups = useMemo(
    () => buildRopGroups(scopedRows, teams, orgTeamCtx?.snap, responsibleByCode, userIdToCatalogMgrId),
    [scopedRows, teams, orgTeamCtx, responsibleByCode, userIdToCatalogMgrId],
  );

  const managerCtx = useMemo(() => findManagerInRopGroups(managerId, ropGroups), [managerId, ropGroups]);

  const managerApiUserId = useMemo(() => resolveManagerApiUserId(managerId), [managerId]);

  const tradePointsOverviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
    staleTime: 30_000,
  });

  const overviewByManagerId = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    const data = tradePointsOverviewQ.data;
    if (!data) return out;
    for (const g of data.ropGroups) {
      for (const mm of g.managers) {
        out.set(mm.userId, mm.tradePoints);
        const catalogId = userIdToCatalogMgrId.get(mm.userId);
        if (catalogId) out.set(catalogId, mm.tradePoints);
      }
    }
    return out;
  }, [tradePointsOverviewQ.data, userIdToCatalogMgrId]);

  const heatLevel: ManagerHeatLevel = useMemo(() => {
    if (!managerCtx) return "medium";
    const m = managerCtx.manager;
    const map = computeManagerHeatMap([
      {
        id: m.managerId,
        clientsActive: m.active,
        tradePointsActive: overviewByManagerId.get(m.managerId) ?? m.outlets,
      },
    ]);
    return map[m.managerId] ?? "medium";
  }, [managerCtx, overviewByManagerId]);

  const dashboard = useMemo(() => {
    if (!managerCtx) return null;
    return buildManagerDashboardModel(managerCtx.manager, managerCtx.ropName, heatLevel);
  }, [managerCtx, heatLevel]);

  const [segmentFilter, setSegmentFilter] = useState<DealerBaseSegmentKey | null>(null);
  const [activeTab, setActiveTab] = useState<"clients" | "cities" | "trade_points" | "attention">("clients");
  const [searchQ, setSearchQ] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [cityF, setCityF] = useState("all");

  const managerTpFromOverview = useMemo<number | null>(() => {
    const data = tradePointsOverviewQ.data;
    if (!data) return null;
    for (const g of data.ropGroups) {
      for (const m of g.managers) {
        if (m.userId === managerApiUserId) return m.tradePoints;
      }
    }
    return null;
  }, [tradePointsOverviewQ.data, managerApiUserId]);

  const managerTradePointsKpiDisplay = useMemo(() => {
    if (!dashboard) return "—";
    if (tradePointsOverviewQ.isLoading && !tradePointsOverviewQ.data) return "…";
    if (managerTpFromOverview != null) return String(managerTpFromOverview);
    return String(dashboard.kpis.tradePoints);
  }, [dashboard, tradePointsOverviewQ.isLoading, tradePointsOverviewQ.data, managerTpFromOverview]);

  const segmentRows = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.rows.filter((r) => dealerRowMatchesSegment(r, segmentFilter));
  }, [dashboard, segmentFilter]);

  const categoryOptions = useMemo(
    () => buildCategoryOptionsFromRows(segmentRows, getClientCategoryLabel),
    [segmentRows],
  );
  const cityOptions = useMemo(() => buildCityOptionsFromRows(segmentRows), [segmentRows]);

  const filteredClients = useMemo(() => {
    let rows = segmentRows;
    if (categoryF !== "all")
      rows = rows.filter((r) => resolveEffectiveClientCategory(r, actx.enabled ? actx.state : null) === categoryF);
    if (cityF !== "all") rows = rows.filter((r) => (r.city ?? "").trim() === cityF);
    if (searchQ.trim()) rows = rows.filter((r) => matchesSearch(searchQ, [r.name]));
    return rows;
  }, [segmentRows, categoryF, cityF, searchQ]);

  const listFilterActiveCount = countActiveEntityListFilters([categoryF, cityF]);

  const resetListFilters = () => {
    setSearchQ("");
    setCategoryF("all");
    setCityF("all");
  };

  const loading =
    authLoading ||
    (isRealUser && (orgSnapQ.isLoading || visCodesQ.isLoading)) ||
    (actx.enabled && actx.loading) ||
    (actx.enabled && teamCtx.teamFetchLoading);

  const managementPlane = shouldUseTeamMergedActualizationPlane(profile);

  if (!loading && (!actx.enabled || !managementPlane)) {
    return <Redirect to={buildHashPath("/dealer-base")} />;
  }

  if (!loading && !dashboard) {
    return <Redirect to={buildHashPath("/dealer-base")} />;
  }

  if (loading || !dashboard) {
    return (
      <div className="min-w-0 space-y-6 pb-20" data-testid="page-dealer-base-manager-detail">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const maxSegmentCount = Math.max(1, ...dashboard.segments.map((s) => s.count));

  return (
    <div className="min-w-0 space-y-6 pb-20" data-testid="page-dealer-base-manager-detail">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={buildHashPath("/dealer-base")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground"
            data-testid="link-manager-back-dealer-base"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Клиентская база
          </Link>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <div
              className={cn("h-8 w-1 shrink-0 rounded-full", managerHeatBarClass(dashboard.heatLevel))}
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {dashboard.managerName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {dashboard.ropName} · штаб менеджера
              </p>
            </div>
          </div>
        </div>
      </div>

      <section data-testid="section-manager-kpis">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Активные клиенты", String(dashboard.kpis.activeClients), "text-foreground"],
              ["Торговые точки", managerTradePointsKpiDisplay, "text-foreground"],
              ["Потенциальные", String(dashboard.kpis.potential), "text-sky-700 dark:text-sky-400"],
              ["Внимание", String(dashboard.kpis.attention), "text-destructive"],
            ] as const
          ).map(([label, value, valueClass]) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground shadow-sm"
            >
              <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
              <p className={cn("mt-0.5 text-lg font-semibold tabular-nums sm:text-xl", valueClass)}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {dashboard.attentionRows.length > 0 ? (
        <section data-testid="section-manager-attention">
          <Card className="rounded-xl border border-destructive/30 bg-destructive/5">
            <CardContent className="space-y-2 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Требует внимания</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setActiveTab("attention")}
                >
                  Все ({dashboard.attentionRows.length})
                </Button>
              </div>
              <ul className="space-y-1.5">
                {dashboard.attentionRows.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground">{r.name}</span>
                    <Button variant="ghost" size="sm" className="h-8 shrink-0 text-primary" asChild>
                      <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Карточка</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {dashboard.segments.length > 0 ? (
        <section data-testid="section-manager-segments">
          <Card className="rounded-xl border border-border bg-card">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <h2 className="text-sm font-semibold text-foreground">Сегментация</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    segmentFilter === null
                      ? "border-[#9ACA3C] bg-[#9ACA3C]/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-[#9ACA3C]/40",
                  )}
                  data-testid="chip-manager-segment-all"
                  onClick={() => setSegmentFilter(null)}
                >
                  Все · {dashboard.rows.length}
                </button>
                {dashboard.segments.map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      segmentFilter === seg.key
                        ? "border-[#9ACA3C] bg-[#9ACA3C]/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-[#9ACA3C]/40",
                    )}
                    data-testid={`chip-manager-segment-${seg.key}`}
                    onClick={() => setSegmentFilter((prev) => (prev === seg.key ? null : seg.key))}
                  >
                    <Badge variant="outline" className={cn("h-5 border px-1.5 text-[10px]", segmentBadgeClass(seg.tone))}>
                      {seg.label}
                    </Badge>
                    <span className="tabular-nums">{seg.count}</span>
                  </button>
                ))}
              </div>
              <ul className="space-y-1.5" aria-hidden>
                {dashboard.segments.map((seg) => {
                  const w = Math.round((seg.count / maxSegmentCount) * 100);
                  return (
                    <li key={seg.key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-24 shrink-0 truncate">{seg.label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn("rounded-full", dealerBaseSegmentBarClass(seg.key))}
                            style={{ width: `${w}%` }}
                          />
                        </span>
                      </span>
                      <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{seg.count}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section data-testid="section-manager-detail-tabs">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
            <TabsTrigger value="clients" className="text-xs sm:text-sm" data-testid="tab-manager-clients">
              Клиенты ({filteredClients.length})
            </TabsTrigger>
            <TabsTrigger value="cities" className="text-xs sm:text-sm" data-testid="tab-manager-cities">
              Города ({dashboard.cities.length})
            </TabsTrigger>
            <TabsTrigger value="trade_points" className="text-xs sm:text-sm" data-testid="tab-manager-trade-points">
              Торговые точки
            </TabsTrigger>
            <TabsTrigger value="attention" className="text-xs sm:text-sm" data-testid="tab-manager-attention">
              Внимание ({dashboard.attentionRows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-3">
            {segmentFilter ? (
              <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="badge-manager-segment-filter">
                <span className="text-xs text-muted-foreground">Сегмент:</span>
                <Badge variant="outline" className="gap-1.5 border-[#9ACA3C]/60 bg-[#9ACA3C]/10">
                  {dashboard.segments.find((s) => s.key === segmentFilter)?.label ?? segmentFilter}
                  <button
                    type="button"
                    onClick={() => setSegmentFilter(null)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-foreground/10"
                    aria-label="Сбросить фильтр сегмента"
                    data-testid="button-clear-manager-segment-filter"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              </div>
            ) : null}
            <EntityListFilters
              className="mb-3"
              search={searchQ}
              onSearchChange={setSearchQ}
              searchPlaceholder="Поиск по названию клиента…"
              resultCount={filteredClients.length}
              activeCount={listFilterActiveCount}
              onReset={resetListFilters}
              filters={[
                {
                  key: "category",
                  label: "Категория",
                  value: categoryF,
                  onChange: setCategoryF,
                  options: categoryOptions,
                },
                {
                  key: "city",
                  label: "Город",
                  value: cityF,
                  onChange: setCityF,
                  options: cityOptions,
                },
              ]}
            />
            {filteredClients.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {segmentRows.length === 0
                  ? "Нет клиентов в выбранном сегменте."
                  : "Нет клиентов по выбранным фильтрам."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Город</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead className="text-right">ТТ</TableHead>
                      <TableHead className="w-[88px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="max-w-[200px] truncate font-medium">{r.name}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              onClick={() => setCityF((r.city ?? "").trim() || "all")}
                              data-testid={`link-manager-client-city-${r.id}`}
                            >
                              {r.city}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="inline-flex transition-opacity hover:opacity-90"
                              onClick={() =>
                                setCategoryF(resolveEffectiveClientCategory(r, actx.enabled ? actx.state : null))
                              }
                              data-testid={`link-manager-client-category-${r.id}`}
                            >
                              <ClientCategoryBadge dealer={r} state={actx.enabled ? actx.state : null} />
                            </button>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.outlets}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                              <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Карточка</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cities" className="mt-3">
            {dashboard.cities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет городов с клиентами.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.cities.map((c) => (
                  <Link
                    key={c.cityKey}
                    href={buildHashPath(`/dealer-base/city/${encodeURIComponent(c.cityKey)}`)}
                    className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 no-underline transition-colors hover:border-[#9ACA3C]/50"
                    data-testid={`card-manager-city-${c.cityKey}`}
                  >
                    <span className="text-sm font-semibold text-foreground">{c.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      клиенты <span className="font-semibold text-foreground">{c.activeClients}</span> · ТТ{" "}
                      <span className="font-semibold text-foreground">{c.tradePoints}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trade_points" className="mt-3">
            <ManagerTradePointsTab managerUserId={managerApiUserId} />
          </TabsContent>

          <TabsContent value="attention" className="mt-3">
            {dashboard.attentionRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет клиентов, требующих внимания.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.attentionRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.city} · ТТ {r.outlets}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" asChild>
                      <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Карточка</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
