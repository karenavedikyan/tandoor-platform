import { getClientCategoryLabel } from "@/lib/client-category";
import type { MergedTradePointEntry } from "@/lib/dealer-trade-points-overrides";
import { oneCStoreListItemToDealerWithPoint } from "@/lib/one-c-distribution-adapter";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

function isOneCStoreArchived(item: OneCStoreListItem): boolean {
  const status = (item.status ?? "").trim().toLowerCase();
  return status === "archived" || status === "closed" || status === "неактивен";
}

function shortIdSuffix(id_1c: string): string {
  const tail = id_1c.slice(-8);
  return `[${tail}]`;
}

function pickOneCStoreDisplayCode(item: OneCStoreListItem): string {
  const addr = item.address?.trim();
  if (addr) return addr;
  const legal = item.legal_name?.trim();
  if (legal) return legal;
  return shortIdSuffix(item.id_1c);
}

/** Полные строки ТТ для analytics-фильтров и агрегатов из списка 1С. */
export function buildOneCAnalyticsTradePointRows(items: readonly OneCStoreListItem[]): TradePointListRow[] {
  const rows: TradePointListRow[] = [];
  for (const item of items) {
    if (isOneCStoreArchived(item)) continue;
    const { dealer, point } = oneCStoreListItemToDealerWithPoint(item);
    const manager =
      item.legal_responsible_manager_name?.trim() ||
      item.manager_name?.trim() ||
      dealer.manager ||
      "—";
    const regionalManager = item.legal_regional_manager_name?.trim() || dealer.regionalManager || "—";
    const rop = item.rop_name?.trim() || dealer.ropName || "—";
    const city = item.legal_city?.trim() || point.city || "—";
    const clientCategory = dealer.clientCategory;
    rows.push({
      tradePointId: item.id_1c,
      dealerId: dealer.id,
      dealer,
      point,
      entry: { point, isArchived: false } as MergedTradePointEntry,
      tradePointDisplayCode: pickOneCStoreDisplayCode(item),
      dealerClientCode: dealer.id,
      dealerName: dealer.name,
      tradePointName: point.name,
      city,
      address: item.address?.trim() || "",
      tradePointFormatLabel: null,
      manager,
      regionalManager,
      rop,
      clientCategory,
      clientCategoryLabel: getClientCategoryLabel(clientCategory),
      showcaseBucket: "has_showcase",
      showcaseBucketLabel: "Витрина",
      portalsTotal: null,
      modelsOnShowcaseCount: 0,
      matrixDeficitCount: 0,
      showcaseNewTasksCount: 0,
      portalOverfill: false,
      portalsUnfilled: false,
      hasFreePortals: false,
      hasShowcase: true,
      showcaseUpdatedAt: null,
      unloadingOrder: null,
      isArchived: false,
      isVirtual: false,
      searchHaystack: [dealer.name, point.name, city, item.id_1c].join(" ").toLowerCase(),
    });
  }
  return rows;
}
