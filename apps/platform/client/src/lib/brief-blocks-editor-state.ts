import type { MarketingBriefBlockRow } from "./marketing-briefs-api.js";

/** Слияние ответа listBlocks с локальным стейтом без потери несохранённого payload. */
export function mergeBlocksFromServer(
  server: MarketingBriefBlockRow[],
  prev: MarketingBriefBlockRow[],
  dirtyIds: ReadonlySet<string>,
): MarketingBriefBlockRow[] {
  const prevById = new Map(prev.map((b) => [b.id, b]));
  return server.map((serverBlock) => {
    if (dirtyIds.has(serverBlock.id) && prevById.has(serverBlock.id)) {
      const local = prevById.get(serverBlock.id)!;
      return {
        ...serverBlock,
        payload: local.payload,
        order_index: local.order_index,
      };
    }
    return serverBlock;
  });
}
