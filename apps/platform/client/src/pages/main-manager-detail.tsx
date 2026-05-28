/**
 * Промт 54-C: drilldown РОПа — карточка менеджера команды (read-only).
 */
import { useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { MainDashboardCityCoverage } from "@/components/main-dashboard-city-coverage";
import {
  MainDashboardCityFilterProvider,
  useMainDashboardCityFilter,
} from "@/context/main-dashboard-city-filter-context";
import { DealerCardSheet } from "@/components/dealer-card-sheet";
import { TradePointSheet } from "@/components/trade-point-sheet";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import { buildDealerBaseRowsWithActualization, mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import {
  managerBelongsToRopTeam,
  realRowsForManagerByUUID,
  ropUserForManager,
} from "@/lib/dealer-base-real-scope";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { dealerRowMatchesCityFilter } from "@/lib/main-dashboard-city-stats";
import { computeMainDashboardScopeMetrics } from "@/lib/main-dashboard-scope-metrics";
import { buildTradePointListForActualization, type TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";

function countTradePointsForDealer(row: DealerRow, act: ReturnType<typeof useClientBaseTeamActualization>["mergedState"]): number {
  return mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived).length;
}

function ManagerCityFilterChip() {
  const { selectedCity, clearCity } = useMainDashboardCityFilter();
  if (!selectedCity) return null;

  return (
    <div
      className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
      data-testid="chip-main-manager-city"
    >
      <span>Город: {selectedCity}</span>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="button-main-manager-city-clear"
        aria-label={`Снять фильтр по городу ${selectedCity}`}
        onClick={clearCity}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function MainManagerDetailPage() {
  return (
    <MainDashboardCityFilterProvider>
      <MainManagerDetailContent />
    </MainDashboardCityFilterProvider>
  );
}

function MainManagerDetailContent() {
  const [, params] = useRoute("/main/manager/:managerId");
  const managerId = params?.managerId?.trim() ?? "";

  const { user: me, isLoading: authLoading, isError: authError } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();

  const isRealUser = Boolean(me?.id);
  const orgSnapQ = useOrgSnapshot({ enabled: isRealUser });
  const snap = orgSnapQ.data ?? null;
  const useReal = Boolean(isRealUser && !authLoading && !authError && snap && !orgSnapQ.isError);

  const access = useMemo(() => {
    if (isRealUser && me?.role) return mapUserRoleToDealerBaseAccess(me.role);
    return null;
  }, [isRealUser, me?.role]);

  const manager = useMemo(() => {
    if (!snap || !managerId) return null;
    return snap.users.find((u) => u.id === managerId) ?? null;
  }, [snap, managerId]);

  const ropForBreadcrumb = useMemo(() => {
    if (!snap || !manager) return null;
    return ropUserForManager(snap, managerId);
  }, [snap, manager, managerId]);

  const allowed = useMemo(() => {
    if (!useReal || !snap || !manager) return false;
    if (access === "sales_director") {
      return manager.role === "manager" || manager.role === "regional_manager";
    }
    if (access === "team_lead") {
      return managerBelongsToRopTeam(snap, managerId);
    }
    return false;
  }, [useReal, snap, manager, managerId, access]);

  const { selectedCity } = useMainDashboardCityFilter();
  const [showArchive, setShowArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<"clients" | "trade_points">("clients");
  const [selectedDealer, setSelectedDealer] = useState<DealerRow | null>(null);
  const [selectedTp, setSelectedTp] = useState<{ dealer: DealerRow; point: DealerTradePoint; isArchived: boolean } | null>(
    null,
  );

  const managerScope = useMemo(
    () => (rows: DealerRow[]) => (snap && managerId ? realRowsForManagerByUUID(rows, snap, managerId) : []),
    [snap, managerId],
  );

  const scopeMetrics = useMemo(() => {
    if (!actx.enabled || !allowed) return null;
    return computeMainDashboardScopeMetrics(managementPlane.mergedState, profile, managerScope);
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, managerScope]);

  const activeClientRows = useMemo(() => {
    if (!actx.enabled || !allowed) return [];
    const built = buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
      includeArchivedDealers: false,
    });
    return managerScope(built);
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, managerScope]);

  const clientRows = useMemo(() => {
    if (!actx.enabled || !allowed) return [];
    const built = buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
      includeArchivedDealers: showArchive,
    });
    return managerScope(built);
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, managerScope, showArchive]);

  const displayedClientRows = useMemo(() => {
    if (!selectedCity) return clientRows;
    return clientRows.filter((r) => dealerRowMatchesCityFilter(r, selectedCity));
  }, [clientRows, selectedCity]);

  const tradePointRows = useMemo((): TradePointListRow[] => {
    if (!actx.enabled || !allowed) return [];
    const dealerIds = new Set(clientRows.map((r) => r.id));
    const list = buildTradePointListForActualization(managementPlane.mergedState, profile, {
      includeArchivedTradePoints: showArchive,
      archivedTradePointsOnly: showArchive,
    });
    return list.filter((r) => dealerIds.has(r.dealerId));
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, clientRows, showArchive]);

  const displayedTradePointRows = useMemo(() => {
    if (!selectedCity) return tradePointRows;
    const dealerIds = new Set(displayedClientRows.map((r) => r.id));
    return tradePointRows.filter((r) => dealerIds.has(r.dealerId));
  }, [tradePointRows, selectedCity, displayedClientRows]);

  const showCityCoverage = actx.enabled && allowed && activeClientRows.length > 0;

  const loading =
    authLoading ||
    (isRealUser && orgSnapQ.isLoading) ||
    (actx.enabled && actx.loading) ||
    (actx.enabled && managementPlane.teamFetchLoading);

  const hasArchive = false;

  if (!loading && !allowed) {
    return <Redirect to="/main" />;
  }

  if (loading || !manager) {
    return (
      <div className="space-y-6 pb-10" data-testid="page-main-manager-detail-loading">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const managerName = manager.fullName?.trim() || "Менеджер";

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-10" data-testid="page-main-manager-detail">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/main">Главная</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {access === "sales_director" && ropForBreadcrumb ? (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/main/rop/${ropForBreadcrumb.id}`}>{ropForBreadcrumb.fullName}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          ) : null}
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{managerName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="outline" size="sm" className="shrink-0" data-testid="button-main-manager-back">
          <Link href="/main">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            Назад
          </Link>
        </Button>
      </div>

<Card className="rounded-xl border border-border" data-testid="card-main-manager-profile">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <ClientAvatar size={56} shape="circle" name={managerName} seed={manager.id} />
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-semibold text-foreground">{managerName}</p>
            <p className="text-sm text-muted-foreground">Менеджер</p>
            <p className="text-sm text-muted-foreground">Email: —</p>
            <p className="text-sm text-muted-foreground">Телефон: —</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4" data-testid="section-main-manager-kpi">
        <Card className="rounded-xl border border-border">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Клиенты</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums" data-testid="metric-manager-active-clients">
              {scopeMetrics?.activeClients ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Торговые точки</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums" data-testid="metric-manager-active-tp">
              {scopeMetrics?.activeTradePoints ?? "—"}
            </p>
          </CardContent>
        </Card>
      </section>

      {showCityCoverage ? (
        <MainDashboardCityCoverage
          rows={activeClientRows}
          act={managementPlane.mergedState}
          testId="section-main-manager-city-coverage"
        />
      ) : null}

      <ManagerCityFilterChip />

      {hasArchive ? (
        <div className="flex items-center gap-2" data-testid="section-main-manager-archive-toggle">
          <Switch
            id="toggle-manager-archive"
            checked={showArchive}
            onCheckedChange={(v) => setShowArchive(v === true)}
            data-testid="toggle-main-manager-show-archive"
          />
          <Label htmlFor="toggle-manager-archive" className="text-sm">
            Архив
          </Label>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "clients" | "trade_points")}>
        <TabsList>
          <TabsTrigger value="clients" data-testid="tab-main-manager-clients">
            Клиенты
          </TabsTrigger>
          <TabsTrigger value="trade_points" data-testid="tab-main-manager-trade-points">
            Торговые точки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table data-testid="table-main-manager-clients">
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО клиента</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последняя активность</TableHead>
                  <TableHead className="text-right">ТТ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedClientRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {selectedCity
                        ? "Нет клиентов в выбранном городе"
                        : showArchive
                          ? "Нет архивных клиентов"
                          : "Нет клиентов"}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedClientRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-main-manager-client-${row.id}`}
                      onClick={() => setSelectedDealer(row)}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.contacts?.phone?.trim() || "—"}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.lastActivity || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {countTradePointsForDealer(row, managementPlane.mergedState)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="trade_points" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table data-testid="table-main-manager-trade-points">
              <TableHeader>
                <TableRow>
                  <TableHead>Торговая точка</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последняя активность</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedTradePointRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {selectedCity
                        ? "Нет торговых точек в выбранном городе"
                        : showArchive
                          ? "Нет архивных торговых точек"
                          : "Нет торговых точек"}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedTradePointRows.map((row) => (
                    <TableRow
                      key={row.tradePointId}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-main-manager-tp-${row.tradePointId}`}
                      onClick={() =>
                        setSelectedTp({
                          dealer: row.dealer,
                          point: row.point,
                          isArchived: row.isArchived,
                        })
                      }
                    >
                      <TableCell>
                        <div className="font-medium">{row.tradePointName}</div>
                        <div className="text-xs text-muted-foreground">{row.address}</div>
                      </TableCell>
                      <TableCell>{row.dealerName}</TableCell>
                      <TableCell>{row.isArchived ? "В архиве" : row.showcaseBucketLabel}</TableCell>
                      <TableCell>{row.showcaseUpdatedAt || row.dealer.lastActivity || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {selectedDealer ? (
        <DealerCardSheet
          open
          onOpenChange={(open) => {
            if (!open) setSelectedDealer(null);
          }}
          baseRow={selectedDealer}
          profile={profile}
          readOnly
        />
      ) : null}

      {selectedTp ? (
        <TradePointSheet
          open
          onOpenChange={(open) => {
            if (!open) setSelectedTp(null);
          }}
          dealer={selectedTp.dealer}
          point={selectedTp.point}
          profile={profile}
          readOnly
          isArchived={selectedTp.isArchived}
        />
      ) : null}
    </div>
  );
}
