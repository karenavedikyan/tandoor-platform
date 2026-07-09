export const DISTRIBUTION_ENTRY_DEBUG =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("debugDistribution") === "1" ||
    window.localStorage?.getItem("tandoor.debugDistribution") === "1");

export function isDistributionDebugEnabled(): boolean {
  return DISTRIBUTION_ENTRY_DEBUG;
}
