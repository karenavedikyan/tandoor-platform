import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, ExternalLink, Info, Store, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ManagementCockpitSkeleton } from "@/components/skeletons/management-cockpit-skeleton";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import {
  VirtualizedStackList,
  largeListVirtualItemStyle,
  shouldVirtualizeLargeList,
  useLargeListScrollMargin,
  useLargeListWindowVirtualizer,
} from "@/lib/window-list-virtualizer";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { getDealerManagerDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import { catalogTeamIdForRopUserId } from "@/lib/dealer-base-real-scope";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { realRopOptions } from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import { fetchClientBaseClientsList } from "@/lib/client-base-overview-api";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { DealerActualizationCreateDialog } from "@/components/client-base-actualization-dealer-forms";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { RoleDistributionSummaryBar } from "@/components/distribution/role-distribution-summary-bar";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import { buildDealerBaseRowsWithActualization, mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import { getCatalogDealerRows } from "@/lib/dealer-base-source";
import { canCreateDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import {
  buildCityModels,
  buildDbAwareManagerMatcher,
  buildRopGroups,
  resolveManagementCatalogTeamId,
  resolveManagementOrgTeamUuid,
  buildStructureInfographic,
  buildOverviewCityCardsFromDb,
  computeUnstatusedCatalogClients,
  dealerMatchesClientListFilter,
  dealerMatchesKpiClientListFilter,
  flattenTradePointsForRows,
  mapClientsListItemToDealerRow,
  mapClientsListTradePointsToListRows,
  mapManagerOverviewClients,
  mergeOverviewClientCountsIntoRopGroups,
  resolveClientKpisFromOverview,
  topCitiesForChart,
  teamsForManagementView,
  type CityRowModel,
  type ClientListFilter,
  type DirectorClientBaseMode,
  type ManagerRowModel,
  type RopGroupModel,
} from "@/lib/dealer-base-management-view-model";
import { useMyClientCodes } from "@/hooks/use-my-client-codes";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";
import { useLocation } from "wouter";
import { ManagerTeamCard } from "@/components/dealer-base/manager-team-card";
import { RopTeamTreeDiagPanel } from "@/components/dealer-base/rop-team-tree-diag-panel";
import { buildRopTeamTreeDiagLines, isRopTreeDiagEnabled } from "@/lib/dealer-base-rop-tree-diag";
import {
  computeManagerHeatMap,
  sortManagersByHeat,
  type ManagerHeatLevel,
} from "@/lib/manager-load-heat";
import { fetchTradePointsOverview } from "@/lib/trade-points-overview-api";
import type { MemberTotals, TeamScopePayload, TeamTotals } from "@shared/dealers-scope-types";

const MODE_LS_KEY = "tandoor-dealer-base-management-mode-v1";
const OPEN_ROPS_LS_KEY = "tandoor-dealer-base-management-open-rops-v1";
const EMPTY_RESPONSIBLE_BY_CODE: Record<string, string> = {};

type DetailKind =
  | { kind: "rop"; teamId: string }
  | { kind: "manager"; teamId: string; managerId: string }
  | { kind: "city"; cityKey: string }
  | { kind: "rop_overview"; teamId: string }
  | { kind: "manager_overview"; managerCatalogId: string; teamId: string }
  | { kind: "kpi-clients" }
  | { kind: "kpi-trade-points" };

const FILTER_LABELS: Record<ClientListFilter, string> = {
  all: "Все",
  active: "Активные",
  potential: "Потенциальные",
  attention: "Внимание",
  noTp: "Без ТТ",
  no_status: "Без статуса",
};

function readMode(): DirectorClientBaseMode {
  try {
    const r = localStorage.getItem(MODE_LS_KEY);
    if (r === "overview" || r === "by_rop" || r === "cities") return r;
  } catch {
    /* ignore */
  }
  return "overview";
}

function isOwnTeamForUser(
  teamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
  orgSnap?: OrgSnapshot | null,
): boolean {
  if (access !== "team_lead") return false;
  const ownTeam = getEffectiveTeamLeadTeamId(profile);
  const catalogOwn = orgSnap ? resolveManagementCatalogTeamId(ownTeam, orgSnap) : ownTeam;
  const catalogTeam = orgSnap ? resolveManagementCatalogTeamId(teamId, orgSnap) : teamId;
  return catalogOwn === catalogTeam || ownTeam === teamId;
}

function readOpenRops(): string[] {
  try {
    const r = localStorage.getItem(OPEN_ROPS_LS_KEY);
    if (!r) return [];
    const p = JSON.parse(r) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function detailRows(detail: DetailKind | null, ropGroups: RopGroupModel[], cities: CityRowModel[], allRows: DealerRow[]): DealerRow[] {
  if (!detail) return [];
  if (detail.kind === "rop_overview" || detail.kind === "manager_overview") return [];
  if (detail.kind === "kpi-clients" || detail.kind === "kpi-trade-points") return allRows;
  if (detail.kind === "city") {
    const c = cities.find((x) => x.cityKey === detail.cityKey);
    return c?.dealerRows ?? [];
  }
  if (detail.kind === "rop") {
    return ropGroups.find((g) => g.teamId === detail.teamId)?.rows ?? [];
  }
  const g = ropGroups.find((x) => x.teamId === detail.teamId);
  const m = g?.managers.find((x) => x.managerId === detail.managerId);
  return m?.rows ?? [];
}

function detailTitle(detail: DetailKind | null, ropGroups: RopGroupModel[], cities: CityRowModel[]): string {
  if (!detail) return "";
  if (detail.kind === "rop_overview") return "Детали команды";
  if (detail.kind === "manager_overview") return "Менеджер";
  if (detail.kind === "kpi-clients") return "Клиенты";
  if (detail.kind === "kpi-trade-points") return "Торговые точки";
  if (detail.kind === "city") return cities.find((c) => c.cityKey === detail.cityKey)?.displayName ?? "Город";
  if (detail.kind === "rop") return ropGroups.find((g) => g.teamId === detail.teamId)?.ropName ?? "Команда";
  const g = ropGroups.find((x) => x.teamId === detail.teamId);
  const m = g?.managers.find((x) => x.managerId === detail.managerId);
  return m?.name ?? "Менеджер";
}

function CockpitFilteredClientList({
  rows,
  wide,
  listRef,
}: {
  rows: DealerRow[];
  wide: boolean;
  listRef: RefObject<HTMLDivElement>;
}) {
  const useVirtual = shouldVirtualizeLargeList(rows.length);
  const scrollMargin = useLargeListScrollMargin(listRef, [rows.length, wide, useVirtual]);
  const virtualizer = useLargeListWindowVirtualizer({
    count: rows.length,
    estimateSize: wide ? 56 : 96,
    scrollMargin,
    enabled: useVirtual,
  });
  const virtualItems = virtualizer?.getVirtualItems() ?? [];

  const renderClientRow = (r: DealerRow) => {
    if (wide) {
      return (
        <TableRow key={r.id} className="border-[#E3E6F3]">
          <TableCell className="max-w-[200px] truncate font-medium text-[#222631]">
            <span className="inline-flex max-w-full flex-wrap items-center gap-1">{r.name}</span>
          </TableCell>
          <TableCell className="text-sm text-[#8F96B0]">{r.city}</TableCell>
          <TableCell className="text-sm text-[#8F96B0]">{getDealerManagerDisplay(r)}</TableCell>
          <TableCell className="text-right tabular-nums text-[#222631]">{r.outlets}</TableCell>
          <TableCell>
            <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
              <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Карточка</Link>
            </Button>
          </TableCell>
        </TableRow>
      );
    }
    return (
      <li key={r.id} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3">
        <p className="inline-flex max-w-full flex-wrap items-center gap-1 font-medium text-[#222631]">{r.name}</p>
        <p className="text-xs text-[#8F96B0]">
          {r.city} · {getDealerManagerDisplay(r)} · ТТ {r.outlets}
        </p>
        <Button variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs" asChild>
          <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Открыть карточку</Link>
        </Button>
      </li>
    );
  };

  if (wide) {
    return (
      <div ref={listRef} data-testid="management-cockpit-client-list">
        <Table>
          <TableHeader>
            <TableRow className="border-[#E3E6F3]">
              <TableHead className="text-[#8F96B0]">Клиент</TableHead>
              <TableHead className="text-[#8F96B0]">Город</TableHead>
              <TableHead className="text-[#8F96B0]">Менеджер</TableHead>
              <TableHead className="text-right text-[#8F96B0]">ТТ</TableHead>
              <TableHead className="w-[100px] text-[#8F96B0]"> </TableHead>
            </TableRow>
          </TableHeader>
          {useVirtual && virtualizer ? (
            <TableBody className="relative block" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((vi) => {
                const r = rows[vi.index]!;
                return (
                  <TableRow
                    key={r.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 flex w-full table border-[#E3E6F3]"
                    style={largeListVirtualItemStyle(virtualizer, vi.start)}
                    data-testid={`row-management-client-${r.id}`}
                  >
                    <TableCell className="max-w-[200px] truncate font-medium text-[#222631]">{r.name}</TableCell>
                    <TableCell className="text-sm text-[#8F96B0]">{r.city}</TableCell>
                    <TableCell className="text-sm text-[#8F96B0]">{getDealerManagerDisplay(r)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[#222631]">{r.outlets}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                        <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Карточка</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ) : (
            <TableBody>{rows.map((r) => renderClientRow(r))}</TableBody>
          )}
        </Table>
      </div>
    );
  }

  if (useVirtual) {
    return (
      <VirtualizedStackList
        listRef={listRef}
        items={rows}
        estimateSize={96}
        className="space-y-2"
        data-testid="management-cockpit-client-list"
        getKey={(r) => r.id}
        rowTestIdPrefix="row-management-client"
        renderItem={(r) => renderClientRow(r)}
      />
    );
  }

  return <ul className="space-y-2">{rows.map((r) => renderClientRow(r))}</ul>;
}

export function DealerBaseManagementCockpit({
  rows,
  profile,
  orgTeamCtx,
  overview,
  scopeTotalDealers,
  mergedDealerRowsForCreate,
  teamTotalsById,
  membersTotalsByTeamId,
  teamScopeForDiag,
}: {
  rows: DealerRow[];
  profile: ReleaseDemoProfile;
  orgTeamCtx?: { snap: OrgSnapshot; access: DealerBaseAccessRole } | null;
  overview?: ClientBaseOverview | null;
  scopeTotalDealers?: number | null;
  mergedDealerRowsForCreate?: DealerRow[] | null;
  teamTotalsById?: Map<string, TeamTotals>;
  membersTotalsByTeamId?: Map<string, Map<string, MemberTotals>>;
  teamScopeForDiag?: TeamScopePayload | null;
}) {
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const access = useMemo(() => {
    if (orgTeamCtx) return orgTeamCtx.access;
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [orgTeamCtx, profile.role]);

  const cockpitScopeTradePointIds = useMemo(() => {
    if (!actx.enabled) return [] as string[];
    const ids: string[] = [];
    for (const row of rows) {
      for (const e of mergeTradePointsForActualization(row, teamCtx.mergedState)) {
        if (!e.isArchived) ids.push(e.point.id);
      }
    }
    return ids;
  }, [actx.enabled, rows, teamCtx.mergedState]);

  const cockpitDistribution = useTradePointDistributionAggregate(
    cockpitScopeTradePointIds,
    teamCtx.mergedState,
  );

  const [mode, setMode] = useState<DirectorClientBaseMode>(() => readMode());
  const [openRops, setOpenRops] = useState<string[]>(() => readOpenRops());
  const [openOverviewTeamIds, setOpenOverviewTeamIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [detailTab, setDetailTab] = useState<"clients" | "tp">("clients");
  const [clientFilter, setClientFilter] = useState<ClientListFilter>("all");
  const [pendingClientFilter, setPendingClientFilter] = useState<ClientListFilter>("all");
  const [createDealerOpen, setCreateDealerOpen] = useState(false);
  const [citiesExpanded, setCitiesExpanded] = useState(false);
  const clientListRef = useRef<HTMLDivElement>(null);

  useScrollRestoration();

  useEffect(() => {
    try {
      localStorage.setItem(MODE_LS_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_ROPS_LS_KEY, JSON.stringify(openRops));
    } catch {
      /* ignore */
    }
  }, [openRops]);

  useEffect(() => {
    setClientFilter(pendingClientFilter);
    if (detail?.kind === "kpi-trade-points") setDetailTab("tp");
    else setDetailTab("clients");
    // pendingClientFilter намеренно не в deps: применяем снимок на момент открытия detail
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const scrollToDetailPanel = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-testid="dialog-client-base-group-detail"]');
      el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }, []);

  const teams = useMemo(
    () => teamsForManagementView(profile, teamCtx.dashboardRopTeamId, orgTeamCtx ?? null),
    [profile, teamCtx.dashboardRopTeamId, orgTeamCtx],
  );
  const teamIds = useMemo(() => teams.map((t) => t.teamId), [teams]);

  const myCodesQ = useMyClientCodes();
  const userIdToCatalogMgrId = useMemo(
    () => new Map(Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE)),
    [],
  );
  const responsibleByCode = myCodesQ.data?.responsibleByCode ?? EMPTY_RESPONSIBLE_BY_CODE;
  const grantedCodes = myCodesQ.data?.grantedCodes;

  const baseRopGroups = useMemo(
    () =>
      buildRopGroups(
        rows,
        teams,
        orgTeamCtx?.snap,
        responsibleByCode,
        userIdToCatalogMgrId,
        grantedCodes,
        teamTotalsById,
        membersTotalsByTeamId,
      ),
    [rows, teams, orgTeamCtx, responsibleByCode, userIdToCatalogMgrId, grantedCodes, teamTotalsById, membersTotalsByTeamId],
  );

  const ropGroups = useMemo(() => {
    if (!overview?.ropGroups?.length) return baseRopGroups;
    return mergeOverviewClientCountsIntoRopGroups(
      baseRopGroups,
      overview.ropGroups,
      orgTeamCtx?.snap,
      userIdToCatalogMgrId,
    );
  }, [baseRopGroups, overview, orgTeamCtx?.snap, userIdToCatalogMgrId]);

  const ropTreeDiagLines = useMemo(() => {
    if (!isRopTreeDiagEnabled() || access !== "team_lead" || !teamScopeForDiag || !orgTeamCtx?.snap) {
      return [];
    }
    const ownGroup = ropGroups.find((g) =>
      isOwnTeamForUser(g.teamId, profile, access, orgTeamCtx.snap),
    );
    const membersTotalsById = membersTotalsByTeamId?.get(ownGroup?.teamId ?? teamScopeForDiag.team.id);
    return buildRopTeamTreeDiagLines({
      teamId: ownGroup?.teamId ?? teamScopeForDiag.team.id,
      orgSnap: orgTeamCtx.snap,
      members: teamScopeForDiag.members,
      membersTotalsById,
      ropGroup: ownGroup,
    });
  }, [access, teamScopeForDiag, orgTeamCtx?.snap, ropGroups, membersTotalsByTeamId, profile]);

  const ownTeamIds = useMemo(
    () =>
      ropGroups
        .filter((g) => isOwnTeamForUser(g.teamId, profile, access, orgTeamCtx?.snap))
        .map((g) => g.teamId),
    [ropGroups, profile, access, orgTeamCtx?.snap],
  );

  useEffect(() => {
    if (ownTeamIds.length > 0 && openOverviewTeamIds.length === 0) {
      setOpenOverviewTeamIds(ownTeamIds);
    }
  }, [ownTeamIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps -- re-init when teams load


  const cities = useMemo(() => buildCityModels(rows), [rows]);
  const structure = useMemo(() => buildStructureInfographic(rows, teamIds), [rows, teamIds]);
  const cityChart = useMemo(() => topCitiesForChart(cities, 5), [cities]);

  const tradePointsOverviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
    staleTime: 30_000,
  });
  const clientsListQ = useQuery({
    queryKey: ["client-base-clients-list"],
    queryFn: () => fetchClientBaseClientsList({}),
    enabled: Boolean(overview),
    staleTime: 30_000,
  });
  const overviewTradePointsCount = tradePointsOverviewQ.data?.structure.activeTradePoints ?? null;
  const overviewTradePointsLoading = tradePointsOverviewQ.isLoading && !tradePointsOverviewQ.data;
  const tpKpiCount = overviewTradePointsCount ?? structure.outlets;
  const tpCountDisplay = (): string =>
    overviewTradePointsLoading
      ? "…"
      : overviewTradePointsCount != null
        ? String(overviewTradePointsCount)
        : String(structure.outlets);

  const overviewByManagerId = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    const data = tradePointsOverviewQ.data;
    if (!data) return out;
    for (const g of data.ropGroups) {
      for (const m of g.managers) {
        out.set(m.userId, m.tradePoints);
        const catalogId = userIdToCatalogMgrId.get(m.userId);
        if (catalogId) out.set(catalogId, m.tradePoints);
      }
    }
    return out;
  }, [tradePointsOverviewQ.data, userIdToCatalogMgrId]);

  const overviewByTeamId = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    const data = tradePointsOverviewQ.data;
    const snap = orgTeamCtx?.snap ?? null;
    if (!data) return out;
    for (const g of data.ropGroups) {
      const keys = new Set<string>();
      if (g.teamId) keys.add(String(g.teamId));
      if (g.ropUserId) keys.add(String(g.ropUserId));
      keys.add(String(g.teamId ?? g.ropUserId ?? "__no_rop__"));
      if (g.teamId && snap) {
        keys.add(resolveManagementCatalogTeamId(g.teamId, snap));
        keys.add(resolveManagementOrgTeamUuid(g.teamId, snap));
      }
      if (g.ropUserId && snap) {
        const fromRop = catalogTeamIdForRopUserId(snap, g.ropUserId);
        if (fromRop) keys.add(fromRop);
      }
      for (const k of Array.from(keys)) out.set(k, g.tradePoints);
    }
    return out;
  }, [tradePointsOverviewQ.data, orgTeamCtx?.snap]);

  const resolveTeamTp = useCallback(
    (g: { teamId?: string | null; ropUserId?: string | null; outlets: number }) => {
      const key = String(g.teamId ?? g.ropUserId ?? "__no_rop__");
      return overviewByTeamId.get(key) ?? g.outlets;
    },
    [overviewByTeamId],
  );

  const resolveManagerTp = useCallback(
    (m: { managerId?: string; userId?: string; outlets: number }) => {
      const key = String(m.managerId ?? m.userId ?? "");
      if (!key) return m.outlets;
      return overviewByManagerId.get(key) ?? m.outlets;
    },
    [overviewByManagerId],
  );

  const ropGroupManagersViewByTeamKey = useMemo(() => {
    const openSet = new Set(openOverviewTeamIds);
    const map = new Map<
      string,
      {
        sortedManagers: Array<ManagerRowModel & { id: string; fullName: string }>;
        heatMap: Record<string, ManagerHeatLevel>;
      }
    >();
    for (const g of ropGroups) {
      const teamKey = g.teamId ?? "__no_rop__";
      if (!openSet.has(teamKey)) continue;
      const heatEntries = g.managers.map((m) => ({
        id: m.managerId,
        clientsActive: m.active,
        tradePointsActive: resolveManagerTp(m),
      }));
      const heatMap = computeManagerHeatMap(heatEntries);
      const sortedManagers = sortManagersByHeat(
        g.managers.map((m) => ({ ...m, id: m.managerId, fullName: m.name })),
        heatMap,
        heatEntries,
      );
      map.set(teamKey, { sortedManagers, heatMap });
    }
    return map;
  }, [ropGroups, openOverviewTeamIds, resolveManagerTp]);

  const overviewTpByCity = useMemo<Map<string, number>>(() => {
    const out = new Map<string, number>();
    const data = tradePointsOverviewQ.data;
    if (!data) return out;
    for (const c of data.cities) {
      out.set(c.cityName, c.tradePointsCount);
      out.set(c.cityKey, c.tradePointsCount);
    }
    return out;
  }, [tradePointsOverviewQ.data]);

  const resolveCityTp = useCallback(
    (c: { cityKey: string; displayName: string; tradePoints: number }) => {
      if (overviewTpByCity.has(c.displayName)) return overviewTpByCity.get(c.displayName)!;
      if (overviewTpByCity.has(c.cityKey)) return overviewTpByCity.get(c.cityKey)!;
      return c.tradePoints;
    },
    [overviewTpByCity],
  );

  const maxBar = useMemo(
    () => Math.max(structure.active, tpKpiCount, structure.potential, structure.attention, 1),
    [structure, tpKpiCount],
  );

  const kpiDbRows = useMemo(
    () => (clientsListQ.data?.clients ?? []).map(mapClientsListItemToDealerRow),
    [clientsListQ.data],
  );
  const kpiDbClientsById = useMemo(() => new Map(kpiDbRows.map((r) => [r.id, r])), [kpiDbRows]);
  const isKpiDetail = detail?.kind === "kpi-clients" || detail?.kind === "kpi-trade-points";
  const useKpiDbList = Boolean(overview && isKpiDetail);

  const detailSourceRows = useMemo(() => {
    if (useKpiDbList && clientsListQ.data) return kpiDbRows;
    return detailRows(detail, ropGroups, cities, rows);
  }, [useKpiDbList, clientsListQ.data, kpiDbRows, detail, ropGroups, cities, rows]);

  const filteredClients = useMemo(() => {
    const match = useKpiDbList ? dealerMatchesKpiClientListFilter : dealerMatchesClientListFilter;
    return detailSourceRows.filter((r) => match(r, clientFilter));
  }, [detailSourceRows, clientFilter, useKpiDbList]);

  const tradePointRows = useMemo(() => {
    if (detail?.kind === "kpi-trade-points" && clientsListQ.data) {
      return mapClientsListTradePointsToListRows(clientsListQ.data.tradePoints, kpiDbClientsById);
    }
    return flattenTradePointsForRows(detailSourceRows);
  }, [detail, clientsListQ.data, kpiDbClientsById, detailSourceRows]);

  const closeDetail = useCallback(() => setDetail(null), []);

  const openClientsWithFilter = useCallback(
    (f: ClientListFilter) => {
      setPendingClientFilter(f);
      setDetail({ kind: "kpi-clients" });
      scrollToDetailPanel();
    },
    [scrollToDetailPanel],
  );

  const openTradePointsDetail = useCallback(() => {
    setDetail({ kind: "kpi-trade-points" });
    scrollToDetailPanel();
  }, [scrollToDetailPanel]);

  const selectedManager = useMemo(() => {
    if (detail?.kind !== "manager_overview") return null;
    const inTeam = ropGroups
      .find((x) => x.teamId === detail.teamId)
      ?.managers.find((m) => m.managerId === detail.managerCatalogId);
    if (inTeam) return inTeam;
    return ropGroups.flatMap((x) => x.managers).find((m) => m.managerId === detail.managerCatalogId) ?? null;
  }, [detail, ropGroups]);

  const selectedManagerClients = useMemo(() => {
    if (!selectedManager) return [];
    return mapManagerOverviewClients(selectedManager.rows);
  }, [selectedManager]);

  const selectedManagerRopName = useMemo(() => {
    if (!selectedManager) return "—";
    return ropGroups.find((g) => g.teamId === selectedManager.teamId)?.ropName ?? "—";
  }, [selectedManager, ropGroups]);

  const overviewTopCities = useMemo(() => {
    if (overview) return buildOverviewCityCardsFromDb(overview);
    return cities
      .filter((c) => c.displayName !== "Без города" && c.activeClients > 0)
      .sort((a, b) => b.activeClients - a.activeClients || a.displayName.localeCompare(b.displayName, "ru"));
  }, [overview, cities]);

  const overviewWithoutCity = useMemo(() => {
    if (overview) {
      return {
        cityKey: "__no_city__",
        displayName: "Без города",
        activeClients: overview.withoutCity.clients,
        tradePoints: overview.withoutCity.tradePoints,
      };
    }
    return cities.find((c) => c.displayName === "Без города");
  }, [overview, cities]);

  const clientKpis = useMemo(
    () =>
      resolveClientKpisFromOverview(overview, {
        active: structure.active,
        potential: structure.potential,
        attention: structure.attention,
      }),
    [overview, structure],
  );

  const totalCatalog = scopeTotalDealers ?? rows.length;
  const otherCount = computeUnstatusedCatalogClients(totalCatalog, clientKpis.active, clientKpis.potential);

  const overviewRopGroupForDetail = useMemo(() => {
    if (detail?.kind !== "rop_overview") return null;
    return ropGroups.find((g) => g.teamId === detail.teamId) ?? null;
  }, [detail, ropGroups]);

  const mergedForCreate = useMemo(() => {
    if (mergedDealerRowsForCreate && mergedDealerRowsForCreate.length > 0) return mergedDealerRowsForCreate;
    return actx.enabled
      ? buildDealerBaseRowsWithActualization(teamCtx.mergedState, profile)
      : getCatalogDealerRows();
  }, [mergedDealerRowsForCreate, actx.enabled, teamCtx.mergedState, profile]);

  const setModeAndPersist = useCallback((m: DirectorClientBaseMode) => {
    setMode(m);
    if (m === "overview") setOpenRops([]);
  }, []);

  const modeBtn = (m: DirectorClientBaseMode, label: string, tid: string) => {
    const active = mode === m;
    return (
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        className={cn(
          "h-9 flex-1 rounded-lg border text-xs font-semibold sm:flex-none sm:px-4",
          active ? "border-primary bg-primary text-primary-foreground hover:bg-[#86B832]" : "border-[#E3E6F3] bg-[#FFFFFF] text-[#222631]",
        )}
        data-testid={tid}
        onClick={() => setModeAndPersist(m)}
      >
        {label}
      </Button>
    );
  };

  const renderTpRows = (wide: boolean) => {
    if (wide) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="border-[#E3E6F3]">
              <TableHead className="text-[#8F96B0]">Точка</TableHead>
              <TableHead className="text-[#8F96B0]">Город</TableHead>
              <TableHead className="text-[#8F96B0]">Клиент</TableHead>
              <TableHead className="text-[#8F96B0]">Менеджер</TableHead>
              <TableHead className="w-[100px] text-[#8F96B0]"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tradePointRows.map((tp) => (
              <TableRow key={tp.tpId} className="border-[#E3E6F3]">
                <TableCell className="max-w-[180px] truncate font-medium text-[#222631]">{tp.name}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{tp.city}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{tp.dealerName}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{tp.manager}</TableCell>
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
      );
    }
    return (
      <ul className="space-y-2">
        {tradePointRows.map((tp) => (
          <li key={tp.tpId} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3">
            <p className="font-medium text-[#222631]">{tp.name}</p>
            <p className="text-xs text-[#8F96B0]">
              {tp.city} · {tp.dealerName} · {tp.manager}
            </p>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs" asChild>
              <Link
                href={buildHashPath(
                  `/dealers/${encodeURIComponent(tp.dealerId)}/trade-points/${encodeURIComponent(tp.tpId)}`,
                )}
              >
                Торговая точка
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  const detailBody = detail ? (
    <div className="space-y-4">
      {useKpiDbList && clientsListQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : useKpiDbList && clientsListQ.isError ? (
        <p className="text-sm text-destructive">Не удалось загрузить список из базы.</p>
      ) : (
        <>
      {detailTab === "clients" ? (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as ClientListFilter[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={clientFilter === f ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full border px-3 text-xs",
                clientFilter === f ? "border-primary bg-primary hover:bg-[#86B832]" : "border-[#E3E6F3] bg-[#FFFFFF]",
              )}
              onClick={() => setClientFilter(f)}
            >
              {FILTER_LABELS[f]}
            </Button>
          ))}
        </div>
      ) : null}
      <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "clients" | "tp")}>
        <TabsList className="grid w-full grid-cols-2 border border-[#E3E6F3] bg-[#EEEFF6]/50">
          <TabsTrigger value="clients" className="text-xs" data-testid="tab-client-base-detail-clients">
            Клиенты ({filteredClients.length})
          </TabsTrigger>
          <TabsTrigger value="tp" className="text-xs" data-testid="tab-client-base-detail-trade-points">
            Торговые точки ({tradePointRows.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-3 space-y-2">
          {filteredClients.length === 0 ? <p className="text-sm text-[#8F96B0]">Нет клиентов по фильтру.</p> : null}
          <CockpitFilteredClientList rows={filteredClients} wide={!isMobile} listRef={clientListRef} />
        </TabsContent>
        <TabsContent value="tp" className="mt-3 space-y-2">
          {tradePointRows.length === 0 ? <p className="text-sm text-[#8F96B0]">Нет торговых точек в выборке.</p> : null}
          {renderTpRows(!isMobile)}
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  ) : null;

  if (overview) {
    const isKpiDetail = detail?.kind === "kpi-clients" || detail?.kind === "kpi-trade-points";
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-dealer-base">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиентская база</h1>
            <p className="mt-1 text-sm text-muted-foreground">Управленческий обзор клиентской базы.</p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {canCreateDealerDuringActualization(profile) && actx.enabled ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="min-h-10 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-create"
                onClick={() => setCreateDealerOpen(true)}
              >
                Добавить клиента
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="min-h-10 w-full sm:w-auto" asChild>
              <Link href={buildHashPath("/client-map")} data-testid="button-dealer-base-open-client-map">
                Карта клиентов
              </Link>
            </Button>
          </div>
        </div>
        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="min-w-0 flex-1 space-y-6">
            <section data-testid="section-client-base-structure-infographic">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    ["Всего в каталоге", String(totalCatalog), null, () => openClientsWithFilter("all"), "kpi-card-total"],
                    ["Активные клиенты", String(clientKpis.active), null, () => openClientsWithFilter("active"), "kpi-card-active"],
                    ["Потенциальные", String(clientKpis.potential), null, () => openClientsWithFilter("potential"), "kpi-card-potential"],
                    ["Без статуса", String(otherCount), "не проработаны", () => openClientsWithFilter("no_status"), "kpi-card-no-status"],
                    ["Внимание", String(clientKpis.attention), null, () => openClientsWithFilter("attention"), "kpi-card-attention"],
                    ["Торговые точки", tpCountDisplay(), null, openTradePointsDetail, "kpi-card-trade-points"],
                  ] as Array<[string, string, string | null, () => void, string]>
                ).map(([label, value, hint, action, testId]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    data-testid={testId}
                    className="group rounded-xl border border-border bg-card px-3 py-2.5 text-left text-card-foreground transition-all hover:border-[#9ACA3C]/60 hover:bg-background hover:shadow-[0_2px_8px_rgba(154,202,60,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <p className="text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">{label}</p>
                    <p className="mt-0.5 text-lg font-semibold text-foreground tabular-nums sm:text-xl">{value}</p>
                    {hint ? <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</p> : null}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground" data-testid="text-client-base-reconcile-note">
                Активные + Потенциальные + Без статуса = Всего в каталоге. «Внимание» — пересекающийся признак (давно без
                обновления), не отдельная категория.
              </p>
            </section>
            <RoleDistributionSummaryBar
              access={access}
              aggregate={cockpitDistribution.aggregate}
              tradePointsCount={cockpitDistribution.tradePointsCount}
              tradePointIds={cockpitScopeTradePointIds}
              testIdPrefix="cockpit-clients"
              showTradePointsCount={false}
            />
            <section data-testid="section-client-base-cities">
              <Card className="rounded-xl border border-border bg-card text-card-foreground">
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Города</h3>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      всего <span className="text-foreground">{overviewTopCities.length}</span>
                    </p>
                  </div>
                  {overviewTopCities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Нет городов с клиентами.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-cities">
                        {(citiesExpanded ? overviewTopCities : overviewTopCities.slice(0, 8)).map((c) => (
                          <Link
                            key={c.cityKey}
                            href={buildHashPath(`/dealer-base/city/${encodeURIComponent(c.cityKey)}`)}
                            data-testid={`card-city-${c.cityKey}`}
                            className="group flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3 no-underline transition-all hover:border-[#9ACA3C]/60 hover:bg-background hover:shadow-[0_2px_8px_rgba(154,202,60,0.08)]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-[#9ACA3C]">
                                {c.displayName}
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[#9ACA3C]" aria-hidden />
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-baseline gap-1">
                                <Users className="h-3 w-3" aria-hidden />
                                <span className="text-base font-semibold tabular-nums text-foreground">{c.activeClients}</span>
                                <span>клиентов</span>
                              </span>
                              <span className="inline-flex items-baseline gap-1">
                                <Store className="h-3 w-3" aria-hidden />
                                <span className="text-base font-semibold tabular-nums text-foreground">{resolveCityTp(c)}</span>
                                <span>ТТ</span>
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                      {overviewTopCities.length > 8 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full text-xs sm:w-auto"
                          data-testid="button-cities-toggle-all"
                          onClick={() => setCitiesExpanded((v) => !v)}
                        >
                          {citiesExpanded ? "Свернуть" : `Показать все (+ ещё ${overviewTopCities.length - 8})`}
                        </Button>
                      ) : null}
                    </>
                  )}
                  {overviewWithoutCity && (overviewWithoutCity.activeClients > 0 || overviewWithoutCity.tradePoints > 0) ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground" data-testid="card-city-no-city">
                      Без города: клиенты{" "}
                      <span className="font-semibold text-foreground">{overviewWithoutCity.activeClients}</span>
                      {" · "}ТТ <span className="font-semibold text-foreground">{resolveCityTp(overviewWithoutCity)}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
            <section className="space-y-2" data-testid="section-client-base-rop-groups">
              <Accordion type="multiple" value={openOverviewTeamIds} onValueChange={setOpenOverviewTeamIds} className="space-y-2">
                {ropGroups.map((g) => {
                  const teamKey = g.teamId ?? "__no_rop__";
                  const isOpen = openOverviewTeamIds.includes(teamKey);
                  const managersView = ropGroupManagersViewByTeamKey.get(teamKey);
                  return (
                    <AccordionItem
                      key={teamKey}
                      value={teamKey}
                      className="rounded-xl border border-border bg-card text-card-foreground"
                      data-testid={`card-client-base-rop-${teamKey}`}
                    >
                      <AccordionTrigger className="px-3 py-2 hover:no-underline" data-testid={`button-client-base-rop-toggle-${teamKey}`}>
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                          <span className="truncate text-sm font-semibold text-foreground">{g.ropName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            менеджеров {g.managers.length} · клиенты {g.active} · ТТ {resolveTeamTp(g)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-0">
                        {isOpen && managersView ? (
                          <>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <p className="text-[11px] text-muted-foreground">
                                потенц. {g.potential} · вним. {g.attention}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ml-auto h-8 text-xs"
                                data-testid={`button-client-base-rop-details-${teamKey}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetail({ kind: "rop_overview", teamId: teamKey });
                                }}
                              >
                                Детали команды
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid={`grid-managers-${teamKey}`}>
                              {managersView.sortedManagers.map((m) => (
                                <ManagerTeamCard
                                  key={m.managerId}
                                  manager={{ ...m, outlets: resolveManagerTp(m) }}
                                  ropName={g.ropName}
                                  heatLevel={managersView.heatMap[m.managerId] ?? "medium"}
                                />
                              ))}
                            </div>
                          </>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          </div>
          {!isMobile && isKpiDetail ? (
            <aside
              className="sticky top-4 hidden w-full max-w-md shrink-0 rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] shadow-sm lg:block lg:max-w-[440px]"
              data-testid="dialog-client-base-group-detail"
            >
              <div className="flex items-center justify-between border-b border-[#E3E6F3] px-4 py-3">
                <h3 className="text-sm font-semibold text-[#222631]">{detailTitle(detail, ropGroups, cities)}</h3>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={closeDetail}>
                  Закрыть
                </Button>
              </div>
              <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{detailBody}</div>
            </aside>
          ) : null}
        </div>
        <DealerActualizationCreateDialog
          open={createDealerOpen}
          onOpenChange={setCreateDealerOpen}
          profile={profile}
          mergedDealerRows={mergedForCreate}
          onCreated={(id) => setLocation(`/dealers/${encodeURIComponent(id)}`)}
        />
        <Sheet
          open={Boolean(
            detail &&
              ((isMobile && isKpiDetail) ||
                detail.kind === "manager_overview" ||
                detail.kind === "rop_overview"),
          )}
          onOpenChange={(o) => !o && closeDetail()}
        >
          <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl border-border bg-card p-0">
            <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-base text-foreground">
                {isKpiDetail
                  ? detailTitle(detail, ropGroups, cities)
                  : detail?.kind === "manager_overview"
                    ? (selectedManager?.name ?? "Менеджер")
                    : detail?.kind === "rop_overview"
                      ? (overviewRopGroupForDetail?.ropName ?? "Команда")
                      : "Команда"}
              </SheetTitle>
              <SheetDescription className={isKpiDetail ? "sr-only" : undefined}>
                {isKpiDetail
                  ? "Список клиентов по выбранной категории"
                  : detail?.kind === "manager_overview" && selectedManager
                    ? `Команда: ${selectedManagerRopName} · клиентов ${selectedManagerClients.length} · ТТ ${resolveManagerTp(selectedManager)}`
                    : detail?.kind === "manager_overview"
                      ? "Клиенты по данным базы (назначения и seed)"
                      : "Реальные данные из актуализации"}
              </SheetDescription>
            </SheetHeader>
            <div className="max-h-[70vh] overflow-y-auto px-4 pb-24 pt-3" data-testid="dialog-client-base-group-detail">
              {isKpiDetail ? (
                detailBody
              ) : detail?.kind === "manager_overview" ? (
                selectedManagerClients.length ? (
                  <div className="space-y-2">
                    {selectedManagerClients.map((c) => (
                      <Card key={c.id} className="rounded-xl border border-border bg-card text-card-foreground">
                        <CardContent className="space-y-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-3">
                              <ClientAvatar name={c.fullName} seed={c.id || c.inn || c.fullName} size={32} shape="circle" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{c.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {c.city ?? "—"} · ТТ {c.tradePointsCount}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  ИНН {c.inn ?? "—"} · юрлицо {c.legalEntity ? "есть" : "—"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  статус:{" "}
                                  {c.status === "active" ? "активный" : c.status === "potential" ? "потенциальный" : "внимание"}
                                </p>
                              </div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={buildHashPath(`/dealers/${encodeURIComponent(c.dealerProfileId)}`)}>Карточка</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">У менеджера нет клиентов в базе</p>
                )
              ) : detail?.kind === "rop_overview" ? (
                <div className="space-y-2">
                  {(overviewRopGroupForDetail?.managers ?? []).map((m) => (
                    <button
                      key={m.managerId}
                      type="button"
                      className="w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-primary/10"
                      onClick={() =>
                        setDetail({ kind: "manager_overview", managerCatalogId: m.managerId, teamId: detail.teamId })
                      }
                    >
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        активные {m.active} · ТТ {resolveManagerTp(m)} · потенц. {m.potential} · вним. {m.attention}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  const overviewInfographic = (
    <section className="space-y-3" data-testid="section-client-base-structure-infographic">
      <h2 className="text-sm font-semibold text-[#222631]">Структура активной базы</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-[#E3E6F3] shadow-sm">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 text-sm text-[#222631]">
              <button
                type="button"
                className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                onClick={() => openClientsWithFilter("active")}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Активные клиенты</p>
                <p className="text-xl font-semibold tabular-nums">{structure.active}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                onClick={openTradePointsDetail}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Торговые точки</p>
                <p className="text-xl font-semibold tabular-nums">{tpCountDisplay()}</p>
              </button>
              <div className="rounded-lg p-2">
                <p className="text-[11px] font-medium text-[#8F96B0]">Потенциальные</p>
                <p className="text-xl font-semibold tabular-nums">{structure.potential}</p>
              </div>
              <div className="rounded-lg p-2">
                <p className="text-[11px] font-medium text-[#8F96B0]">Требуют внимания</p>
                <p className="text-xl font-semibold tabular-nums">{structure.attention}</p>
              </div>
            </div>
            <p className="text-xs text-[#8F96B0]">
              Средняя дистрибуция: <span className="font-semibold text-[#222631]">{structure.avgDist}%</span>
              {" · "}
              ТТ на клиента:{" "}
              <span className="font-semibold text-[#222631]">
                {structure.ratioTpPerClient === "—" ? "—" : `${structure.ratioTpPerClient}`}
              </span>
            </p>
            <div className="space-y-2">
              {[
                { label: "Активные клиенты", val: structure.active, color: "bg-[#9ACA3C]" },
                { label: "Торговые точки", val: tpKpiCount, color: "bg-[#9ACA3C]/85" },
                { label: "Потенциальные", val: structure.potential, color: "bg-[#9ACA3C]/70" },
                { label: "Внимание", val: structure.attention, color: "bg-[#9ACA3C]/55" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-0.5 flex justify-between text-[11px] text-[#8F96B0]">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-[#222631]">{row.val}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${(row.val / maxBar) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#8F96B0]">
              Менеджеров с активными клиентами без ТТ:{" "}
              <span className="font-semibold text-[#222631]">{structure.managersWithActiveNoTp}</span>
              {" · "}
              городов с такими клиентами:{" "}
              <span className="font-semibold text-[#222631]">{structure.citiesWithActiveNoTp}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E3E6F3] shadow-sm">
          <CardContent className="space-y-2 p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-[#222631]">Топ по активным клиентам</h3>
            <ul className="space-y-2">
              {structure.topLeaders.length === 0 ? <li className="text-xs text-[#8F96B0]">Нет данных</li> : null}
              {structure.topLeaders.map((m, idx) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-[#8F96B0]">{idx + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[#222631]">{m.name}</span>
                  <span className="shrink-0 tabular-nums text-[#222631]">{m.active}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );

  const cityBlock = (
    <section className="space-y-2" data-testid="section-client-base-city-chart">
      <h2 className="text-sm font-semibold text-[#222631]">Города</h2>
      {cityChart.top.length < 2 ? (
        <p className="text-xs text-[#8F96B0]">Недостаточно городов для диаграммы (нужно минимум два с активными клиентами).</p>
      ) : (
        <Card className="border-[#E3E6F3] shadow-sm">
          <CardContent className="space-y-2 p-3 sm:p-4">
            <ul className="space-y-2">
              {cityChart.top.map((c) => {
                const w = Math.round((c.activeClients / cityChart.maxActive) * 100);
                return (
                  <li key={c.cityKey}>
                    <div data-testid={`row-client-base-city-${c.cityKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`}>
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-[#EEEFF6]/80"
                      data-testid={`button-client-base-city-open-${c.cityKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      onClick={() => setDetail({ kind: "city", cityKey: c.cityKey })}
                    >
                      <span className="w-[7.5rem] shrink-0 truncate font-medium text-[#222631] sm:w-36">{c.displayName}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                          <span className="rounded-full bg-[#9ACA3C]" style={{ width: `${w}%` }} />
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[#8F96B0]">
                        клиенты <span className="text-[#222631]">{c.activeClients}</span>
                        
                        {" · "}
                        ТТ <span className="text-[#222631]">{resolveCityTp(c)}</span>
                        
                      </span>
                    </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {cityChart.noCity ? (
              <div data-testid={`row-client-base-city-${cityChart.noCity.cityKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between border-t border-[#E3E6F3] pt-2 text-left text-xs text-[#8F96B0] hover:text-[#222631]"
                data-testid={`button-client-base-city-open-${cityChart.noCity.cityKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                onClick={() => setDetail({ kind: "city", cityKey: cityChart.noCity!.cityKey })}
              >
                <span className="font-medium text-[#222631]">Без города</span>
                <span className="tabular-nums">
                  клиенты <span className="text-[#222631]">{cityChart.noCity.activeClients}</span>
                  
                  {" · "}
                  ТТ <span className="text-[#222631]">{resolveCityTp(cityChart.noCity)}</span>
                  
                </span>
              </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </section>
  );

  const ropAccordion = (
    <section className="space-y-2" data-testid="section-client-base-rop-groups">
      <Accordion
        type="multiple"
        value={openRops}
        onValueChange={(v) => setOpenRops(v)}
        className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] px-2"
      >
        {ropGroups.map((g) => {
          const maxMgrActive = Math.max(1, ...g.managers.map((m) => m.active));
          return (
            <AccordionItem key={g.teamId} value={g.teamId} className="border-[#E3E6F3]" data-testid={`card-client-base-rop-${g.teamId}`}>
              <AccordionTrigger
                className="py-3 hover:no-underline"
                data-testid={`button-client-base-rop-toggle-${g.teamId}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-3">
                  <span className="truncate font-semibold text-[#222631]">
                    {g.ropName}
                  </span>
                  <span className="text-[11px] text-[#8F96B0]">
                    клиенты {g.active} · ТТ {resolveTeamTp(g)} · потенц. {g.potential} · вним. {g.attention} · менеджеров{" "}
                    {g.managerCatalogCount}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <p className="mb-2 text-[11px] text-[#8F96B0]">{g.statusLine}</p>
                <div className="flex flex-wrap gap-2 pb-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "rop", teamId: g.teamId })}>
                    Детали команды
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2" data-testid={`section-client-base-rop-members-${g.teamId}`}>
                  {g.managers.map((m) => {
                    const share = Math.round((m.active / maxMgrActive) * 100);
                    return (
                      <button
                        key={m.managerId}
                        type="button"
                        className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/50"
                        data-testid={`button-client-base-manager-open-${m.managerId}`}
                        onClick={() => setDetail({ kind: "manager", teamId: g.teamId, managerId: m.managerId })}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#222631]" data-testid={`card-client-base-manager-${m.managerId}`}>
                            {m.name}
                          </p>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
                        </div>
                        <p className="mt-1 text-[11px] text-[#8F96B0]">
                          активные <span className="text-[#222631]">{m.active}</span>
                          
                          {" · "}
                          ТТ <span className="text-[#222631]">{resolveManagerTp(m)}</span>
                          
                          {" · "}
                          сегм. {m.topSegmentLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8F96B0]">
                          потенц. {m.potential} · вним. {m.attention}
                        </p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#EEEFF6]">
                          <div className="h-full rounded-full bg-[#9ACA3C]/75" style={{ width: `${share}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );

  if (actx.loading && rows.length === 0) {
    return <ManagementCockpitSkeleton />;
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-dealer-base">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#222631] sm:text-3xl">Клиентская база</h1>
          <p className="mt-1 text-sm text-[#8F96B0]">
            Управленческий обзор активной базы (merge актуализации команды). Без архива и демо-KPI.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
          {canCreateDealerDuringActualization(profile) && actx.enabled ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-10 w-full bg-primary font-semibold hover:bg-[#86B832] sm:w-auto"
              data-testid="button-dealer-create"
              onClick={() => setCreateDealerOpen(true)}
            >
              Добавить клиента
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="border-[#E3E6F3]" asChild>
            <Link href={buildHashPath("/client-map")} data-testid="button-dealer-base-open-client-map">
              Карта клиентов
            </Link>
          </Button>
        </div>
      </div>

      {teamCtx.teamFetchLoading || teamCtx.teamFetchError ? (
        <div className="space-y-3">
          {teamCtx.teamFetchLoading ? (
            <Alert className="border-primary/30 bg-primary/5" data-testid="alert-dealer-base-team-state-loading">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription>Загружаются данные актуализации команды…</AlertDescription>
            </Alert>
          ) : null}
          {teamCtx.teamFetchError ? (
            <Alert variant="destructive" data-testid="alert-dealer-base-team-state-error">
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
          <p className="mb-1 text-xs font-medium text-[#8F96B0]">Команда для загрузки merge</p>
          <Select value={teamCtx.dashboardRopTeamId} onValueChange={(v) => teamCtx.publishDashboardRopTeamId(v)}>
            <SelectTrigger className="border-[#E3E6F3] bg-[#FFFFFF]">
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

      <DealerActualizationCreateDialog
        open={createDealerOpen}
        onOpenChange={setCreateDealerOpen}
        profile={profile}
        mergedDealerRows={mergedForCreate}
        onCreated={(id) => setLocation(`/dealers/${encodeURIComponent(id)}`)}
      />

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-6" data-testid="section-client-base-director-overview">
          {overviewInfographic}

          <RoleDistributionSummaryBar
            access={access}
            aggregate={cockpitDistribution.aggregate}
            tradePointsCount={cockpitDistribution.tradePointsCount}
            tradePointIds={cockpitScopeTradePointIds}
            testIdPrefix="cockpit-clients"
            showTradePointsCount={false}
          />

          <div
            className="sticky top-0 z-20 space-y-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/90"
            data-testid="section-client-base-mode-toggle"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#8F96B0]">Режим</p>
            <div className="flex gap-2">
              {modeBtn("overview", "Обзор", "button-client-base-mode-overview")}
              {modeBtn("by_rop", "По РОП", "button-client-base-mode-rop")}
              {modeBtn("cities", "По городам", "button-client-base-mode-cities")}
            </div>
          </div>

          {mode === "cities" || mode === "overview" ? cityBlock : null}

          {mode === "by_rop" || mode === "overview" ? ropAccordion : null}
        </div>

        {!isMobile && detail ? (
          <aside
            className="sticky top-4 hidden w-full max-w-md shrink-0 rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] shadow-sm lg:block lg:max-w-[440px]"
            data-testid="dialog-client-base-group-detail"
          >
            <div className="flex items-center justify-between border-b border-[#E3E6F3] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#222631]">{detailTitle(detail, ropGroups, cities)}</h3>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={closeDetail}>
                Закрыть
              </Button>
            </div>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{detailBody}</div>
          </aside>
        ) : null}
      </div>

      <Sheet open={Boolean(isMobile && detail)} onOpenChange={(o) => !o && closeDetail()}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl border-[#E3E6F3] p-0">
          <SheetHeader className="border-b border-[#E3E6F3] px-4 pb-3 pt-4 text-left">
            <SheetTitle className="text-base text-[#222631]">{detailTitle(detail, ropGroups, cities)}</SheetTitle>
            <SheetDescription className="sr-only">Детали выбора</SheetDescription>
          </SheetHeader>
          <div className="max-h-[70vh] overflow-y-auto px-4 pb-24 pt-2" data-testid="dialog-client-base-group-detail">
            {detailBody}
          </div>
        </SheetContent>
      </Sheet>

      {isMobile ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E3E6F3] bg-[#FFFFFF]/95 px-3 py-2 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg justify-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 flex-1 border-[#E3E6F3]">
              <Link href={buildHashPath("/main")}>К главному</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 flex-1 border-[#E3E6F3]" title="Карта">
              <Link href={buildHashPath("/client-map")}>
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
      {ropTreeDiagLines.length > 0 ? <RopTeamTreeDiagPanel lines={ropTreeDiagLines} /> : null}
    </div>
  );
}
