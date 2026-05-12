import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  loadSalesControlStoredState,
  saveSalesControlStoredState,
  type SalesControlStoredState,
} from "@/lib/sales-control-data";

export function useSalesControlStoredState(): readonly [
  SalesControlStoredState,
  Dispatch<SetStateAction<SalesControlStoredState>>,
] {
  const [stored, setStored] = useState<SalesControlStoredState>(() => loadSalesControlStoredState());

  useEffect(() => {
    saveSalesControlStoredState(stored);
  }, [stored]);

  return [stored, setStored] as const;
}
