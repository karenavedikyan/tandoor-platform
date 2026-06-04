import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LayoutGrid, List, Search, Square } from "lucide-react";
import { DistributionEntryTradePointCard } from "@/components/distribution/distribution-entry-tradepoint-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  readDistributionEntryTradePointView,
  writeDistributionEntryTradePointView,
  type DistributionEntryTradePointView,
} from "@/lib/distribution-entry-tradepoint-view";
import {
  DistributionTradePointMatrixEntry,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import { DEALER_BASE_ROWS, type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import {
  buildDistributionEntryTradePointRows,
  findDealerTradePointForEntryRow,
  type DistributionEntryTradePointRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionEntryTradePointPanelProps = {
  profile: ReleaseDemoProfile;
  /** Отфильтрованные дилеры из мастера «Ввод»; если не переданы — считаются внутри панели. */
  dealers?: readonly DealerRow[];
};

export function DistributionEntryTradePointPanel({ profile, dealers: dealersProp }: DistributionEntryTradePointPanelProps) {
  const { user } = useCurrentUser();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const [query, setQuery] = useState("");
  const [selectedTradePointId, setSelectedTradePointId] = useState<string | null>(null);
  const [cacheBump, setCacheBump] = useState(0);
  const isMobile = useIsMobile();
  const [tradePointView, setTradePointView] = useState<DistributionEntryTradePointView>(() =>
    readDistributionEntryTradePointView(isMobile),
  );

  useEffect(() => {
    writeDistributionEntryTradePointView(tradePointView);
  }, [tradePointView]);

  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
            includeArchivedDealers: false,
          })
        : DEALER_BASE_ROWS,
    [actx.enabled, managementPlane.mergedState, profile],
  );

  const scopedDealersInternal = useMemo(
    () => roleScopedDealerRows(workingDealerRows, profile),
    [workingDealerRows, profile],
  );

  const scopedDealers = dealersProp ?? scopedDealersInternal;

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const rows = useMemo(() => {
    void cacheBump;
    return buildDistributionEntryTradePointRows({ dealers: scopedDealers, query });
  }, [scopedDealers, query, cacheBump]);

  const rowRefs = useMemo(() => {
    const map = new Map<string, { dealer: DealerRow; point: DealerTradePoint }>();
    for (const row of rows) {
      const ref = findDealerTradePointForEntryRow(scopedDealers, row);
      if (ref) map.set(row.tradePointId, ref);
    }
    return map;
  }, [rows, scopedDealers]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.tradePointId === selectedTradePointId) ?? null,
    [rows, selectedTradePointId],
  );

  const selectedRef = useMemo(
    () => (selectedRow ? findDealerTradePointForEntryRow(scopedDealers, selectedRow) : null),
    [scopedDealers, selectedRow],
  );

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const handleSelectRow = useCallback((row: DistributionEntryTradePointRow) => {
    setSelectedTradePointId(row.tradePointId);
  }, []);

  const feedLayoutClass =
    tradePointView === "large"
      ? "mx-auto flex w-full max-w-4xl flex-col gap-3"
      : tradePointView === "grid"
        ? "grid grid-cols-2 gap-2 lg:grid-cols-1"
        : "flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm";

  const listColumn = (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по точке, клиенту, городу"
            className="min-h-10 pl-9"
            data-testid="input-distribution-entry-tradepoint-search"
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5 self-start rounded-lg border border-border bg-card p-0.5"
          role="radiogroup"
          aria-label="Вид списка торговых точек"
          data-testid="distribution-entry-tradepoint-view-toggle"
        >
          {(
            [
              { id: "large" as const, label: "Крупные", icon: Square },
              { id: "grid" as const, label: "Сетка", icon: LayoutGrid },
              { id: "list" as const, label: "Список", icon: List },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = tradePointView === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0 rounded-md border",
                  active
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label={opt.label}
                aria-pressed={active}
                onClick={() => setTradePointView(opt.id)}
                data-testid={`distribution-entry-tradepoint-view-${opt.id}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </Button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В вашей зоне видимости нет торговых точек для ввода.</p>
      ) : (
        <div
          className={cn("max-h-[min(70vh,720px)] overflow-y-auto pr-0.5", feedLayoutClass)}
          data-testid="list-distribution-entry-tradepoints"
        >
          {rows.map((row) => {
            const ref = rowRefs.get(row.tradePointId);
            if (!ref) return null;
            return (
              <DistributionEntryTradePointCard
                key={row.tradePointId}
                row={row}
                dealer={ref.dealer}
                point={ref.point}
                profile={profile}
                view={tradePointView}
                selected={row.tradePointId === selectedTradePointId}
                onSelect={() => handleSelectRow(row)}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  const entryColumn = selectedRow && selectedRef ? (
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
        <p className="text-sm text-muted-foreground">Выберите торговую точку в списке, чтобы внести факт по матрице.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-entry-tradepoint-panel">
      <div className="hidden min-h-[min(70vh,780px)] gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-3 sm:p-4">{listColumn}</CardContent>
        </Card>
        <div className="min-w-0">{entryColumn}</div>
      </div>

      <div className="space-y-4 lg:hidden">
        {selectedTradePointId && selectedRow ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10"
              onClick={() => setSelectedTradePointId(null)}
              data-testid="button-distribution-entry-back-to-list"
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Назад к списку
            </Button>
            {entryColumn}
          </>
        ) : (
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-3 sm:p-4">{listColumn}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
