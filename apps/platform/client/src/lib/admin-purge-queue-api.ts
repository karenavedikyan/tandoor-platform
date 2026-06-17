/**
 * GET /api/admin/purge-queue — корзина админа (Промт 386).
 */

export type AdminPurgeQueueDealer = {
  id: string;
  external_key: string;
  name: string;
  release_code: string | null;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purge_requested_by: string | null;
  trashed_by_name: string | null;
  purge_requested_by_name: string | null;
};

export type AdminPurgeQueueTradePoint = {
  tp_id: string;
  dealer_id: string | null;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purge_requested_by: string | null;
  trashed_by_name: string | null;
  purge_requested_by_name: string | null;
};

export type AdminPurgeQueuePayload = {
  success: true;
  dealers: AdminPurgeQueueDealer[];
  trade_points: AdminPurgeQueueTradePoint[];
};

export const ADMIN_PURGE_QUEUE_QUERY_KEY = ["admin", "purge-queue"] as const;

export async function fetchAdminPurgeQueue(): Promise<AdminPurgeQueuePayload> {
  const res = await fetch("/api/admin/purge-queue", { method: "GET", credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) throw new Error("UNAUTHENTICATED");
  const json = (await res.json()) as AdminPurgeQueuePayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `purge-queue HTTP ${res.status}`);
  }
  return json;
}
