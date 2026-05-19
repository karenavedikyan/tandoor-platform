export const BITRIX24_TASK_LINKS_STORAGE_KEY = "tandoor-bitrix24-task-links-v1";

export const BITRIX24_TASK_LINKS_CHANGED_EVENT = "tandoor-bitrix24-task-links-changed";

export type Bitrix24TaskLinkSource = "dealer" | "trade_point";

export type Bitrix24TaskLink = {
  id: string;
  bitrixTaskId: string;
  title: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  source: Bitrix24TaskLinkSource;
  status: "created";
};

export type Bitrix24TaskLinksState = {
  linksByDealer: Record<string, Bitrix24TaskLink[]>;
  linksByTradePoint: Record<string, Bitrix24TaskLink[]>;
};

const MAX_PER_BUCKET = 40;

function emptyState(): Bitrix24TaskLinksState {
  return { linksByDealer: {}, linksByTradePoint: {} };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseStored(raw: string | null): Bitrix24TaskLinksState {
  if (!raw?.trim()) return emptyState();
  try {
    const j = JSON.parse(raw) as unknown;
    if (!isRecord(j)) return emptyState();
    const linksByDealer = isRecord(j.linksByDealer) ? (j.linksByDealer as Record<string, Bitrix24TaskLink[]>) : {};
    const linksByTradePoint = isRecord(j.linksByTradePoint)
      ? (j.linksByTradePoint as Record<string, Bitrix24TaskLink[]>)
      : {};
    return { linksByDealer, linksByTradePoint };
  } catch {
    return emptyState();
  }
}

export function loadBitrix24TaskLinksState(): Bitrix24TaskLinksState {
  if (typeof window === "undefined") return emptyState();
  return parseStored(window.localStorage.getItem(BITRIX24_TASK_LINKS_STORAGE_KEY));
}

export function saveBitrix24TaskLinksState(state: Bitrix24TaskLinksState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BITRIX24_TASK_LINKS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(BITRIX24_TASK_LINKS_CHANGED_EVENT));
}

function trimBucket(list: Bitrix24TaskLink[]): Bitrix24TaskLink[] {
  return list.slice(0, MAX_PER_BUCKET);
}

export function tradePointLinksKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}

export function getDealerBitrix24TaskLinks(dealerId: string): Bitrix24TaskLink[] {
  const s = loadBitrix24TaskLinksState();
  return [...(s.linksByDealer[dealerId] ?? [])];
}

export function getTradePointBitrix24TaskLinks(dealerId: string, tradePointId: string): Bitrix24TaskLink[] {
  const s = loadBitrix24TaskLinksState();
  const key = tradePointLinksKey(dealerId, tradePointId);
  return [...(s.linksByTradePoint[key] ?? [])];
}

export function addDealerBitrix24TaskLink(link: Bitrix24TaskLink): void {
  const s = loadBitrix24TaskLinksState();
  const prev = s.linksByDealer[link.dealerId] ?? [];
  s.linksByDealer[link.dealerId] = trimBucket([link, ...prev]);
  saveBitrix24TaskLinksState(s);
}

export function addTradePointBitrix24TaskLink(dealerId: string, tradePointId: string, link: Bitrix24TaskLink): void {
  const s = loadBitrix24TaskLinksState();
  const key = tradePointLinksKey(dealerId, tradePointId);
  const prev = s.linksByTradePoint[key] ?? [];
  s.linksByTradePoint[key] = trimBucket([link, ...prev]);
  saveBitrix24TaskLinksState(s);
}

export function newBitrix24TaskLinkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bxt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
