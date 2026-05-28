import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, Info, Store, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { mapSalesRoleToDealerBaseAccess, type DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { realRopOptions } from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { buildHashPath } from "@/lib/hash-route-utils";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { resolveManagementCatalogTeamId } from "@/lib/dealer-base-management-view-model";
import { fetchTradePointsOverview } from "@/lib/trade-points-overview-api";
import { ManagerTradePointsCard } from "@/components/trade-points/manager-trade-points-card";
import {
  computeManagerTpHeatMap,
  managerCardFromOverview,
  overviewCityCards,
  sortManagersByTpLoad,
} from "@/lib/trade-points-overview-view-model";
import {
  countWorkingTradePointsForSidebar,
  type TradePointListRow,
} from "@/lib/trade-point-list-for-actualization";

function isOwnTeamForUser(
  teamId: string | null | undefined,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
  orgSnap?: OrgSnapshot | null,
): boolean {
  if (access !== "team_lead" || !teamId) return false;
  const ownTeam = getEffectiveTeamLeadTeamId(profile);
  const catalogOwn = orgSnap ? resolveManagementCatalogTeamId(ownTeam, orgSnap) : ownTeam;
  const catalogTeam = orgSnap ? resolveManagementCatalogTeamId(teamId, orgSnap) : teamId;
  return catalogOwn === catalogTeam || ownTeam === teamId;
}

function teamSectionKey(teamId: string | null, index: number): string {
  return teamId ?? `__team_${index}__`;
}

export function TradePointsManagementCockpit({
  profile,
  workingRows: _workingRows,
  dealerRows: _dealerRows,
  orgTeamCtx,
}: {
  profile: ReleaseDemoProfile;
  workingRows: TradePointListRow[];
  dealerRows: DealerRow[];
  orgTeamCtx?: { snap: OrgSnapshot; access: DealerBaseAccessRole } | null;
}) {
  void _workingRows;
  void _dealerRows;
  const teamCtx = useClientBaseTeamActualization();
  const isMobile = useIsMobile();
  const access = useMemo(() => {
    if (orgTeamCtx) return orgTeamCtx.access;
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [orgTeamCtx, profile.role]);

  const [citiesExpanded, setCitiesExpanded] = useState(false);

  const overviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
  });
  const overview = overviewQ.data ?? null;

  const visibleRopGroups = useMemo(() => {
    if (!overview) return [];
    if (access === "sales_director") return overview.ropGroups;
    return overview.ropGroups.filter((g) => isOwnTeamForUser(g.teamId, profile, access, orgTeamCtx?.snap));
  }, [overview, access, profile, orgTeamCtx?.snap]);

  const cityCards = useMemo(() => (overview ? overviewCityCards(overview) : []), [overview]);

  const structure = overview?.structure;

  useEffect(() => {
    if (typeof window === "undefined" || !overview?.structure) return;
    const sidebarCount = countWorkingTradePointsForSidebar(profile, teamCtx.mergedState);
    const serverCount = overview.structure.activeTradePoints;
    if (sidebarCount !== serverCount) {
      console.warn("[tp-count-mismatch]", {
        sidebarCount,
        serverCount,
        diff: sidebarCount - serverCount,
        ropGroups: overview.ropGroups.map((g) => ({
          team: g.teamName,
          tp: g.tradePoints,
          mgrs: g.managers.length,
        })),
      });
    }
  }, [overview, profile, teamCtx.mergedState]);

  if (overviewQ.isLoading) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-trade-points">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-trade-points">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Торговые точки</h1>
          <p className="mt-1 text-sm text-muted-foreground">Управленческий обзор торговых точек.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHashPath("/dealer-base")}>Клиентская база</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHashPath("/client-map")}>Карта</Link>
          </Button>
        </div>
      </div>

      {overviewQ.isError ? (
        <Alert variant="destructive" data-testid="alert-trade-points-overview-error">
          <AlertDescription>
            {overviewQ.error instanceof Error ? overviewQ.error.message : "Не удалось загрузить обзор торговых точек."}
          </AlertDescription>
        </Alert>
      ) : null}

      {teamCtx.teamFetchLoading || teamCtx.teamFetchError ? (
        <div className="space-y-3">
          {teamCtx.teamFetchLoading ? (
            <Alert className="border-primary/30 bg-primary/5" data-testid="alert-trade-points-team-state-loading">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription>Загружаются данные актуализации команды…</AlertDescription>
            </Alert>
          ) : null}
          {teamCtx.teamFetchError ? (
            <Alert variant="destructive" data-testid="alert-trade-points-team-state-error">
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{teamCtx.teamFetchError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void teamCtx.refresh()}>
                  Повторить
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {access === "sales_director" ? (
        <div className="max-w-md">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Команда для merge</p>
          <Select value={teamCtx.dashboardRopTeamId} onValueChange={(v) => teamCtx.publishDashboardRopTeamId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Команда" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все команды</SelectItem>
              {(orgTeamCtx ? realRopOptions(orgTeamCtx.snap) : getRopOptions()).map((o) => (
                <SelectItem key={o.teamId} value={o.teamId}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {structure ? (
        <section data-testid="section-trade-points-kpis">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["Точек", structure.activeTradePoints],
                ["Клиентов с ТТ", structure.clientsWithTp],
                ["Без фото", structure.withoutPhoto],
                ["Не заполнены", structure.notFilled],
                ["Городов", structure.cities],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground">
                <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section data-testid="section-trade-points-cities">
        <Card className="rounded-xl border border-border bg-card text-card-foreground">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Города</h2>
              {cityCards.length > 0 ? (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  всего <span className="text-foreground">{cityCards.length}</span>
                </p>
              ) : null}
            </div>
            {cityCards.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет городов с торговыми точками.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-trade-points-cities">
                  {(citiesExpanded ? cityCards : cityCards.slice(0, 8)).map((c) => (
                    <Link
                      key={c.cityKey}
                      href={buildHashPath(`/dealer-base/city/${encodeURIComponent(c.cityKey)}`)}
                      data-testid={`card-tp-city-${c.cityKey}`}
                      className="group flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3 no-underline transition-all hover:border-[#9ACA3C]/60 hover:bg-background hover:shadow-[0_2px_8px_rgba(154,202,60,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-[#9ACA3C]">
                          {c.cityName}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-[#9ACA3C]" aria-hidden />
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-baseline gap-1">
                          <Store className="h-3 w-3" aria-hidden />
                          <span className="text-base font-semibold tabular-nums text-foreground">{c.tradePointsCount}</span>
                          <span>ТТ</span>
                        </span>
                        <span className="inline-flex items-baseline gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          <span className="text-base font-semibold tabular-nums text-foreground">{c.clientsCount}</span>
                          <span>клиентов</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {cityCards.length > 8 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs sm:w-auto"
                    data-testid="button-tp-cities-toggle-all"
                    onClick={() => setCitiesExpanded((v) => !v)}
                  >
                    {citiesExpanded ? "Свернуть" : `Показать все (+ ещё ${cityCards.length - 8})`}
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" data-testid="section-trade-points-rop-groups">
        {visibleRopGroups.length === 0 ? (
          <Card className="rounded-xl border border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">Нет команд с торговыми точками в текущем scope.</CardContent>
          </Card>
        ) : (
          visibleRopGroups.map((g, gi) => {
            const teamKey = teamSectionKey(g.teamId, gi);
            const managers = g.managers.map(managerCardFromOverview);
            const heatEntries = managers.map((m) => ({ id: m.userId, tradePoints: m.tradePoints }));
            const heatMap = computeManagerTpHeatMap(heatEntries);
            const sorted = sortManagersByTpLoad(
              managers.map((m) => ({ ...m, fullName: m.fullName })),
              heatMap,
            );

            return (
              <div
                key={teamKey}
                className="rounded-xl border border-border bg-card text-card-foreground"
                data-testid={`card-trade-points-rop-${teamKey}`}
              >
                <div className="border-b border-border/60 px-3 py-3 sm:px-4">
                  <h3 className="text-sm font-semibold text-foreground">{g.teamName || g.ropFullName}</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    менеджеров {g.managerCount} · ТТ {g.tradePoints} · клиентов с ТТ {g.clientsWithTp} · без фото{" "}
                    {g.withoutPhoto} · не заполнены {g.notFilled}
                  </p>
                </div>
                <div className="p-3 sm:p-4">
                  {sorted.length === 0 ? (
                    <p className="text-xs text-muted-foreground">В команде нет менеджеров с точками.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid={`grid-managers-tp-${teamKey}`}>
                      {sorted.map((m) => (
                        <ManagerTradePointsCard key={m.userId} manager={m} heatLevel={heatMap[m.userId] ?? "medium"} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {isMobile ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg justify-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 flex-1">
              <Link href={buildHashPath("/dealer-base")}>Клиентская база</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
