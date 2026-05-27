import type { ReactNode } from "react";
import { createElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { normalizeTerritoryCityName } from "@/lib/territory-city-normalize";
import { cn } from "@/lib/utils";

export function isDealerArchivedInActualization(dealerId: string, act: ActualizationState): boolean {
  return Boolean(act.archivedDealersById[dealerId]);
}

/** Muted row surface for archived clients / trade points in tables and lists. */
export function archivedEntityRowClassName(isArchived: boolean): string {
  if (!isArchived) return "";
  return "bg-muted/40 text-muted-foreground [&_a:not([class*='text-primary'])]:text-muted-foreground [&_svg]:text-muted-foreground";
}

const archiveBadgeBase =
  "inline-flex shrink-0 items-center rounded-full border border-muted-foreground/40 bg-transparent font-medium text-muted-foreground";

export function archiveInArchiveBadgeClassName(size: "table" | "header" = "table"): string {
  return cn(archiveBadgeBase, size === "header" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0 text-[10px] leading-none");
}

export function ArchiveInArchiveBadge({
  size = "table",
  className,
  testId,
}: {
  size?: "table" | "header";
  className?: string;
  testId?: string;
}): ReactNode {
  return createElement(
    "span",
    {
      className: cn(archiveInArchiveBadgeClassName(size), className),
      "data-testid": testId ?? "badge-archive-in-archive",
    },
    "🗄️ В архиве",
  );
}

/** Gray inline suffix: ` · 12 архив` — only when count > 0. */
export function archiveCountDotSuffix(count: number): ReactNode {
  if (count <= 0) return null;
  return createElement("span", { className: "text-xs text-muted-foreground" }, ` · ${count} архив`);
}

/** Gray inline suffix: ` (3 архив)` — only when count > 0. */
export function archiveCountParenSuffix(count: number): ReactNode {
  if (count <= 0) return null;
  return createElement("span", { className: "text-xs text-muted-foreground" }, ` (${count} архив)`);
}

export type CityArchiveCounts = {
  archivedClients: number;
  archivedTradePoints: number;
};

export function cityKeyForDealerRow(row: DealerRow): string {
  const raw = row.city?.trim();
  const display =
    !raw || raw === "—" || raw === "-"
      ? "Без города"
      : normalizeTerritoryCityName(row.city, row.releaseAddress);
  return display === "Без города" ? "__no_city__" : display;
}

export function buildCityArchiveCountsMap(
  rows: DealerRow[],
  act: ActualizationState | undefined,
): Map<string, CityArchiveCounts> {
  const map = new Map<string, CityArchiveCounts>();
  if (!act) return map;

  const bump = (cityKey: string, clients: number, tps: number) => {
    const cur = map.get(cityKey) ?? { archivedClients: 0, archivedTradePoints: 0 };
    cur.archivedClients += clients;
    cur.archivedTradePoints += tps;
    map.set(cityKey, cur);
  };

  for (const r of rows) {
    const cityKey = cityKeyForDealerRow(r);
    if (isDealerArchivedInActualization(r.id, act)) {
      bump(cityKey, 1, 0);
    }
    for (const entry of mergeTradePointsForActualization(r, act)) {
      if (!entry.isArchived) continue;
      bump(cityKey, 0, 1);
    }
  }
  return map;
}

export function countArchivedDealersInRows(rows: DealerRow[], act: ActualizationState): number {
  let n = 0;
  for (const r of rows) {
    if (isDealerArchivedInActualization(r.id, act)) n += 1;
  }
  return n;
}

export function countArchivedTradePointsInRows(rows: DealerRow[], act: ActualizationState): number {
  let n = 0;
  for (const r of rows) {
    for (const entry of mergeTradePointsForActualization(r, act)) {
      if (entry.isArchived) n += 1;
    }
  }
  return n;
}

export type ManagerArchiveCounts = { archivedClients: number; archivedTradePoints: number };

/** Архивные клиенты/ТТ по менеджеру (активная база + архивные клиенты менеджера). */
export function computeManagerArchiveCounts(
  activeRows: DealerRow[],
  archivedOnlyRows: DealerRow[],
  act: ActualizationState,
  matchManager: (row: DealerRow) => boolean,
): ManagerArchiveCounts {
  const archivedClients = archivedOnlyRows.filter(matchManager).length;
  const dealerById = new Map<string, DealerRow>();
  for (const r of activeRows) {
    if (matchManager(r)) dealerById.set(r.id, r);
  }
  for (const r of archivedOnlyRows) {
    if (matchManager(r)) dealerById.set(r.id, r);
  }
  let archivedTradePoints = 0;
  for (const r of Array.from(dealerById.values())) {
    for (const entry of mergeTradePointsForActualization(r, act)) {
      if (entry.isArchived) archivedTradePoints += 1;
    }
  }
  return { archivedClients, archivedTradePoints };
}
