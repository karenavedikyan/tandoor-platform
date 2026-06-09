import type { GlobalSearchResult } from "@shared/search-handlers";

export type { GlobalSearchResult, GlobalSearchResultItem, GlobalSearchTradePointItem } from "@shared/search-handlers";

type ApiOk = { success: true; result: GlobalSearchResult };
type ApiErr = { success: false; message?: string; code?: string };

export async function searchGlobal(
  query: string,
  opts?: { limitPerType?: number; signal?: AbortSignal },
): Promise<GlobalSearchResult> {
  const qs = new URLSearchParams();
  qs.set("q", query);
  if (opts?.limitPerType != null) qs.set("limitPerType", String(opts.limitPerType));

  const res = await fetch(`/api/search/query?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: opts?.signal,
  });

  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    const msg = json.success === false && json.message ? json.message : "Не удалось выполнить поиск";
    throw new Error(msg);
  }
  return json.result;
}
