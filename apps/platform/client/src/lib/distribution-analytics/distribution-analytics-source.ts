import type { UserRole } from "@shared/auth";

export type DistributionAnalyticsSource = "one-c" | "legacy";

export function resolveDistributionAnalyticsSource(
  role: UserRole | undefined,
  qs?: URLSearchParams,
): DistributionAnalyticsSource {
  if (role !== "admin") return "one-c";
  if (qs?.get("source") === "legacy") return "legacy";
  return "one-c";
}

export function readDistributionAnalyticsSourceFromHash(hash: string): URLSearchParams {
  const query = hash.includes("?") ? hash.split("?")[1] ?? "" : "";
  return new URLSearchParams(query);
}
