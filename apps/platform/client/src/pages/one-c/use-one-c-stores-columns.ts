import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_STORE_COLUMNS,
  ONE_C_STORES_COLUMNS_STORAGE_KEY,
  mergeStoreColumnsState,
  parseStoreColumnsState,
  reorderStoreColumns,
  toggleStoreColumn,
  type StoreColumnKey,
  type StoreColumnsState,
} from "./one-c-stores-columns";

function readColumnsFromStorage(): StoreColumnsState {
  if (typeof window === "undefined") return DEFAULT_STORE_COLUMNS.map((c) => ({ ...c }));
  const saved = parseStoreColumnsState(localStorage.getItem(ONE_C_STORES_COLUMNS_STORAGE_KEY));
  return mergeStoreColumnsState(saved);
}

function persistColumns(columns: StoreColumnsState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONE_C_STORES_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
}

export function useOneCStoresColumns(): {
  columns: StoreColumnsState;
  setColumns: (next: StoreColumnsState) => void;
  toggleColumn: (key: StoreColumnKey) => void;
  reorderColumns: (fromIdx: number, toIdx: number) => void;
  resetColumns: () => void;
} {
  const [columns, setColumnsState] = useState<StoreColumnsState>(readColumnsFromStorage);

  useEffect(() => {
    persistColumns(columns);
  }, [columns]);

  const setColumns = useCallback((next: StoreColumnsState) => {
    setColumnsState(mergeStoreColumnsState(next));
  }, []);

  const toggleColumn = useCallback((key: StoreColumnKey) => {
    setColumnsState((prev) => toggleStoreColumn(prev, key));
  }, []);

  const reorderColumns = useCallback((fromIdx: number, toIdx: number) => {
    setColumnsState((prev) => reorderStoreColumns(prev, fromIdx, toIdx));
  }, []);

  const resetColumns = useCallback(() => {
    setColumnsState(DEFAULT_STORE_COLUMNS.map((c) => ({ ...c })));
  }, []);

  return { columns, setColumns, toggleColumn, reorderColumns, resetColumns };
}
