import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { buildEntryCityRows } from "@/lib/distribution-entry-city-view-model";
import {
  buildDistributionEntryTradePointRows,
  findDealerTradePointForEntryRow,
  type DistributionEntryTradePointRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import {
  DistributionTradePointMatrixEntry,
  coverageBadgeClass,
  freshnessLabel,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useEffect } from "react";
import {
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE,
  distributionEntryVirtualItemStyle,
  useDistributionEntryVirtualizer,
} from "@/lib/distribution-entry-element-virtualizer";

import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionEntryCityPanelProps = {
  profile: ReleaseDemoProfile;
  dealers: readonly DealerRow[];
};

function filterRowsByCity(rows: DistributionEntryTradePointRow[], city: string): DistributionEntryTradePointRow[] {
  const c = city.trim().toLowerCase();
  return rows.filter((r) => (r.city ?? "").trim().toLowerCase() === c);
}

export function DistributionEntryCityPanel({ profile, dealers }: DistributionEntryCityPanelProps) {
  const { user } = useCurrentUser();
  const [cityQuery, setCityQuery] = useState("");
  const [tpQuery, setTpQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedTradePointId, setSelectedTradePointId] = useState<string | null>(null);
  const [cacheBump, setCacheBump] = useState(0);

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const cityRows = useMemo(() => buildEntryCityRows(dealers, cityQuery), [dealers, cityQuery]);

  const tpRows = useMemo(() => {
    void cacheBump;
    if (!selectedCity) return [];
    const all = buildDistributionEntryTradePointRows({ dealers, query: tpQuery });
    return filterRowsByCity(all, selectedCity);
  }, [dealers, selectedCity, tpQuery, cacheBump]);

  const selectedRow = useMemo(
    () => tpRows.find((r) => r.tradePointId === selectedTradePointId) ?? null,
    [tpRows, selectedTradePointId],
  );

  const selectedRef = useMemo(
    () => (selectedRow ? findDealerTradePointForEntryRow(dealers, selectedRow) : null),
    [dealers, selectedRow],
  );

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const cityScrollRef = useRef<HTMLDivElement>(null);
  const cityVirtualizer = useDistributionEntryVirtualizer({
    count: cityRows.length,
    estimateSize: DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.simpleRow,
    scrollRef: cityScrollRef,
  });

  const tpScrollRef = useRef<HTMLDivElement>(null);
  const tpVirtualizer = useDistributionEntryVirtualizer({
    count: tpRows.length,
    estimateSize: DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE.simpleRow,
    scrollRef: tpScrollRef,
  });

  const handleSelectCity = useCallback((city: string) => {
    setSelectedCity(city);
    setSelectedTradePointId(null);
  }, []);

  const cityList = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          placeholder="Поиск города"
          className="min-h-10 pl-9"
          data-testid="input-distribution-entry-city-search"
        />
      </div>
      {cityRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Города не найдены.</p>
      ) : (
        <div
          ref={cityScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto"
          data-testid="list-distribution-entry-cities"
        >
          <ul className="relative m-0 list-none p-0" style={{ height: cityVirtualizer.getTotalSize() }}>
            {cityVirtualizer.getVirtualItems().map((vi) => {
              const row = cityRows[vi.index];
              if (!row) return null;
              return (
                <li
                  key={vi.key}
                  data-index={vi.index}
                  ref={cityVirtualizer.measureElement}
                  className="mb-2 list-none"
                  style={distributionEntryVirtualItemStyle(cityVirtualizer, vi.start)}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCity(row.city)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
                      selectedCity === row.city
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                    data-testid={`distribution-entry-city-row-${row.city}`}
                  >
                    <span className="text-sm font-semibold text-foreground">{row.city}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {row.tradePointCount} ТТ
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  const tpList = selectedCity ? (
    <div className="flex min-h-0 flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{selectedCity}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={tpQuery}
          onChange={(e) => setTpQuery(e.target.value)}
          placeholder="Поиск по точке или клиенту"
          className="min-h-10 pl-9"
          data-testid="input-distribution-entry-city-tp-search"
        />
      </div>
      {tpRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Торговые точки не найдены.</p>
      ) : (
        <div
          ref={tpScrollRef}
          className="max-h-[min(60vh,560px)] overflow-y-auto"
          data-testid="list-distribution-entry-city-tradepoints"
        >
          <ul className="relative m-0 list-none p-0" style={{ height: tpVirtualizer.getTotalSize() }}>
            {tpVirtualizer.getVirtualItems().map((vi) => {
              const row = tpRows[vi.index];
              if (!row) return null;
              const selected = row.tradePointId === selectedTradePointId;
              const noMatrix = row.templateModelsCount === 0;
              return (
                <li
                  key={vi.key}
                  data-index={vi.index}
                  ref={tpVirtualizer.measureElement}
                  className="mb-2 list-none"
                  style={distributionEntryVirtualItemStyle(tpVirtualizer, vi.start)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTradePointId(row.tradePointId)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      selected ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:bg-muted/40",
                    )}
                    data-testid={`distribution-entry-city-tp-${row.tradePointId}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.tradePointName}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {noMatrix ? (
                          <Badge variant="outline" className="text-[10px]">
                            нет матрицы
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] tabular-nums", coverageBadgeClass(row.coveragePct))}
                          >
                            {row.filledCount}/{row.templateModelsCount} · {row.coveragePct}%
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{freshnessLabel(row.lastUpdatedAt)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

      )}
    </div>
  ) : null;

  const showcase =
    selectedRef && selectedRow ? (
      <DistributionTradePointMatrixEntry
        dealer={selectedRef.dealer}
        point={selectedRef.point}
        profile={profile}
        actorUserId={actorUserId}
        actorName={actorName}
      />
    ) : (
      <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-none">
        <CardContent className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Выберите торговую точку в списке.</p>
        </CardContent>
      </Card>
    );

  const showTpColumn = selectedCity != null;
  const showShowcase = selectedTradePointId != null;

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-entry-city-panel">
      {showTpColumn ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-0 text-muted-foreground lg:hidden"
          onClick={() => {
            if (showShowcase) setSelectedTradePointId(null);
            else {
              setSelectedCity(null);
              setSelectedTradePointId(null);
            }
          }}
          data-testid="distribution-entry-city-step-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          {showShowcase ? "Назад к списку ТТ" : "Назад к городам"}
        </Button>
      ) : null}

      {!showTpColumn ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-3 sm:p-4">{cityList}</CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden min-h-[min(70vh,780px)] gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardContent className="p-3 sm:p-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-3 min-h-9 px-0 text-muted-foreground"
                  onClick={() => {
                    setSelectedCity(null);
                    setSelectedTradePointId(null);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                  Города
                </Button>
                {tpList}
              </CardContent>
            </Card>
            <div className="min-w-0">{showcase}</div>
          </div>

          <div className="lg:hidden">
            {showShowcase ? showcase : (
              <Card className="rounded-xl border border-border bg-card shadow-xs">
                <CardContent className="p-3 sm:p-4">{tpList}</CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
