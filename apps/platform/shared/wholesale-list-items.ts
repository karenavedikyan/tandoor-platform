/**
 * DTO builders for wholesale manager/RM detail lists — explicit client vs store entities.
 */

import type { OneCStoreListItem } from "./one-c-showroom-handlers.js";
import type { WholesaleClientAssignment, WholesaleOrgReadResult } from "./wholesale-org-types.js";

export type WholesaleListEntityKind = "client" | "store";

export type WholesaleAssignmentListItem = OneCStoreListItem & {
  entityKind: WholesaleListEntityKind;
  clientGuid: string;
  storeCount: number;
};

export function buildAssignmentListItems(
  clients: WholesaleClientAssignment[],
  org: WholesaleOrgReadResult,
  allowedStoreGuids?: Set<string> | null,
): WholesaleAssignmentListItem[] {
  const items: WholesaleAssignmentListItem[] = [];
  for (const c of clients) {
    const openStores = c.openStoreGuids.filter((s) => !allowedStoreGuids || allowedStoreGuids.has(s));
    if (openStores.length === 0) {
      items.push({
        entityKind: "client",
        id_1c: c.guidClient,
        clientGuid: c.guidClient,
        address: c.city?.trim() || null,
        manager_name: c.responsibleManagerName,
        legal_name: c.name,
        legal_inn: null,
        legal_city: c.city,
        legal_parent_1c: null,
        legal_parent_name: null,
        legal_client_type: null,
        legal_regional_manager_name: c.regionalManagerName,
        legal_responsible_manager_name: c.responsibleManagerName,
        legal_furniture_manager_name: null,
        rop_user_id: c.headOfSalesGuid,
        rop_name: c.headOfSalesName,
        legal_payment_form: null,
        legal_phone: null,
        legal_email: null,
        status: null,
        orders_count: 0,
        distribution_filled: 0,
        distribution_total: 0,
        storeCount: 0,
      });
      continue;
    }
    for (const storeGuid of openStores) {
      const outlet = org.outlets.find((o) => o.guidStore === storeGuid);
      items.push({
        entityKind: "store",
        id_1c: storeGuid,
        clientGuid: c.guidClient,
        address: outlet?.address?.trim() || null,
        manager_name: outlet?.storeManagerName ?? c.responsibleManagerName,
        legal_name: c.name,
        legal_inn: null,
        legal_city: c.city,
        legal_parent_1c: null,
        legal_parent_name: null,
        legal_client_type: null,
        legal_regional_manager_name: c.regionalManagerName,
        legal_responsible_manager_name: c.responsibleManagerName,
        legal_furniture_manager_name: null,
        rop_user_id: c.headOfSalesGuid,
        rop_name: c.headOfSalesName,
        legal_payment_form: null,
        legal_phone: null,
        legal_email: null,
        status: outlet?.closed ? "closed" : "active",
        orders_count: 0,
        distribution_filled: 0,
        distribution_total: 0,
        storeCount: 1,
      });
    }
  }
  return items;
}
