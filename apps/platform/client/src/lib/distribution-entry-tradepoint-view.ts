/** Режим плотности списка ТТ во «Вводе» (как на странице торговых точек). */

export type DistributionEntryTradePointView = "large" | "grid" | "list";

export const DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY = "tandoor-distribution-entry-tt-view-v1";

export function readDistributionEntryTradePointView(
  narrowViewport: boolean,
): DistributionEntryTradePointView {
  if (typeof window === "undefined") {
    return narrowViewport ? "grid" : "large";
  }
  try {
    const raw = window.localStorage.getItem(DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY);
    if (raw === "large" || raw === "grid" || raw === "list") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return narrowViewport ? "grid" : "large";
}

export function writeDistributionEntryTradePointView(view: DistributionEntryTradePointView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}
