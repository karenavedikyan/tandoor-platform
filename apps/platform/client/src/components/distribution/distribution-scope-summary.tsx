import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TradePointListRow } from "@/lib/dealer-base-management-view-model";
import {
  buildDistributionScopeSummary,
  filterSummaryRows,
  type SegmentSummaryRow,
  uniqueDealersFromSummaryRows,
} from "@/lib/distribution-scope-summary-view-model";
import { fetchShowcaseMatrixScopeAll } from "@/lib/showcase-matrix-api";
import type { ShowcasePlacementSegment } from "@/lib/showcase-matrix-api";
import {
  DistributionPercentBadge,
  DistributionSourceBadge,
} from "@/lib/showcase-distribution-segment-badges";
import { cn } from "@/lib/utils";

type DistributionScopeSummaryProps = {
  tradePoints: TradePointListRow[];
  onClose: () => void;
  density?: "comfortable" | "compact";
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

const SEGMENT_SHORT: Record<ShowcasePlacementSegment, string> = {
  vh: "ВХ",
  mk: "МК",
  hardware: "Фурнитура",
};

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function SummaryTile({
  kind,
  label,
  value,
  compact,
}: {
  kind: string;
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <Card className="rounded-lg border border-border/80 shadow-xs" data-testid={`summary-tile-${kind}`}>
      <CardContent className={cn("px-3 py-2.5", compact && "px-2.5 py-2")}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function DistributionScopeSummary({
  tradePoints,
  onClose,
  density = "comfortable",
}: DistributionScopeSummaryProps) {
  const compact = density === "compact";
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [entriesByTp, setEntriesByTp] = useState<Map<string, readonly import("@/lib/showcase-matrix-api").ShowcaseMatrixEntryDto[]>>(
    new Map(),
  );
  const [selectedDealers, setSelectedDealers] = useState<Set<string>>(new Set());
  const [selectedSegments, setSelectedSegments] = useState<Set<ShowcasePlacementSegment>>(new Set());
  const [emptyOnly, setEmptyOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorText(null);
      const data = await fetchShowcaseMatrixScopeAll();
      if (cancelled) return;
      if (!data) {
        setLoading(false);
        setErrorText("Не удалось загрузить данные витрины");
        return;
      }
      const map = new Map<string, import("@/lib/showcase-matrix-api").ShowcaseMatrixEntryDto[]>();
      for (const e of data.entries) {
        const tpId = e.tradePointId?.trim();
        if (!tpId) continue;
        const arr = map.get(tpId) ?? [];
        arr.push(e);
        map.set(tpId, arr);
      }
      setEntriesByTp(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { rows, totals } = useMemo(
    () => buildDistributionScopeSummary(tradePoints, entriesByTp),
    [tradePoints, entriesByTp],
  );

  const dealerOptions = useMemo(() => uniqueDealersFromSummaryRows(rows), [rows]);

  const filterActive =
    selectedDealers.size > 0 || selectedSegments.size > 0 || emptyOnly;

  const filteredRows = useMemo(() => {
    return filterSummaryRows(rows, {
      dealerIds: selectedDealers.size > 0 ? Array.from(selectedDealers) : undefined,
      segments: selectedSegments.size > 0 ? Array.from(selectedSegments) : undefined,
      emptyOnly,
    });
  }, [rows, selectedDealers, selectedSegments, emptyOnly]);

  const openTradePoint = (row: SegmentSummaryRow) => {
    setLocation(
      `/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}`,
    );
  };

  return (
    <div className="min-w-0 space-y-4" data-testid="distribution-scope-summary">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={onClose}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Назад
        </Button>
        <h2 className="text-lg font-semibold text-foreground">Свод по ТТ скоупа</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка свода…</p>
      ) : errorText ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{errorText}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
            Повторить
          </Button>
        </div>
      ) : (
        <>
          <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", compact && "gap-1.5")}>
            <SummaryTile
              kind="in-scope"
              label="ТТ в скоупе"
              value={totals.tradePointsInScope}
              compact={compact}
            />
            <SummaryTile
              kind="with-data"
              label="С данными"
              value={totals.tradePointsWithData}
              compact={compact}
            />
            <SummaryTile kind="empty" label="Пустые" value={totals.tradePointsEmpty} compact={compact} />
            <SummaryTile
              kind="avg-percent"
              label="Средний % (ВХ+МК)"
              value={`${totals.averagePercent}%`}
              compact={compact}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фильтры</p>

            <div className="space-y-2" data-testid="summary-filter-dealer">
              <Label className="text-xs text-muted-foreground">Дилер</Label>
              <div className="flex flex-wrap gap-1.5">
                {dealerOptions.map((d) => {
                  const toggled = selectedDealers.has(d.id);
                  return (
                    <Badge
                      key={d.id}
                      variant={selectedDealers.size === 0 || toggled ? "secondary" : "outline"}
                      className={cn(
                        "cursor-pointer select-none",
                        selectedDealers.size > 0 && !toggled && "opacity-50",
                      )}
                      onClick={() => {
                        setSelectedDealers((prev) => {
                          if (prev.size === 0) {
                            const all = new Set(dealerOptions.map((x) => x.id));
                            all.delete(d.id);
                            return all;
                          }
                          const next = toggleInSet(prev, d.id);
                          if (next.size === dealerOptions.length) return new Set();
                          return next;
                        });
                      }}
                    >
                      {d.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2" data-testid="summary-filter-segment">
              <Label className="text-xs text-muted-foreground">Сегмент</Label>
              <div className="flex flex-wrap gap-1.5">
                {SEGMENTS.map((seg) => {
                  const toggled = selectedSegments.has(seg);
                  return (
                    <Badge
                      key={seg}
                      variant={selectedSegments.size === 0 || toggled ? "secondary" : "outline"}
                      className={cn(
                        "cursor-pointer select-none",
                        selectedSegments.size > 0 && !toggled && "opacity-50",
                      )}
                      onClick={() => {
                        setSelectedSegments((prev) => {
                          if (prev.size === 0) {
                            const all = new Set(SEGMENTS);
                            all.delete(seg);
                            return all;
                          }
                          const next = toggleInSet(prev, seg);
                          if (next.size === SEGMENTS.length) return new Set();
                          return next;
                        });
                      }}
                    >
                      {SEGMENT_SHORT[seg]}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div
              className="flex items-center gap-2"
              data-testid="summary-filter-empty-only"
            >
              <Switch id="summary-empty-only" checked={emptyOnly} onCheckedChange={setEmptyOnly} />
              <Label htmlFor="summary-empty-only" className="text-sm font-normal">
                Только пустые
              </Label>
            </div>

            {filterActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                data-testid="summary-reset-filters"
                onClick={() => {
                  setSelectedDealers(new Set());
                  setSelectedSegments(new Set());
                  setEmptyOnly(false);
                }}
              >
                Сбросить фильтры
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table
              className="w-full min-w-[720px] text-left text-sm"
              data-testid="distribution-scope-summary-table"
            >
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-xs">
                  <th className="px-2 py-2 font-medium">Дилер</th>
                  <th className="px-2 py-2 font-medium">ТТ</th>
                  <th className="px-2 py-2 font-medium">Сегмент</th>
                  <th className="px-2 py-2 font-medium">Блоков</th>
                  <th className="px-2 py-2 font-medium">Ёмкость</th>
                  <th className="px-2 py-2 font-medium">Наши</th>
                  <th className="px-2 py-2 font-medium">%</th>
                  <th className="px-2 py-2 font-medium">Источник</th>
                  <th className="px-2 py-2 font-medium">Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-4 text-center text-sm text-muted-foreground">
                      Нет строк по выбранным фильтрам
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={`${row.tradePointId}-${row.segment}`}
                      data-testid={`summary-row-${row.tradePointId}-${row.segment}`}
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/20"
                      onClick={() => openTradePoint(row)}
                    >
                      <td className="px-2 py-2">{row.dealerName}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{row.tradePointName}</div>
                        <div className="text-xs text-muted-foreground">{row.city}</div>
                      </td>
                      <td className="px-2 py-2">{SEGMENT_SHORT[row.segment]}</td>
                      <td className="px-2 py-2 tabular-nums">{row.blockCount}</td>
                      <td className="px-2 py-2 tabular-nums">{row.totalCapacity}</td>
                      <td className="px-2 py-2 tabular-nums">{row.totalOurs}</td>
                      <td className="px-2 py-2">
                        {row.source === "blocks" ? (
                          <DistributionPercentBadge percent={row.distributionPercent} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <DistributionSourceBadge source={row.source} />
                      </td>
                      <td className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
                        {formatUpdatedAt(row.lastUpdatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
