/** Режим плотности списка ТТ во «Вводе» (компактный / развёрнутый). */

export type DistributionEntryTradePointView = "compact" | "detailed";

export const DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY = "tandoor-distribution-entry-tt-view-v1";

const VALID_VIEWS: readonly DistributionEntryTradePointView[] = ["compact", "detailed"];

export function migrateDistributionEntryTradePointView(
  raw: string,
): DistributionEntryTradePointView | null {
  if (VALID_VIEWS.includes(raw as DistributionEntryTradePointView)) {
    return raw as DistributionEntryTradePointView;
  }
  if (raw === "list") return "compact";
  if (raw === "grid" || raw === "large") return "detailed";
  return null;
}

export function readDistributionEntryTradePointView(
  narrowViewport: boolean,
): DistributionEntryTradePointView {
  if (typeof window === "undefined") {
    return narrowViewport ? "compact" : "detailed";
  }
  try {
    const raw = window.localStorage.getItem(DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY);
    if (raw) {
      const migrated = migrateDistributionEntryTradePointView(raw);
      if (migrated) return migrated;
    }
  } catch {
    /* ignore */
  }
  return narrowViewport ? "compact" : "detailed";
}

export function writeDistributionEntryTradePointView(view: DistributionEntryTradePointView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISTRIBUTION_ENTRY_TP_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}
