import { useEffect, useMemo, useRef, type ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import {
  dealerBaseVirtualItemStyle,
  useDealerBaseListScrollMargin,
  useDealerBaseWindowVirtualizer,
  useDealerCompactGridColumnCount,
  useDealerLargeGridColumnCount,
} from "@/lib/dealer-base-list-window-virtualizer";
import { Card } from "@/components/ui/card";
import { OneCStoreCard } from "./one-c-store-card";
import { getOneCCardsListLayout } from "./one-c-cards-list-layout";
import type { OneCCardDensity } from "./use-one-c-list-density";

type OneCStoresCardsListProps = {
  items: OneCStoreListItem[];
  density: OneCCardDensity;
  loading?: boolean;
  emptyLabel?: string;
  testIdPrefix?: string;
  act: ActualizationState;
};

export function OneCStoresCardsList({
  items,
  density,
  loading = false,
  emptyLabel = "Ничего не найдено",
  testIdPrefix = "one-c-stores",
  act,
}: OneCStoresCardsListProps): ReactElement {
  useEffect(() => {
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  const compactColumns = useDealerCompactGridColumnCount();
  const largeColumns = useDealerLargeGridColumnCount();
  const layout = useMemo(
    () => getOneCCardsListLayout(density, compactColumns, largeColumns),
    [density, compactColumns, largeColumns],
  );
  const virtualRowCount = Math.ceil(items.length / layout.columns);
  const scrollMargin = useDealerBaseListScrollMargin(listRef, [items.length, layout.columns, density]);
  const virtualizer = useDealerBaseWindowVirtualizer({
    count: virtualRowCount,
    estimateSize: layout.estimateSize,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  if (items.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </Card>
    );
  }

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
      data-testid={`${testIdPrefix}-cards-virtual`}
      data-density={density}
    >
      {virtualItems.map((vi) => {
        const startIdx = vi.index * layout.columns;
        const slice = items.slice(startIdx, startIdx + layout.columns);
        return (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className={layout.rowGapClassName}
            style={dealerBaseVirtualItemStyle(virtualizer, vi.start)}
          >
            <div className={layout.gridClassName}>
              {slice.map((row) => (
                <OneCStoreCard key={row.id_1c} row={row} density={density} act={act} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** @deprecated Use OneCStoresCardsList */
export const OneCStoresCards = OneCStoresCardsList;
