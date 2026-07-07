/**
 * Read-only API client for /1c/* showroom.
 */

export type OneCOverview = {
  success: boolean;
  rops: number;
  rms: number;
  managers: number;
  storesActive: number;
  storesTotal: number;
  legalsActive: number;
  legalsTotal: number;
  last_imported_at: string | null;
  message?: string;
};

export type OneCManagerNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
  hasMatch: boolean;
};

export type OneCRmNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
  hasMatch: boolean;
  managers: OneCManagerNode[];
};

export type OneCRopNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  teamId: string;
  teamName: string;
  rmCount: number;
  managerCount: number;
  storeCount: number;
  legalCount: number;
  rms: OneCRmNode[];
};

export type OneCHierarchyResponse = {
  success: boolean;
  items: OneCRopNode[];
  message?: string;
};

export type OneCUserCard = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  teamName: string | null;
  ropName: string | null;
  rmNames: string[];
  storeCount: number;
  legalCount: number;
};

export type OneCTeamMemberRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
};

export type OneCRopResponse = {
  success: boolean;
  user: OneCUserCard;
  rms: OneCTeamMemberRow[];
  managers: OneCTeamMemberRow[];
  message?: string;
};

export type OneCManagerStoreRow = {
  id_1c: string;
  address: string | null;
  store_name: string;
  legal_short: string | null;
  inn: string | null;
  kpp: string | null;
  legal_city: string | null;
  resp?: string | null;
};

export type OneCRmResponse = {
  success: boolean;
  user: OneCUserCard;
  teamName: string | null;
  ropName: string | null;
  managers: OneCTeamMemberRow[];
  total: number;
  items: OneCManagerStoreRow[];
  limit: number;
  offset: number;
  message?: string;
};

export type OneCManagerResponse = {
  success: boolean;
  user: OneCUserCard;
  total: number;
  items: OneCManagerStoreRow[];
  limit: number;
  offset: number;
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
  onlyActive: boolean;
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
  responsible_manager_user_id: string | null;
  regional_manager_user_id: string | null;
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
  onlyActive: boolean;
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
  regional_manager_name: string | null;
  responsible_manager_name: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  parent_name: string | null;
  parent_inn: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
  imported_at: string;
  responsible_manager_user_id: string | null;
  regional_manager_user_id: string | null;
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

export function fetchOneCHierarchy(q?: string): Promise<OneCHierarchyResponse> {
  const params: Record<string, string> = {};
  if (q?.trim()) params.q = q.trim();
  return fetchOneC<OneCHierarchyResponse>("hierarchy", params);
}

export function fetchOneCRop(userId: string): Promise<OneCRopResponse> {
  return fetchOneC<OneCRopResponse>("rop", { user_id: userId });
}

export function fetchOneCRm(
  userId: string,
  opts?: { q?: string; limit?: number; offset?: number },
): Promise<OneCRmResponse> {
  const params: Record<string, string> = {
    user_id: userId,
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCRmResponse>("rm", params);
}

export function fetchOneCManager(
  userId: string,
  opts?: { q?: string; limit?: number; offset?: number },
): Promise<OneCManagerResponse> {
  const params: Record<string, string> = {
    user_id: userId,
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCManagerResponse>("manager", params);
}

export function fetchOneCStores(opts?: {
  q?: string;
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
}): Promise<OneCStoresResponse> {
  const params: Record<string, string> = {
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
    onlyActive: opts?.onlyActive === false ? "0" : "1",
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCStoresResponse>("stores", params);
}

export function fetchOneCStore(id1c: string): Promise<OneCStoreResponse> {
  return fetchOneC<OneCStoreResponse>("store", { id_1c: id1c });
}

export function fetchOneCLegals(opts?: {
  q?: string;
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
}): Promise<OneCLegalsResponse> {
  const params: Record<string, string> = {
    limit: String(opts?.limit ?? 100),
    offset: String(opts?.offset ?? 0),
    onlyActive: opts?.onlyActive === false ? "0" : "1",
  };
  if (opts?.q?.trim()) params.q = opts.q.trim();
  return fetchOneC<OneCLegalsResponse>("legals", params);
}

export function fetchOneCLegal(id1c: string): Promise<OneCLegalResponse> {
  return fetchOneC<OneCLegalResponse>("legal", { id_1c: id1c });
}
