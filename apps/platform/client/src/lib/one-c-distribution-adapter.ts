import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { DistributionEntryTradePointRow } from "@/lib/distribution-entry-tradepoint-view-model";
import { entryTradePointRowSearchHaystack } from "@/lib/distribution-entry-tradepoint-view-model";
import type { TradePointListRow } from "@/lib/dealer-base-management-view-model";
import {
  build1cDealerRow,
  build1cPoint,
  type OneCLegalShapeInput,
} from "@/lib/one-c-dealer-shape";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";
import {
  countInstalledLegacyOurs,
  countInstalledOursBySegment,
} from "@/lib/trade-point-showcase-segment-models";

function legalFromStoreListItem(item: OneCStoreListItem): OneCLegalShapeInput {
  const legalId = item.legal_parent_1c ?? item.id_1c;
  return {
    id_1c: legalId,
    name: item.legal_parent_name?.trim() || item.legal_name?.trim() || "Клиент 1С",
    legal_name: item.legal_name,
    inn: item.legal_inn,
    kpp: null,
    ogrn: null,
    region: null,
    city: item.legal_city,
    client_type: item.legal_client_type,
    payment_form: item.legal_payment_form,
    phone: item.legal_phone,
    email: item.legal_email,
    discount_code: null,
    discount_percent: null,
    responsible_manager_name: item.legal_responsible_manager_name ?? item.manager_name,
    regional_manager_name: item.legal_regional_manager_name,
    plan_sum: null,
    plan_retro_bonus: null,
  };
}

export function oneCStoreListItemToDealerWithPoint(item: OneCStoreListItem): {
  dealer: DealerRow & { source1c: true };
  point: DealerTradePoint;
} {
  const legal = legalFromStoreListItem(item);
  const legalId = legal.id_1c;
  const dealer = build1cDealerRow(legal);
  const point = build1cPoint(
    {
      id_1c: item.id_1c,
      address: item.address,
      name: item.address?.trim() || item.legal_name?.trim() || "ТТ",
      manager_name: item.manager_name,
      manager_phone: null,
      legal_entity_1c: legalId,
    },
    legal,
  );
  dealer.tradePoints = [point];
  dealer.ropId = item.rop_user_id ?? null;
  dealer.managerUserId = item.responsible_manager_user_id ?? null;
  dealer.regionalManagerId = item.regional_manager_user_id ?? null;
  return { dealer, point };
}

export function oneCStoreListItemToTradePointListRow(item: OneCStoreListItem): TradePointListRow {
  const { dealer, point } = oneCStoreListItemToDealerWithPoint(item);
  return {
    tpId: item.id_1c,
    name: point.name,
    city: item.legal_city?.trim() || point.city || "—",
    dealerId: dealer.id,
    dealerName: dealer.name,
    manager:
      item.legal_responsible_manager_name?.trim() ||
      item.manager_name?.trim() ||
      item.legal_regional_manager_name?.trim() ||
      "—",
  };
}

export function buildDistributionEntryTradePointRowFromOneC(
  item: OneCStoreListItem,
): DistributionEntryTradePointRow {
  const { dealer, point } = oneCStoreListItemToDealerWithPoint(item);
  const total = item.distribution_total > 0 ? item.distribution_total : 0;
  const filled = item.distribution_filled > 0 ? item.distribution_filled : 0;
  const coveragePct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const entries = loadCachedMatrix(item.id_1c);
  const installedOursBySegment = countInstalledOursBySegment(entries);
  const installedOursRotation = countInstalledLegacyOurs(entries);
  const installedOursTotal =
    installedOursBySegment.vh + installedOursBySegment.mk + installedOursBySegment.hardware;
  return {
    dealerId: dealer.id,
    tradePointId: item.id_1c,
    tradePointName: point.name,
    clientName: item.legal_parent_name?.trim() || item.legal_name?.trim() || dealer.name,
    city: item.legal_city?.trim() || null,
    clientCategory: dealer.clientCategory,
    managerName: item.manager_name?.trim() || null,
    regionalManagerName: item.legal_regional_manager_name?.trim() || null,
    responsibleManagerName: item.legal_responsible_manager_name?.trim() || null,
    furnitureManagerName: item.legal_furniture_manager_name?.trim() || null,
    ropName: item.rop_name?.trim() || null,
    legalInn: item.legal_inn?.trim() || null,
    address: item.address?.trim() || null,
    templateModelsCount: total,
    filledCount: filled,
    coveragePct,
    lastUpdatedAt: null,
    installedOursTotal: installedOursTotal > 0 ? installedOursTotal : filled,
    installedOursBySegment,
    installedOursRotation,
  };
}

export function buildDistributionEntryTradePointRowsFromOneC(
  items: readonly OneCStoreListItem[],
  query = "",
): DistributionEntryTradePointRow[] {
  const q = query.trim().toLowerCase();
  const rows = items.map((item) => buildDistributionEntryTradePointRowFromOneC(item));
  if (!q) return rows.sort((a, b) => a.tradePointName.localeCompare(b.tradePointName, "ru"));
  return rows
    .filter((row) => entryTradePointRowSearchHaystack(row).includes(q))
    .sort((a, b) => a.tradePointName.localeCompare(b.tradePointName, "ru"));
}

export function buildOneCRowRefsMap(
  items: readonly OneCStoreListItem[],
): Map<string, { dealer: DealerRow; point: DealerTradePoint }> {
  const map = new Map<string, { dealer: DealerRow; point: DealerTradePoint }>();
  for (const item of items) {
    const { dealer, point } = oneCStoreListItemToDealerWithPoint(item);
    map.set(item.id_1c, { dealer, point });
  }
  return map;
}
