import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  MAIN_FOCUS_TILES,
  buildMainFocusTileHref,
  computeMainFocusTileCounts,
  type MainFocusTileHrefParams,
} from "@/lib/main-focus-tiles";
import { cn } from "@/lib/utils";

export type MainFocusTilesSectionProps = {
  title: string;
  rows: DealerRow[];
  act: ActualizationState;
  dealerBaseParams?: MainFocusTileHrefParams;
  testId?: string;
};

export function MainFocusTilesSection({
  title,
  rows,
  act,
  dealerBaseParams = {},
  testId = "section-main-focus-tiles",
}: MainFocusTilesSectionProps) {
  const counts = useMemo(() => computeMainFocusTileCounts(rows, act), [rows, act]);

  return (
    <section className="min-w-0 space-y-2" data-testid={testId}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
        {MAIN_FOCUS_TILES.map((tile) => {
          const href = buildMainFocusTileHref(tile.id, dealerBaseParams);
          return (
            <a
              key={tile.id}
              href={href}
              data-testid={`focus-tile-${tile.id}`}
              className="block min-w-0 rounded-2xl no-underline outline-none ring-offset-background transition hover:opacity-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={cn(
                  "min-w-0 cursor-pointer rounded-2xl border border-border bg-card transition-colors hover:bg-card/80",
                )}
              >
                <CardContent className="p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="text-base leading-none" aria-hidden>
                      {tile.icon}
                    </span>
                    <span className="min-w-0 truncate">{tile.title}</span>
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{counts[tile.id]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tile.subtitle}</p>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
