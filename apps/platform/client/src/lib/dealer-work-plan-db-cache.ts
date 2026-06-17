/**
 * Кеш рабочего плана из Postgres + синхронизация с UI.
 */

import {
  DEALER_WORK_PLAN_EVENT,
  type DealerWorkPlanScheduleEntry,
  type DealerWorkPlanState,
  loadDealerWorkPlanState,
  saveDealerWorkPlanState,
} from "./dealer-work-plan.js";
import { fetchWorkPlan, itemsToLocalSlice, type WorkPlanItemDto } from "./dealer-work-plan-api.js";

export type UserWorkPlanSlice = {
  hidden: Record<string, true>;
  scheduled: Record<string, DealerWorkPlanScheduleEntry>;
};

const sliceByLocalUserKey: Record<string, UserWorkPlanSlice> = {};
let authUserIdForSession: string | null = null;
let localUserKeyForSession: string | null = null;

export function setWorkPlanSessionKeys(authUserId: string | null, localUserKey: string | null): void {
  authUserIdForSession = authUserId;
  localUserKeyForSession = localUserKey;
}

export function getWorkPlanAuthUserId(): string | null {
  return authUserIdForSession;
}

export function getWorkPlanLocalUserKey(): string | null {
  return localUserKeyForSession;
}

export function setWorkPlanSliceForUser(localUserKey: string, slice: UserWorkPlanSlice | null): void {
  if (slice) sliceByLocalUserKey[localUserKey] = slice;
  else delete sliceByLocalUserKey[localUserKey];
}

export function applyWorkPlanItemsToLocal(localUserKey: string, items: WorkPlanItemDto[]): void {
  const slice = itemsToLocalSlice(items);
  setWorkPlanSliceForUser(localUserKey, slice);
  const state = loadDealerWorkPlanState();
  state.hiddenByUser[localUserKey] = slice.hidden;
  state.scheduledByUser[localUserKey] = slice.scheduled;
  saveDealerWorkPlanState(state);
}

export function notifyWorkPlanChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEALER_WORK_PLAN_EVENT));
  }
}

export function resolveWorkPlanState(state?: DealerWorkPlanState): DealerWorkPlanState {
  const base = state ?? loadDealerWorkPlanState();
  const merged: DealerWorkPlanState = {
    hiddenByUser: { ...base.hiddenByUser },
    scheduledByUser: { ...base.scheduledByUser },
  };
  for (const [key, slice] of Object.entries(sliceByLocalUserKey)) {
    merged.hiddenByUser[key] = slice.hidden;
    merged.scheduledByUser[key] = slice.scheduled;
  }
  return merged;
}

export async function refreshWorkPlanFromApi(localUserKey: string, authUserId?: string): Promise<boolean> {
  const payload = await fetchWorkPlan(authUserId);
  if (!payload) return false;
  applyWorkPlanItemsToLocal(localUserKey, payload.items);
  notifyWorkPlanChanged();
  return true;
}
