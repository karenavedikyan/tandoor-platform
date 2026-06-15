/**
 * Запуск: `npm run test:real-scope-audit` из каталога apps/platform.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRealScopeAuditBufferForTests,
  flushRealScopeAuditQueue,
  logRealScopeAudit,
  setRealScopeAuditUserId,
} from "../real-scope-audit";

describe("real-scope-audit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRealScopeAuditBufferForTests();
    setRealScopeAuditUserId(null);
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("накапливает события в __REAL_SCOPE_AUDIT_BUFFER__", () => {
    logRealScopeAudit({
      callSite: "test@unit",
      profileRole: "team_lead",
      personaUserId: "user-tl-kupiansky",
      reason: "demo-fallback-for-real-user",
    });
    expect(globalThis.__REAL_SCOPE_AUDIT_BUFFER__).toHaveLength(1);
    expect(globalThis.__REAL_SCOPE_AUDIT_BUFFER__![0].eventCount).toBe(1);
  });

  it("агрегирует count по ключу callSite|role|reason|persona", () => {
    const event = {
      callSite: "roleScopedDealerRows@dealer-base-role-views",
      profileRole: "team_lead" as const,
      personaUserId: "user-tl-kupiansky",
      reason: "demo-fallback-for-real-user" as const,
    };
    logRealScopeAudit(event);
    logRealScopeAudit(event);
    expect(globalThis.__REAL_SCOPE_AUDIT_BUFFER__).toHaveLength(2);
    expect(globalThis.__REAL_SCOPE_AUDIT_BUFFER__![1].eventCount).toBe(2);
  });

  it("rate-limit: flush не чаще 1 раза в 5s", () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });

    logRealScopeAudit({
      callSite: "a@x",
      profileRole: "team_lead",
      personaUserId: "p1",
      reason: "demo-fallback-for-real-user",
    });
    vi.advanceTimersByTime(4999);
    expect(beacon).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(beacon).toHaveBeenCalledTimes(1);

    logRealScopeAudit({
      callSite: "b@x",
      profileRole: "team_lead",
      personaUserId: "p2",
      reason: "demo-fallback-for-real-user",
    });
    vi.advanceTimersByTime(5000);
    expect(beacon).toHaveBeenCalledTimes(2);
  });

  it("fallback на fetch при отсутствии sendBeacon", () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    logRealScopeAudit({
      callSite: "fetch@x",
      profileRole: "team_lead",
      personaUserId: "user-tl-kupiansky",
      reason: "demo-fallback-for-real-user",
    });
    flushRealScopeAuditQueue();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/diag/real-scope-audit");
    expect(init.keepalive).toBe(true);
  });

  it("flush вручную отправляет батч и очищает очередь", () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });

    setRealScopeAuditUserId("user-uuid-1");
    logRealScopeAudit({
      callSite: "manual@x",
      profileRole: "team_lead",
      personaUserId: "user-tl-kupiansky",
      reason: "demo-fallback-for-real-user",
    });
    flushRealScopeAuditQueue();

    expect(beacon).toHaveBeenCalledTimes(1);
    const blob = beacon.mock.calls[0][1] as Blob;
    expect(blob.type).toBe("application/json");
  });

  it("не бросает при ошибке sendBeacon", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("beacon fail");
      },
    });
    expect(() => {
      logRealScopeAudit({
        callSite: "safe@x",
        profileRole: "team_lead",
        personaUserId: "p",
        reason: "demo-fallback-for-real-user",
      });
      flushRealScopeAuditQueue();
    }).not.toThrow();
  });
});
