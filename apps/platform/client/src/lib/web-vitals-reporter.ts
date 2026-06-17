/**
 * Web Vitals reporter → POST /api/perf/web-vitals (Промт 382).
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

const ENDPOINT = "/api/perf/web-vitals";

let started = false;

export function isClientWebVitalsEnabled(): boolean {
  const v = import.meta.env?.VITE_WEB_VITALS_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  return true;
}

export function currentAppPathname(): string {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const path = hash.split("?")[0] ?? "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export async function hashUserId(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function readConnectionType(): string | undefined {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  return nav.connection?.effectiveType;
}

export function buildWebVitalsPayload(metric: Metric, role: string, userHash: string) {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    pathname: currentAppPathname(),
    role,
    user_hash: userHash,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    connection: typeof navigator !== "undefined" ? readConnectionType() : undefined,
    viewport_width: typeof window !== "undefined" ? window.innerWidth : 0,
    timestamp: Date.now(),
  };
}

export function sendWebVitalsMetric(metric: Metric, role: string, userHash: string): void {
  const body = JSON.stringify(buildWebVitalsPayload(metric, role, userHash));
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(ENDPOINT, blob);
    return;
  }
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  });
}

export function initWebVitalsReporter(userId: string, role: string): void {
  if (!isClientWebVitalsEnabled() || started || typeof window === "undefined") return;
  started = true;

  void hashUserId(userId).then((userHash) => {
    const report = (metric: Metric) => sendWebVitalsMetric(metric, role, userHash);
    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  });
}

export function resetWebVitalsReporterForTests(): void {
  started = false;
}
