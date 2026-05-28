/**
 * HTTP API рабочего плана клиентов (Postgres).
 */

import type { DealerWorkPlanScheduleEntry, DealerWorkPlanState } from "@/lib/dealer-work-plan";

export const DEALER_WORK_PLAN_MIGRATED_KEY_PREFIX = "tandoor-dealer-work-plan-migrated-v1-";

export type WorkPlanItemDto = {
  dealerId: string;
  isHidden: boolean;
  scheduledDate: string | null;
  scheduledNote: string | null;
  scheduledUpdatedAt: string | null;
};

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function itemsToLocalSlice(items: WorkPlanItemDto[]): {
  hidden: Record<string, true>;
  scheduled: Record<string, DealerWorkPlanScheduleEntry>;
} {
  const hidden: Record<string, true> = {};
  const scheduled: Record<string, DealerWorkPlanScheduleEntry> = {};
  for (const item of items) {
    if (item.isHidden) hidden[item.dealerId] = true;
    if (item.scheduledDate) {
      scheduled[item.dealerId] = {
        date: item.scheduledDate,
        ...(item.scheduledNote ? { note: item.scheduledNote } : {}),
        updatedAt: item.scheduledUpdatedAt ?? new Date().toISOString(),
      };
    }
  }
  return { hidden, scheduled };
}

export async function fetchWorkPlan(userId?: string): Promise<{ userId: string; items: WorkPlanItemDto[] } | null> {
  try {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`/api/dealer-work-plan/list${q}`, { credentials: "include", cache: "no-store" });
    const data = await parseJson<ApiOk<{ userId: string; items: WorkPlanItemDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return { userId: data.userId, items: data.items };
  } catch {
    return null;
  }
}

export async function apiHide(dealerIds: string[]): Promise<boolean> {
  const res = await fetch("/api/dealer-work-plan/hide", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealerIds }),
  });
  return res.ok;
}

export async function apiRestore(dealerIds: string[]): Promise<boolean> {
  const res = await fetch("/api/dealer-work-plan/restore", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealerIds }),
  });
  return res.ok;
}

export async function apiSchedule(dealerIds: string[], date: string, note?: string): Promise<boolean> {
  const res = await fetch("/api/dealer-work-plan/schedule", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealerIds, date, note }),
  });
  return res.ok;
}

export async function apiClearSchedule(dealerIds: string[]): Promise<boolean> {
  const res = await fetch("/api/dealer-work-plan/clear-schedule", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealerIds }),
  });
  return res.ok;
}

export async function apiBulkImport(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  const res = await fetch("/api/dealer-work-plan/bulk-import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok || res.status === 409, status: res.status };
}

export function buildBulkImportPayloadFromLocal(
  authUserId: string,
  localUserKey: string,
  local: DealerWorkPlanState,
): Record<string, unknown> {
  return {
    userId: authUserId,
    hiddenByUser: { [localUserKey]: local.hiddenByUser[localUserKey] ?? {} },
    scheduledByUser: { [localUserKey]: local.scheduledByUser[localUserKey] ?? {} },
  };
}
