import type { DistributionEntryTradePointRow } from "./distribution-entry-tradepoint-view-model";

export type DistributionEntryStatusTab = "all" | "empty" | "filled";

export type DistributionEntrySortKey = "incomplete-first" | "recent-first" | "coverage-desc" | "name-asc";

export type DistributionEntryPeriod = "today" | "week" | "month" | "all";

export type DistributionEntryStatusCounts = {
  all: number;
  empty: number;
  filled: number;
};

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function parseRowUpdatedAt(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Та же логика, что compareRows в distribution-entry-tradepoint-view-model. */
export function compareIncompleteFirst(
  a: DistributionEntryTradePointRow,
  b: DistributionEntryTradePointRow,
): number {
  if (a.coveragePct !== b.coveragePct) return a.coveragePct - b.coveragePct;
  const aTime = parseRowUpdatedAt(a.lastUpdatedAt) ?? 0;
  const bTime = parseRowUpdatedAt(b.lastUpdatedAt) ?? 0;
  if (aTime !== bTime) return aTime - bTime;
  return a.tradePointName.localeCompare(b.tradePointName, "ru");
}

export function filterRowsByStatusTab(
  rows: readonly DistributionEntryTradePointRow[],
  tab: DistributionEntryStatusTab,
): DistributionEntryTradePointRow[] {
  if (tab === "all") return [...rows];
  // ТТ считается «заполненной», если на витрину внесена хотя бы одна installed-модель
  // (по сегментам вх/мк/фурнитура), независимо от наличия матрицы — согласовано с владельцем продукта.
  if (tab === "empty") return rows.filter((r) => r.installedOursTotal === 0);
  return rows.filter((r) => r.installedOursTotal > 0);
}

export function filterRowsByPeriod(
  rows: readonly DistributionEntryTradePointRow[],
  period: DistributionEntryPeriod,
  now = Date.now(),
): DistributionEntryTradePointRow[] {
  if (period === "all") return [...rows];

  const nowDate = new Date(now);
  let cutoff: number;
  switch (period) {
    case "today":
      cutoff = startOfLocalDayMs(nowDate);
      break;
    case "week":
      cutoff = startOfLocalDayMs(nowDate) - 6 * 86400000;
      break;
    case "month":
      cutoff = now - 30 * 86400000;
      break;
    default:
      return [...rows];
  }

  return rows.filter((r) => {
    const t = parseRowUpdatedAt(r.lastUpdatedAt);
    return t != null && t >= cutoff;
  });
}

export function sortEntryRows(
  rows: readonly DistributionEntryTradePointRow[],
  sortKey: DistributionEntrySortKey,
): DistributionEntryTradePointRow[] {
  const list = [...rows];
  switch (sortKey) {
    case "incomplete-first":
      list.sort(compareIncompleteFirst);
      break;
    case "recent-first":
      list.sort((a, b) => {
        const aTime = parseRowUpdatedAt(a.lastUpdatedAt) ?? -1;
        const bTime = parseRowUpdatedAt(b.lastUpdatedAt) ?? -1;
        if (aTime !== bTime) return bTime - aTime;
        return a.tradePointName.localeCompare(b.tradePointName, "ru");
      });
      break;
    case "coverage-desc":
      list.sort((a, b) => {
        if (a.coveragePct !== b.coveragePct) return b.coveragePct - a.coveragePct;
        return a.tradePointName.localeCompare(b.tradePointName, "ru");
      });
      break;
    case "name-asc":
      list.sort((a, b) => a.tradePointName.localeCompare(b.tradePointName, "ru"));
      break;
  }
  return list;
}

export function countByStatusTab(rows: readonly DistributionEntryTradePointRow[]): DistributionEntryStatusCounts {
  let empty = 0;
  let filled = 0;
  for (const r of rows) {
    if (r.installedOursTotal === 0) empty += 1;
    else filled += 1;
  }
  return { all: rows.length, empty, filled };
}

export function defaultSortForTab(tab: DistributionEntryStatusTab): DistributionEntrySortKey {
  return tab === "filled" ? "recent-first" : "incomplete-first";
}
