import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "one-c-list-view:";

export type OneCListDensity = "large" | "grid" | "list" | "table";

export type OneCCardDensity = Exclude<OneCListDensity, "table">;

function migrateStoredDensity(raw: string | null, defaultDensity: OneCListDensity): OneCListDensity {
  if (raw === "cards") return "grid";
  if (raw === "large" || raw === "grid" || raw === "list" || raw === "table") return raw;
  return defaultDensity;
}

export function useOneCListDensity(
  storageKey: string,
  defaultDensity: OneCListDensity = "grid",
): {
  density: OneCListDensity;
  setDensity: (density: OneCListDensity) => void;
  effectiveDensity: OneCListDensity;
  narrowViewport: boolean;
} {
  const [density, setDensityState] = useState<OneCListDensity>(() => {
    if (typeof window === "undefined") return defaultDensity;
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    return migrateStoredDensity(stored, defaultDensity);
  });
  const [narrowViewport, setNarrowViewport] = useState(false);

  useEffect(() => {
    const update = () => setNarrowViewport(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const setDensity = useCallback(
    (next: OneCListDensity) => {
      setDensityState(next);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, next);
      }
    },
    [storageKey],
  );

  const effectiveDensity = useMemo(
    () => (density === "table" && narrowViewport ? "list" : density),
    [density, narrowViewport],
  );

  return { density, setDensity, effectiveDensity, narrowViewport };
}

export function readOneCListDensity(storageKey: string): OneCListDensity | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
  if (!stored) return null;
  if (stored === "cards") return "grid";
  if (stored === "large" || stored === "grid" || stored === "list" || stored === "table") return stored;
  return null;
}

export function migrateOneCListDensityValue(raw: string | null): OneCListDensity | null {
  if (!raw) return null;
  if (raw === "cards") return "grid";
  if (raw === "large" || raw === "grid" || raw === "list" || raw === "table") return raw;
  return null;
}
