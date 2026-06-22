import { useMemo, useRef } from "react";

/** Content-key for string arrays — stable while sorted join matches. */
export function useStableSortedJoin(value: readonly string[] | undefined): string {
  const ref = useRef<string>("");
  const next = value ? [...value].sort().join(",") : "";
  if (ref.current !== next) ref.current = next;
  return ref.current;
}

/** Set reference stable while array contents match (react-query refetch safe). */
export function useStableSet(value: readonly string[] | undefined): Set<string> {
  const key = useStableSortedJoin(value);
  return useMemo(() => new Set(value ?? []), [key]);
}

/** Array reference stable while item ids set matches (order-independent). */
export function useStableArrayByIds<T extends { id: string }>(items: readonly T[]): T[] {
  const idsKey = useStableSortedJoin(items.map((item) => item.id));
  const stableRef = useRef<T[]>([]);
  const keyRef = useRef("");
  return useMemo(() => {
    if (keyRef.current === idsKey) return stableRef.current;
    keyRef.current = idsKey;
    stableRef.current = items as T[];
    return stableRef.current;
  }, [idsKey, items]);
}
