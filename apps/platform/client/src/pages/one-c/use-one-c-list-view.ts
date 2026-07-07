import { useCallback, useState } from "react";

const STORAGE_PREFIX = "one-c-list-view:";

export type OneCListViewMode = "cards" | "table";

export function useOneCListView(
  storageKey: string,
  defaultView: OneCListViewMode = "cards",
): [OneCListViewMode, (view: OneCListViewMode) => void] {
  const [view, setView] = useState<OneCListViewMode>(() => {
    if (typeof window === "undefined") return defaultView;
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (stored === "cards" || stored === "table") return stored;
    return defaultView;
  });

  const setViewAndPersist = useCallback(
    (next: OneCListViewMode) => {
      setView(next);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, next);
      }
    },
    [storageKey],
  );

  return [view, setViewAndPersist];
}

export function readOneCListView(storageKey: string): OneCListViewMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
  if (stored === "cards" || stored === "table") return stored;
  return null;
}
