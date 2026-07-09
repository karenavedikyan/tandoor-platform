import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";

export type TradePointShowcaseSharedApiRecord = {
  tradePointId: string;
  dealerId: string;
  data: TradePointShowcaseActualization;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string | null;
};

export type TradePointShowcaseBatchResponse = {
  success: boolean;
  records: TradePointShowcaseSharedApiRecord[];
  message?: string;
};

export async function fetchTradePointShowcaseBatch(
  tradePointIds: readonly string[],
): Promise<TradePointShowcaseSharedApiRecord[]> {
  const ids = [...new Set(tradePointIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  try {
    const res = await fetch("/api/trade-point-showcase/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tradePointIds: ids }),
    });
    if (!res.ok) {
      console.warn("[trade-point-showcase-shared-store] batch HTTP", res.status);
      return [];
    }
    const body = (await res.json()) as TradePointShowcaseBatchResponse;
    if (!body.success || !Array.isArray(body.records)) return [];
    return body.records;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[trade-point-showcase-shared-store] batch fetch failed", m.slice(0, 200));
    return [];
  }
}
