/**
 * API client for Bitrix orders in /1c/* showroom.
 */

export type BitrixOrderListItem = {
  id: string;
  order_number: string;
  status: string;
  delivery_type: string | null;
  total_with_discount: number | null;
  total_discount: number | null;
  created_at_bitrix: string | null;
  client_number_1c: string | null;
  store: { id_1c: string; name: string; city: string | null } | null;
  legal: { id_1c: string; name: string } | null;
  manager: { manager_1c: string; name: string | null } | null;
  items_count: number;
};

export type BitrixOrderDetail = BitrixOrderListItem & {
  site_id: string | null;
  client_uuid: string | null;
  delivery_address: string | null;
  payment_method: string | null;
  payment_percent: number | null;
  source_file: string | null;
  imported_at: string;
  updated_at: string;
  items: Array<{
    line_no: number;
    product_xml_id: string;
    product_id: string | null;
    product_name_1c: string | null;
    product_name: string | null;
    quantity: number;
    discount_per_item: number | null;
    price_no_discount: number | null;
    discount_id: string | null;
    product_id_1c_internal: string | null;
    price_type_uuid: string | null;
    supply_variant: string | null;
    supply_date: string | null;
  }>;
};

export type BitrixOrdersResponse = {
  success: boolean;
  orders: BitrixOrderListItem[];
  total: number;
  limit: number;
  offset: number;
  scope?: string;
  message?: string;
};

export type BitrixOrderResponse = {
  success: boolean;
  order: BitrixOrderDetail;
  message?: string;
};

async function fetchOneCOrders<T>(action: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`/api/one-c/${action}${qs}`, { credentials: "include" });
  return (await res.json()) as T;
}

export function fetchBitrixOrders(opts?: {
  search?: string;
  status?: string;
  scope?: "all" | "unassigned";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<BitrixOrdersResponse> {
  const params: Record<string, string> = {
    limit: String(opts?.limit ?? 50),
    offset: String(opts?.offset ?? 0),
    scope: opts?.scope ?? "all",
  };
  if (opts?.search?.trim()) params.search = opts.search.trim();
  if (opts?.status?.trim()) params.status = opts.status.trim();
  if (opts?.dateFrom) params.dateFrom = opts.dateFrom;
  if (opts?.dateTo) params.dateTo = opts.dateTo;
  return fetchOneCOrders<BitrixOrdersResponse>("orders", params);
}

export function fetchBitrixOrdersForStore(
  storeId1c: string,
  opts?: { limit?: number; offset?: number },
): Promise<BitrixOrdersResponse> {
  return fetchOneCOrders<BitrixOrdersResponse>("orders-for-store", {
    store_id_1c: storeId1c,
    limit: String(opts?.limit ?? 20),
    offset: String(opts?.offset ?? 0),
  });
}

export function fetchBitrixOrdersForLegal(
  legalId1c: string,
  opts?: { limit?: number; offset?: number },
): Promise<BitrixOrdersResponse> {
  return fetchOneCOrders<BitrixOrdersResponse>("orders-for-legal", {
    legal_id_1c: legalId1c,
    limit: String(opts?.limit ?? 20),
    offset: String(opts?.offset ?? 0),
  });
}

export function fetchBitrixOrder(orderId: string): Promise<BitrixOrderResponse> {
  return fetchOneCOrders<BitrixOrderResponse>("order", { order_id: orderId });
}
