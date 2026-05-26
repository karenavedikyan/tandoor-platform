import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, ExternalLink, Info } from "lucide-react";
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
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { getDealerManagerDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { realRopOptions } from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { ClientBaseOverview } from "@/lib/client-base-overview-api";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { DealerActualizationCreateDialog } from "@/components/client-base-actualization-dealer-forms";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { canActualizeClientBase, canCreateDealerDuringActualization } from "@/lib/client-base-actualization-permissions";
import {
  buildCityModels,
  buildRopGroups,
  buildStructureInfographic,
  dealerMatchesClientListFilter,
  flattenTradePointsForRows,
  topCitiesForChart,
  teamsForManagementView,
  type CityRowModel,
  type ClientListFilter,
  type DirectorClientBaseMode,
  type RopGroupModel,
} from "@/lib/dealer-base-management-view-model";
import { useLocation } from "wouter";

const MODE_LS_KEY = "tandoor-dealer-base-management-mode-v1";
const OPEN_ROPS_LS_KEY = "tandoor-dealer-base-management-open-rops-v1";

type DetailKind =
  | { kind: "rop"; teamId: string }
  | { kind: "manager"; teamId: string; managerId: string }
  | { kind: "city"; cityKey: string }
  | { kind: "kpi-clients" }
  | { kind: "kpi-trade-points" };

const FILTER_LABELS: Record<ClientListFilter, string> = {
  all: "Все",
  active: "Активные",
  potential: "Потенциальные",
  attention: "Внимание",
  noTp: "Без ТТ",
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
  if (detail.kind === "kpi-clients") return "Клиенты";
  if (detail.kind === "kpi-trade-points") return "Торговые точки";
  if (detail.kind === "city") return cities.find((c) => c.cityKey === detail.cityKey)?.displayName ?? "Город";
  if (detail.kind === "rop") return ropGroups.find((g) => g.teamId === detail.teamId)?.ropName ?? "Команда";
  const g = ropGroups.find((x) => x.teamId === detail.teamId);
  const m = g?.managers.find((x) => x.managerId === detail.managerId);
  return m?.name ?? "Менеджер";
}

export function DealerBaseManagementCockpit({
  rows,
  profile,
  orgTeamCtx,
  overview,
  mergedDealerRowsForCreate,
}: {
  rows: DealerRow[];
  profile: ReleaseDemoProfile;
  orgTeamCtx?: { snap: OrgSnapshot; access: DealerBaseAccessRole } | null;
  overview?: ClientBaseOverview | null;
  mergedDealerRowsForCreate?: DealerRow[] | null;
}) {
  const actx = useClientBaseActualization();
  const teamCtx = useClientBaseTeamActualization();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const access = useMemo(() => {
    if (orgTeamCtx) return orgTeamCtx.access;
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [orgTeamCtx, profile.role]);

  const [mode, setMode] = useState<DirectorClientBaseMode>(() => readMode());
  const [openRops, setOpenRops] = useState<string[]>(() => readOpenRops());
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [detailTab, setDetailTab] = useState<"clients" | "tp">("clients");
  const [clientFilter, setClientFilter] = useState<ClientListFilter>("all");
  const [createDealerOpen, setCreateDealerOpen] = useState(false);

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
    setClientFilter("all");
    if (detail?.kind === "kpi-trade-points") setDetailTab("tp");
    else setDetailTab("clients");
  }, [detail]);

  const teams = useMemo(
    () => teamsForManagementView(profile, teamCtx.dashboardRopTeamId, orgTeamCtx ?? null),
    [profile, teamCtx.dashboardRopTeamId, orgTeamCtx],
  );
  const teamIds = useMemo(() => teams.map((t) => t.teamId), [teams]);

  const ropGroups = useMemo(() => buildRopGroups(rows, teams, orgTeamCtx?.snap), [rows, teams, orgTeamCtx]);
  const cities = useMemo(() => buildCityModels(rows), [rows]);
  const structure = useMemo(() => buildStructureInfographic(rows, teamIds), [rows, teamIds]);
  const cityChart = useMemo(() => topCitiesForChart(cities, 5), [cities]);

  const maxBar = useMemo(
    () => Math.max(structure.active, structure.outlets, structure.potential, structure.attention, 1),
    [structure],
  );

  const detailSourceRows = useMemo(
    () => detailRows(detail, ropGroups, cities, rows),
    [detail, ropGroups, cities, rows],
  );

  const filteredClients = useMemo(
    () => detailSourceRows.filter((r) => dealerMatchesClientListFilter(r, clientFilter)),
    [detailSourceRows, clientFilter],
  );

  const tradePointRows = useMemo(() => flattenTradePointsForRows(detailSourceRows), [detailSourceRows]);

  const closeDetail = useCallback(() => setDetail(null), []);

  const mergedForCreate = useMemo(() => {
    if (mergedDealerRowsForCreate && mergedDealerRowsForCreate.length > 0) return mergedDealerRowsForCreate;
    return actx.enabled
      ? buildDealerBaseRowsWithActualization(teamCtx.mergedState, profile, { includeArchivedDealers: false })
      : DEALER_BASE_ROWS;
  }, [mergedDealerRowsForCreate, actx.enabled, teamCtx.mergedState, profile]);

  const setModeAndPersist = useCallback((m: DirectorClientBaseMode) => {
    setMode(m);
    if (m === "overview") setOpenRops([]);
  }, []);

  if (overview) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-dealer-base">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиентская база</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Управленческий обзор реальной базы из Postgres. Без seed-агрегатов и синтетических KPI.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {canCreateDealerDuringActualization(profile) && actx.enabled ? (
              <Button type="button" variant="default" size="sm" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-create" onClick={() => setCreateDealerOpen(true)}>
                Добавить клиента
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="min-h-10 w-full sm:w-auto" asChild>
              <Link href={buildHashPath("/client-map")} data-testid="button-dealer-base-open-client-map">Карта клиентов</Link>
            </Button>
          </div>
        </div>
        {canActualizeClientBase(profile) ? (
          <ClientBaseActualizationSyncStatus isLoading={actx.loading} meta={actx.meta} syncStatus={actx.syncStatus} onRetry={() => void actx.refresh()} />
        ) : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="section-client-base-structure-infographic">
          {[
            ["Активные клиенты", overview.structure.activeClients],
            ["Торговые точки", overview.structure.tradePoints],
            ["Потенциальные", overview.structure.potentialClients],
            ["Внимание", overview.structure.attentionClients],
          ].map(([label, value]) => (
            <Card key={String(label)} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-foreground">Топ по активным клиентам</h2>
              {overview.topActiveClients.length === 0 ? <p className="text-sm text-muted-foreground">Нет данных</p> : null}
              {overview.topActiveClients.map((c, idx) => (
                <div key={c.clientId} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                  <span className="w-5 text-xs text-muted-foreground">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.city || "Без города"} · {c.managerFullName}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{c.tradePointsCount}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-foreground">Города</h2>
              {overview.cities.map((c) => (
                <div key={c.city ?? "without"} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{c.city ?? "Без города"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">клиенты {c.clients} · ТТ {c.tradePoints}</span>
                </div>
              ))}
              {overview.withoutCity.clients > 0 || overview.withoutCity.tradePoints > 0 ? (
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-foreground">Без города</span>
                  <span className="text-xs text-muted-foreground">клиенты {overview.withoutCity.clients} · ТТ {overview.withoutCity.tradePoints}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
        <section className="space-y-3" data-testid="section-client-base-rop-groups">
          {overview.ropGroups.map((g) => (
            <Card key={g.teamId ?? "no-rop"} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm" data-testid={`card-client-base-rop-${g.teamId ?? "no-rop"}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{g.teamName}</p>
                    <p className="text-xs text-muted-foreground">{g.ropFullName} · менеджеров {g.managerCount}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" data-testid={`button-client-base-rop-toggle-${g.teamId ?? "no-rop"}`} onClick={() => setDetail({ kind: "rop", teamId: g.teamId ?? "__no_rop__" })}>
                    Детали команды
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">клиенты {g.clients} · ТТ {g.tradePoints} · потенц. {g.potential} · вним. {g.attention}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.managers.map((m) => (
                    <button key={m.userId} type="button" className="rounded-xl border border-border bg-card p-3 text-left hover:bg-primary/10" data-testid={`button-client-base-manager-open-${m.userId}`} onClick={() => setDetail({ kind: "manager", teamId: g.teamId ?? "__no_rop__", managerId: m.userId })}>
                      <p className="truncate text-sm font-semibold text-foreground" data-testid={`card-client-base-manager-${m.userId}`}>{m.fullName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">активные {m.active} · ТТ {m.tradePoints} · сегм. {m.segment ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">потенц. {m.potential} · вним. {m.attention}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
        <DealerActualizationCreateDialog
          open={createDealerOpen}
          onOpenChange={setCreateDealerOpen}
          profile={profile}
          mergedDealerRows={mergedForCreate}
          onCreated={(id) => setLocation(`/dealers/${encodeURIComponent(id)}`)}
        />
      </div>
    );
  }

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

  const renderClientRows = (wide: boolean) => {
    if (wide) {
      return (
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
          <TableBody>
            {filteredClients.map((r) => (
              <TableRow key={r.id} className="border-[#E3E6F3]">
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
            ))}
          </TableBody>
        </Table>
      );
    }
    return (
      <ul className="space-y-2">
        {filteredClients.map((r) => (
          <li key={r.id} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3">
            <p className="font-medium text-[#222631]">{r.name}</p>
            <p className="text-xs text-[#8F96B0]">
              {r.city} · {getDealerManagerDisplay(r)} · ТТ {r.outlets}
            </p>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs" asChild>
              <Link href={buildHashPath(`/dealers/${encodeURIComponent(r.id)}`)}>Открыть карточку</Link>
            </Button>
          </li>
        ))}
      </ul>
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
          {renderClientRows(!isMobile)}
        </TabsContent>
        <TabsContent value="tp" className="mt-3 space-y-2">
          {tradePointRows.length === 0 ? <p className="text-sm text-[#8F96B0]">Нет торговых точек в выборке.</p> : null}
          {renderTpRows(!isMobile)}
        </TabsContent>
      </Tabs>
    </div>
  ) : null;

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
                onClick={() => setDetail({ kind: "kpi-clients" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Активные клиенты</p>
                <p className="text-xl font-semibold tabular-nums">{structure.active}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                onClick={() => setDetail({ kind: "kpi-trade-points" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Торговые точки</p>
                <p className="text-xl font-semibold tabular-nums">{structure.outlets}</p>
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
                { label: "Торговые точки", val: structure.outlets, color: "bg-[#9ACA3C]/85" },
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
                      <span className="shrink-0 text-xs tabular-nums text-[#222631]">
                        {c.activeClients}
                        <span className="text-[#8F96B0]"> · ТТ {c.tradePoints}</span>
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
                  {cityChart.noCity.activeClients} клиентов · ТТ {cityChart.noCity.tradePoints}
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
                    клиенты {g.active} · ТТ {g.outlets} · потенц. {g.potential} · вним. {g.attention} · менеджеров{" "}
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
                          активные {m.active} · ТТ {m.outlets} · сегм. {m.topSegmentLabel}
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

      {canActualizeClientBase(profile) ? (
        <div className="space-y-3">
          <ClientBaseActualizationSyncStatus
            isLoading={actx.loading}
            meta={actx.meta}
            syncStatus={actx.syncStatus}
            onRetry={() => void actx.refresh()}
          />
          {teamCtx.teamFetchLoading ? (
            <Alert className="border-primary/30 bg-[#EEEFF6]/60" data-testid="alert-dealer-base-team-state-loading">
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

          <div className="space-y-2" data-testid="section-client-base-mode-toggle">
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
    </div>
  );
}
