/**
 * View-model разреза «Ввод → по городу».
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";

export type EntryCityRow = {
  city: string;
  tradePointCount: number;
};

function normalizeCity(city: string | undefined): string | null {
  const c = city?.trim();
  if (!c || c === "—" || c === "-") return null;
  return c;
}

export function buildEntryCityRows(
  dealers: readonly DealerRow[],
  query?: string,
): EntryCityRow[] {
  const counts = new Map<string, number>();
  for (const dealer of dealers) {
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (point.status?.trim() === "Архив") continue;
      const city = normalizeCity(point.city?.trim() || dealer.city);
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
  }

  const q = query?.trim().toLowerCase() ?? "";
  return Array.from(counts.entries())
    .map(([city, tradePointCount]) => ({ city, tradePointCount }))
    .filter((row) => !q || row.city.toLowerCase().includes(q))
    .sort((a, b) => a.city.localeCompare(b.city, "ru"));
}
