export type Clients1cListItem = {
  holding_id_1c: string;
  holding_name: string;
  holding_inn: string | null;
  holding_city: string | null;
  stores_count: number;
  legals_count: number;
  responsible_managers: string[];
  regional_managers: string[];
  distribution_filled_count: number;
  distribution_total_targets: number;
  distribution_percent: number;
  orders_last_90d_count: number;
  orders_last_90d_amount: number;
  last_order_at: string | null;
};

export type Clients1cListResponse = {
  ok: true;
  items: Clients1cListItem[];
  total: number;
  page: number;
  pageSize: number;
  refreshedAt: string | null;
};

export type MvStore1cRow = {
  store_id_1c: string;
  store_name: string;
  store_address: string | null;
  store_status: string | null;
  legal_id_1c: string;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
  legal_region: string | null;
  holding_id_1c: string;
  holding_name: string | null;
  responsible_manager_1c: string | null;
  responsible_manager_name: string | null;
  regional_manager_1c: string | null;
  regional_manager_name: string | null;
  furniture_manager_1c: string | null;
  furniture_manager_name: string | null;
  store_manager_1c: string | null;
  store_manager_name: string | null;
  linked_trade_point_id: string | null;
  distribution_filled_count: number;
  distribution_total_targets: number;
  distribution_percent: number;
  orders_last_90d_count: number;
  orders_last_90d_amount: number;
  last_order_at: string | null;
  last_distribution_updated_at: string | null;
  refreshed_at: string;
};

export type Clients1cHoldingHeader = {
  holding_id_1c: string;
  holding_name: string;
  holding_inn: string | null;
  holding_city: string | null;
  holding_region: string | null;
  stores_count: number;
  legals_count: number;
  responsible_managers: string[];
  regional_managers: string[];
  distribution_filled_count: number;
  distribution_total_targets: number;
  distribution_percent: number;
  orders_last_90d_count: number;
  orders_last_90d_amount: number;
  last_order_at: string | null;
  refreshed_at: string;
};

export type DistributionKindSummary = {
  total: number;
  filled: number;
};

export type Clients1cDistributionRow = {
  store_id_1c: string;
  target_kind: string;
  target_id: string;
  status: string | null;
  placement_type: string | null;
  placement_segment: string | null;
  placement_capacity: number | null;
  placement_actual: number | null;
  placement_ref: string | null;
  placement_our_models: string | null;
  placement_competitors: string | null;
  source: "override_1c" | "matrix_lk" | string;
  updated_at: string | null;
  updated_by_name: string | null;
};

export type Clients1cOrderRow = {
  id: string;
  order_number: string;
  status: string;
  delivery_type: string | null;
  total_with_discount: number | null;
  total_discount: number | null;
  created_at_bitrix: string | null;
  store_id_1c: string | null;
  store_name: string | null;
  store_city: string | null;
  legal_id_1c: string | null;
  legal_name: string | null;
  manager_name: string | null;
  items_count: number;
};

export type Clients1cHistoryRow = {
  id: string;
  storeId1c: string;
  action: string;
  payload: unknown;
  actorUserId: string | null;
  actorFullName: string | null;
  createdAt: string;
};

export type Clients1cHoldingResponse = {
  ok: true;
  holding: Clients1cHoldingHeader;
  stores: MvStore1cRow[];
  distributionSummary: Record<string, DistributionKindSummary>;
  orders: Clients1cOrderRow[];
};

export type Clients1cStoreResponse = {
  ok: true;
  store: MvStore1cRow;
  distribution: Clients1cDistributionRow[];
  orders: Clients1cOrderRow[];
  history: Clients1cHistoryRow[];
};

export type Clients1cListSort =
  | "name"
  | "stores_desc"
  | "distribution_desc"
  | "orders_desc"
  | "last_order_desc";

export type Clients1cTriFilter = "true" | "false" | "any";

export type Clients1cListQuery = {
  search: string;
  city: string;
  region: string;
  hasDistribution: Clients1cTriFilter;
  hasOrders: Clients1cTriFilter;
  sort: Clients1cListSort;
  page: number;
  pageSize: number;
};
