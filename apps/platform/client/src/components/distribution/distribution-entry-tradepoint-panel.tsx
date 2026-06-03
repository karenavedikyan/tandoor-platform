import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  TradePointShowcaseMatrixSection,
  type TradePointShowcasePageBundle,
} from "@/components/trade-point-showcase-matrix-section";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import {
  buildDistributionEntryTradePointRows,
  findDealerTradePointForEntryRow,
  type DistributionEntryTradePointRow,
} from "@/lib/distribution-entry-tradepoint-view-model";
import { formatRelativeTime } from "@/lib/format-datetime";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import type { TradePointMatrixSummary } from "@/lib/trade-point-matrix-data";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

const EMPTY_MATRIX_SUMMARY: TradePointMatrixSummary = {
  totalRequired: 0,
  totalPresent: 0,
  totalMissing: 0,
  totalUnderReview: 0,
  zoneA: 0,
  zoneB: 0,
  zoneC: 0,
  entrancePresent: 0,
  entranceRequired: 0,
  interiorPresent: 0,
  interiorRequired: 0,
};

function buildDistributionEntryShowcasePageBundle(
  point: { id: string; distribution: { mk: number; vh: number; total: number } },
): TradePointShowcasePageBundle {
  const noop = () => undefined;
  return {
    matrixSummary: EMPTY_MATRIX_SUMMARY,
    showcaseComment: "—",
    distribution: point.distribution,
    distributionConclusion: "—",
    productMatrixFiltered: [],
    productMatrixFilter: "all",
    onProductMatrixFilterChange: noop,
    recommendationByProductId: new Map(),
    showcaseTasksOpen: [],
    openTasksCount: 0,
    recommendations: [],
    createdTaskByProductId: new Map(),
    onCreateMatrixTask: noop,
    onScrollToMatrixTask: noop,
    tasksLinkHref: `/trade-points/${point.id}`,
    matrixTasksSlot: null,
  };
}

function freshnessLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) return "нет данных";
  return `обновлено ${formatRelativeTime(lastUpdatedAt)}`;
}

function coverageBadgeClass(pct: number): string {
  if (pct >= 100) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (pct >= 50) return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
}

type DistributionEntryTradePointPanelProps = {
  profile: ReleaseDemoProfile;
};

export function DistributionEntryTradePointPanel({ profile }: DistributionEntryTradePointPanelProps) {
  const { user } = useCurrentUser();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const [query, setQuery] = useState("");
  const [selectedTradePointId, setSelectedTradePointId] = useState<string | null>(null);
  const [cacheBump, setCacheBump] = useState(0);

  const workingDealerRows = useMemo(
    () =>
      actx.enabled
        ? buildDealerBaseRowsWithActualization(managementPlane.mergedState, profile, {
            includeArchivedDealers: false,
          })
        : DEALER_BASE_ROWS,
    [actx.enabled, managementPlane.mergedState, profile],
  );

  const scopedDealers = useMemo(
    () => roleScopedDealerRows(workingDealerRows, profile),
    [workingDealerRows, profile],
  );

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const rows = useMemo(() => {
    void cacheBump;
    return buildDistributionEntryTradePointRows({ dealers: scopedDealers, query });
  }, [scopedDealers, query, cacheBump]);

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

  const showcasePage = useMemo(
    () => (selectedRef ? buildDistributionEntryShowcasePageBundle(selectedRef.point) : null),
    [selectedRef],
  );

  const handleSelectRow = useCallback((row: DistributionEntryTradePointRow) => {
    setSelectedTradePointId(row.tradePointId);
  }, []);

  const listColumn = (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по точке, клиенту, городу"
          className="pl-9"
          data-testid="input-distribution-entry-tradepoint-search"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">В вашей зоне видимости нет торговых точек для ввода.</p>
      ) : (
        <ul className="flex max-h-[min(70vh,720px)] flex-col gap-2 overflow-y-auto pr-0.5" data-testid="list-distribution-entry-tradepoints">
          {rows.map((row) => {
            const selected = row.tradePointId === selectedTradePointId;
            const noMatrix = row.templateModelsCount === 0;
            return (
              <li key={row.tradePointId}>
                <button
                  type="button"
                  onClick={() => handleSelectRow(row)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                  data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-foreground">{row.tradePointName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
                      {row.city ? (
                        <p className="truncate text-xs text-muted-foreground">{row.city}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {noMatrix ? (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          нет матрицы
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={cn("text-[10px] font-medium tabular-nums", coverageBadgeClass(row.coveragePct))}>
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
      )}
    </div>
  );

  const entryColumn = selectedRow && selectedRef && showcasePage ? (
    selectedRow.templateModelsCount === 0 ? (
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Активная матрица не назначена</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Для этой торговой точки нет чек-листа моделей. Выберите другую точку или назначьте матрицу в
            справочнике.
          </p>
        </CardContent>
      </Card>
    ) : (
      <TradePointShowcaseMatrixSection
        dealer={selectedRef.dealer}
        point={selectedRef.point}
        profile={profile}
        actorUserId={actorUserId}
        actorName={actorName}
        page={showcasePage}
      />
    )
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
