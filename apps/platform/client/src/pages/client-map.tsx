import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { Search } from "lucide-react";
import { ClientMapYandex } from "@/components/client-map-yandex";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { Badge } from "@/components/ui/badge";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { type DealerRow } from "@/lib/dealer-base-mock-data";
import { useDealerBaseRows } from "@/lib/dealer-base-source";
import { DealerCatalogEmpty, DealerCatalogLoadError } from "@/components/dealer-catalog-query-ui";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  managerOptionsForProfile,
  ropOptionsForProfile,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import { getRoleScopedDealerRowsAuto, useRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import {
  CLIENT_MAP_LIST_LIMIT,
  CLIENT_MAP_MAX_MARKERS,
  buildClientMapMarkerBundle,
  clientMapListCoordinateBadgeText,
  computeClientMapKpis,
  filterClientMapRows,
  listCoordinateSourceForDealer,
  type ClientMapQuickFilter,
} from "@/lib/client-map-data";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getAllSalesManagers, getSalesUserById, type SalesRole } from "@/lib/sales-control-data";
import { getClientCategoryBadgeClass, getClientCategoryLabel } from "@/lib/client-category";
import { cn } from "@/lib/utils";

const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim() ?? "";

const QUICK_FROM_URL: Record<string, ClientMapQuickFilter> = {
  all: "all",
  active: "active",
  potential: "potential",
  attention: "attention",
  top: "top",
  inactive: "no_activity",
  no_activity: "no_activity",
};

const QUICK_OPTIONS: { id: ClientMapQuickFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "attention", label: "Внимание" },
  { id: "top", label: "ТОП-сегмент" },
  { id: "potential", label: "Потенциальные" },
  { id: "no_activity", label: "Без активности" },
];

function teamAllowedForProfile(teamId: string, profile: ReleaseDemoProfile, access: DealerBaseAccessRole): boolean {
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
    return getSalesUserById(profile.personaUserId)?.id === managerId;
  }
  const pool =
    access === "sales_director" && isRopOrManagerAllFilter(ropTeamId) ? getAllSalesManagers() : getManagersForRopTeam(ropTeamId);
  return pool.some((m) => m.id === managerId);
}

function roleSubtitle(role: SalesRole, profile: ReleaseDemoProfile): string {
  if (role === "sales_director") return "Все клиенты отдела";
  if (role === "analyst") return "Все клиенты отдела (аналитика)";
  if (role === "marketer") return "Все клиенты (просмотр)";
  if (role === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    const label = getRopOptions().find((o) => o.teamId === tid)?.label ?? "команда";
    return `Клиенты команды: ${label}`;
  }
  return "Мои клиенты";
}

export default function ClientMapPage() {
  const catalogQ = useDealerBaseRows();
  const catalogRows = catalogQ.data ?? [];
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const [, setLoc] = useHashLocation();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);

  const defaultRopManager = useMemo(
    () => initialRopManagerForProfile(profile, access),
    [profile, access],
  );
  const userTouchedPickerRef = useRef(false);

  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<ClientMapQuickFilter>("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [ropTeam, setRopTeam] = useState(defaultRopManager.ropTeam);
  const [manager, setManager] = useState(defaultRopManager.manager);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);

  useEffect(() => {
    if (userTouchedPickerRef.current) return;
    if (routeKey) return;
    setRopTeam(defaultRopManager.ropTeam);
    setManager(defaultRopManager.manager);
  }, [defaultRopManager.ropTeam, defaultRopManager.manager, routeKey]);

  const teamCtx = useClientBaseTeamActualization();
  const teamActualizationPlane = teamCtx.mergedState;
  const { publishDashboardRopTeamId } = teamCtx;
  const realScope = useSidebarNavRealScope();

  const baseRowsForMap = useMemo(
    () =>
      actx.enabled ? buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, { includeArchivedDealers: false }) : catalogRows,
    [actx.enabled, teamActualizationPlane, profile, catalogRows],
  );

  const scopedRows = useRoleScopedDealerRowsAuto(baseRowsForMap, profile);

  useEffect(() => {
    if (access !== "sales_director" && access !== "team_lead") return;
    publishDashboardRopTeamId(ropTeam);
  }, [ropTeam, access, publishDashboardRopTeamId]);

  useEffect(() => {
    const d = initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      if (!userTouchedPickerRef.current) {
        setRopTeam(d.ropTeam);
        setManager(d.manager);
      }
      setQuick("all");
      setSelectedCities([]);
      setSearch("");
      return;
    }
    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv: ClientMapQuickFilter = "all";
    let cityV: string[] = [];
    let searchV = "";
    const scoped = getRoleScopedDealerRowsAuto(
      actx.enabled ? buildDealerBaseRowsWithActualization(teamActualizationPlane, profile, { includeArchivedDealers: false }) : catalogRows,
      profile,
      realScope,
    );
    const teamRaw = (routeQs.get("team") ?? routeQs.get("rop"))?.trim() ?? "";
    const managerRaw = routeQs.get("manager")?.trim() ?? "";
    const quickRaw = (routeQs.get("quick") ?? "").trim().toLowerCase();
    if (quickRaw && QUICK_FROM_URL[quickRaw]) qv = QUICK_FROM_URL[quickRaw]!;
    if (teamRaw && teamAllowedForProfile(teamRaw, profile, access)) {
      rop = teamRaw;
      mgr = "all";
    }
    if (managerRaw && managerAllowedForRop(managerRaw, rop, profile, access)) {
      mgr = managerRaw;
    }
    const cityRaws = routeQs.getAll("city");
    const cityParsed: string[] = [];
    for (const raw of cityRaws) {
      for (const part of raw.split(",")) {
        const trimmed = part.trim();
        if (!trimmed || trimmed === "all") continue;
        if (scoped.some((r) => r.city === trimmed) && !cityParsed.includes(trimmed)) {
          cityParsed.push(trimmed);
        }
      }
    }
    cityV = cityParsed;
    const searchRaw = routeQs.get("search")?.trim();
    if (searchRaw) searchV = searchRaw;
    setRopTeam(rop);
    setManager(mgr);
    setQuick(qv);
    setSelectedCities(cityV);
    setSearch(searchV);
  }, [profile.personaUserId, profile.role, access, routeKey, routeQs, actx.enabled, teamActualizationPlane, realScope]);

  const managerCatalogForRop = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);
  const managerOptions = useMemo(() => managerOptionsForProfile(profile, access, ropTeam), [profile, access, ropTeam]);
  const ropSelectOptions = useMemo(() => ropOptionsForProfile(profile, access), [profile, access]);

  const pickerArgs = useMemo(
    () => ({ search, quick, cities: selectedCities, ropTeam, manager, managerCatalogForRop }),
    [search, quick, selectedCities, ropTeam, manager, managerCatalogForRop],
  );

  const filtered = useMemo(() => filterClientMapRows(scopedRows, pickerArgs), [scopedRows, pickerArgs]);

  const { exactAddressMarkers: markers, breakdown, truncated } = useMemo(
    () => buildClientMapMarkerBundle(filtered, CLIENT_MAP_MAX_MARKERS),
    [filtered],
  );

  const kpis = useMemo(
    () => computeClientMapKpis(filtered, breakdown, markers.length),
    [filtered, breakdown, markers.length],
  );

  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);

  const listRows = useMemo(() => filtered.slice(0, CLIENT_MAP_LIST_LIMIT), [filtered]);

  const cityOptions = useMemo(() => {
    const s = new Set(scopedRows.map((r) => r.city));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scopedRows]);

  const hideRopManagerFilters = access === "sales_manager";

  const onRopChange = useCallback((v: string) => {
    userTouchedPickerRef.current = true;
    setRopTeam(v);
    setManager((prev) => {
      if (prev === "all") return "all";
      const allowed = getManagersForRopTeam(v).some((m) => m.id === prev);
      return allowed ? prev : "all";
    });
  }, []);

  const onManagerChange = useCallback((v: string) => {
    userTouchedPickerRef.current = true;
    setManager(v);
  }, []);

  useEffect(() => {
    setFlyTo(null);
  }, [search, quick, selectedCities, ropTeam, manager]);

  const handleRowClick = useCallback(
    (d: DealerRow) => {
      const m = markerById.get(d.id);
      if (m) setFlyTo({ lat: m.lat, lng: m.lng });
      else setLoc(`/dealers/${d.id}`);
    },
    [markerById, setLoc],
  );

  if (catalogQ.isPending && !catalogQ.data) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24 p-4" data-testid="page-client-map">
        <p className="text-sm text-muted-foreground">Загрузка каталога клиентов…</p>
      </div>
    );
  }

  if (catalogQ.isError) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24 p-4" data-testid="page-client-map">
        <DealerCatalogLoadError catalogQ={catalogQ} />
      </div>
    );
  }

  if (!catalogQ.isPending && catalogRows.length === 0) {
    return (
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24 p-4" data-testid="page-client-map">
        <DealerCatalogEmpty />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-24" data-testid="page-client-map">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-client-map" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Карта клиентов</h1>
        <p className="mt-1 text-sm text-muted-foreground">{roleSubtitle(profile.role, profile)}</p>
      </div>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="section-client-map-kpis">
        <Card className="rounded-xl border border-border/80" data-testid="card-client-map-total">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Всего в доступе</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.total}</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80" data-testid="card-client-map-mapped">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">На карте</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.onMap}</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80" data-testid="card-client-map-missing">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Без точной координаты</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.withoutExactAddress}</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80" data-testid="card-client-map-active">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Активные</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.active}</CardContent>
        </Card>
        <Card className="rounded-xl border border-border/80" data-testid="card-client-map-attention">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Внимание</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.attention}</CardContent>
        </Card>
      </section>

      <Card className="rounded-xl border border-border/80" data-testid="card-client-map-address-coordinates">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold">Координаты на карте</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-4 pt-0 text-sm text-muted-foreground">
          <span>
            Точные адреса:{" "}
            <strong className="tabular-nums text-foreground" data-testid="text-client-map-address-count">
              {kpis.exactAddressInScope}
            </strong>
          </span>
          <span>
            Не показаны без точного адреса:{" "}
            <strong className="tabular-nums text-foreground" data-testid="text-client-map-without-exact-count">
              {kpis.withoutExactAddress}
            </strong>
          </span>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden rounded-xl border border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-3" data-testid="section-client-map-filters">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Поиск</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="min-h-10 pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Название, город, менеджер…"
                  data-testid="input-client-map-search"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Город</Label>
              <MultiSelect
                options={cityOptions.map((c) => ({ value: c, label: c }))}
                value={selectedCities}
                onChange={setSelectedCities}
                placeholder="Все города"
                allLabel="Все города"
                triggerClassName="min-h-10"
                testId="select-client-map-city"
                ariaLabel="Город"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Быстрый фильтр</Label>
              <Select value={quick} onValueChange={(v) => setQuick(v as ClientMapQuickFilter)}>
                <SelectTrigger className="min-h-10 min-w-0" data-testid="select-client-map-quick">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideRopManagerFilters ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">РОП / команда</Label>
                <Select value={ropTeam} onValueChange={onRopChange}>
                  <SelectTrigger className="min-h-10 min-w-0" data-testid="select-client-map-rop">
                    <SelectValue placeholder="РОП" />
                  </SelectTrigger>
                  <SelectContent>
                    {access === "sales_director" ? <SelectItem value="all">Все РОПы</SelectItem> : null}
                    {ropSelectOptions.map((o) => (
                      <SelectItem key={o.teamId} value={o.teamId}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {!hideRopManagerFilters ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Менеджер</Label>
                <Select value={manager} onValueChange={onManagerChange}>
                  <SelectTrigger className="min-h-10 min-w-0" data-testid="select-client-map-manager">
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
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <div
            className="min-h-[min(360px,52vh)] min-w-0 overflow-hidden rounded-xl border border-border/80 lg:min-h-[520px]"
            data-testid="section-client-map-canvas"
          >
            {YANDEX_MAPS_API_KEY ? (
              <ClientMapYandex apiKey={YANDEX_MAPS_API_KEY} markers={markers} flyTo={flyTo} />
            ) : (
              <div
                className="flex min-h-[min(360px,52vh)] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground lg:min-h-[520px]"
                data-testid="section-client-map-yandex-fallback"
              >
                <p>Карта Яндекса не настроена. Добавьте VITE_YANDEX_MAPS_API_KEY.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-client-map-visible-count">
            На карте отображается маркеров: {markers.length}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-client-map-map-policy-note">
            На карте отображаются только клиенты с точной координатой по адресу.
          </p>
          {kpis.withoutExactAddress > 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="text-client-map-geocoding-hint">
              Не показано без точной координаты: {kpis.withoutExactAddress}. Эти клиенты требуют геокодинга адреса.
            </p>
          ) : null}
          {truncated ? (
            <p className="text-xs text-muted-foreground" data-testid="text-client-map-truncated-hint">
              Показано на карте {markers.length} из {breakdown.exactAddressInScope} с точным адресом; уточните фильтр, чтобы увидеть
              остальные.
            </p>
          ) : null}
        </div>

        <Card className="min-w-0 shrink-0 lg:w-[320px]" data-testid="section-client-map-list">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Клиенты (топ {listRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[min(360px,52vh)] min-w-0 space-y-1 overflow-y-auto overflow-x-hidden lg:max-h-[520px]">
            {listRows.map((d) => {
              const coordSrc = listCoordinateSourceForDealer(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  className={cn(
                    "flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition hover:border-border hover:bg-muted/50",
                  )}
                  data-testid={`row-client-map-dealer-${d.id}`}
                  onClick={() => handleRowClick(d)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-medium">{d.name}</span>
                    <div className="flex max-w-[min(100%,11rem)] shrink-0 flex-wrap items-center justify-end gap-1">
                      <Badge
                        variant="outline"
                        className={cn("max-w-full px-1.5 py-0 text-[10px] font-normal", getClientCategoryBadgeClass(d.clientCategory))}
                        data-testid={`badge-client-map-category-${d.id}`}
                      >
                        {getClientCategoryLabel(d.clientCategory)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                        data-testid={`badge-client-map-coordinate-source-${d.id}`}
                      >
                        {clientMapListCoordinateBadgeText(coordSrc)}
                      </Badge>
                      {coordSrc !== "address" ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1.5 py-0 text-[10px] font-normal text-amber-800 dark:text-amber-200"
                          data-testid={`badge-client-map-needs-geocoding-${d.id}`}
                        >
                          требуется геокодинг
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {d.city} · {d.manager}
                  </span>
                  <span className="text-xs">{d.status}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
