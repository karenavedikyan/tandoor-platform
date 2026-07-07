/**
 * Read-only API client for /1c/* showroom (shadow tables).
 */

export type OneCOverview = {
  success: boolean;
  stores: number;
  users: number;
  legals: number;
  last_imported_at: string | null;
  message?: string;
};

export type OneCTeamMember = {
  id_1c: string;
  name: string;
  phone: string | null;
  store_count: number;
};

export type OneCTeamResponse = {
  success: boolean;
  total: number;
  items: OneCTeamMember[];
  message?: string;
};

export type OneCManagerStoreRow = {
  id_1c: string;
  address: string | null;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
};

export type OneCManagerResponse = {
  success: boolean;
  user: {
    id_1c: string;
    name: string;
    phone: string | null;
    store_count: number;
  };
  stores: OneCManagerStoreRow[];
  message?: string;
};

export type OneCStoreListItem = {
  id_1c: string;
  address: string | null;
  manager_name: string | null;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
};

export type OneCStoresResponse = {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  items: OneCStoreListItem[];
  message?: string;
};

export type OneCStoreDetail = {
  id_1c: string;
  address: string | null;
  name: string;
  status: string;
  imported_at: string;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  legal_entity_1c: string | null;
  legal_name: string | null;
  legal_legal_name: string | null;
  legal_inn: string | null;
  legal_kpp: string | null;
  legal_ogrn: string | null;
  legal_region: string | null;
  legal_city: string | null;
  legal_client_type: string | null;
  legal_payment_form: string | null;
  legal_phone: string | null;
  legal_email: string | null;
  legal_discount_code: string | null;
  legal_discount_percent: number | null;
  legal_regional_manager_name: string | null;
  legal_responsible_manager_name: string | null;
  legal_furniture_manager_name: string | null;
  legal_furniture_manager_phone: string | null;
  legal_ma_number: string | null;
  legal_plan_sum: number | null;
  legal_plan_retro_bonus: string | null;
  legal_parent_1c: string | null;
  legal_parent_name: string | null;
  legal_parent_inn: string | null;
};

export type OneCStoreResponse = {
  success: boolean;
  store: OneCStoreDetail;
  message?: string;
};

export type OneCLegalListItem = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  city: string | null;
  responsible_manager_name: string | null;
  plan_sum: number | null;
};

export type OneCLegalsResponse = {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  items: OneCLegalListItem[];
  message?: string;
};

export type OneCLegalChild = {
  id_1c: string;
  name: string;
  inn: string | null;
};

export type OneCLegalStoreRow = {
  id_1c: string;
  address: string | null;
  manager_name: string | null;
};

export type OneCLegalDetail = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  ma_number: string | null;
  payment_form: string | null;
  region: string | null;
  city: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  regional_manager_1c: string | null;
  regional_manager_name: string | null;
  responsible_manager_1c: string | null;
  responsible_manager_name: string | null;
  furniture_manager_1c: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  parent_name: string | null;
  parent_inn: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
  imported_at: string;
  regional_manager_in_users: boolean;
  responsible_manager_in_users: boolean;
  furniture_manager_in_users: boolean;
};

export type OneCLegalResponse = {
  success: boolean;
  legal: OneCLegalDetail;
  children: OneCLegalChild[];
  stores: OneCLegalStoreRow[];
  message?: string;
};

async function fetchOneC<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`/api/one-c/${path}${qs}`, { credentials: "include" });
  return (await res.json()) as T;
}

export function fetchOneCOverview(): Promise<OneCOverview> {
  return fetchOneC<OneCOverview>("overview");
}

export function fetchOneCTeam(q?: string): Promise<OneCTeamResponse> {
  const params: Record<string, string> = {};
  if (q?.trim()) params.q = q.trim();
  return fetchOneC<OneCTeamResponse>("team", params);
}

export function fetchOneCManager(id1c: string, q?: string): Promise<OneCManagerResponse> {
  const params: Record<string, string> = { id_1c: id1c };
  if (q?.trim()) params.q = q.trim();
  return fetchOneC<OneCManagerResponse>("manager", params);
}

export function fetchOneCStores(opts?: { q?: string; limit?: number; offset?: number }): Promise<OneCStoresResponse> {
  const params: Record<string, string> = {
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCStoresResponse>("stores", params);
}

export function fetchOneCStore(id1c: string): Promise<OneCStoreResponse> {
  return fetchOneC<OneCStoreResponse>("store", { id_1c: id1c });
}

export function fetchOneCLegals(opts?: { q?: string; limit?: number; offset?: number }): Promise<OneCLegalsResponse> {
  const params: Record<string, string> = {
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCLegalsResponse>("legals", params);
}

export function fetchOneCLegal(id1c: string): Promise<OneCLegalResponse> {
  return fetchOneC<OneCLegalResponse>("legal", { id_1c: id1c });
}
