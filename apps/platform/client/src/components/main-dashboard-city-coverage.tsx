import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMainDashboardCityFilter } from "@/context/main-dashboard-city-filter-context";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildMainDashboardCityTiles,
  filterCityTilesBySearch,
  type MainDashboardCityTile,
} from "@/lib/main-dashboard-city-stats";
import { safeCityId } from "@/lib/city-concentration";
import { cn } from "@/lib/utils";

const DEFAULT_VISIBLE = 12;

type MainDashboardCityCoverageProps = {
  rows: DealerRow[];
  act: ActualizationState;
  tradePointCountByCity?: Map<string, number>;
  testId?: string;
};

function CityTile({
  tile,
  selected,
  onSelect,
}: {
  tile: MainDashboardCityTile;
  selected: boolean;
  onSelect: () => void;
}) {
  const sid = safeCityId(tile.city);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex min-h-[4.5rem] min-w-0 flex-col items-start rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-muted/40",
        selected && "ring-2 ring-primary bg-primary/10",
        tile.isNoCity && "border-dashed bg-muted/30 text-muted-foreground",
      )}
      data-testid={`tile-main-city-${sid}`}
      aria-pressed={selected}
    >
      {selected ? (
        <span
          className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid={`button-main-city-clear-${sid}`}
          aria-label={`Снять фильтр: ${tile.city}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <span className={cn("line-clamp-2 pr-6 text-xs font-semibold uppercase tracking-wide", tile.isNoCity && "text-muted-foreground")}>
        {tile.city}
      </span>
      <span className={cn("mt-1 text-2xl font-bold tabular-nums", tile.isNoCity ? "text-muted-foreground" : "text-foreground")}>
        {tile.activeClients}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {tile.activeTradePoints} {tile.activeTradePoints === 1 ? "ТТ" : "ТТ"}
      </span>
    </button>
  );
}

export function MainDashboardCityCoverage({
  rows,
  act,
  tradePointCountByCity,
  testId = "section-main-city-coverage",
}: MainDashboardCityCoverageProps) {
  const { selectedCity, toggleCity } = useMainDashboardCityFilter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const allTiles = useMemo(
    () => buildMainDashboardCityTiles(rows, act, tradePointCountByCity),
    [rows, act, tradePointCountByCity],
  );
  const filteredTiles = useMemo(() => filterCityTilesBySearch(allTiles, search), [allTiles, search]);

  const searchActive = search.trim().length > 0;
  const visibleTiles = useMemo(() => {
    if (searchActive || expanded || filteredTiles.length <= DEFAULT_VISIBLE) return filteredTiles;
    return filteredTiles.slice(0, DEFAULT_VISIBLE);
  }, [filteredTiles, searchActive, expanded]);

  const showExpandControl = !searchActive && filteredTiles.length > DEFAULT_VISIBLE;

  return (
    <section className="min-w-0 space-y-3" data-testid={testId}>
      <Card className="rounded-2xl border border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">География покрытия</CardTitle>
          <CardDescription>
            Активные клиенты и торговые точки по городам. Нажмите город, чтобы отфильтровать таблицу клиентов ниже.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск города"
            className="h-9"
            data-testid="input-main-city-search"
          />
          {visibleTiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет городов по запросу.</p>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibleTiles.map((tile) => (
                <CityTile
                  key={tile.city}
                  tile={tile}
                  selected={selectedCity === tile.city}
                  onSelect={() => toggleCity(tile.city)}
                />
              ))}
            </div>
          )}
          {showExpandControl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-medium"
              data-testid={expanded ? "button-main-cities-collapse" : "button-main-cities-expand"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Свернуть" : `Показать все ${filteredTiles.length} городов`}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
