import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEALER_BASE_ROWS, type DealerRow, type DealerCategory, type DealerStatus } from "@/lib/dealer-base-mock-data";
import {
  getManagersForRopTeam,
  getRopOptions,
  isRopOrManagerAllFilter,
  managerDisplayMatchesCatalogName,
} from "@/lib/rop-manager-filters";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { loadReleaseDemoProfile, getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById, getTeamManagers, getAllSalesManagers, type SalesUser } from "@/lib/sales-control-data";
import {
  buildDayPlanTeamRows,
  dealerNeedsAttention,
  DEALER_BASE_TEAM_WORK_VIEWS,
  DEALER_BASE_VIEW_LABELS,
  defaultWorkViewForAccess,
  groupLabelsForAccess,
  isDealerBusinessRisk,
  isDealerTop,
  initialRopManagerForProfile,
  managerOptionsForProfile,
  mapSalesRoleToDealerBaseAccess,
  pickTodayContactRows,
  roleScopedDealerRows,
  ropOptionsForProfile,
  viewsInGroupForAccess,
  workViewGroup,
  workViewsForAccess,
  type DealerBaseAccessRole,
  type DealerBaseWorkView,
} from "@/lib/dealer-base-role-views";
import { CityConcentrationBlock } from "@/components/city-concentration-block";
import { buildTeamSummary } from "@/lib/team-summary";
import { TeamSummaryCard } from "@/components/team-summary-card";
import { buildCityConcentrationRows, buildDealerBaseAllCitiesHref, buildDealerBaseCityDrillHref } from "@/lib/city-concentration";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";

const DEALER_BASE_DISPLAY_LIMIT = 300;
const TODAY_LIMIT = 100;

type QuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity";

const QUICK_FROM_URL: Record<string, QuickFilter> = {
  all: "all",
  active: "active",
  potential: "potential",
  attention: "attention",
  top: "top",
  inactive: "no_activity",
  no_activity: "no_activity",
};

function parseWorkViewFromQuery(raw: string | null, access: DealerBaseAccessRole): DealerBaseWorkView | null {
  if (!raw) return null;
  const v = raw.trim() as DealerBaseWorkView;
  return workViewsForAccess(access).includes(v) ? v : null;
}

function teamAllowedForProfile(
  teamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): boolean {
  if (!getRopOptions().some((o) => o.teamId === teamId)) return false;
  if (access === "sales_director") return true;
  if (access === "team_lead") return teamId === getEffectiveTeamLeadTeamId(profile);
  const u = getSalesUserById(profile.personaUserId);
  return Boolean(u?.teamId === teamId);
}

function managerAllowedForRop(
  managerId: string,
  ropTeamId: string,
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): boolean {
  if (access === "sales_manager") {
    const u = getSalesUserById(profile.personaUserId);
    return Boolean(u?.id === managerId);
  }
  const pool = access === "sales_director" && isRopOrManagerAllFilter(ropTeamId)
    ? getAllSalesManagers()
    : getManagersForRopTeam(ropTeamId);
  return pool.some((m) => m.id === managerId);
}

const QUICK_FILTERS: { id: QuickFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-dealers-all" },
  { id: "active", label: "Активные", testId: "filter-dealers-active" },
  { id: "potential", label: "Потенциальные", testId: "filter-dealers-potential" },
  { id: "attention", label: "Требуют внимания", testId: "filter-dealers-attention" },
  { id: "top", label: "TOP", testId: "filter-dealers-top" },
  { id: "no_activity", label: "Без активности", testId: "filter-dealers-no-activity" },
];

function statusBadgeClass(status: DealerStatus) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function categoryBadgeClass(cat: DealerCategory) {
  if (cat === "TOP") return "border-primary/40 bg-primary/15 text-foreground font-semibold";
  return "border-border bg-muted/60 text-foreground";
}

function applyQuickFilter(row: DealerRow, q: QuickFilter): boolean {
  switch (q) {
    case "all":
      return true;
    case "active":
      return row.status === "активный";
    case "potential":
      return row.status === "потенциальный";
    case "attention":
      return row.status === "требует внимания" || row.hasProblem;
    case "top":
      return row.category === "TOP";
    case "no_activity":
      return !row.hasRecentActivity;
    default:
      return true;
  }
}

type PickerArgs = {
  search: string;
  quick: QuickFilter;
  city: string;
  category: string;
  ropTeam: string;
  manager: string;
  managerCatalogForRop: ReturnType<typeof getManagersForRopTeam>;
};

function applyPickerFilters(rows: DealerRow[], args: PickerArgs): DealerRow[] {
  const q = args.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (!applyQuickFilter(row, args.quick)) return false;
    if (args.city !== "all" && row.city !== args.city) return false;
    if (args.category !== "all" && row.category !== args.category) return false;
    if (!isRopOrManagerAllFilter(args.ropTeam)) {
      if (row.releaseTeamId !== args.ropTeam) return false;
    }
    if (!isRopOrManagerAllFilter(args.manager)) {
      let mgrOk = row.releaseManagerId === args.manager;
      if (!mgrOk) {
        const cat = args.managerCatalogForRop.find((m) => m.id === args.manager);
        mgrOk = Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
      }
      if (!mgrOk) return false;
    }
    if (!q) return true;
    const hay = [
      row.name,
      row.city,
      row.manager,
      row.regionalManager,
      row.releaseCode ?? "",
      row.releaseAddress ?? "",
      row.clientTypeLabel ?? "",
      row.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function managerStatsForRows(rows: DealerRow[]) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "активный").length;
  const top = rows.filter(isDealerTop).length;
  const attention = rows.filter(dealerNeedsAttention).length;
  const potential = rows.filter((r) => r.status === "потенциальный").length;
  return { total, active, top, attention, potential };
}

function groupRowsByManagerKey(rows: DealerRow[]): { key: string; label: string; rows: DealerRow[] }[] {
  const m = new Map<string, { label: string; rows: DealerRow[] }>();
  for (const r of rows) {
    const key = r.releaseManagerId ?? r.manager;
    const label = r.manager || "—";
    const cur = m.get(key) ?? { label, rows: [] as DealerRow[] };
    cur.rows.push(r);
    if (label !== "—") cur.label = label;
    m.set(key, cur);
  }
  return Array.from(m.entries())
    .map(([key, v]) => ({ key, label: v.label, rows: v.rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
}

function viewSectionDataTestId(view: DealerBaseWorkView): string {
  return `section-dealer-base-view-${view.replace(/_/g, "-")}`;
}

function rowBelongsToManager(row: DealerRow, m: Pick<SalesUser, "id" | "name">): boolean {
  if (row.releaseManagerId === m.id) return true;
  return managerDisplayMatchesCatalogName(row.manager, m.name);
}

function OpenDealerButton({ id }: { id: string }) {
  return (
    <Button asChild className="min-h-11 shrink-0 font-semibold" data-testid={`button-open-dealer-${id}`}>
      <Link href={`/dealers/${id}`}>Открыть</Link>
    </Button>
  );
}

function ClientListBlock({ rows, empty, compact }: { rows: DealerRow[]; empty: string; compact?: boolean }) {
  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {rows.map((row) => (
        <Card
          key={row.id}
          className="rounded-2xl border border-border/80 bg-card shadow-sm"
          data-testid={`row-dealer-${row.id}`}
        >
          <CardContent
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
              compact ? "p-3 sm:gap-3" : "p-4 sm:gap-4",
            )}
          >
            <div className={cn("min-w-0 flex-1", compact ? "space-y-1" : "space-y-2")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("font-semibold text-foreground", compact && "text-sm")}>{row.name}</span>
                <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                  {row.category}
                </Badge>
                <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                  {row.status}
                </Badge>
                {row.hasProblem ? (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-800">
                    Есть вопрос
                  </Badge>
                ) : null}
              </div>
              <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                Код: {row.releaseCode ?? "—"} · {row.city} · {row.manager}
              </p>
              {!compact ? (
                <>
                  <p className="text-xs text-muted-foreground">РОП: {row.regionalManager}</p>
                  <p className="text-xs text-muted-foreground">
                    Тип: {row.clientTypeLabel ?? row.category} · ТТ: {row.outlets}
                  </p>
                  {row.releaseAddress ? (
                    <p className="text-xs text-muted-foreground">Адрес: {row.releaseAddress}</p>
                  ) : null}
                </>
              ) : null}
            </div>
            <OpenDealerButton id={row.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClientTableBlock({ rows }: { rows: DealerRow[] }) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={row.id} className="rounded-2xl border border-border/80 bg-card shadow-sm" data-testid={`row-dealer-${row.id}`}>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{row.name}</span>
                <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                  {row.category}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {row.city} · {row.status}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.manager} · РОП: {row.regionalManager}
              </p>
              {row.releaseAddress ? <p className="text-xs text-muted-foreground line-clamp-2">{row.releaseAddress}</p> : null}
              <OpenDealerButton id={row.id} />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="hidden min-w-0 sm:block sm:max-w-full sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-border/80 sm:bg-card sm:shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Код", "Клиент", "Город", "РОП", "Менеджер", "Тип клиента", "Адрес", "Статус", ""].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0" data-testid={`row-dealer-${row.id}`}>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.releaseCode ?? "—"}</td>
                <td className="max-w-[160px] truncate px-3 py-3 font-medium" title={row.name}>
                  {row.name}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{row.city}</td>
                <td className="max-w-[120px] truncate px-3 py-3 text-xs" title={row.regionalManager}>
                  {row.regionalManager}
                </td>
                <td className="max-w-[120px] truncate px-3 py-3 text-xs" title={row.manager}>
                  {row.manager}
                </td>
                <td className="max-w-[140px] truncate px-3 py-3 text-xs" title={row.clientTypeLabel}>
                  {row.clientTypeLabel ?? row.category}
                </td>
                <td className="max-w-[180px] truncate px-3 py-3 text-xs text-muted-foreground" title={row.releaseAddress}>
                  {row.releaseAddress ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Button asChild size="sm" className="font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                    <Link href={`/dealers/${row.id}`}>Открыть</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function DealerBase() {
  const { profile } = useReleaseDemoProfile();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);

  const [workView, setWorkView] = useState<DealerBaseWorkView>(() => {
    const p = loadReleaseDemoProfile();
    return defaultWorkViewForAccess(mapSalesRoleToDealerBaseAccess(p.role));
  });
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [ropTeam, setRopTeam] = useState<string>(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).ropTeam;
  });
  const [manager, setManager] = useState<string>(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).manager;
  });

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);

  useEffect(() => {
    const allowed = workViewsForAccess(access);
    setWorkView((prev) => (allowed.includes(prev) ? prev : defaultWorkViewForAccess(access)));
  }, [access]);

  const managerCatalogForRop = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);
  const managerOptions = useMemo(
    () => managerOptionsForProfile(profile, access, ropTeam),
    [profile, access, ropTeam],
  );
  const ropSelectOptions = useMemo(() => ropOptionsForProfile(profile, access), [profile, access]);

  const scopedRows = useMemo(() => roleScopedDealerRows(DEALER_BASE_ROWS, profile), [profile]);

  const pickerArgs = useMemo(
    () => ({ search, quick, city, category, ropTeam, manager, managerCatalogForRop }),
    [search, quick, city, category, ropTeam, manager, managerCatalogForRop],
  );

  const pickerFiltered = useMemo(() => applyPickerFilters(scopedRows, pickerArgs), [scopedRows, pickerArgs]);

  const kpis = useMemo(() => {
    const total = pickerFiltered.length;
    const active = pickerFiltered.filter((r) => r.status === "активный").length;
    const potential = pickerFiltered.filter((r) => r.status === "потенциальный").length;
    const attention = pickerFiltered.filter((r) => r.status === "требует внимания" || r.hasProblem).length;
    const outlets = pickerFiltered.reduce((a, r) => a + r.outlets, 0);
    const avgDist =
      total > 0 ? Math.round(pickerFiltered.reduce((a, r) => a + r.distribution, 0) / total) : 0;
    return { total, active, potential, attention, outlets, avgDist };
  }, [pickerFiltered]);

  const categoryOptions = useMemo(() => {
    const s = new Set(scopedRows.map((r) => r.category));
    return Array.from(s).sort() as DealerCategory[];
  }, [scopedRows]);

  const cities = useMemo(() => {
    const s = new Set(scopedRows.map((r) => r.city));
    return Array.from(s).sort();
  }, [scopedRows]);

  useEffect(() => {
    const d = initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      setRopTeam(d.ropTeam);
      setManager(d.manager);
      setQuick("all");
      setCity("all");
      setCategory("all");
      setSearch("");
      setWorkView(defaultWorkViewForAccess(access));
      return;
    }

    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv: QuickFilter = "all";
    let cityV = "all";
    let catV = "all";
    let searchV = "";
    let vw: DealerBaseWorkView = defaultWorkViewForAccess(access);

    const scoped = roleScopedDealerRows(DEALER_BASE_ROWS, profile);
    const catOpts = Array.from(new Set(scoped.map((r) => r.category))) as DealerCategory[];

    const teamRaw = (routeQs.get("team") ?? routeQs.get("rop"))?.trim() ?? "";
    const managerRaw = routeQs.get("manager")?.trim() ?? "";
    const viewRaw = routeQs.get("view")?.trim() ?? "";
    const viewNorm =
      viewRaw.toLowerCase() === "cities"
        ? access === "sales_director"
          ? "cities_all"
          : access === "team_lead"
            ? "team_cities"
            : "my_cities"
        : viewRaw;
    const viewParsed = parseWorkViewFromQuery(viewNorm || null, access);
    const quickRaw = (routeQs.get("quick") ?? "").trim().toLowerCase();
    if (quickRaw && QUICK_FROM_URL[quickRaw]) qv = QUICK_FROM_URL[quickRaw]!;

    if (teamRaw && teamAllowedForProfile(teamRaw, profile, access)) {
      rop = teamRaw;
      mgr = "all";
    }

    if (managerRaw && managerAllowedForRop(managerRaw, rop, profile, access)) {
      mgr = managerRaw;
    }

    if (viewParsed) {
      vw = viewParsed;
    } else if (mgr !== "all" && !isRopOrManagerAllFilter(mgr) && (access === "sales_director" || access === "team_lead")) {
      vw = "my_clients";
    } else if (
      teamRaw &&
      teamAllowedForProfile(teamRaw, profile, access) &&
      !managerRaw &&
      (access === "sales_director" || access === "team_lead")
    ) {
      vw = "my_team";
    }

    const cityRaw = routeQs.get("city")?.trim();
    if (cityRaw && cityRaw !== "all" && scoped.some((r) => r.city === cityRaw)) cityV = cityRaw;

    const catRaw = routeQs.get("category")?.trim();
    if (catRaw && catRaw !== "all" && catOpts.includes(catRaw as DealerCategory)) catV = catRaw;

    const searchRaw = routeQs.get("search")?.trim();
    if (searchRaw) searchV = searchRaw;

    setRopTeam(rop);
    setManager(mgr);
    setQuick(qv);
    setCity(cityV);
    setCategory(catV);
    setSearch(searchV);
    setWorkView(vw);
  }, [profile.personaUserId, profile.role, access, routeKey, routeQs]);

  const firstRopTeamId = useMemo(() => getRopOptions()[0]?.teamId ?? "", []);

  const effectiveTeamIdForTeamModes = useMemo(() => {
    if (access === "team_lead") return getEffectiveTeamLeadTeamId(profile);
    if (access === "sales_manager") {
      return getSalesUserById(profile.personaUserId)?.teamId ?? firstRopTeamId;
    }
    if (!isRopOrManagerAllFilter(ropTeam)) return ropTeam;
    return firstRopTeamId;
  }, [access, profile, ropTeam, firstRopTeamId]);

  const teamRowsForModes = useMemo(
    () => scopedRows.filter((r) => r.releaseTeamId === effectiveTeamIdForTeamModes),
    [scopedRows, effectiveTeamIdForTeamModes],
  );

  const teamSummaryForCompactBanner = useMemo(() => {
    if (access !== "sales_director" && access !== "team_lead") return null;
    if (!DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) return null;
    return buildTeamSummary(effectiveTeamIdForTeamModes);
  }, [access, workView, effectiveTeamIdForTeamModes]);

  const teamRopDisplayLabel = useMemo(
    () => getRopOptions().find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—",
    [effectiveTeamIdForTeamModes],
  );

  const selectedManagerLabel = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return null;
    const fromCat = managerCatalogForRop.find((m) => m.id === manager);
    if (fromCat) return fromCat.name;
    return getSalesUserById(manager)?.name ?? null;
  }, [manager, managerCatalogForRop]);

  const hideManagerFilterInTeamView =
    (access === "sales_director" || access === "team_lead") &&
    DEALER_BASE_TEAM_WORK_VIEWS.includes(workView);

  const needsManagerSelection =
    (access === "sales_director" || access === "team_lead") &&
    (workView === "my_clients" ||
      workView === "today" ||
      workView === "my_attention" ||
      workView === "my_top" ||
      workView === "my_cities") &&
    isRopOrManagerAllFilter(manager);

  const resultsContextLine = useMemo(() => {
    if ((access === "sales_director" || access === "team_lead") && DEALER_BASE_TEAM_WORK_VIEWS.includes(workView)) {
      return `Показана команда: ${teamRopDisplayLabel}`;
    }
    if (selectedManagerLabel && !isRopOrManagerAllFilter(manager)) {
      if (access === "sales_manager") {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
      if (workViewGroup(workView) === "manager") {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
      if (
        workView === "table_all" ||
        workView === "table_team" ||
        workView === "risks_all" ||
        workView === "top_all" ||
        workView === "cities_all" ||
        workView === "team_cities"
      ) {
        return `Показаны клиенты: ${selectedManagerLabel}`;
      }
    }
    return null;
  }, [access, workView, manager, selectedManagerLabel, teamRopDisplayLabel]);

  const managerScopedRows = useMemo(() => {
    if (isRopOrManagerAllFilter(manager)) return pickerFiltered;
    const cat = managerCatalogForRop.find((m) => m.id === manager);
    return pickerFiltered.filter((row) => {
      if (row.releaseManagerId === manager) return true;
      return Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
    });
  }, [pickerFiltered, manager, managerCatalogForRop]);

  const teamTablePickerRows = useMemo(
    () => applyPickerFilters(teamRowsForModes, pickerArgs),
    [teamRowsForModes, pickerArgs],
  );

  const cityRowsDept = useMemo(() => buildCityConcentrationRows(pickerFiltered), [pickerFiltered]);
  const cityRowsTeam = useMemo(() => buildCityConcentrationRows(teamTablePickerRows), [teamTablePickerRows]);
  const cityRowsManager = useMemo(() => buildCityConcentrationRows(managerScopedRows), [managerScopedRows]);

  const allCitiesHref = useMemo(() => buildDealerBaseAllCitiesHref(profile.role, profile), [profile]);
  const cityRowHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { ropTeamId: ropTeam }),
    [profile, ropTeam],
  );
  const cityActiveHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { quick: "active", ropTeamId: ropTeam }),
    [profile, ropTeam],
  );
  const cityAttentionHref = useCallback(
    (city: string) => buildDealerBaseCityDrillHref(profile.role, profile, city, { quick: "attention", ropTeamId: ropTeam }),
    [profile, ropTeam],
  );

  const viewRows = useMemo(() => {
    const limit = DEALER_BASE_DISPLAY_LIMIT;
    const pick = pickerFiltered;
    switch (workView) {
      case "risks_all":
        return pick.filter(isDealerBusinessRisk).slice(0, limit);
      case "top_all":
        return pick.filter(isDealerTop).slice(0, limit);
      case "team_attention":
        return teamRowsForModes.filter(dealerNeedsAttention).slice(0, limit);
      case "day_plan_team":
        return buildDayPlanTeamRows(teamRowsForModes, limit);
      case "today":
        return pickTodayContactRows(needsManagerSelection ? [] : managerScopedRows, TODAY_LIMIT);
      case "my_attention":
        return (needsManagerSelection ? [] : managerScopedRows).filter(dealerNeedsAttention).slice(0, limit);
      case "my_top":
        return (needsManagerSelection ? [] : managerScopedRows).filter(isDealerTop).slice(0, limit);
      case "my_cities":
      case "cities_all":
      case "team_cities":
      case "by_manager":
      case "teams":
      case "my_team":
        return [];
      default:
        return [];
    }
  }, [
    workView,
    pickerFiltered,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
  ]);

  const displayRows = useMemo(() => {
    const limit = DEALER_BASE_DISPLAY_LIMIT;
    if (
      workView === "risks_all" ||
      workView === "top_all" ||
      workView === "team_attention" ||
      workView === "day_plan_team" ||
      workView === "today" ||
      workView === "my_attention" ||
      workView === "my_top"
    ) {
      return viewRows;
    }
    if (workView === "my_clients") {
      if (needsManagerSelection) return [];
      return managerScopedRows.slice(0, limit);
    }
    if (workView === "table_all") {
      return pickerFiltered.slice(0, limit);
    }
    if (workView === "table_team") {
      return applyPickerFilters(teamRowsForModes, pickerArgs).slice(0, limit);
    }
    return [];
  }, [
    workView,
    viewRows,
    pickerFiltered,
    pickerArgs,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
  ]);

  const cap = DEALER_BASE_DISPLAY_LIMIT;

  const onRopChange = useCallback(
    (v: string) => {
      setRopTeam(v);
      setManager((prev) => {
        if (prev === "all") return prev;
        const allowed = getManagersForRopTeam(v).some((m) => m.id === prev);
        return allowed ? prev : "all";
      });
    },
    [],
  );

  const handleSelectWorkView = useCallback(
    (v: DealerBaseWorkView) => {
      setWorkView(v);
      if (workViewGroup(v) === "team" && (access === "sales_director" || access === "team_lead")) {
        setManager("all");
      }
    },
    [access],
  );

  const handleManagerChange = useCallback(
    (v: string) => {
      setManager(v);
      if (!isRopOrManagerAllFilter(v)) {
        if (workViewsForAccess(access).includes("my_clients")) setWorkView("my_clients");
      } else if (workViewsForAccess(access).includes("my_team")) {
        setWorkView("my_team");
      }
    },
    [access],
  );

  const resultsCapTotal = useMemo(() => {
    switch (workView) {
      case "risks_all":
        return pickerFiltered.filter(isDealerBusinessRisk).length;
      case "top_all":
        return pickerFiltered.filter(isDealerTop).length;
      case "team_attention":
        return teamRowsForModes.filter(dealerNeedsAttention).length;
      case "day_plan_team":
        return buildDayPlanTeamRows(teamRowsForModes, 1_000_000).length;
      case "today":
        if (needsManagerSelection) return 0;
        return managerScopedRows.length;
      case "my_attention":
        if (needsManagerSelection) return 0;
        return managerScopedRows.filter(dealerNeedsAttention).length;
      case "my_top":
        if (needsManagerSelection) return 0;
        return managerScopedRows.filter(isDealerTop).length;
      case "my_clients":
        if (needsManagerSelection) return 0;
        return managerScopedRows.length;
      case "table_all":
        return pickerFiltered.length;
      case "table_team":
        return applyPickerFilters(teamRowsForModes, pickerArgs).length;
      default:
        return null;
    }
  }, [
    workView,
    pickerFiltered,
    teamRowsForModes,
    managerScopedRows,
    needsManagerSelection,
    pickerArgs,
  ]);

  const setRopManagerFromClick = (tid: string, mid: string) => {
    setRopTeam(tid);
    setManager(mid);
    if (workViewsForAccess(access).includes("my_clients")) setWorkView("my_clients");
  };

  const hintSelectRop =
    access === "sales_director" && workView === "my_team" && isRopOrManagerAllFilter(ropTeam) ? (
      <p className="text-sm text-muted-foreground">
        Выберите РОПа в фильтре выше, чтобы посмотреть команду. Превью: команда «
        {getRopOptions().find((o) => o.teamId === effectiveTeamIdForTeamModes)?.label ?? "—"}».
      </p>
    ) : null;

  const groupUi = groupLabelsForAccess(access);

  const hideResultsCap =
    needsManagerSelection &&
    (workView === "my_clients" || workView === "today" || workView === "my_attention" || workView === "my_top");

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6 sm:space-y-8" data-testid="page-dealer-base">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиентская база</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Клиенты пилота Release 1 (импорт Excel): поиск, фильтры и переход в карточку клиента.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 self-start" asChild>
          <Link
            href={buildHashPath("/client-map", {
              ...(city !== "all" ? { city } : {}),
              ...(isRopOrManagerAllFilter(ropTeam) ? {} : { team: ropTeam }),
              ...(isRopOrManagerAllFilter(manager) ? {} : { manager }),
              ...(quick !== "all" ? { quick } : {}),
            })}
            data-testid="button-dealer-base-open-client-map"
          >
            Карта клиентов
          </Link>
        </Button>
      </div>

      <section className="space-y-3" data-testid="section-dealer-base-kpis">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Всего клиентов", value: String(kpis.total) },
            { label: "Активные", value: String(kpis.active) },
            { label: "Потенциальные", value: String(kpis.potential) },
            { label: "Требуют внимания", value: String(kpis.attention) },
            { label: "Торговые точки", value: String(kpis.outlets) },
            { label: "Средняя дистрибуция", value: `${kpis.avgDist}%` },
          ].map((k) => (
            <Card key={k.label} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="p-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{k.value}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: название, код, город, РОП, менеджер, тип, адрес"
              className="min-h-11 rounded-xl border-border pl-10"
              data-testid="input-dealer-base-search"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={quick === f.id ? "default" : "outline"}
                className={cn("rounded-full", quick === f.id ? "" : "border-border bg-card")}
                onClick={() => setQuick(f.id)}
                data-testid={f.testId}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div
            className={cn(
              "grid min-w-0 gap-4 sm:grid-cols-2",
              hideManagerFilterInTeamView ? "lg:grid-cols-3" : "lg:grid-cols-4",
            )}
          >
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Город</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="min-h-11 min-w-0 rounded-xl">
                  <SelectValue placeholder="Город" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все города</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Классификация (TOP/A/B/C)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-h-11 min-w-0 rounded-xl">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">РОП</Label>
              <Select value={ropTeam} onValueChange={onRopChange}>
                <SelectTrigger className="min-h-11 min-w-0 rounded-xl" data-testid="select-dealer-base-rop">
                  <SelectValue placeholder="РОП" />
                </SelectTrigger>
                <SelectContent>
                  {access === "sales_director" ? (
                    <SelectItem value="all">Все РОПы</SelectItem>
                  ) : null}
                  {ropSelectOptions.map((r) => (
                    <SelectItem key={r.teamId} value={r.teamId}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideManagerFilterInTeamView ? (
              <div className="min-w-0 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Менеджер</Label>
                <Select value={manager} onValueChange={handleManagerChange}>
                  <SelectTrigger className="min-h-11 min-w-0 rounded-xl" data-testid="select-dealer-base-manager">
                    <SelectValue placeholder="Менеджер" />
                  </SelectTrigger>
                  <SelectContent>
                    {access === "sales_director" || access === "team_lead" ? (
                      <SelectItem value="all">Все менеджеры</SelectItem>
                    ) : null}
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {hideManagerFilterInTeamView ? (
            <p className="text-xs text-muted-foreground" data-testid="text-dealer-base-manager-filter-hint">
              Выберите режим менеджера, чтобы смотреть клиентов конкретного менеджера.
            </p>
          ) : null}

          <section className="space-y-4 border-t border-border pt-4" data-testid="section-dealer-base-role-views">
            <p className="text-xs font-medium text-muted-foreground">Рабочий режим:</p>
            <div className="flex min-w-0 flex-col gap-6">
              {groupUi.department ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-department">
                  <p className="text-sm font-semibold text-foreground">Отдел</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "department").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {groupUi.team ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-team">
                  <p className="text-sm font-semibold text-foreground">Команда</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "team").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {groupUi.manager ? (
                <div className="min-w-0 space-y-2" data-testid="section-dealer-base-role-group-manager">
                  <p className="text-sm font-semibold text-foreground">Менеджер</p>
                  <div className="flex flex-wrap gap-2">
                    {viewsInGroupForAccess(access, "manager").map((vid) => (
                      <Button
                        key={vid}
                        type="button"
                        size="sm"
                        variant={workView === vid ? "default" : "outline"}
                        className={cn("rounded-full", workView !== vid && "border-border bg-card")}
                        onClick={() => handleSelectWorkView(vid)}
                        data-testid={`button-dealer-base-view-${vid}`}
                      >
                        {DEALER_BASE_VIEW_LABELS[vid]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </CardContent>
      </Card>

      {resultsCapTotal !== null && !hideResultsCap ? (
        <p className="text-sm text-muted-foreground" data-testid="text-dealer-base-display-cap">
          Показано {displayRows.length} из {resultsCapTotal}
          {workView === "today" ? ` (лимит режима «Сегодня» ${TODAY_LIMIT})` : ""}
          {workView !== "today" && resultsCapTotal > cap ? ` (лимит отображения ${cap})` : ""}.
          {resultsCapTotal > displayRows.length && workView !== "today"
            ? " Уточните поиск или фильтры, чтобы сузить список."
            : null}
        </p>
      ) : null}

      <section className="min-w-0" data-testid="section-dealer-base-results">
        {resultsContextLine ? (
          <p className="mb-3 text-sm font-medium text-foreground" data-testid="text-dealer-base-results-context">
            {resultsContextLine}
          </p>
        ) : null}
        {teamSummaryForCompactBanner ? (
          <div className="mb-4 min-w-0 max-w-full" data-testid="section-dealer-base-team-compact-summary">
            <TeamSummaryCard
              variant="compact"
              summary={teamSummaryForCompactBanner}
              ctaHref={buildHashPath("/dealer-base", { team: teamSummaryForCompactBanner.teamId })}
              ctaLabel="Открыть команду"
              showCta={false}
            />
          </div>
        ) : null}
        {workView === "teams" ? (
          <div className="space-y-6" data-testid={viewSectionDataTestId("teams")}>
            {getRopOptions().map((rop) => {
              const mgrs = getTeamManagers(rop.teamId);
              return (
                <Card key={rop.teamId} className="rounded-2xl border border-border/80 bg-card shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{rop.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">Команда · карточки менеджеров</p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mgrs.map((m) => {
                      const rows = DEALER_BASE_ROWS.filter(
                        (r) => r.releaseTeamId === rop.teamId && rowBelongsToManager(r, m),
                      );
                      const st = managerStatsForRows(rows);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="rounded-xl border border-border/80 bg-muted/20 p-4 text-left transition hover:bg-muted/40"
                          onClick={() => setRopManagerFromClick(rop.teamId, m.id)}
                        >
                          <p className="font-semibold text-foreground">{m.name}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Всего: {st.total}</span>
                            <span>Активные: {st.active}</span>
                            <span>TOP: {st.top}</span>
                            <span>Внимание: {st.attention}</span>
                            <span className="col-span-2">Потенциальные: {st.potential}</span>
                          </div>
                          <p className="mt-2 text-[11px] text-primary">Нажмите, чтобы применить РОП + менеджера</p>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {workView === "cities_all" ? (
          <CityConcentrationBlock
            variant="dealer"
            rows={cityRowsDept}
            showAllHref={allCitiesHref}
            cityHref={cityRowHref}
            activeHref={cityActiveHref}
            attentionHref={cityAttentionHref}
            showAllLink={false}
          />
        ) : null}

        {workView === "team_cities" ? (
          <CityConcentrationBlock
            variant="dealer"
            rows={cityRowsTeam}
            showAllHref={allCitiesHref}
            cityHref={cityRowHref}
            activeHref={cityActiveHref}
            attentionHref={cityAttentionHref}
            showAllLink={false}
          />
        ) : null}

        {workView === "my_team" ? (
          <div className="space-y-3" data-testid={viewSectionDataTestId("my_team")}>
            {hintSelectRop}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getTeamManagers(effectiveTeamIdForTeamModes).map((m) => {
                const rows = teamRowsForModes.filter((r) => rowBelongsToManager(r, m));
                const st = managerStatsForRows(rows);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
                    onClick={() => setRopManagerFromClick(effectiveTeamIdForTeamModes, m.id)}
                  >
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Всего: {st.total}</span>
                      <span>Активные: {st.active}</span>
                      <span>TOP: {st.top}</span>
                      <span>Внимание: {st.attention}</span>
                      <span className="col-span-2">Потенциальные: {st.potential}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {workView === "by_manager" ? (
          <div className="space-y-6" data-testid={viewSectionDataTestId("by_manager")}>
            {groupRowsByManagerKey(teamRowsForModes).map((g) => (
              <Card key={g.key} className="rounded-2xl border border-border/80 bg-card shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">{g.rows.length} клиентов</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.rows.slice(0, 40).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      data-testid={`row-dealer-${row.id}`}
                    >
                      <span className="min-w-0 font-medium">{row.name}</span>
                      <OpenDealerButton id={row.id} />
                    </div>
                  ))}
                  {g.rows.length > 40 ? (
                    <p className="text-xs text-muted-foreground">Показаны 40 из {g.rows.length} в группе.</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {workView === "my_cities" ? (
          <div className="space-y-3" data-testid={viewSectionDataTestId("my_cities")}>
            {needsManagerSelection ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Выберите менеджера в фильтре выше, чтобы увидеть группировку по городам.
              </Card>
            ) : (
              <CityConcentrationBlock
                variant="dealer"
                rows={cityRowsManager}
                showAllHref={allCitiesHref}
                cityHref={cityRowHref}
                activeHref={cityActiveHref}
                attentionHref={cityAttentionHref}
                showAllLink={false}
              />
            )}
          </div>
        ) : null}

        {needsManagerSelection && workView !== "my_cities" ? (
          <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Выберите менеджера в фильтре выше, чтобы увидеть данные в этом режиме.
          </Card>
        ) : null}

        {!needsManagerSelection &&
        (workView === "risks_all" ||
          workView === "top_all" ||
          workView === "team_attention" ||
          workView === "day_plan_team" ||
          workView === "today" ||
          workView === "my_attention" ||
          workView === "my_top" ||
          workView === "my_clients") ? (
          <div
            data-testid={viewSectionDataTestId(workView)}
            className={workView === "my_clients" ? "space-y-2" : "space-y-3"}
          >
            {workView === "my_clients" ? (
              <ClientListBlock rows={displayRows} empty="Нет клиентов по выбранным фильтрам." compact />
            ) : (
              <ClientListBlock rows={displayRows} empty="Нет записей." />
            )}
          </div>
        ) : null}

        {workView === "table_all" ? (
          <div data-testid={viewSectionDataTestId("table_all")}>
            {displayRows.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Ничего не найдено.
              </Card>
            ) : (
              <ClientTableBlock rows={displayRows} />
            )}
          </div>
        ) : null}

        {workView === "table_team" ? (
          <div data-testid={viewSectionDataTestId("table_team")}>
            {displayRows.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Нет клиентов команды по фильтрам.
              </Card>
            ) : (
              <ClientTableBlock rows={displayRows} />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
