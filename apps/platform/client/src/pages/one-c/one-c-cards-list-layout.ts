import type { OneCCardDensity } from "./use-one-c-list-density";
import { DEALER_BASE_VIRTUAL_ESTIMATE } from "@/lib/dealer-base-list-window-virtualizer";

export type OneCCardsListLayout = {
  columns: number;
  estimateSize: number;
  gridClassName: string;
  rowGapClassName: string;
};

export function getOneCCardsListLayout(
  density: OneCCardDensity,
  compactColumns: number,
  largeColumns: number,
): OneCCardsListLayout {
  if (density === "list") {
    return {
      columns: 1,
      estimateSize: DEALER_BASE_VIRTUAL_ESTIMATE.listRow,
      gridClassName: "flex min-w-0 flex-col gap-1.5",
      rowGapClassName: "pb-1.5",
    };
  }
  if (density === "large") {
    return {
      columns: largeColumns,
      estimateSize: DEALER_BASE_VIRTUAL_ESTIMATE.largeRow,
      gridClassName: "grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3",
      rowGapClassName: "pb-3",
    };
  }
  return {
    columns: compactColumns,
    estimateSize: DEALER_BASE_VIRTUAL_ESTIMATE.gridRow,
    gridClassName: "grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    rowGapClassName: "pb-2",
  };
}
