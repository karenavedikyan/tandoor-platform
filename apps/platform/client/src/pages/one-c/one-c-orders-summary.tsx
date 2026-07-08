import { useEffect, useState, type ReactElement } from "react";
import {
  fetchOrdersSummaryForLegal,
  fetchOrdersSummaryForStore,
  type OneCOrdersSummary,
} from "@/lib/one-c-bitrix-orders-api";
import { cn } from "@/lib/utils";
import {
  formatBitrixOrderCount,
  formatBitrixOrderSummaryDate,
  formatBitrixOrderSummaryMoney,
} from "./one-c-orders-format";

type OneCOrdersSummaryProps = {
  mode: "store" | "legal";
  entityId1c: string;
};

export function OneCOrdersSummary({ mode, entityId1c }: OneCOrdersSummaryProps): ReactElement {
  const [summary, setSummary] = useState<OneCOrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      mode === "store"
        ? fetchOrdersSummaryForStore(entityId1c)
        : fetchOrdersSummaryForLegal(entityId1c);

    void fetcher
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.message ?? "Не удалось загрузить сводку заказов.");
          setSummary(null);
          return;
        }
        setSummary(res.summary);
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
  }, [mode, entityId1c]);

  if (loading) {
    return (
      <div
        className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
        data-testid={`one-c-orders-summary-${mode}-loading`}
      >
        Загрузка сводки заказов…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        data-testid={`one-c-orders-summary-${mode}-error`}
      >
        {error}
      </div>
    );
  }

  const data = summary ?? {
    count_30d: 0,
    count_90d: 0,
    total_30d: "0",
    total_90d: "0",
    last_order_at: null,
    last_order_number: null,
  };

  const isDead = data.count_90d === 0;
  const isStale = !isDead && data.count_30d === 0;

  return (
    <div
      className={cn(
        "mb-3 rounded-md border px-3 py-2 text-sm",
        isDead && "border-destructive text-destructive",
        isStale && "border-amber-500 text-amber-700 dark:text-amber-400",
        !isDead && !isStale && "border-border text-foreground",
      )}
      data-testid={`one-c-orders-summary-${mode}`}
    >
      {isDead ? (
        <p>Нет заказов за 90 дней</p>
      ) : (
        <div className="space-y-1">
          {isStale ? <p>Нет заказов за 30 дней</p> : null}
          <p>
            За 30 дней: {formatBitrixOrderCount(data.count_30d)} ·{" "}
            {formatBitrixOrderSummaryMoney(data.total_30d)}
          </p>
          <p>
            За 90 дней: {formatBitrixOrderCount(data.count_90d)} ·{" "}
            {formatBitrixOrderSummaryMoney(data.total_90d)}
          </p>
          <p className="text-muted-foreground">
            Последний заказ
            {data.last_order_number ? `: №${data.last_order_number}` : ""} ·{" "}
            {formatBitrixOrderSummaryDate(data.last_order_at)}
          </p>
        </div>
      )}
    </div>
  );
}
