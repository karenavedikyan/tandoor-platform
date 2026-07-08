import { useEffect, useState, type ReactElement } from "react";
import { Link } from "wouter";
import {
  fetchBitrixOrdersForLegal,
  fetchBitrixOrdersForStore,
  type BitrixOrderListItem,
} from "@/lib/one-c-bitrix-orders-api";
import { Button } from "@/components/ui/button";
import { OneCDetailSection } from "./one-c-ui";
import { OneCOrdersTable } from "./one-c-orders-table";

type OneCOrdersSectionProps = {
  mode: "store" | "legal";
  entityId1c: string;
  testIdPrefix?: string;
};

const PAGE_SIZE = 20;

export function OneCOrdersSection({
  mode,
  entityId1c,
  testIdPrefix = "one-c-orders-section",
}: OneCOrdersSectionProps): ReactElement | null {
  const [orders, setOrders] = useState<BitrixOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      mode === "store"
        ? fetchBitrixOrdersForStore(entityId1c, { limit })
        : fetchBitrixOrdersForLegal(entityId1c, { limit });

    void fetcher
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить заказы.");
          return;
        }
        setOrders(res.orders);
        setTotal(res.total);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, entityId1c, limit]);

  if (!loading && total === 0 && !error) return null;

  return (
    <OneCDetailSection title={`Заказы${total > 0 ? ` (${total})` : ""}`} testId={`${testIdPrefix}-section`}>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Загрузка заказов…</p> : null}
      {!loading && orders.length > 0 ? (
        <div className="space-y-3">
          <OneCOrdersTable
            orders={orders}
            compact
            showStoreColumn={mode === "legal"}
            showLegalColumn={false}
            storeWholeLegalLabel={mode === "legal"}
            testIdPrefix={testIdPrefix}
          />
          {total > limit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLimit(total)}>
                Показать все ({total})
              </Button>
              {mode === "legal" ? (
                <Link href="/1c/orders" className="text-sm text-primary hover:underline">
                  Все заказы →
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!loading && total === 0 && !error ? (
        <p className="text-sm text-muted-foreground">Заказов нет.</p>
      ) : null}
    </OneCDetailSection>
  );
}
