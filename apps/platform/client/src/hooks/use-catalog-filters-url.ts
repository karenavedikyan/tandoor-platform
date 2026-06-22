import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildHashWithQuery,
  navigateHashPathInHash,
  stripQuery,
  useHashLocation,
  useHashQuery,
} from "@/lib/hash-location-router";
import type { CatalogFiltersValue } from "@/lib/catalog-facets";

const URL_DEBOUNCE_MS = 300;

export type CatalogSourceFilter = "matrix" | "all";

function paramName(prefix: string | undefined, key: string): string {
  return prefix ? `${prefix}_${key}` : key;
}

function parseList(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function encodeList(values: string[]): string | undefined {
  const t = values.filter(Boolean);
  return t.length > 0 ? t.join(",") : undefined;
}

function parseSource(raw: string | null): CatalogSourceFilter {
  return raw === "matrix" ? "matrix" : "all";
}

function readStateFromParams(
  sp: URLSearchParams,
  prefix: string | undefined,
  syncKeys: string[] | undefined,
): {
  filters: CatalogFiltersValue;
  query: string;
  source: CatalogSourceFilter;
  categories: string[];
} {
  const filters: CatalogFiltersValue = {};
  const catRaw = sp.get(paramName(prefix, "cat"));
  const categories = parseList(catRaw);
  const keys = syncKeys ?? ["brand", "series", "color", "coating", "openType"];
  for (const key of keys) {
    const v = parseList(sp.get(paramName(prefix, key)));
    if (v.length > 0) filters[key] = v;
  }
  const query = sp.get(paramName(prefix, "q")) ?? "";
  const source = parseSource(sp.get(paramName(prefix, "source")));
  return { filters, query, source, categories };
}

function writeStateToParams(
  base: URLSearchParams,
  prefix: string | undefined,
  syncKeys: string[] | undefined,
  state: {
    filters: CatalogFiltersValue;
    query: string;
    source: CatalogSourceFilter;
    categories: string[];
  },
): URLSearchParams {
  const sp = new URLSearchParams(base);
  const keys = new Set([...(syncKeys ?? ["brand", "series", "color", "coating", "openType"]), "cat", "q", "source"]);
  for (const key of keys) {
    sp.delete(paramName(prefix, key));
  }

  const cat = encodeList(state.categories);
  if (cat) sp.set(paramName(prefix, "cat"), cat);

  for (const [key, values] of Object.entries(state.filters)) {
    const encoded = encodeList(values);
    if (encoded) sp.set(paramName(prefix, key), encoded);
  }

  const q = state.query.trim();
  if (q) sp.set(paramName(prefix, "q"), q);

  sp.set(paramName(prefix, "source"), state.source);

  return sp;
}

export function useCatalogFiltersUrl(opts?: {
  prefix?: string;
  syncKeys?: string[];
}): {
  filters: CatalogFiltersValue;
  setFilter: (key: string, next: string[]) => void;
  categories: string[];
  setCategories: (next: string[]) => void;
  query: string;
  setQuery: (q: string) => void;
  source: CatalogSourceFilter;
  setSource: (s: CatalogSourceFilter) => void;
  resetAll: () => void;
  hasUrlSource: boolean;
} {
  const prefix = opts?.prefix;
  const syncKeys = opts?.syncKeys;
  const routeQs = useHashQuery();
  const [loc] = useHashLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlWriteRef = useRef(false);
  const pendingSourceRef = useRef<CatalogSourceFilter | null>(null);

  const parsed = useMemo(
    () => readStateFromParams(routeQs, prefix, syncKeys),
    [routeQs, prefix, syncKeys],
  );

  const [filters, setFilters] = useState<CatalogFiltersValue>(parsed.filters);
  const [categories, setCategoriesState] = useState<string[]>(parsed.categories);
  const [query, setQueryState] = useState(parsed.query);
  const [source, setSourceState] = useState<CatalogSourceFilter>(parsed.source);

  const hasUrlSource = routeQs.has(paramName(prefix, "source"));

  useEffect(() => {
    if (pendingUrlWriteRef.current) return;

    if (pendingSourceRef.current !== null && parsed.source !== pendingSourceRef.current) {
      setFilters(parsed.filters);
      setCategoriesState(parsed.categories);
      setQueryState(parsed.query);
      return;
    }
    if (pendingSourceRef.current !== null && parsed.source === pendingSourceRef.current) {
      pendingSourceRef.current = null;
    }

    setFilters(parsed.filters);
    setCategoriesState(parsed.categories);
    setQueryState(parsed.query);
    setSourceState(parsed.source);
  }, [parsed.filters, parsed.categories, parsed.query, parsed.source]);

  const writeViaHash = useCallback(
    (next: {
      filters: CatalogFiltersValue;
      query: string;
      source: CatalogSourceFilter;
      categories: string[];
    }) => {
      const merged: Record<string, string | undefined> = {};
      routeQs.forEach((v, k) => {
        merged[k] = v;
      });

      const dxKeys = new Set(
        [...(syncKeys ?? ["brand", "series", "color", "coating", "openType"]), "cat", "q", "source"].map(
          (k) => paramName(prefix, k),
        ),
      );
      for (const k of dxKeys) delete merged[k];

      const sp = writeStateToParams(new URLSearchParams(), prefix, syncKeys, next);
      sp.forEach((v, k) => {
        merged[k] = v;
      });

      const path = stripQuery(loc) || "/distribution";
      pendingUrlWriteRef.current = true;
      try {
        navigateHashPathInHash(buildHashWithQuery(path, merged), { replace: true });
      } finally {
        queueMicrotask(() => {
          pendingUrlWriteRef.current = false;
        });
      }
    },
    [loc, prefix, routeQs, syncKeys],
  );

  const pushUrlImmediate = useCallback(
    (next: {
      filters: CatalogFiltersValue;
      query: string;
      source: CatalogSourceFilter;
      categories: string[];
    }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      writeViaHash(next);
    },
    [writeViaHash],
  );

  const pushUrl = useCallback(
    (next: {
      filters: CatalogFiltersValue;
      query: string;
      source: CatalogSourceFilter;
      categories: string[];
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        writeViaHash(next);
      }, URL_DEBOUNCE_MS);
    },
    [writeViaHash],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const setFilter = useCallback(
    (key: string, next: string[]) => {
      setFilters((prev) => {
        const copy = { ...prev };
        if (next.length > 0) copy[key] = next;
        else delete copy[key];
        pushUrl({ filters: copy, query, source, categories });
        return copy;
      });
    },
    [categories, pushUrl, query, source],
  );

  const setCategories = useCallback(
    (next: string[]) => {
      setCategoriesState(next);
      pushUrl({ filters, query, source, categories: next });
    },
    [filters, pushUrl, query, source],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      pushUrl({ filters, query: q, source, categories });
    },
    [categories, filters, pushUrl, source],
  );

  const setSource = useCallback(
    (s: CatalogSourceFilter) => {
      pendingSourceRef.current = s;
      setSourceState(s);
      pushUrlImmediate({ filters, query, source: s, categories });
    },
    [categories, filters, pushUrlImmediate, query],
  );

  const resetAll = useCallback(() => {
    const empty = { filters: {}, query: "", source: "all" as const, categories: [] as string[] };
    pendingSourceRef.current = "all";
    setFilters({});
    setCategoriesState([]);
    setQueryState("");
    setSourceState("all");
    pushUrl(empty);
  }, [pushUrl]);

  return {
    filters,
    setFilter,
    categories,
    setCategories,
    query,
    setQuery,
    source,
    setSource,
    resetAll,
    hasUrlSource,
  };
}

export { parseList, encodeList, paramName, readStateFromParams, writeStateToParams };
