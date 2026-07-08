import type {
  Clients1cHoldingResponse,
  Clients1cListItem,
  Clients1cListQuery,
  Clients1cListResponse,
  Clients1cListSort,
  Clients1cStoreResponse,
  Clients1cTriFilter,
} from "../../../shared/clients-1c/types.js";

export type {
  Clients1cHoldingResponse,
  Clients1cListItem,
  Clients1cListQuery,
  Clients1cListResponse,
  Clients1cListSort,
  Clients1cStoreResponse,
  Clients1cTriFilter,
};

type ApiError = { ok: false; code?: string; message?: string };

async function readJson<T>(res: Response): Promise<T | ApiError> {
  return (await res.json()) as T | ApiError;
}

function buildListQuery(params: Partial<Clients1cListQuery>): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.city) q.set("city", params.city);
  if (params.region) q.set("region", params.region);
  if (params.hasDistribution && params.hasDistribution !== "any") {
    q.set("hasDistribution", params.hasDistribution);
  }
  if (params.hasOrders && params.hasOrders !== "any") {
    q.set("hasOrders", params.hasOrders);
  }
  if (params.sort) q.set("sort", params.sort);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchClients1cList(
  params: Partial<Clients1cListQuery> = {},
): Promise<Clients1cListResponse | ApiError> {
  const res = await fetch(`/api/clients-1c/list${buildListQuery(params)}`, {
    credentials: "include",
  });
  return readJson<Clients1cListResponse>(res);
}

export async function fetchClients1cHolding(
  holdingId: string,
): Promise<Clients1cHoldingResponse | ApiError> {
  const res = await fetch(`/api/clients-1c/${encodeURIComponent(holdingId)}`, {
    credentials: "include",
  });
  return readJson<Clients1cHoldingResponse>(res);
}

export async function fetchClients1cStore(
  holdingId: string,
  storeId: string,
): Promise<Clients1cStoreResponse | ApiError> {
  const res = await fetch(
    `/api/clients-1c/${encodeURIComponent(holdingId)}/tp/${encodeURIComponent(storeId)}`,
    { credentials: "include" },
  );
  return readJson<Clients1cStoreResponse>(res);
}

export async function refreshClients1cMv(): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/admin/refresh-clients-1c-mv", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = (await res.json()) as { ok?: boolean; message?: string };
  return { ok: res.ok && json.ok !== false, message: json.message };
}

export function clients1cOrderToBitrixListItem(
  order: Clients1cHoldingResponse["orders"][number],
): import("@/lib/one-c-bitrix-orders-api").BitrixOrderListItem {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    delivery_type: order.delivery_type,
    total_with_discount: order.total_with_discount,
    total_discount: order.total_discount,
    created_at_bitrix: order.created_at_bitrix,
    client_number_1c: null,
    store: order.store_id_1c
      ? { id_1c: order.store_id_1c, name: order.store_name ?? "—", city: order.store_city }
      : null,
    legal: order.legal_id_1c
      ? { id_1c: order.legal_id_1c, name: order.legal_name ?? "—" }
      : null,
    manager: order.manager_name ? { manager_1c: "", name: order.manager_name } : null,
    items_count: order.items_count,
  };
}
