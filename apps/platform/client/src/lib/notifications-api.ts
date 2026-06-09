/**
 * HTTP API in-app уведомлений.
 */

import type { NotificationDto } from "@shared/notifications-handlers";

export type { NotificationDto };

type ApiErr = { success: false; message?: string; code?: string };

function parseApiError(json: { success?: boolean; message?: string }, fallback: string): string {
  if (json.success === false && json.message) return json.message;
  return fallback;
}

export async function listNotifications(opts?: {
  onlyUnread?: boolean;
  limit?: number;
}): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
  const qs = new URLSearchParams();
  if (opts?.onlyUnread) qs.set("unread", "1");
  if (opts?.limit != null) qs.set("limit", String(opts.limit));
  const query = qs.toString();
  const res = await fetch(`/api/notifications/list${query ? `?${query}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as
    | { success: true; notifications: NotificationDto[]; unreadCount: number }
    | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось загрузить уведомления"));
  }
  return { notifications: json.notifications, unreadCount: json.unreadCount };
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetch("/api/notifications/unread-count", {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as { success: true; unreadCount: number } | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось загрузить счётчик уведомлений"));
  }
  return json.unreadCount;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const res = await fetch("/api/notifications/mark-read", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const json = (await res.json()) as { success: true; updated: number } | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось отметить уведомления"));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch("/api/notifications/mark-all-read", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = (await res.json()) as { success: true; updated: number } | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось отметить все уведомления"));
  }
}
