import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ORDER_COLUMNS,
  ONE_C_ORDERS_COLUMNS_STORAGE_KEY,
  mergeOrderColumnsState,
  parseOrderColumnsState,
  reorderOrderColumns,
  toggleOrderColumn,
  type OrderColumnKey,
  type OrderColumnsState,
} from "./one-c-orders-columns";

function readColumnsFromStorage(): OrderColumnsState {
  if (typeof window === "undefined") return DEFAULT_ORDER_COLUMNS.map((c) => ({ ...c }));
  const saved = parseOrderColumnsState(localStorage.getItem(ONE_C_ORDERS_COLUMNS_STORAGE_KEY));
  return mergeOrderColumnsState(saved);
}

export function useOneCOrdersColumns(): {
  columns: OrderColumnsState;
  toggleColumn: (key: OrderColumnKey) => void;
  reorderColumns: (fromIdx: number, toIdx: number) => void;
  resetColumns: () => void;
} {
  const [columns, setColumnsState] = useState<OrderColumnsState>(readColumnsFromStorage);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ONE_C_ORDERS_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const toggleColumn = useCallback((key: OrderColumnKey) => {
    setColumnsState((prev) => toggleOrderColumn(prev, key));
  }, []);

  const reorderColumns = useCallback((fromIdx: number, toIdx: number) => {
    setColumnsState((prev) => reorderOrderColumns(prev, fromIdx, toIdx));
  }, []);

  const resetColumns = useCallback(() => {
    setColumnsState(DEFAULT_ORDER_COLUMNS.map((c) => ({ ...c })));
  }, []);

  return { columns, toggleColumn, reorderColumns, resetColumns };
}
