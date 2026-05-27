import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Info } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { realRopOptions } from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { buildHashPath } from "@/lib/hash-route-utils";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { teamsForManagementView } from "@/lib/dealer-base-management-view-model";
import {
  fetchTradePointsManagerDetail,
  fetchTradePointsOverview,
  type TradePointsOverview,
} from "@/lib/trade-points-overview-api";
import { ClientAvatar } from "@/components/ui/client-avatar";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import {
  buildCityTpAggs,
  buildClientSummariesFromDealers,
  buildRopTpGroups,
  buildTradePointsStructureSummary,
  isManagementTradePointRow,
  topCitiesForTpChart,
  topRopTeamsByTp,
  tradePointMatchesDetailFilter,
  tradePointHasPhoto,
  tradePointShowcaseUnfilled,
  type CityTpAgg,
  type ClientSummaryRow,
  type RopTpGroup,
  type TradePointsManagementMode,
  type TradePointDetailFilter,
} from "@/lib/trade-points-management-view-model";

const MODE_LS = "tandoor-trade-points-management-mode-v1";
const OPEN_ROPS_LS = "tandoor-trade-points-management-open-rops-v1";

const TP_FILTER_LABELS: Record<TradePointDetailFilter, string> = {
  all: "Все",
  no_photo: "Без фото",
  unfilled: "Не заполнены",
  with_photo: "С фото",
};

type DetailKind =
  | { kind: "tp-all" }
  | { kind: "tp-no-photo" }
  | { kind: "tp-unfilled" }
  | { kind: "rop"; teamId: string }
  | { kind: "manager"; teamId: string; managerId: string }
  | { kind: "city"; cityKey: string }
  | { kind: "clients-no-tp" }
  | { kind: "clients-with-tp" }
  | { kind: "rop_overview"; teamId: string }
  | { kind: "manager_overview"; managerUserId: string; teamId: string };

const TP_STATUS_LABEL: Record<"active" | "potential" | "attention", string> = {
  active: "активный",
  potential: "потенциальный",
  attention: "внимание",
};

function safeCityTestId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function readMode(): TradePointsManagementMode {
  try {
    const r = localStorage.getItem(MODE_LS);
    if (r === "overview" || r === "by_rop" || r === "cities") return r;
  } catch {
    /* ignore */
  }
  return "overview";
}

function readOpenRops(): string[] {
  try {
    const r = localStorage.getItem(OPEN_ROPS_LS);
    if (!r) return [];
    const p = JSON.parse(r) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function detailTpRows(
  detail: DetailKind | null,
  workingRows: TradePointListRow[],
  ropGroups: RopTpGroup[],
  cities: CityTpAgg[],
): TradePointListRow[] {
  const base = workingRows.filter(isManagementTradePointRow);
  if (!detail) return [];
  if (detail.kind === "tp-all") return base;
  if (detail.kind === "tp-no-photo") return base.filter((r) => !tradePointHasPhoto(r));
  if (detail.kind === "tp-unfilled") return base.filter((r) => tradePointShowcaseUnfilled(r));
  if (detail.kind === "city") return cities.find((c) => c.cityKey === detail.cityKey)?.rows ?? [];
  if (detail.kind === "rop") return ropGroups.find((g) => g.teamId === detail.teamId)?.rows ?? [];
  if (detail.kind === "manager") {
    const g = ropGroups.find((x) => x.teamId === detail.teamId);
    return g?.managers.find((m) => m.managerId === detail.managerId)?.rows ?? [];
  }
  return [];
}

function detailTitle(detail: DetailKind | null, ropGroups: RopTpGroup[], cities: CityTpAgg[]): string {
  if (!detail) return "";
  if (detail.kind === "tp-all") return "Все торговые точки";
  if (detail.kind === "tp-no-photo") return "Торговые точки без фото";
  if (detail.kind === "tp-unfilled") return "Торговые точки: не заполнена витрина";
  if (detail.kind === "clients-no-tp") return "Клиенты без торговых точек";
  if (detail.kind === "clients-with-tp") return "Клиенты с торговыми точками";
  if (detail.kind === "city") return cities.find((c) => c.cityKey === detail.cityKey)?.displayName ?? "Город";
  if (detail.kind === "rop") return ropGroups.find((g) => g.teamId === detail.teamId)?.ropName ?? "Команда";
  if (detail.kind === "rop_overview") return ropGroups.find((g) => g.teamId === detail.teamId)?.ropName ?? "Команда";
  if (detail.kind === "manager_overview") return "Менеджер";
  const g = ropGroups.find((x) => x.teamId === detail.teamId);
  return g?.managers.find((m) => m.managerId === detail.managerId)?.name ?? "Менеджер";
}

function filterClientSummaries(rows: ClientSummaryRow[], kind: "clients-no-tp" | "clients-with-tp"): ClientSummaryRow[] {
  if (kind === "clients-no-tp") return rows.filter((r) => r.tpCount === 0);
  return rows.filter((r) => r.tpCount > 0);
}

export function TradePointsManagementCockpit({
  profile,
  workingRows,
  dealerRows,
  orgTeamCtx,
}: {
  profile: ReleaseDemoProfile;
  workingRows: TradePointListRow[];
  dealerRows: DealerRow[];
  orgTeamCtx?: { snap: OrgSnapshot; access: DealerBaseAccessRole } | null;
}) {
  const teamCtx = useClientBaseTeamActualization();
  const isMobile = useIsMobile();
  const access = useMemo(() => {
    if (orgTeamCtx) return orgTeamCtx.access;
    return mapSalesRoleToDealerBaseAccess(profile.role);
  }, [orgTeamCtx, profile.role]);

  const [mode, setMode] = useState<TradePointsManagementMode>(() => readMode());
  const [openRops, setOpenRops] = useState<string[]>(() => readOpenRops());
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [detailTab, setDetailTab] = useState<"points" | "clients">("points");
  const [tpFilter, setTpFilter] = useState<TradePointDetailFilter>("all");

  useEffect(() => {
    try {
      localStorage.setItem(MODE_LS, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_ROPS_LS, JSON.stringify(openRops));
    } catch {
      /* ignore */
    }
  }, [openRops]);

  useEffect(() => {
    setTpFilter("all");
    if (detail?.kind === "clients-no-tp" || detail?.kind === "clients-with-tp") setDetailTab("clients");
    else setDetailTab("points");
  }, [detail]);

  const setModeAndPersist = useCallback((m: TradePointsManagementMode) => {
    setMode(m);
    if (m === "overview") setOpenRops([]);
  }, []);

  const overviewQ = useQuery({
    queryKey: ["trade-points-overview"],
    queryFn: fetchTradePointsOverview,
  });
  const overview: TradePointsOverview | null = overviewQ.data ?? null;

  const overviewManagerUserId = detail?.kind === "manager_overview" ? detail.managerUserId : null;
  const managerDetailQ = useQuery({
    queryKey: ["trade-points-manager-detail", overviewManagerUserId],
    queryFn: () => fetchTradePointsManagerDetail(overviewManagerUserId ?? ""),
    enabled: Boolean(overviewManagerUserId),
  });

  const teams = useMemo(
    () => teamsForManagementView(profile, teamCtx.dashboardRopTeamId, orgTeamCtx ?? null),
    [profile, teamCtx.dashboardRopTeamId, orgTeamCtx],
  );

  const structure = useMemo(() => buildTradePointsStructureSummary(workingRows, dealerRows), [workingRows, dealerRows]);
  const cities = useMemo(() => buildCityTpAggs(workingRows), [workingRows]);
  const cityChart = useMemo(() => topCitiesForTpChart(cities, 5), [cities]);
  const ropGroups = useMemo(() => buildRopTpGroups(workingRows, teams, orgTeamCtx?.snap), [workingRows, teams, orgTeamCtx]);
  const topRops = useMemo(() => topRopTeamsByTp(ropGroups, 5), [ropGroups]);
  const clientSummaries = useMemo(() => buildClientSummariesFromDealers(dealerRows), [dealerRows]);

  const maxBar = useMemo(
    () =>
      Math.max(
        structure.totalTp,
        structure.dealersWithTp,
        structure.citiesCount,
        structure.noPhoto,
        structure.unfilled,
        1,
      ),
    [structure],
  );

  const detailSourceTp = useMemo(
    () => detailTpRows(detail, workingRows, ropGroups, cities),
    [detail, workingRows, ropGroups, cities],
  );

  const filteredTpDetail = useMemo(
    () => detailSourceTp.filter((r) => tradePointMatchesDetailFilter(r, tpFilter)),
    [detailSourceTp, tpFilter],
  );

  const detailClientRows = useMemo(() => {
    if (!detail) return [];
    if (detail.kind === "clients-no-tp") return filterClientSummaries(clientSummaries, "clients-no-tp");
    if (detail.kind === "clients-with-tp") return filterClientSummaries(clientSummaries, "clients-with-tp");
    const ids = new Set(detailSourceTp.map((r) => r.dealerId));
    return clientSummaries.filter((c) => ids.has(c.dealerId));
  }, [detail, detailSourceTp, clientSummaries]);

  const closeDetail = useCallback(() => setDetail(null), []);

  const modeBtn = (m: TradePointsManagementMode, label: string, tid: string) => {
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

  const tpHref = (r: TradePointListRow) =>
    buildHashPath(`/dealers/${encodeURIComponent(r.dealerId)}/trade-points/${encodeURIComponent(r.tradePointId)}`);

  const renderTpTable = (wide: boolean) => {
    if (filteredTpDetail.length === 0) {
      return <p className="text-sm text-[#8F96B0]">Нет торговых точек по выбору.</p>;
    }
    if (wide) {
      return (
        <Table>
          <TableHeader>
            <TableRow className="border-[#E3E6F3]">
              <TableHead className="text-[#8F96B0]">Точка</TableHead>
              <TableHead className="text-[#8F96B0]">Город</TableHead>
              <TableHead className="text-[#8F96B0]">Клиент</TableHead>
              <TableHead className="text-[#8F96B0]">Менеджер</TableHead>
              <TableHead className="text-[#8F96B0]">РОП</TableHead>
              <TableHead className="text-[#8F96B0]">Фото</TableHead>
              <TableHead className="text-[#8F96B0]">Витрина</TableHead>
              <TableHead className="w-[100px] text-[#8F96B0]"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTpDetail.map((r) => (
              <TableRow key={r.tradePointId} className="border-[#E3E6F3]" data-testid={`row-trade-point-detail-${r.tradePointId}`}>
                <TableCell className="max-w-[160px] truncate font-medium text-[#222631]">{r.tradePointName}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{r.city}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{r.dealerName}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{r.manager}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{r.rop}</TableCell>
                <TableCell className="text-xs text-[#222631]">{tradePointHasPhoto(r) ? "есть" : "нет"}</TableCell>
                <TableCell className="max-w-[120px] truncate text-xs text-[#8F96B0]">{r.showcaseBucketLabel}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                    <Link href={tpHref(r)} data-testid={`link-trade-point-detail-open-${r.tradePointId}`}>
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
        {filteredTpDetail.map((r) => (
          <li key={r.tradePointId} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3" data-testid={`row-trade-point-detail-${r.tradePointId}`}>
            <p className="font-medium text-[#222631]">{r.tradePointName}</p>
            <p className="text-xs text-[#8F96B0]">
              {r.city} · {r.dealerName} · {r.manager}
            </p>
            <p className="mt-1 text-[11px] text-[#8F96B0]">
              Фото: {tradePointHasPhoto(r) ? "есть" : "нет"} · {r.showcaseBucketLabel}
            </p>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs" asChild>
              <Link href={tpHref(r)} data-testid={`link-trade-point-detail-open-${r.tradePointId}`}>
                Открыть точку
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  const renderClientTable = (wide: boolean) => {
    if (detailClientRows.length === 0) {
      return <p className="text-sm text-[#8F96B0]">Нет клиентов в выборке.</p>;
    }
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
            {detailClientRows.map((c) => (
              <TableRow key={c.dealerId} className="border-[#E3E6F3]">
                <TableCell className="font-medium text-[#222631]">{c.name}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{c.city}</TableCell>
                <TableCell className="text-sm text-[#8F96B0]">{c.manager}</TableCell>
                <TableCell className="text-right tabular-nums text-[#222631]">{c.tpCount}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                    <Link href={buildHashPath(`/dealers/${encodeURIComponent(c.dealerId)}`)}>Клиент</Link>
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
        {detailClientRows.map((c) => (
          <li key={c.dealerId} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3">
            <p className="font-medium text-[#222631]">{c.name}</p>
            <p className="text-xs text-[#8F96B0]">
              {c.city} · {c.manager} · ТТ {c.tpCount}
            </p>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs" asChild>
              <Link href={buildHashPath(`/dealers/${encodeURIComponent(c.dealerId)}`)}>Открыть клиента</Link>
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  const detailBody = detail ? (
    <div className="space-y-4">
      {detailTab === "points" && detail.kind !== "clients-no-tp" && detail.kind !== "clients-with-tp" ? (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TP_FILTER_LABELS) as TradePointDetailFilter[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={tpFilter === f ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full border px-3 text-xs",
                tpFilter === f ? "border-primary bg-primary hover:bg-[#86B832]" : "border-[#E3E6F3] bg-[#FFFFFF]",
              )}
              onClick={() => setTpFilter(f)}
            >
              {TP_FILTER_LABELS[f]}
            </Button>
          ))}
        </div>
      ) : null}
      <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "points" | "clients")}>
        <TabsList className="grid w-full grid-cols-2 border border-[#E3E6F3] bg-[#EEEFF6]/50">
          <TabsTrigger value="points" className="text-xs" data-testid="tab-trade-points-detail-points">
            Торговые точки ({filteredTpDetail.length})
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-xs" data-testid="tab-trade-points-detail-clients">
            Клиенты ({detailClientRows.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="points" className="mt-3">
          {detail?.kind === "clients-no-tp" || detail?.kind === "clients-with-tp" ? (
            <p className="text-xs text-[#8F96B0]">Для этого среза откройте вкладку «Клиенты».</p>
          ) : null}
          {renderTpTable(!isMobile)}
        </TabsContent>
        <TabsContent value="clients" className="mt-3">
          {renderClientTable(!isMobile)}
        </TabsContent>
      </Tabs>
    </div>
  ) : null;

  const hasData = structure.totalTp > 0;

  const structureBlock = (
    <section className="space-y-3" data-testid="section-trade-points-structure-infographic">
      <h2 className="text-sm font-semibold text-[#222631]">Структура торговых точек</h2>
      {!hasData ? (
        <Card className="border-[#E3E6F3] shadow-sm">
          <CardContent className="p-4 text-sm text-[#8F96B0]">
            Нет активных торговых точек в текущем scope merge. Проверьте актуализацию или выбор команды (для директора).
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border-[#E3E6F3] shadow-sm">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 text-sm text-[#222631]">
                <button
                  type="button"
                  className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                  onClick={() => setDetail({ kind: "tp-all" })}
                >
                  <p className="text-[11px] font-medium text-[#8F96B0]">Активные ТТ</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.totalTp}</p>
                </button>
                <div className="rounded-lg p-2">
                  <p className="text-[11px] font-medium text-[#8F96B0]">Клиентов с ТТ</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.dealersWithTp}</p>
                </div>
                <div className="rounded-lg p-2">
                  <p className="text-[11px] font-medium text-[#8F96B0]">Городов</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.citiesCount}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                  onClick={() => setDetail({ kind: "tp-no-photo" })}
                >
                  <p className="text-[11px] font-medium text-[#8F96B0]">Без фото</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.noPhoto}</p>
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-transparent p-2 text-left hover:border-primary/30 hover:bg-[#EEEFF6]/60"
                  onClick={() => setDetail({ kind: "tp-unfilled" })}
                >
                  <p className="text-[11px] font-medium text-[#8F96B0]">Не заполнены / внимание</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.unfilled}</p>
                </button>
                <div className="rounded-lg p-2">
                  <p className="text-[11px] font-medium text-[#8F96B0]">С фото</p>
                  <p className="text-xl font-semibold tabular-nums">{structure.withPhoto}</p>
                </div>
              </div>
              <p className="text-xs text-[#8F96B0]">
                Среднее ТТ на клиента с точками:{" "}
                <span className="font-semibold text-[#222631]">{structure.avgTpPerDealer}</span>
              </p>
              <div className="space-y-2">
                {[
                  { label: "Торговые точки", val: structure.totalTp, c: "bg-[#9ACA3C]" },
                  { label: "Клиенты с ТТ", val: structure.dealersWithTp, c: "bg-[#9ACA3C]/85" },
                  { label: "Города (уник.)", val: structure.citiesCount, c: "bg-[#9ACA3C]/70" },
                  { label: "Без фото", val: structure.noPhoto, c: "bg-[#9ACA3C]/55" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-0.5 flex justify-between text-[11px] text-[#8F96B0]">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-[#222631]">{row.val}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                      <div className={cn("h-full rounded-full", row.c)} style={{ width: `${(row.val / maxBar) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E3E6F3] shadow-sm">
            <CardContent className="space-y-2 p-3 sm:p-4">
              <p className="text-sm font-semibold text-[#222631]">Клиентская база (активные)</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left hover:border-primary/40"
                  onClick={() => setDetail({ kind: "clients-no-tp" })}
                >
                  <p className="text-[11px] text-[#8F96B0]">Без ТТ</p>
                  <p className="text-lg font-semibold tabular-nums text-[#222631]">{structure.clientsNoTp}</p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left hover:border-primary/40"
                  onClick={() => setDetail({ kind: "clients-with-tp" })}
                >
                  <p className="text-[11px] text-[#8F96B0]">С ТТ</p>
                  <p className="text-lg font-semibold tabular-nums text-[#222631]">{structure.clientsWithTp}</p>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );

  const citySection = (
    <section className="space-y-2" data-testid="section-trade-points-city-chart">
      <h2 className="text-sm font-semibold text-[#222631]">Города</h2>
      {cityChart.top.length < 2 ? (
        <p className="text-xs text-[#8F96B0]">Недостаточно городов для диаграммы.</p>
      ) : (
        <Card className="border-[#E3E6F3] shadow-sm">
          <CardContent className="space-y-2 p-3 sm:p-4">
            <ul className="space-y-2">
              {cityChart.top.map((c) => {
                const w = Math.round((c.tpCount / cityChart.maxTp) * 100);
                const sid = safeCityTestId(c.cityKey);
                return (
                  <li key={c.cityKey}>
                    <div data-testid={`row-trade-points-city-${sid}`}>
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-[#EEEFF6]/80"
                        data-testid={`button-trade-points-city-open-${sid}`}
                        onClick={() => setDetail({ kind: "city", cityKey: c.cityKey })}
                      >
                        <span className="w-[7.5rem] shrink-0 truncate font-medium text-[#222631] sm:w-36">{c.displayName}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                            <span className="rounded-full bg-[#9ACA3C]" style={{ width: `${w}%` }} />
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[#222631]">
                          {c.tpCount}
                          <span className="text-[#8F96B0]"> · клиентов {c.dealerIds.size}</span>
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {cityChart.noCity ? (
              <div data-testid={`row-trade-points-city-${safeCityTestId(cityChart.noCity.cityKey)}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-t border-[#E3E6F3] pt-2 text-left text-xs text-[#8F96B0] hover:text-[#222631]"
                  data-testid={`button-trade-points-city-open-${safeCityTestId(cityChart.noCity.cityKey)}`}
                  onClick={() => setDetail({ kind: "city", cityKey: cityChart.noCity!.cityKey })}
                >
                  <span className="font-medium text-[#222631]">Без города</span>
                  <span className="tabular-nums">
                    {cityChart.noCity.tpCount} ТТ · клиентов {cityChart.noCity.dealerIds.size}
                  </span>
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </section>
  );

  const overviewExtras = hasData ? (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-[#E3E6F3] shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-[#222631]">Топ команд по ТТ</h3>
          <ul className="mt-2 space-y-2">
            {topRops.map((g, i) => (
              <li key={g.teamId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:bg-[#EEEFF6]/60"
                  onClick={() => setDetail({ kind: "rop", teamId: g.teamId })}
                >
                  <span className="text-[#8F96B0]">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[#222631]">{g.ropName}</span>
                  <span className="tabular-nums text-[#222631]">{g.tpCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="border-[#E3E6F3] shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-[#222631]">Быстрые срезы</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "tp-no-photo" })}>
              Без фото ({structure.noPhoto})
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "tp-unfilled" })}>
              Не заполнены ({structure.unfilled})
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "clients-no-tp" })}>
              Клиенты без ТТ
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "clients-with-tp" })}>
              Клиенты с ТТ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : null;

  const ropAccordion = (
    <section className="space-y-2" data-testid="section-trade-points-rop-groups">
      <Accordion type="multiple" value={openRops} onValueChange={(v) => setOpenRops(v)} className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] px-2">
        {ropGroups.map((g) => {
          const maxMgrTp = Math.max(1, ...g.managers.map((m) => m.tpCount));
          return (
            <AccordionItem key={g.teamId} value={g.teamId} className="border-[#E3E6F3]" data-testid={`card-trade-points-rop-${g.teamId}`}>
              <AccordionTrigger className="py-3 hover:no-underline" data-testid={`button-trade-points-rop-toggle-${g.teamId}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-3">
                  <span className="truncate font-semibold text-[#222631]">{g.ropName}</span>
                  <span className="text-[11px] text-[#8F96B0]">
                    ТТ {g.tpCount} · клиентов {g.dealerCount} · городов {g.cityCount} · без фото {g.noPhoto} · не заполнено {g.unfilled} · менеджеров{" "}
                    {g.managerCatalogCount}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <p className="mb-2 text-[11px] text-[#8F96B0]">Лидер по ТТ: {g.topManagerName}</p>
                <div className="flex flex-wrap gap-2 pb-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs" onClick={() => setDetail({ kind: "rop", teamId: g.teamId })}>
                    Детали команды
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2" data-testid={`section-trade-points-rop-members-${g.teamId}`}>
                  {g.managers.map((m) => {
                    const share = Math.round((m.tpCount / maxMgrTp) * 100);
                    return (
                      <button
                        key={m.managerId}
                        type="button"
                        className="rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/50"
                        data-testid={`button-trade-points-manager-open-${m.managerId}`}
                        onClick={() => setDetail({ kind: "manager", teamId: g.teamId, managerId: m.managerId })}
                      >
                        <p className="truncate text-sm font-semibold text-[#222631]" data-testid={`card-trade-points-manager-${m.managerId}`}>
                          {m.name}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8F96B0]">
                          ТТ {m.tpCount} · клиентов {m.dealerIds.size} · городов {m.cityIds.size}
                        </p>
                        <p className="text-[11px] text-[#8F96B0]">без фото {m.noPhoto} · не заполнено {m.unfilled}</p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#EEEFF6]">
                          <div className="h-full rounded-full bg-[#9ACA3C]/75" style={{ width: `${share}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-primary">Детали →</p>
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

  if (overview) {
    const closeSheet = () => setDetail(null);
    const inSheet = detail?.kind === "manager_overview" || detail?.kind === "rop_overview";
    const ropForSheet =
      detail?.kind === "rop_overview" || detail?.kind === "manager_overview"
        ? overview.ropGroups.find((g) => (g.teamId ?? "__no_rop__") === detail.teamId) ?? null
        : null;
    const overviewKpis: Array<[string, number]> = [
      ["Активные ТТ", overview.structure.activeTradePoints],
      ["Клиентов с ТТ", overview.structure.clientsWithTp],
      ["Городов", overview.structure.cities],
      ["Без фото", overview.structure.withoutPhoto],
      ["Не заполнены", overview.structure.notFilled],
      ["С фото", overview.structure.withPhoto],
    ];
    return (
      <div
        className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10"
        data-testid="page-trade-points"
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Торговые точки</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Управленческий обзор торговых точек.
            </p>
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

        <section data-testid="section-trade-points-kpi">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {overviewKpis.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-card-foreground"
              >
                <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground tabular-nums sm:text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-2" data-testid="section-trade-points-mode-toggle">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Режим</p>
          <div className="flex gap-2">
            {(["overview", "by_rop", "cities"] as TradePointsManagementMode[]).map((m) => {
              const active = mode === m;
              const label = m === "overview" ? "Обзор" : m === "by_rop" ? "По РОП" : "По городам";
              return (
                <Button
                  key={m}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="h-9 flex-1 text-xs font-semibold sm:flex-none sm:px-4"
                  data-testid={`button-trade-points-mode-${m === "by_rop" ? "rop" : m}`}
                  onClick={() => setModeAndPersist(m)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {mode === "overview" && overview.topRopTeams.length > 0 ? (
          <Card className="rounded-xl border border-border bg-card text-card-foreground">
            <CardContent className="space-y-1 p-3">
              <h3 className="text-sm font-semibold text-foreground">Топ команд по ТТ</h3>
              {overview.topRopTeams.map((g, i) => {
                const key = (g.teamId ?? "__no_rop__") + ":" + i;
                return (
                  <button
                    key={key}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/40"
                    onClick={() => setDetail({ kind: "rop_overview", teamId: g.teamId ?? "__no_rop__" })}
                  >
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{g.teamName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      ТТ {g.tradePoints} · клиентов {g.clientsWithTp}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {mode === "overview" || mode === "cities" ? (
          <Card className="rounded-xl border border-border bg-card text-card-foreground">
            <CardContent className="space-y-2 p-3">
              <h3 className="text-sm font-semibold text-foreground">Города</h3>
              {overview.cities.length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет городов с торговыми точками.</p>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {overview.cities.slice(0, 5).map((c) => (
                    <button
                      key={c.cityKey}
                      type="button"
                      className="flex items-baseline justify-between gap-3 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/40"
                      onClick={() => setDetail({ kind: "city", cityKey: c.cityKey })}
                    >
                      <span className="truncate font-medium text-foreground">{c.cityName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        ТТ {c.tradePointsCount} · клиенты {c.clientsCount}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {overview.cities.length > 5 ? (
                <p className="text-[11px] text-muted-foreground">+ ещё {overview.cities.length - 5} городов</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {mode === "overview" || mode === "by_rop" ? (
          <section className="space-y-2" data-testid="section-trade-points-rop-groups">
            {overview.ropGroups.length === 0 ? (
              <Card className="rounded-xl border border-border bg-card text-card-foreground">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Нет активных торговых точек в текущем merge.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" value={openRops} onValueChange={(v) => setOpenRops(v)} className="space-y-2">
                {overview.ropGroups.map((g) => {
                  const teamKey = g.teamId ?? "__no_rop__";
                  return (
                    <AccordionItem
                      key={teamKey}
                      value={teamKey}
                      className="rounded-xl border border-border bg-card text-card-foreground"
                      data-testid={`card-trade-points-rop-${teamKey}`}
                    >
                      <AccordionTrigger
                        className="px-3 py-2 hover:no-underline"
                        data-testid={`button-trade-points-rop-toggle-${teamKey}`}
                      >
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                          <span className="truncate text-sm font-semibold text-foreground">{g.teamName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {g.ropFullName} · менеджеров {g.managerCount} · ТТ {g.tradePoints} · без фото {g.withoutPhoto}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            клиентов с ТТ {g.clientsWithTp} · городов {g.cities} · не заполнено {g.notFilled}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="ml-auto h-8 text-xs"
                            data-testid={`button-trade-points-rop-details-${teamKey}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail({ kind: "rop_overview", teamId: teamKey });
                            }}
                          >
                            Детали команды
                          </Button>
                        </div>
                        {g.managers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">В команде нет менеджеров.</p>
                        ) : (
                          <div
                            className="grid gap-2 sm:grid-cols-2"
                            data-testid={`section-trade-points-rop-members-${teamKey}`}
                          >
                            {g.managers.map((m) => (
                              <button
                                key={m.userId}
                                type="button"
                                className="rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition-colors hover:bg-muted/40"
                                data-testid={`button-trade-points-manager-open-${m.userId}`}
                                onClick={() =>
                                  setDetail({ kind: "manager_overview", managerUserId: m.userId, teamId: teamKey })
                                }
                              >
                                <p
                                  className="truncate text-sm font-semibold text-foreground"
                                  data-testid={`card-trade-points-manager-${m.userId}`}
                                >
                                  {m.fullName}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  ТТ {m.tradePoints} · клиентов с ТТ {m.clientsWithTp} · городов {m.cities}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  без фото {m.withoutPhoto} · не заполнено {m.notFilled}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </section>
        ) : null}

        <Sheet open={inSheet} onOpenChange={(o) => !o && closeSheet()}>
          <SheetContent
            side="bottom"
            className="max-h-[88vh] rounded-t-2xl border-border bg-card p-0"
            data-testid="dialog-trade-points-management-detail"
          >
            <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-base text-foreground">
                {detail?.kind === "manager_overview"
                  ? managerDetailQ.data?.manager.fullName ?? "Менеджер"
                  : ropForSheet?.teamName ?? "Команда"}
              </SheetTitle>
              <SheetDescription>
                {detail?.kind === "manager_overview" && managerDetailQ.data
                  ? `Команда: ${managerDetailQ.data.manager.ropFullName} · ТТ ${managerDetailQ.data.tradePoints.length} · клиентов с ТТ ${managerDetailQ.data.clients.length}`
                  : detail?.kind === "rop_overview" && ropForSheet
                    ? `${ropForSheet.ropFullName} · менеджеров ${ropForSheet.managerCount} · ТТ ${ropForSheet.tradePoints}`
                    : "Реальные данные актуализации"}
              </SheetDescription>
            </SheetHeader>
            <div className="max-h-[70vh] overflow-y-auto px-4 pb-24 pt-3">
              {detail?.kind === "manager_overview" ? (
                managerDetailQ.isLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : managerDetailQ.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>Не удалось загрузить торговые точки менеджера.</AlertDescription>
                  </Alert>
                ) : managerDetailQ.data ? (
                  <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "points" | "clients")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="points" className="text-xs" data-testid="tab-trade-points-manager-overview-points">
                        Точки ({managerDetailQ.data.tradePoints.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="clients"
                        className="text-xs"
                        data-testid="tab-trade-points-manager-overview-clients"
                      >
                        Клиенты ({managerDetailQ.data.clients.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="points" className="mt-3 space-y-2">
                      {managerDetailQ.data.tradePoints.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">У менеджера нет ТТ</p>
                      ) : (
                        managerDetailQ.data.tradePoints.map((tp) => (
                          <Card
                            key={tp.id}
                            className="rounded-xl border border-border bg-card text-card-foreground"
                            data-testid={`card-trade-points-manager-tp-${tp.id}`}
                          >
                            <CardContent className="space-y-1 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2">
                                  <ClientAvatar
                                    name={tp.clientFullName}
                                    seed={tp.clientId}
                                    size={24}
                                    shape="circle"
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {tp.name ?? tp.address ?? "ТТ"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {tp.city ?? "—"}
                                      {tp.address ? ` · ${tp.address}` : ""}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      клиент: {tp.clientFullName} ({TP_STATUS_LABEL[tp.clientStatus]})
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {tp.hasPhoto ? "с фото" : "без фото"}
                                      {tp.notFilled ? " · не заполнено" : ""}
                                    </p>
                                  </div>
                                </div>
                                <Button asChild variant="outline" size="sm">
                                  <Link
                                    href={buildHashPath(
                                      `/dealers/${encodeURIComponent(tp.dealerProfileId ?? tp.clientId)}`,
                                    )}
                                  >
                                    Клиент
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </TabsContent>
                    <TabsContent value="clients" className="mt-3 space-y-2">
                      {managerDetailQ.data.clients.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">У менеджера нет клиентов</p>
                      ) : (
                        managerDetailQ.data.clients.map((c) => (
                          <Card
                            key={c.id}
                            className="rounded-xl border border-border bg-card text-card-foreground"
                            data-testid={`card-trade-points-manager-client-${c.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-3">
                                  <ClientAvatar
                                    name={c.fullName}
                                    seed={c.id || c.fullName}
                                    size={32}
                                    shape="circle"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{c.fullName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.city ?? "—"} · ТТ {c.tradePointsCount}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      статус: {TP_STATUS_LABEL[c.status]}
                                    </p>
                                  </div>
                                </div>
                                <Button asChild variant="outline" size="sm">
                                  <Link
                                    href={buildHashPath(`/dealers/${encodeURIComponent(c.dealerProfileId ?? c.id)}`)}
                                  >
                                    Карточка
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                ) : null
              ) : detail?.kind === "rop_overview" && ropForSheet ? (
                ropForSheet.managers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">В команде нет менеджеров.</p>
                ) : (
                  <div className="space-y-2">
                    {ropForSheet.managers.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        className="w-full rounded-xl border border-border bg-card p-3 text-left text-card-foreground hover:bg-muted/40"
                        data-testid={`button-trade-points-rop-sheet-manager-${m.userId}`}
                        onClick={() =>
                          setDetail({
                            kind: "manager_overview",
                            managerUserId: m.userId,
                            teamId: detail.teamId,
                          })
                        }
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{m.fullName}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          ТТ {m.tradePoints} · клиентов с ТТ {m.clientsWithTp} · городов {m.cities}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          без фото {m.withoutPhoto} · не заполнено {m.notFilled}
                        </p>
                        <p className="mt-2 text-xs text-primary">Открыть →</p>
                      </button>
                    ))}
                  </div>
                )
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  if (overviewQ.isLoading) {
    return (
      <div
        className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10"
        data-testid="page-trade-points"
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Торговые точки</h1>
            <p className="mt-1 text-sm text-muted-foreground">Загружаем реальные данные…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10"
      data-testid="page-trade-points"
    >
      <div data-testid="section-trade-points-management-cockpit" className="contents">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[#222631] sm:text-3xl">Торговые точки</h1>
            <p className="mt-1 text-sm text-[#8F96B0]">Управленческий обзор активных ТТ (merge актуализации). Без архива и демо.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="border-[#E3E6F3]" asChild>
              <Link href={buildHashPath("/dealer-base")}>Клиентская база</Link>
            </Button>
            <Button variant="outline" size="sm" className="border-[#E3E6F3]" asChild>
              <Link href={buildHashPath("/client-map")}>Карта</Link>
            </Button>
          </div>
        </div>

        {overviewQ.isError ? (
          <Alert variant="destructive" data-testid="alert-trade-points-overview-error">
            <AlertDescription>Не удалось получить актуальные данные. Показаны демонстрационные срезы.</AlertDescription>
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
            <p className="mb-1 text-xs font-medium text-[#8F96B0]">Команда для merge</p>
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

        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="min-w-0 flex-1 space-y-6">
            {structureBlock}

            <div className="space-y-2" data-testid="section-trade-points-mode-toggle">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#8F96B0]">Режим</p>
              <div className="flex gap-2">
                {modeBtn("overview", "Обзор", "button-trade-points-mode-overview")}
                {modeBtn("by_rop", "По РОП", "button-trade-points-mode-rop")}
                {modeBtn("cities", "По городам", "button-trade-points-mode-cities")}
              </div>
            </div>

            {mode === "overview" && hasData ? (
              <>
                {overviewExtras}
                {citySection}
              </>
            ) : null}
            {mode === "cities" ? citySection : null}
            {mode === "by_rop" || mode === "overview" ? ropAccordion : null}
          </div>

          {!isMobile && detail ? (
            <aside
              className="sticky top-4 hidden w-full max-w-md shrink-0 rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] shadow-sm lg:block lg:max-w-[460px]"
              data-testid="dialog-trade-points-management-detail"
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
          <SheetContent
            side="bottom"
            className="max-h-[88vh] rounded-t-2xl border-[#E3E6F3] p-0"
            data-testid="dialog-trade-points-management-detail"
          >
            <SheetHeader className="border-b border-[#E3E6F3] px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-base text-[#222631]">{detailTitle(detail, ropGroups, cities)}</SheetTitle>
              <SheetDescription className="sr-only">Детали</SheetDescription>
            </SheetHeader>
            <div className="max-h-[70vh] overflow-y-auto px-4 pb-24 pt-2">
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
              <Button asChild variant="outline" size="sm" className="h-9 flex-1 border-[#E3E6F3]">
                <Link href={buildHashPath("/dealer-base")}>База</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
