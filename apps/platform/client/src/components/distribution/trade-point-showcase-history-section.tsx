import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShowcaseMatrixEventDto, ShowcasePlacementSegment } from "@/lib/showcase-matrix-api";
import { fetchShowcaseMatrixHistory } from "@/lib/showcase-matrix-api";
import { PLACEMENT_SEGMENT_LABEL_RU } from "@/lib/showcase-placement-labels";
import {
  defaultHistoryFilter,
  filterHistoryEvents,
  formatHistoryTime,
  groupEventsByDay,
  type HistoryEventAction,
  type HistoryFilter,
  uniqueUsersFromEvents,
} from "@/lib/trade-point-showcase-history-view-model";
import { cn } from "@/lib/utils";

type TradePointShowcaseHistorySectionProps = {
  tradePointId: string;
  density?: "comfortable" | "compact";
};

const MAX_HISTORY_LIMIT = 500;
const PAGE_SIZE = 50;

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

const ACTION_OPTIONS: { value: HistoryFilter["action"]; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "status_change", label: "Изменение статуса" },
  { value: "placement_update", label: "Размещение" },
  { value: "comment_only", label: "Комментарий" },
];

const PERIOD_OPTIONS: { value: HistoryFilter["period"]; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "last7", label: "Последние 7 дней" },
  { value: "last30", label: "Последние 30 дней" },
];

export function TradePointShowcaseHistorySection({
  tradePointId,
  density = "comfortable",
}: TradePointShowcaseHistorySectionProps) {
  const compact = density === "compact";
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<ShowcaseMatrixEventDto[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>(defaultHistoryFilter);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    const data = await fetchShowcaseMatrixHistory({ tradePointId, limit });
    setLoading(false);
    if (data === null) {
      setErrorText("Не удалось загрузить историю");
      return;
    }
    setEvents(data);
    setHasLoadedOnce(true);
  }, [tradePointId, limit]);

  useEffect(() => {
    if (!isOpen) return;
    void loadHistory();
  }, [isOpen, loadHistory]);

  const users = useMemo(() => uniqueUsersFromEvents(events), [events]);

  const filteredEvents = useMemo(
    () => filterHistoryEvents(events, filter),
    [events, filter],
  );

  const groups = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents]);

  const canShowMore = hasLoadedOnce && !loading && events.length >= limit && limit < MAX_HISTORY_LIMIT;
  const headerCount = hasLoadedOnce ? events.length : null;

  return (
    <section
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
      data-testid="trade-point-showcase-history-section"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className={cn("p-0", compact && "text-sm")}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto min-h-10 w-full justify-between rounded-xl px-3 py-2.5 text-left font-normal",
                  compact && "px-2.5 py-2",
                )}
                data-testid="button-toggle-showcase-history"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  История изменений витрины
                  {headerCount != null ? (
                    <span className="text-muted-foreground">({headerCount})</span>
                  ) : null}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div
                className={cn(
                  "space-y-4 border-t border-border/60 px-3 pb-3 pt-3",
                  compact && "space-y-3 px-2.5 pb-2.5 pt-2",
                )}
              >
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Фильтры
                  </p>
                  <div
                    className={cn(
                      "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
                      compact && "gap-2",
                    )}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Сегмент</Label>
                      <Select
                        value={filter.segment}
                        onValueChange={(segment) =>
                          setFilter((prev) => ({
                            ...prev,
                            segment: segment as HistoryFilter["segment"],
                          }))
                        }
                      >
                        <SelectTrigger data-testid="select-history-segment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все</SelectItem>
                          {SEGMENTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PLACEMENT_SEGMENT_LABEL_RU[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Действие</Label>
                      <Select
                        value={filter.action}
                        onValueChange={(action) =>
                          setFilter((prev) => ({
                            ...prev,
                            action: action as HistoryFilter["action"],
                          }))
                        }
                      >
                        <SelectTrigger data-testid="select-history-action">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Пользователь</Label>
                      <Select
                        value={filter.userId}
                        onValueChange={(userId) =>
                          setFilter((prev) => ({ ...prev, userId }))
                        }
                      >
                        <SelectTrigger data-testid="select-history-user">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Период</Label>
                      <Select
                        value={filter.period}
                        onValueChange={(period) =>
                          setFilter((prev) => ({
                            ...prev,
                            period: period as HistoryFilter["period"],
                          }))
                        }
                      >
                        <SelectTrigger data-testid="select-history-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIOD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setFilter(defaultHistoryFilter())}
                    data-testid="button-history-reset-filters"
                  >
                    Сбросить
                  </Button>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Загрузка истории…</p>
                ) : errorText ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">{errorText}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadHistory()}>
                      Повторить
                    </Button>
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Изменений по этой витрине пока нет</p>
                ) : filteredEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Нет событий по выбранным фильтрам
                  </p>
                ) : (
                  <div className="space-y-4">
                    {groups.map((group) => (
                      <div key={group.dayIso} data-testid={`history-day-${group.dayIso}`}>
                        <h4 className="text-sm font-semibold text-foreground">{group.dayLabel}</h4>
                        <ul className="mt-1 space-y-2">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              data-testid={`history-event-${item.id}`}
                              className="rounded-md border border-border bg-card p-2"
                            >
                              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatHistoryTime(item.changedAt)}
                                </span>
                                <span>{item.changedByName}</span>
                                {item.segmentLabel ? (
                                  <Badge variant="outline" className="text-xs">
                                    {item.segmentLabel}
                                  </Badge>
                                ) : null}
                                {item.placementTypeLabel ? (
                                  <span>· {item.placementTypeLabel}</span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-sm font-medium text-foreground">
                                {item.targetLabel}
                              </div>
                              {item.action === "status_change" ? (
                                <div className="mt-0.5 text-xs">
                                  <span className="text-muted-foreground">
                                    {item.oldStatusLabel ?? "—"}
                                  </span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium">{item.newStatusLabel ?? "—"}</span>
                                </div>
                              ) : null}
                              {item.action === "placement_update" && item.capacityChangeLabel ? (
                                <div className="mt-0.5 text-xs text-muted-foreground">{item.capacityChangeLabel}</div>
                              ) : null}
                              {item.action === "placement_update" && !item.capacityChangeLabel && item.newStatusLabel ? (
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Статус: {item.newStatusLabel}
                                </div>
                              ) : null}
                              {item.comment ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium">Комментарий: </span>«{item.comment}»
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {canShowMore ? (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_HISTORY_LIMIT))}
                      data-testid="button-history-show-more"
                    >
                      Показать ещё ({PAGE_SIZE})
                    </Button>
                  </div>
                ) : null}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
    </section>
  );
}
