/**
 * Drill-down города: KPI, сегментация, клиенты, ТТ, менеджеры.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, useRoute } from "wouter";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
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
import { assignmentsScopeIsActive, roleScopedDealerRowsForReal } from "@/lib/dealer-base-real-scope";
import { buildAssignmentsMap, getVisibleReleaseClients } from "@/lib/real-client-base";
import { buildDealerRowsFromReleaseClients, DEALER_BASE_ROWS, getDealerManagerDisplay } from "@/lib/dealer-base-mock-data";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import {
  buildCityDetailModel,
  cityDetailRowMatchesSegment,
  resolveDealerRowManagerCatalogId,
  type CityDetailSegmentKey,
} from "@/lib/dealer-base-city-detail-view-model";
import { flattenTradePointsForRows } from "@/lib/dealer-base-management-view-model";
import { getClientCategoryLabel } from "@/lib/client-category";
import { ClientCategoryBadge } from "@/components/client-category-badge";
import { resolveEffectiveClientCategory } from "@/lib/effective-client-category";
import { EntityListFilters } from "@/components/entity-list/entity-list-filters";
import {
  buildCategoryOptionsFromRows,
  buildManagerNameOptionsFromRows,
  buildManagerOptionsFromCityManagers,
  countActiveEntityListFilters,
  matchesSearch,
} from "@/lib/entity-list-filtering";
import { buildHashPath } from "@/lib/hash-route-utils";
import { fetchTradePointsOverview } from "@/lib/trade-points-overview-api";
import { cn } from "@/lib/utils";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";

function segmentBadgeClass(tone: string): string {
  if (tone === "destructive") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (tone === "secondary") return "border-primary/30 bg-primary/10 text-foreground";
  return "border-border bg-muted/50 text-foreground";
}

export default function DealerBaseCityDetailPage() {
  const [, params] = useRoute("/dealer-base/city/:cityKey");
  const cityKey = decodeURIComponent(params?.cityKey ?? "");

  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();

  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const visCodesQ = useMyVisibleClientCodes({ enabled: isRealUser });
  const snap = orgSnapQ.data ?? null;
  const visPayload = visCodesQ.data ?? null;

  const useReal = Boolean(
    isRealUser && !authLoading && !authError && snap && visPayload && !orgSnapQ.isError && !visCodesQ.isError,
  );

  const access = useMemo(() => {
    if (isRealUser && me?.role) return mapUserRoleToDealerBaseAccess(me.role);
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [isRealUser, me?.role, profile.role]);

  const myCodesQ = useMyClientCodes({ enabled: actx.enabled });
  const responsibleByCode = myCodesQ.data?.responsibleByCode ?? {};

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

  const detail = useMemo(
    () => buildCityDetailModel(cityKey, scopedRows, { orgSnap: snap, responsibleByCode }),
    [cityKey, scopedRows, snap, responsibleByCode],
  );

  const tradePointsOverviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
    staleTime: 30_000,
  });
  const cityTpFromOverview = useMemo<number | null>(() => {
    const data = tradePointsOverviewQ.data;
    if (!data || !detail) return null;
    const city = data.cities.find(
      (c) => c.cityName === detail.displayName || c.cityKey === cityKey || c.cityKey === detail.cityKey,
    );
    return city ? city.tradePointsCount : 0;
  }, [tradePointsOverviewQ.data, cityKey, detail]);

  const cityTradePointsKpiDisplay = useMemo(() => {
    if (!detail) return "—";
    if (tradePointsOverviewQ.isLoading && !tradePointsOverviewQ.data) return "…";
    if (cityTpFromOverview != null) return String(cityTpFromOverview);
    return String(detail.kpis.tradePoints);
  }, [detail, tradePointsOverviewQ.isLoading, tradePointsOverviewQ.data, cityTpFromOverview]);

  const [segmentFilter, setSegmentFilter] = useState<CityDetailSegmentKey | null>(null);
  const [managerF, setManagerF] = useState("all");
  const [activeTab, setActiveTab] = useState<"clients" | "trade_points" | "managers">("clients");
  const [searchQ, setSearchQ] = useState("");
  const [categoryF, setCategoryF] = useState("all");
  const [tpSearchQ, setTpSearchQ] = useState("");
  const [tpManagerF, setTpManagerF] = useState("all");

  const segmentFilteredRows = useMemo(() => {
    if (!detail) return [];
    return detail.dealerRows.filter((r) => cityDetailRowMatchesSegment(r, segmentFilter));
  }, [detail, segmentFilter]);

  const categoryOptions = useMemo(
    () => buildCategoryOptionsFromRows(segmentFilteredRows, getClientCategoryLabel),
    [segmentFilteredRows],
  );
  const managerOptions = useMemo(
    () => buildManagerOptionsFromCityManagers(detail?.byManager ?? []),
    [detail?.byManager],
  );

  const filteredClients = useMemo(() => {
    let rows = segmentFilteredRows;
    if (managerF !== "all") {
      rows = rows.filter((r) => resolveDealerRowManagerCatalogId(r) === managerF);
    }
    if (categoryF !== "all")
      rows = rows.filter((r) => resolveEffectiveClientCategory(r, actx.enabled ? actx.state : null) === categoryF);
    if (searchQ.trim()) rows = rows.filter((r) => matchesSearch(searchQ, [r.name]));
    return rows;
  }, [segmentFilteredRows, managerF, categoryF, searchQ]);

  const clientsListFilterActiveCount = countActiveEntityListFilters([categoryF, managerF]);

  const resetClientsListFilters = () => {
    setSearchQ("");
    setCategoryF("all");
    setManagerF("all");
  };

  const tradePointRowsBase = useMemo(() => {
    if (!detail) return [];
    const ids = new Set(segmentFilteredRows.map((r) => r.id));
    return flattenTradePointsForRows(detail.dealerRows).filter((tp) => ids.has(tp.dealerId));
  }, [detail, segmentFilteredRows]);

  const tpManagerOptions = useMemo(
    () => buildManagerNameOptionsFromRows(tradePointRowsBase),
    [tradePointRowsBase],
  );

  const tradePointRows = useMemo(() => {
    let rows = tradePointRowsBase;
    if (tpManagerF !== "all") rows = rows.filter((tp) => (tp.manager ?? "").trim() === tpManagerF);
    if (tpSearchQ.trim()) {
      rows = rows.filter((tp) => matchesSearch(tpSearchQ, [tp.name, tp.dealerName, tp.manager]));
    }
    return rows;
  }, [tradePointRowsBase, tpManagerF, tpSearchQ]);

  const tpListFilterActiveCount = countActiveEntityListFilters([tpManagerF]);

  const resetTpListFilters = () => {
    setTpSearchQ("");
    setTpManagerF("all");
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

  if (!loading && !detail) {
    return <Redirect to={buildHashPath("/dealer-base")} />;
  }

  if (loading || !detail) {
    return (
      <div className="min-w-0 space-y-6 pb-20" data-testid="page-dealer-base-city-detail">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const maxSegmentCount = Math.max(1, ...detail.segments.map((s) => s.count));

  return (
    <div className="min-w-0 space-y-6 pb-20" data-testid="page-dealer-base-city-detail">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <BackNav
            breadcrumbs={breadcrumbsFor(`/dealer-base/city/${cityKey}`, {
              city: detail.displayName,
            })}
            fallbackHref="/dealer-base"
            testId="link-city-back-dealer-base"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{detail.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Детальный обзор города.</p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="min-h-10 w-full sm:w-auto" asChild>
            <Link
              href={buildHashPath(`/client-map?city=${encodeURIComponent(detail.displayName)}`)}
              data-testid="button-city-open-map"
            >
              На карте
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="min-h-10 w-full sm:w-auto" asChild>
            <Link
              href={buildHashPath(`/dealer-base?city=${encodeURIComponent(detail.displayName)}`)}
              data-testid="button-city-open-list"
            >
              Все клиенты списком
            </Link>
          </Button>
        </div>
      </div>

      <section data-testid="section-city-kpis">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Активные клиенты", String(detail.kpis.activeClients), "text-foreground"],
              ["Торговые точки", cityTradePointsKpiDisplay, "text-foreground"],
              ["Потенциальные", String(detail.kpis.potential), "text-sky-700 dark:text-sky-400"],
              ["Внимание", String(detail.kpis.attention), "text-destructive"],
            ] as const
          ).map(([label, value, valueClass]) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground shadow-sm"
              data-testid={`kpi-city-${label.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
              <p className={cn("mt-0.5 text-lg font-semibold tabular-nums sm:text-xl", valueClass)}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {detail.segments.length > 0 ? (
        <section data-testid="section-city-segments">
          <Card className="rounded-xl border border-border bg-card text-card-foreground">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <h2 className="text-sm font-semibold text-foreground">Сегментация</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    segmentFilter === null
                      ? "border-[#9ACA3C] bg-[#9ACA3C]/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-[#9ACA3C]/40",
                  )}
                  data-testid="chip-city-segment-all"
                  onClick={() => setSegmentFilter(null)}
                >
                  Все · {detail.dealerRows.length}
                </button>
                {detail.segments.map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      segmentFilter === seg.key
                        ? "border-[#9ACA3C] bg-[#9ACA3C]/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-[#9ACA3C]/40",
                    )}
                    data-testid={`chip-city-segment-${seg.key}`}
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
                {detail.segments.map((seg) => {
                  const w = Math.round((seg.count / maxSegmentCount) * 100);
                  return (
                    <li key={seg.key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-24 shrink-0 truncate">{seg.label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className="rounded-full bg-[#9ACA3C]" style={{ width: `${w}%` }} />
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

      <section data-testid="section-city-detail-tabs">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
            <TabsTrigger value="clients" className="text-xs sm:text-sm" data-testid="tab-city-clients">
              Клиенты ({filteredClients.length})
            </TabsTrigger>
            <TabsTrigger value="trade_points" className="text-xs sm:text-sm" data-testid="tab-city-trade-points">
              Торговые точки ({tradePointRows.length})
            </TabsTrigger>
            <TabsTrigger value="managers" className="text-xs sm:text-sm" data-testid="tab-city-managers">
              Менеджеры ({detail.byManager.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-3">
            <EntityListFilters
              className="mb-3"
              search={searchQ}
              onSearchChange={setSearchQ}
              searchPlaceholder="Поиск по названию клиента…"
              resultCount={filteredClients.length}
              activeCount={clientsListFilterActiveCount}
              onReset={resetClientsListFilters}
              filters={[
                {
                  key: "category",
                  label: "Категория",
                  value: categoryF,
                  onChange: setCategoryF,
                  options: categoryOptions,
                },
                {
                  key: "manager",
                  label: "Менеджер",
                  value: managerF,
                  onChange: setManagerF,
                  options: managerOptions,
                },
              ]}
            />
            {filteredClients.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {segmentFilteredRows.length === 0
                  ? "Нет клиентов в выбранном сегменте."
                  : "Нет клиентов по выбранным фильтрам."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Менеджер</TableHead>
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
                              className="inline-flex transition-opacity hover:opacity-90"
                              onClick={() =>
                                setCategoryF(resolveEffectiveClientCategory(r, actx.enabled ? actx.state : null))
                              }
                              data-testid={`link-city-client-category-${r.id}`}
                            >
                              <ClientCategoryBadge dealer={r} state={actx.enabled ? actx.state : null} />
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              onClick={() => {
                                const id = resolveDealerRowManagerCatalogId(r);
                                if (id) setManagerF(id);
                              }}
                              data-testid={`link-city-client-manager-${r.id}`}
                            >
                              {getDealerManagerDisplay(r)}
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

          <TabsContent value="trade_points" className="mt-3">
            <EntityListFilters
              className="mb-3"
              search={tpSearchQ}
              onSearchChange={setTpSearchQ}
              searchPlaceholder="Поиск по точке, клиенту, менеджеру…"
              resultCount={tradePointRows.length}
              activeCount={tpListFilterActiveCount}
              onReset={resetTpListFilters}
              filters={[
                {
                  key: "manager",
                  label: "Менеджер",
                  value: tpManagerF,
                  onChange: setTpManagerF,
                  options: tpManagerOptions,
                },
              ]}
            />
            {tradePointRowsBase.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет торговых точек.</p>
            ) : tradePointRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет точек по выбранным фильтрам.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Точка</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Менеджер</TableHead>
                      <TableHead className="w-[88px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tradePointRows.map((tp) => (
                      <TableRow key={tp.tpId}>
                        <TableCell className="max-w-[180px] truncate font-medium">{tp.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tp.dealerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tp.manager}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                            <Link
                              href={buildHashPath(
                                `/dealers/${encodeURIComponent(tp.dealerId)}/trade-points/${encodeURIComponent(tp.tpId)}`,
                              )}
                            >
                              Открыть
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="managers" className="mt-3 space-y-2">
            {detail.byManager.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет данных по менеджерам.</p>
            ) : (
              detail.byManager.map((m) => (
                <Card
                  key={`${m.managerCatalogId}-${m.managerName}`}
                  className="rounded-xl border border-border bg-card text-card-foreground"
                  data-testid={`card-city-manager-${m.managerCatalogId.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                >
                  <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{m.managerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.ropName ? `${m.ropName} · ` : ""}
                        активные {m.activeClients} · ТТ {m.tradePoints}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      data-testid={`button-city-manager-clients-${m.managerCatalogId.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      onClick={() => {
                        setManagerF(m.managerCatalogId);
                        setActiveTab("clients");
                        document
                          .querySelector('[data-testid="tab-city-clients"]')
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Клиенты
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
