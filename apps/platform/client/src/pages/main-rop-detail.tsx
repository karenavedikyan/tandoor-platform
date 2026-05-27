/**
 * Промт 54-D: drilldown директора — карточка РОПа и команды (read-only).
 */
import { useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
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
  isRopUserInSnapshot,
  managersForRopTeam,
  realRowsForManagerByUUID,
  realRowsForRopTeam,
  teamUuidForRopUserId,
} from "@/lib/dealer-base-real-scope";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { computeMainDashboardScopeMetrics } from "@/lib/main-dashboard-scope-metrics";
import { buildTradePointListForActualization, type TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";

function countTradePointsForDealer(row: DealerRow, act: ReturnType<typeof useClientBaseTeamActualization>["mergedState"]): number {
  return mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived).length;
}

export default function MainRopDetailPage() {
  const [, params] = useRoute("/main/rop/:ropId");
  const ropId = params?.ropId?.trim() ?? "";

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

  const rop = useMemo(() => {
    if (!snap || !ropId) return null;
    const u = snap.users.find((x) => x.id === ropId);
    if (!u || u.role !== "rop") return null;
    return u;
  }, [snap, ropId]);

  const teamName = useMemo(() => {
    if (!snap || !ropId) return "—";
    const teamUuid = teamUuidForRopUserId(snap, ropId);
    const team = snap.teams.find((t) => t.id === teamUuid);
    return team?.name?.trim() || "—";
  }, [snap, ropId]);

  const allowed = useReal && access === "sales_director" && rop != null && isRopUserInSnapshot(snap!, ropId);

  const [showArchive, setShowArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<"clients" | "trade_points">("clients");
  const [selectedDealer, setSelectedDealer] = useState<DealerRow | null>(null);
  const [selectedTp, setSelectedTp] = useState<{ dealer: DealerRow; point: DealerTradePoint; isArchived: boolean } | null>(
    null,
  );

  const teamScope = useMemo(
    () => (rows: DealerRow[]) => (snap && ropId ? realRowsForRopTeam(rows, snap, ropId) : []),
    [snap, ropId],
  );

  const teamManagers = useMemo(() => (snap && ropId ? managersForRopTeam(snap, ropId) : []), [snap, ropId]);

  const managerMiniMetrics = useMemo(() => {
    if (!actx.enabled || !allowed || !snap) return new Map<string, ReturnType<typeof computeMainDashboardScopeMetrics>>();
    const map = new Map<string, ReturnType<typeof computeMainDashboardScopeMetrics>>();
    for (const m of teamManagers) {
      const scope = (rows: DealerRow[]) => realRowsForManagerByUUID(rows, snap, m.id);
      map.set(m.id, computeMainDashboardScopeMetrics(managementPlane.mergedState, profile, scope));
    }
    return map;
  }, [actx.enabled, allowed, snap, teamManagers, managementPlane.mergedState, profile]);

  const scopeMetrics = useMemo(() => {
    if (!actx.enabled || !allowed) return null;
    return computeMainDashboardScopeMetrics(managementPlane.mergedState, profile, teamScope);
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, teamScope]);

  const clientRows = useMemo(() => {
    if (!actx.enabled || !allowed) return [];
    const built = buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
      includeArchivedDealers: showArchive,
    });
    return teamScope(built);
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, teamScope, showArchive]);

  const tradePointRows = useMemo((): TradePointListRow[] => {
    if (!actx.enabled || !allowed) return [];
    const dealerIds = new Set(clientRows.map((r) => r.id));
    const list = buildTradePointListForActualization(managementPlane.mergedState, profile, {
      includeArchivedTradePoints: showArchive,
      archivedTradePointsOnly: showArchive,
    });
    return list.filter((r) => dealerIds.has(r.dealerId));
  }, [actx.enabled, allowed, managementPlane.mergedState, profile, clientRows, showArchive]);

  const loading =
    authLoading ||
    (isRealUser && orgSnapQ.isLoading) ||
    (actx.enabled && actx.loading) ||
    (actx.enabled && managementPlane.teamFetchLoading);

  const hasArchive =
    (scopeMetrics?.archivedClients ?? 0) > 0 || (scopeMetrics?.archivedTradePoints ?? 0) > 0;

  if (!loading && !allowed) {
    return <Redirect to="/main" />;
  }

  if (loading || !rop) {
    return (
      <div className="space-y-6 pb-10" data-testid="page-main-rop-detail-loading">
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

  const ropName = rop.fullName?.trim() || "РОП";

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-10" data-testid="page-main-rop-detail">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/main">Главная</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{ropName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="outline" size="sm" className="shrink-0" data-testid="button-main-rop-back">
          <Link href="/main">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            Назад
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-border" data-testid="card-main-rop-profile">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <ClientAvatar size={56} shape="circle" name={ropName} seed={rop.id} />
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-semibold text-foreground">{ropName}</p>
            <p className="text-sm text-muted-foreground">РОП</p>
            <p className="text-sm text-muted-foreground">Команда: {teamName}</p>
            <p className="text-sm text-muted-foreground">Email: —</p>
            <p className="text-sm text-muted-foreground">Телефон: —</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4" data-testid="section-main-rop-kpi">
        <Card className="rounded-xl border border-border">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Клиенты вне архива</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums" data-testid="metric-rop-active-clients">
              {scopeMetrics?.activeClients ?? "—"}
            </p>
            {scopeMetrics && scopeMetrics.archivedClients > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{scopeMetrics.archivedClients} в архиве</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border">
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Торговые точки вне архива</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums" data-testid="metric-rop-active-tp">
              {scopeMetrics?.activeTradePoints ?? "—"}
            </p>
            {scopeMetrics && scopeMetrics.archivedTradePoints > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{scopeMetrics.archivedTradePoints} в архиве</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="min-w-0 space-y-2" data-testid="section-main-rop-managers">
        <h2 className="text-sm font-semibold text-foreground">Менеджеры команды</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {teamManagers.map((m) => {
            const mini = managerMiniMetrics.get(m.id);
            return (
              <li key={m.id}>
                <Link
                  href={`/main/manager/${m.id}`}
                  className="flex min-h-11 flex-col gap-0.5 px-4 py-2.5 no-underline transition hover:bg-muted/60 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`link-main-rop-manager-${m.id}`}
                >
                  <span className="truncate text-sm font-medium text-foreground">{m.fullName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {mini
                      ? `Клиенты: ${mini.activeClients}${mini.archivedClients > 0 ? ` / ${mini.archivedClients} арх.` : ""} · ТТ: ${mini.activeTradePoints}`
                      : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {hasArchive ? (
        <div className="flex items-center gap-2" data-testid="section-main-rop-archive-toggle">
          <Switch
            id="toggle-rop-archive"
            checked={showArchive}
            onCheckedChange={(v) => setShowArchive(v === true)}
            data-testid="toggle-main-rop-show-archive"
          />
          <Label htmlFor="toggle-rop-archive" className="text-sm">
            Архив
          </Label>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "clients" | "trade_points")}>
        <TabsList>
          <TabsTrigger value="clients" data-testid="tab-main-rop-clients">
            Все клиенты команды
          </TabsTrigger>
          <TabsTrigger value="trade_points" data-testid="tab-main-rop-trade-points">
            Все торговые точки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table data-testid="table-main-rop-clients">
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО клиента</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последняя активность</TableHead>
                  <TableHead className="text-right">ТТ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {showArchive ? "Нет архивных клиентов" : "Нет клиентов"}
                    </TableCell>
                  </TableRow>
                ) : (
                  clientRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-main-rop-client-${row.id}`}
                      onClick={() => setSelectedDealer(row)}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.manager || "—"}</TableCell>
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
            <Table data-testid="table-main-rop-trade-points">
              <TableHeader>
                <TableRow>
                  <TableHead>Торговая точка</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последняя активность</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradePointRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {showArchive ? "Нет архивных торговых точек" : "Нет торговых точек"}
                    </TableCell>
                  </TableRow>
                ) : (
                  tradePointRows.map((row) => (
                    <TableRow
                      key={row.tradePointId}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-main-rop-tp-${row.tradePointId}`}
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
                      <TableCell>{row.manager || "—"}</TableCell>
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
