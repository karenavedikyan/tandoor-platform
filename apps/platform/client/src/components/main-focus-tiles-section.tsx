import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  MAIN_FOCUS_TILES,
  computeMainFocusTileCounts,
  type MainFocusTileId,
} from "@/lib/main-focus-tiles";
import { cn } from "@/lib/utils";

export type MainFocusTilesSectionProps = {
  title: string;
  rows: DealerRow[];
  act: ActualizationState;
  selectedSegment?: MainFocusTileId | null;
  onTileClick?: (segment: MainFocusTileId) => void;
  testId?: string;
};

export function MainFocusTilesSection({
  title,
  rows,
  act,
  selectedSegment = null,
  onTileClick,
  testId = "section-main-focus-tiles",
}: MainFocusTilesSectionProps) {
  const counts = useMemo(() => computeMainFocusTileCounts(rows, act), [rows, act]);
  const interactive = Boolean(onTileClick);

  return (
    <section className="min-w-0 space-y-2" data-testid={testId}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
        {MAIN_FOCUS_TILES.map((tile) => {
          const active = selectedSegment === tile.id;
          const inner = (
            <Card
              className={cn(
                "min-w-0 rounded-2xl border border-border bg-card transition-colors",
                interactive && "cursor-pointer hover:bg-card/80",
                active && "ring-2 ring-primary bg-primary/10",
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
          );

          if (!interactive) {
            return (
              <div key={tile.id} data-testid={`focus-tile-${tile.id}`} className="min-w-0">
                {inner}
              </div>
            );
          }

          return (
            <button
              key={tile.id}
              type="button"
              data-testid={`focus-tile-${tile.id}`}
              aria-pressed={active}
              className="block min-w-0 rounded-2xl text-left outline-none ring-offset-background transition hover:opacity-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onTileClick?.(tile.id)}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
