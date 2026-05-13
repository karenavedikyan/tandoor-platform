import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
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
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  roleScopedDealerRows,
  managerOptionsForProfile,
  ropOptionsForProfile,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import {
  CLIENT_MAP_LIST_LIMIT,
  CLIENT_MAP_MAX_MARKERS,
  buildClientMapMarkers,
  computeClientMapKpis,
  filterClientMapRows,
  type ClientMapMarker,
  type ClientMapQuickFilter,
} from "@/lib/client-map-data";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import { getManagersForRopTeam, getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getEffectiveTeamLeadTeamId, loadReleaseDemoProfile, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getAllSalesManagers, getSalesUserById, type SalesRole } from "@/lib/sales-control-data";
import { cn } from "@/lib/utils";

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
  { id: "top", label: "TOP" },
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

function dealerBaseHrefForDealer(d: DealerRow): string {
  const params: Record<string, string> = { search: d.name, city: d.city };
  if (d.releaseTeamId) params.team = d.releaseTeamId;
  if (d.releaseManagerId) params.manager = d.releaseManagerId;
  return buildHashPath("/dealer-base", params);
}

function MapFitBounds({ points }: { points: L.LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView([47.25, 39.72], 7);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0] as L.LatLngTuple, 10);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 10 });
  }, [map, points]);
  return null;
}

function MapFlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], 11, { animate: true });
  }, [map, target]);
  return null;
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

function MarkerLayer({
  markers,
  flyTo,
}: {
  markers: ClientMapMarker[];
  flyTo: { lat: number; lng: number } | null;
}) {
  const pts = useMemo(() => markers.map((m) => [m.lat, m.lng] as L.LatLngTuple), [markers]);
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitBounds points={pts} />
      <MapFlyTo target={flyTo} />
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          ref={(inst) => {
            const el = inst?.getElement?.();
            if (el) el.setAttribute("data-testid", `marker-client-map-${m.id}`);
          }}
          center={[m.lat, m.lng]}
          radius={m.style.radius}
          pathOptions={{
            color: m.style.stroke,
            fillColor: m.style.fill,
            fillOpacity: 0.88,
            weight: 2,
          }}
        >
          <Popup>
            <div className="min-w-[200px] space-y-1 text-sm" data-testid={`popup-client-map-${m.id}`}>
              <p className="font-semibold leading-snug">{m.dealer.name}</p>
              <p className="text-muted-foreground">{m.dealer.city}</p>
              <p>
                <span className="text-muted-foreground">РОП:</span> {m.dealer.regionalManager || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Менеджер:</span> {m.dealer.manager}
              </p>
              <p>
                <span className="text-muted-foreground">Статус:</span> {m.dealer.status}
              </p>
              <div className="flex flex-col gap-1 pt-1">
                <Link
                  href={`/dealers/${m.dealer.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  data-testid={`link-client-map-open-dealer-${m.dealer.id}`}
                >
                  Открыть карточку
                </Link>
                <Link
                  href={dealerBaseHrefForDealer(m.dealer)}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  data-testid={`link-client-map-open-base-${m.dealer.id}`}
                >
                  Показать в базе
                </Link>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export default function ClientMapPage() {
  const { profile } = useReleaseDemoProfile();
  const [, setLoc] = useHashLocation();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);

  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<ClientMapQuickFilter>("all");
  const [city, setCity] = useState<string>("all");
  const [ropTeam, setRopTeam] = useState(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).ropTeam;
  });
  const [manager, setManager] = useState(() => {
    const p = loadReleaseDemoProfile();
    return initialRopManagerForProfile(p, mapSalesRoleToDealerBaseAccess(p.role)).manager;
  });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);

  const routeQs = useRouteSearchParams();
  const routeKey = useMemo(() => routeQs.toString(), [routeQs]);

  useEffect(() => {
    const d = initialRopManagerForProfile(profile, access);
    if (!routeKey) {
      setRopTeam(d.ropTeam);
      setManager(d.manager);
      setQuick("all");
      setCity("all");
      setSearch("");
      return;
    }
    let rop = d.ropTeam;
    let mgr = d.manager;
    let qv: ClientMapQuickFilter = "all";
    let cityV = "all";
    let searchV = "";
    const scoped = roleScopedDealerRows(DEALER_BASE_ROWS, profile);
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
    const cityRaw = routeQs.get("city")?.trim();
    if (cityRaw && cityRaw !== "all" && scoped.some((r) => r.city === cityRaw)) cityV = cityRaw;
    const searchRaw = routeQs.get("search")?.trim();
    if (searchRaw) searchV = searchRaw;
    setRopTeam(rop);
    setManager(mgr);
    setQuick(qv);
    setCity(cityV);
    setSearch(searchV);
  }, [profile.personaUserId, profile.role, access, routeKey, routeQs]);

  const managerCatalogForRop = useMemo(() => getManagersForRopTeam(ropTeam), [ropTeam]);
  const managerOptions = useMemo(() => managerOptionsForProfile(profile, access, ropTeam), [profile, access, ropTeam]);
  const ropSelectOptions = useMemo(() => ropOptionsForProfile(profile, access), [profile, access]);

  const scopedRows = useMemo(() => roleScopedDealerRows(DEALER_BASE_ROWS, profile), [profile]);

  const pickerArgs = useMemo(
    () => ({ search, quick, city, ropTeam, manager, managerCatalogForRop }),
    [search, quick, city, ropTeam, manager, managerCatalogForRop],
  );

  const filtered = useMemo(() => filterClientMapRows(scopedRows, pickerArgs), [scopedRows, pickerArgs]);

  const { markers, withCoords, missingCoords, truncated } = useMemo(
    () => buildClientMapMarkers(filtered, CLIENT_MAP_MAX_MARKERS),
    [filtered],
  );

  const kpis = useMemo(() => computeClientMapKpis(filtered, withCoords, missingCoords), [filtered, withCoords, missingCoords]);

  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);

  const listRows = useMemo(() => filtered.slice(0, CLIENT_MAP_LIST_LIMIT), [filtered]);

  const cities = useMemo(() => {
    const s = new Set(scopedRows.map((r) => r.city));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scopedRows]);

  const hideRopManagerFilters = access === "sales_manager";

  const onRopChange = useCallback((v: string) => {
    setRopTeam(v);
    setManager((prev) => {
      if (prev === "all") return "all";
      const allowed = getManagersForRopTeam(v).some((m) => m.id === prev);
      return allowed ? prev : "all";
    });
  }, []);

  useEffect(() => {
    setFlyTo(null);
  }, [search, quick, city, ropTeam, manager]);

  const handleRowClick = useCallback(
    (d: DealerRow) => {
      const m = markerById.get(d.id);
      if (m) setFlyTo({ lat: m.lat, lng: m.lng });
      else setLoc(`/dealers/${d.id}`);
    },
    [markerById, setLoc],
  );

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
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Без координат</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold tabular-nums">{kpis.missingCoords}</CardContent>
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
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="min-h-10 min-w-0" data-testid="select-client-map-city">
                  <SelectValue placeholder="Все" />
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
                <Select value={manager} onValueChange={setManager}>
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
            <MapContainer center={[47.25, 39.72]} zoom={7} className="h-[min(360px,52vh)] w-full min-w-0 lg:h-[520px]" scrollWheelZoom>
              <MarkerLayer markers={markers} flyTo={flyTo} />
            </MapContainer>
          </div>
          {truncated ? (
            <p className="text-xs text-muted-foreground">
              Показано на карте {CLIENT_MAP_MAX_MARKERS} из {withCoords}; уточните фильтр, чтобы увидеть остальные.
            </p>
          ) : null}
        </div>

        <Card className="min-w-0 shrink-0 lg:w-[320px]" data-testid="section-client-map-list">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Клиенты (топ {listRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[min(360px,52vh)] min-w-0 space-y-1 overflow-y-auto lg:max-h-[520px]">
            {listRows.map((d) => (
              <button
                key={d.id}
                type="button"
                className={cn(
                  "flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition hover:border-border hover:bg-muted/50",
                )}
                data-testid={`row-client-map-${d.id}`}
                onClick={() => handleRowClick(d)}
              >
                <span className="truncate font-medium">{d.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {d.city} · {d.manager}
                </span>
                <span className="text-xs">{d.status}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
