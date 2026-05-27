import { createContext, useContext } from "react";

const DealerCardReadOnlyContext = createContext(false);

export const DealerCardReadOnlyProvider = DealerCardReadOnlyContext.Provider;

export function useDealerCardReadOnly(): boolean {
  return useContext(DealerCardReadOnlyContext);
}
