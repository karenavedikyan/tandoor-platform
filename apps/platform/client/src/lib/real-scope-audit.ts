/**
 * Промт 338: rate-limited телеметрия demo-fallback на путях, доступных real-юзерам.
 * Не меняет рантайм-поведение — только собирает агрегированные события.
 */

import type { ReleaseDemoProfile } from "./release-demo-profile.js";

export type RealScopeAuditEvent = {
  callSite: string;
  profileRole: ReleaseDemoProfile["role"];
  personaUserId: string;
  realUserId?: string | null;
  reason: "demo-fallback-for-real-user" | "no-org-snapshot" | "demo-persona";
};

export type RealScopeAuditAggregatedEvent = RealScopeAuditEvent & { eventCount: number };

declare global {
  // eslint-disable-next-line no-var
  var __REAL_SCOPE_AUDIT_BUFFER__: RealScopeAuditAggregatedEvent[] | undefined;
}

const FLUSH_INTERVAL_MS = 5000;
const AUDIT_ENDPOINT = "/api/diag/real-scope-audit";

const aggregateMap = new Map<string, RealScopeAuditAggregatedEvent>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushAt: number | null = null;
let unloadListenerAttached = false;
let contextRealUserId: string | null = null;

function browserWindow(): Window | undefined {
  if (typeof globalThis === "undefined") return undefined;
  return globalThis.window;
}

function auditKey(event: RealScopeAuditEvent): string {
  return `${event.callSite}|${event.profileRole}|${event.reason}|${event.personaUserId}`;
}

function appendToTestBuffer(entry: RealScopeAuditAggregatedEvent): void {
  if (!globalThis.__REAL_SCOPE_AUDIT_BUFFER__) {
    globalThis.__REAL_SCOPE_AUDIT_BUFFER__ = [];
  }
  globalThis.__REAL_SCOPE_AUDIT_BUFFER__.push({ ...entry });
}

/** Для тестов: сброс буфера и агрегата. */
export function clearRealScopeAuditBufferForTests(): void {
  aggregateMap.clear();
  globalThis.__REAL_SCOPE_AUDIT_BUFFER__ = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  lastFlushAt = null;
  unloadListenerAttached = false;
}

/** Опционально: UUID серверного пользователя для payload (из auth-хука). */
export function setRealScopeAuditUserId(userId: string | null | undefined): void {
  contextRealUserId = userId?.trim() || null;
}

function scheduleFlush(): void {
  if (!browserWindow()) return;
  if (flushTimer) return;
  const elapsed = lastFlushAt == null ? 0 : Date.now() - lastFlushAt;
  const delay = Math.max(0, FLUSH_INTERVAL_MS - elapsed);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushRealScopeAuditQueue();
  }, delay);
}

function sendPayload(body: string): void {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(AUDIT_ENDPOINT, blob);
    return;
  }
  void fetch(AUDIT_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    credentials: "include",
  }).catch(() => undefined);
}

export function flushRealScopeAuditQueue(): void {
  try {
    if (aggregateMap.size === 0) return;
    if (!browserWindow()) return;
    const events = Array.from(aggregateMap.values());
    aggregateMap.clear();
    lastFlushAt = Date.now();

    const payload = JSON.stringify({
      events,
      userId: contextRealUserId,
      timestamp: Date.now(),
    });
    sendPayload(payload);
  } catch {
    // never throw
  }
}

export function attachRealScopeAuditUnloadFlush(): void {
  const win = browserWindow();
  if (!win || unloadListenerAttached) return;
  if (typeof win.addEventListener !== "function") return;
  unloadListenerAttached = true;
  const flush = () => flushRealScopeAuditQueue();
  win.addEventListener("pagehide", flush);
  win.addEventListener("beforeunload", flush);
}

export function logRealScopeAudit(event: RealScopeAuditEvent): void {
  try {
    attachRealScopeAuditUnloadFlush();
    const enriched: RealScopeAuditEvent = {
      ...event,
      realUserId: event.realUserId ?? contextRealUserId,
    };
    const key = auditKey(enriched);
    const existing = aggregateMap.get(key);
    if (existing) {
      existing.eventCount += 1;
    } else {
      aggregateMap.set(key, { ...enriched, eventCount: 1 });
    }
    appendToTestBuffer(aggregateMap.get(key)!);
    scheduleFlush();
  } catch {
    // never throw
  }
}
