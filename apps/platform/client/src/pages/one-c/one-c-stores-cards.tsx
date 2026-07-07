import { useEffect, useRef, type ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import {
  DEALER_BASE_VIRTUAL_ESTIMATE,
  dealerBaseVirtualItemStyle,
  useDealerBaseListScrollMargin,
  useDealerBaseWindowVirtualizer,
  useDealerCompactGridColumnCount,
} from "@/lib/dealer-base-list-window-virtualizer";
import { Card } from "@/components/ui/card";
import { OneCStoreCard } from "./one-c-store-card";

type OneCStoresCardsProps = {
  items: OneCStoreListItem[];
  loading?: boolean;
  emptyLabel?: string;
  testIdPrefix?: string;
  act: ActualizationState;
};

export function OneCStoresCards({
  items,
  loading = false,
  emptyLabel = "Ничего не найдено",
  testIdPrefix = "one-c-stores",
  act,
}: OneCStoresCardsProps): ReactElement {
  useEffect(() => {
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  const columns = useDealerCompactGridColumnCount();
  const virtualRowCount = Math.ceil(items.length / columns);
  const scrollMargin = useDealerBaseListScrollMargin(listRef, [items.length, columns]);
  const virtualizer = useDealerBaseWindowVirtualizer({
    count: virtualRowCount,
    estimateSize: DEALER_BASE_VIRTUAL_ESTIMATE.gridRow,
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
    >
      {virtualItems.map((vi) => {
        const startIdx = vi.index * columns;
        const slice = items.slice(startIdx, startIdx + columns);
        return (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className="pb-2"
            style={dealerBaseVirtualItemStyle(virtualizer, vi.start)}
          >
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slice.map((row) => (
                <OneCStoreCard key={row.id_1c} row={row} act={act} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
