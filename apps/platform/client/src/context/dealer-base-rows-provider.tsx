/**
 * Prefetch каталога клиентов для authenticated shell (Промт 376).
 */

import { useEffect, type ReactNode } from "react";
import { setDealerBaseRowsCache, useDealerBaseRows } from "@/lib/dealer-base-source";

export function DealerBaseRowsProvider({ children }: { children: ReactNode }) {
  const q = useDealerBaseRows();

  useEffect(() => {
    if (q.data && q.data.length > 0) {
      setDealerBaseRowsCache(q.data);
    }
  }, [q.data]);

  return <>{children}</>;
}
