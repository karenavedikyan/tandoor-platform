import { useMemo, useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getShowcaseTasksForDealerDisplay, loadShowcaseStorage } from "@/lib/showcase-distribution-data";

type Props = {
  row: DealerRow;
  /** Для навигации по карточке дилера (IntersectionObserver). */
  sectionDomId?: string;
};

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function tradePointContact(tp: DealerTradePoint, dealer: DealerRow): string {
  const phone = (tp as DealerTradePoint & { contactPhone?: string }).contactPhone;
  if (isFilled(phone)) return phone!.trim();
  if (dealer.tradePoints.length === 1 && isFilled(dealer.contacts.phone)) return dealer.contacts.phone.trim();
  return "";
}

function openShowcaseTasksCount(dealer: DealerRow): number | undefined {
  if (dealer.tradePoints.length !== 1) return undefined;
  const storage = loadShowcaseStorage();
  const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
  return tasks.filter((t) => t.status !== "done").length;
}

export function DealerTradePointsSection({ row, sectionDomId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showcaseOpen = useMemo(() => openShowcaseTasksCount(row), [row]);

  const points = row.tradePoints;
  if (points.length === 0) {
    return (
      <section
        id={sectionDomId}
        data-testid="section-dealer-trade-points"
        className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
      >
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
        <p className="text-sm text-muted-foreground">Торговые точки не указаны.</p>
      </section>
    );
  }

  const limit = expanded ? points.length : Math.min(3, points.length);
  const slice = points.slice(0, limit);

  return (
    <section
      id={sectionDomId}
      data-testid="section-dealer-trade-points"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
      <div className="space-y-2">
        {slice.map((tp) => {
          const contact = tradePointContact(tp, row);
          const showBadge = isFilled(tp.showcaseStatus);
          return (
            <Card
              key={tp.id}
              data-testid={`row-dealer-trade-point-${tp.id}`}
              className="rounded-xl border border-border/70 bg-card shadow-xs"
            >
              <CardContent className="space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{tp.name}</p>
                    <p className="text-xs text-muted-foreground">{tp.city}</p>
                    <p
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
                      data-testid={`text-dealer-trade-point-address-${tp.id}`}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{tp.address}</span>
                    </p>
                    {contact ? (
                      <p className="text-xs text-muted-foreground" data-testid={`text-dealer-trade-point-contact-${tp.id}`}>
                        {contact}
                      </p>
                    ) : (
                      <span className="sr-only" data-testid={`text-dealer-trade-point-contact-${tp.id}`}>
                        —
                      </span>
                    )}
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                    {showBadge ? (
                      <Badge
                        variant="outline"
                        className={cn("w-full justify-center text-[10px] font-semibold sm:w-auto")}
                        data-testid={`badge-dealer-trade-point-showcase-status-${tp.id}`}
                      >
                        Витрина: {tp.showcaseStatus}
                      </Badge>
                    ) : null}
                    {showcaseOpen != null && showcaseOpen > 0 ? (
                      <p className="text-center text-[11px] text-muted-foreground sm:text-right">
                        Открытых задач по витрине: <span className="font-semibold tabular-nums text-foreground">{showcaseOpen}</span>
                      </p>
                    ) : null}
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="min-h-10 w-full font-semibold sm:w-auto"
                      data-testid={`button-dealer-trade-point-open-${tp.id}`}
                    >
                      <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>Открыть точку</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {points.length > 3 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!expanded ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-show-all"
              onClick={() => setExpanded(true)}
            >
              Показать все точки
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-collapse"
              onClick={() => setExpanded(false)}
            >
              Свернуть
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
