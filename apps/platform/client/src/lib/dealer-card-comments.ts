/**
 * Комментарии по карточке клиента.
 * Чтение: Postgres (кеш) → fallback localStorage. Запись: LS + awaited API (Промт 114).
 */

import type { UserRole } from "@shared/auth";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { canEditClientNextStep } from "./client-next-step-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { apiCreateComment } from "./client-comments-api.js";
import { refreshDbCommentsForClient, resolveDealerCommentsForClient } from "./client-comments-db-cache.js";
import { enqueuePendingSync, makePendingId } from "./overrides-pending-sync.js";

export const DEALER_CARD_COMMENTS_STORAGE_KEY = "tandoor-dealer-card-comments-v1";
export const DEALER_CARD_COMMENTS_EVENT = "tandoor-dealer-card-comments-changed";

export type DealerCardCommentType = "general" | "problem" | "competitor";

export type DealerCardComment = {
  id: string;
  type: DealerCardCommentType;
  body: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
};

export type DealerCardCommentsState = {
  commentsByDealer: Record<string, DealerCardComment[]>;
};

function emptyState(): DealerCardCommentsState {
  return { commentsByDealer: {} };
}

export function loadDealerCardCommentsState(): DealerCardCommentsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_CARD_COMMENTS_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerCardCommentsState>;
    return {
      commentsByDealer:
        p.commentsByDealer && typeof p.commentsByDealer === "object" ? p.commentsByDealer : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerCardCommentsState(state: DealerCardCommentsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_CARD_COMMENTS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_CARD_COMMENTS_EVENT));
}

export function getDealerComments(dealerId: string, state?: DealerCardCommentsState): DealerCardComment[] {
  const list = state ? [...(state.commentsByDealer[dealerId] ?? [])] : resolveDealerCommentsForClient(dealerId);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function canEditDealerCardComments(
  profile: ReleaseDemoProfile,
  dealer: DealerRow,
  authRole?: UserRole | null,
): boolean {
  return canEditClientNextStep(profile, dealer, authRole);
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

function typeTitle(t: DealerCardCommentType): string {
  if (t === "general") return "Комментарий по клиенту";
  if (t === "problem") return "Комментарий по проблеме";
  return "Комментарий по конкурентам";
}

export async function addDealerComment(
  dealerId: string,
  payload: {
    type: DealerCardCommentType;
    body: string;
    createdBy: string;
    createdByName: string;
  },
): Promise<void> {
  const body = payload.body.trim();
  if (!body) return;
  const state = loadDealerCardCommentsState();
  const prev = state.commentsByDealer[dealerId] ?? [];
  const optimisticId = `dcc-${dealerId}-${Date.now()}`;
  const entry: DealerCardComment = {
    id: optimisticId,
    type: payload.type,
    body,
    createdAt: new Date().toISOString(),
    createdBy: payload.createdBy,
    createdByName: payload.createdByName,
  };
  state.commentsByDealer[dealerId] = [entry, ...prev].slice(0, 120);
  saveDealerCardCommentsState(state);

  const apiBody = {
    clientId: dealerId,
    scope: "dealer" as const,
    type: payload.type,
    body,
    createdByUserId: payload.createdBy,
    createdByName: payload.createdByName,
  };
  const r = await apiCreateComment(apiBody);
  if (r.ok) {
    await refreshDbCommentsForClient(dealerId);
    return;
  }
  enqueuePendingSync({
    id: makePendingId("client-comments-create", optimisticId),
    kind: "client-comments-create",
    payload: { ...apiBody, optimisticId, dealerId },
  });
}

/** События для ленты «История активности». */
export function getDealerCommentsHistoryEvents(dealerId: string, state?: DealerCardCommentsState): {
  id: string;
  meta: string;
  body: string;
  at: string;
}[] {
  return getDealerComments(dealerId, state).map((c) => ({
    id: c.id,
    meta: `${formatMetaRu(c.createdAt, c.createdByName)} · ${typeTitle(c.type)}`,
    body: c.body,
    at: c.createdAt,
  }));
}
