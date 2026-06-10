/**
 * Read-only диагностика расхождений счётчиков клиентов / ТТ / городов (промт 90).
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { defaultHomePathForUserRole } from "@/lib/auth-access";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import {
  applyDealerBasePickerFilters,
  type ClientCategorySelection,
} from "@/lib/dealer-base-picker-filters";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  roleScopedDealerRows,
} from "@/lib/dealer-base-role-views";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  resolveSidebarWorkingDealerClientCount,
  type SidebarDealerClientCountContext,
} from "@/lib/dealer-base-sidebar-client-count";
import { getManagersForRopTeam } from "@/lib/rop-manager-filters";
import { fetchTradePointsOverview } from "@/lib/trade-points-overview-api";
import { normalizeTerritoryCityName } from "@/lib/territory-city-normalize";

type DiagRow = {
  source: string;
  value: string;
  from: string;
};

function computePickerFilteredDefault(profile: ReturnType<typeof useReleaseDemoProfile>["profile"], actState: SidebarDealerClientCountContext): DealerRow[] {
  if (actState.enabled && actState.loading) return [];
  const actForRows = actState.managementDisplayState ?? actState.state;
  const merged = actState.enabled
    ? buildDealerBaseRowsWithActualization(actForRows, profile, { includeArchivedDealers: false })
    : DEALER_BASE_ROWS;
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  const scoped = roleScopedDealerRows(merged, profile);
  const init = initialRopManagerForProfile(profile, access);
  const pickerArgs = {
    search: "",
    quick: "all" as const,
    cities: [] as string[],
    categories: [] as ClientCategorySelection[],
    ropTeam: init.ropTeam,
    manager: init.manager,
    managerCatalogForRop: getManagersForRopTeam(init.ropTeam),
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  };
  return applyDealerBasePickerFilters(scoped, pickerArgs);
}

function uniqueCitiesFromRows(rows: DealerRow[]): number {
  const set = new Set<string>();
  for (const r of rows) {
    const c = normalizeTerritoryCityName(r.city, r.releaseAddress).replace(/^—$/, "Без города");
    if (c) set.add(c);
  }
  return set.size;
}

function DiagTable({ title, rows, footnote }: { title: string; rows: DiagRow[]; footnote?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Источник</TableHead>
              <TableHead className="text-right w-24">Значение</TableHead>
              <TableHead>Откуда</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source}>
                <TableCell className="text-sm">{row.source}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{row.value}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.from}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminCountsDiagPage() {
  const { user } = useCurrentUser();
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();

  const sidebarCtx: SidebarDealerClientCountContext = useMemo(
    () => ({
      enabled: actx.enabled,
      loading: actx.loading,
      state: actx.state,
      managementDisplayState: teamPlane.mergedState,
      managementTeamFetchLoading: teamPlane.teamFetchLoading,
    }),
    [actx.enabled, actx.loading, actx.state, teamPlane.mergedState, teamPlane.teamFetchLoading],
  );

  const overviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
    enabled: Boolean(user && ["admin", "director", "rop", "analyst"].includes(user.role)),
    staleTime: 30_000,
  });

  const pickerFiltered = useMemo(
    () => computePickerFilteredDefault(profile, sidebarCtx),
    [profile, sidebarCtx],
  );

  const sidebarClients = useMemo(
    () => resolveSidebarWorkingDealerClientCount(profile, sidebarCtx),
    [profile, sidebarCtx],
  );

  const dealerKpis = useMemo(() => {
    const total = pickerFiltered.length;
    const active = pickerFiltered.filter((r) => r.status === "активный").length;
    const potential = pickerFiltered.filter((r) => r.status === "потенциальный").length;
    const attention = pickerFiltered.filter((r) => r.status === "требует внимания" || r.hasProblem).length;
    const outlets = pickerFiltered.reduce((a, r) => a + r.outlets, 0);
    return { total, active, potential, attention, outlets };
  }, [pickerFiltered]);

  const overview = overviewQ.data ?? null;

  const ownRopGroup = useMemo(() => {
    if (!overview || !user) return null;
    return (
      overview.ropGroups.find((g) => g.ropUserId === user.id) ??
      overview.ropGroups.find((g) => g.ropFullName.toLowerCase().includes("купян")) ??
      overview.ropGroups[0] ??
      null
    );
  }, [overview, user]);

  const managersTpSum = useMemo(() => {
    if (!ownRopGroup) return null;
    return ownRopGroup.managers.reduce((a, m) => a + m.tradePoints, 0);
  }, [ownRopGroup]);

  const ropGroupsTpSum = useMemo(() => {
    if (!overview) return null;
    return overview.ropGroups.reduce((a, g) => a + g.tradePoints, 0);
  }, [overview]);

  const clientRows: DiagRow[] = useMemo(() => {
    const rows: DiagRow[] = [
      {
        source: "Сайдбар «Клиенты-дилеры»",
        value: sidebarClients == null ? "…" : String(sidebarClients),
        from: "resolveSidebarWorkingDealerClientCount(profile, ctx) — как в App.tsx",
      },
      {
        source: "/dealer-base — «Всего клиентов» (pickerFiltered)",
        value: String(dealerKpis.total),
        from: "buildDealerBaseRowsWithActualization + default picker (без UI-фильтров)",
      },
      {
        source: "/dealer-base — active",
        value: String(dealerKpis.active),
        from: 'status === "активный"',
      },
      {
        source: "/dealer-base — potential",
        value: String(dealerKpis.potential),
        from: 'status === "потенциальный"',
      },
      {
        source: "/dealer-base — attention",
        value: String(dealerKpis.attention),
        from: 'status === "требует внимания" || hasProblem',
      },
    ];
    if (overview) {
      rows.push(
        {
          source: "/trade-points overview — clientsWithTp",
          value: String(overview.structure.clientsWithTp),
          from: "fetchTradePointsOverview().structure.clientsWithTp",
        },
        {
          source: "/trade-points overview — totalActiveClients",
          value: String(overview.structure.totalActiveClients),
          from: "fetchTradePointsOverview().structure.totalActiveClients",
        },
      );
    }
    return rows;
  }, [sidebarClients, dealerKpis, overview]);

  const tpRows: DiagRow[] = useMemo(() => {
    const rows: DiagRow[] = [];
    if (overview) {
      rows.push(
        {
          source: "Сайдбар «Торговые точки»",
          value: String(overview.structure.activeTradePoints),
          from: "overview.structure.activeTradePoints (после 87.2)",
        },
        {
          source: "/dealer-base KPI «Торговые точки»",
          value: String(dealerKpis.outlets),
          from: "sum(r.outlets) по pickerFiltered",
        },
        {
          source: "/trade-points overview — activeTradePoints",
          value: String(overview.structure.activeTradePoints),
          from: "overview.structure.activeTradePoints",
        },
        {
          source: "/trade-points — sum(ropGroups.tradePoints)",
          value: ropGroupsTpSum == null ? "—" : String(ropGroupsTpSum),
          from: "overview.ropGroups.reduce((a,g) => a + g.tradePoints, 0)",
        },
      );
      if (ownRopGroup && managersTpSum != null) {
        rows.push({
          source: `Сумма менеджеров (${ownRopGroup.teamName || ownRopGroup.ropFullName})`,
          value: String(managersTpSum),
          from: "ownRopGroup.managers.reduce((a,m) => a + m.tradePoints, 0)",
        });
      }
    } else if (overviewQ.isLoading) {
      rows.push({ source: "Overview API", value: "…", from: "загрузка" });
    } else if (overviewQ.isError) {
      rows.push({ source: "Overview API", value: "ошибка", from: "fetchTradePointsOverview" });
    }
    return rows;
  }, [overview, dealerKpis.outlets, ropGroupsTpSum, ownRopGroup, managersTpSum, overviewQ.isLoading, overviewQ.isError]);

  const cityRows: DiagRow[] = useMemo(() => {
    const dealerCities = uniqueCitiesFromRows(pickerFiltered);
    return [
      {
        source: "/dealer-base — всего городов",
        value: String(dealerCities),
        from: "unique cities из pickerFiltered",
      },
      {
        source: "/trade-points — «Городов»",
        value: overview ? String(overview.structure.cities) : overviewQ.isLoading ? "…" : "—",
        from: "overview.structure.cities",
      },
    ];
  }, [pickerFiltered, overview, overviewQ.isLoading]);

  if (!user || !["admin", "director", "rop", "analyst"].includes(user.role)) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Недостаточно прав.{" "}
        <Link href={defaultHomePathForUserRole(user?.role ?? "manager")} className="text-primary underline">
          На главную
        </Link>
      </div>
    );
  }

  const loading = overviewQ.isLoading || (actx.enabled && (actx.loading || teamPlane.teamFetchLoading));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" data-testid="page-admin-counts-diag">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Диагностика счётчиков</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сравнение источников чисел для клиентов, торговых точек и городов (read-only).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Загрузка данных…
        </div>
      ) : null}

      <DiagTable
        title="Блок 1. Клиенты"
        rows={clientRows}
        footnote="Если сайдбар ≠ «Всего» на /dealer-base — проверьте фильтры на странице, real-scope (API) vs demo merge, корзину. Здесь — default picker как у сайдбара."
      />

      <DiagTable
        title="Блок 2. Торговые точки"
        rows={tpRows}
        footnote={
          dealerKpis.outlets !== overview?.structure.activeTradePoints
            ? "663 и подобные — это сырое поле r.outlets из сидов/релиза дилера; KPI /dealer-base суммирует outlets, а не dedup ТТ из actualization. Должно сходиться с overview.activeTradePoints после унификации."
            : "Сайдбар и /trade-points используют overview.activeTradePoints (dedup по tp.id)."
        }
      />

      <DiagTable
        title="Блок 3. Города"
        rows={cityRows}
        footnote="/dealer-base — все города клиентов в pickerFiltered; /trade-points — только города с активными ТТ в overview."
      />

      <Collapsible>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start px-0 font-semibold">
                Блок 4. Raw dump
              </Button>
            </CollapsibleTrigger>
            <CardDescription>pickerFiltered (5 строк), ropGroups, контекст загрузки</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Контекст</p>
                <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px]">
                  {JSON.stringify(
                    {
                      actxEnabled: actx.enabled,
                      actxLoading: actx.loading,
                      teamFetchLoading: teamPlane.teamFetchLoading,
                      pickerFilteredLen: pickerFiltered.length,
                      overviewLoaded: Boolean(overview),
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">pickerFiltered (первые 5)</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px]">
                  {JSON.stringify(
                    pickerFiltered.slice(0, 5).map((r) => ({
                      id: r.id,
                      name: r.name,
                      status: r.status,
                      outlets: r.outlets,
                      city: r.city,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">overview.ropGroups</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px]">
                  {JSON.stringify(
                    (overview?.ropGroups ?? []).map((g) => ({
                      teamId: g.teamId,
                      teamName: g.teamName,
                      ropFullName: g.ropFullName,
                      tradePoints: g.tradePoints,
                      clientsWithTp: g.clientsWithTp,
                      managerCount: g.managerCount,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void overviewQ.refetch()}
                disabled={overviewQ.isFetching}
              >
                Обновить overview
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
