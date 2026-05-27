import { createContext, useContext } from "react";

const TradePointReadOnlyContext = createContext(false);

export const TradePointReadOnlyProvider = TradePointReadOnlyContext.Provider;

export function useTradePointReadOnly(): boolean {
  return useContext(TradePointReadOnlyContext);
}
