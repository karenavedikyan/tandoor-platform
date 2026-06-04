/**
 * Batch-загрузка истории матрицы по скоупу дистрибуции.
 */

import { fetchShowcaseMatrixHistory, type ShowcaseMatrixEventDto } from "@/lib/showcase-matrix-api";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

const DEFAULT_LIMIT_PER_DEALER = 2000;
const CHUNK_SIZE = 10;
const CHUNK_THRESHOLD = 25;

async function fetchDealerHistory(
  dealerId: string,
  limit: number,
): Promise<ShowcaseMatrixEventDto[]> {
  try {
    const events = await fetchShowcaseMatrixHistory({ dealerId, limit });
    return events ?? [];
  } catch {
    return [];
  }
}

export async function loadScopeMatrixEvents(
  refs: readonly ScopeTradePointRef[],
  opts?: { limitPerDealer?: number },
): Promise<ShowcaseMatrixEventDto[]> {
  if (refs.length === 0) return [];

  const limit = opts?.limitPerDealer ?? DEFAULT_LIMIT_PER_DEALER;
  const tradePointIds = new Set(refs.map((r) => r.point.id));
  const dealerIds = Array.from(new Set(refs.map((r) => r.dealer.id)));

  const chunks: string[][] = [];
  if (dealerIds.length <= CHUNK_THRESHOLD) {
    chunks.push(dealerIds);
  } else {
    for (let i = 0; i < dealerIds.length; i += CHUNK_SIZE) {
      chunks.push(dealerIds.slice(i, i + CHUNK_SIZE));
    }
  }

  const merged: ShowcaseMatrixEventDto[] = [];
  for (const chunk of chunks) {
    const batch = await Promise.all(chunk.map((dealerId) => fetchDealerHistory(dealerId, limit)));
    for (const events of batch) merged.push(...events);
  }

  return merged.filter((e) => tradePointIds.has(e.tradePointId));
}
