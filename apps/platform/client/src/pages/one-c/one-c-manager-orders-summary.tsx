import { useEffect, useState, type ReactElement } from "react";
import {
  fetchOrdersSummaryForManager,
  type OneCManagerOrdersSummary,
} from "@/lib/one-c-bitrix-orders-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatBitrixOrderSummaryMoney,
} from "./one-c-orders-format";

type OneCManagerOrdersSummaryProps = {
  managerId: string;
  scope: "manager" | "rm";
};

export function OneCManagerOrdersSummary({
  managerId,
  scope,
}: OneCManagerOrdersSummaryProps): ReactElement {
  const [summary, setSummary] = useState<OneCManagerOrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchOrdersSummaryForManager(managerId, scope)
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
  }, [managerId, scope]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground" data-testid="one-c-manager-orders-summary-loading">
        Загрузка сводки заказов…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" data-testid="one-c-manager-orders-summary-error">
        {error}
      </p>
    );
  }

  const data = summary ?? {
    count_30d: 0,
    count_90d: 0,
    total_30d: "0",
    total_90d: "0",
    last_order_at: null,
    last_order_number: null,
    active_stores_30d: 0,
    total_stores: 0,
    avg_check_30d: "0",
  };

  const tiles = [
    {
      label: "Активных ТТ (30 дн)",
      value: `${data.active_stores_30d} / ${data.total_stores}`,
      testId: "kpi-active-stores",
    },
    {
      label: "Заказов за 30 дней",
      value: String(data.count_30d),
      sub: formatBitrixOrderSummaryMoney(data.total_30d),
      testId: "kpi-orders-30d",
    },
    {
      label: "Средний чек",
      value: formatBitrixOrderSummaryMoney(data.avg_check_30d),
      testId: "kpi-avg-check",
    },
    {
      label: "Заказов за 90 дней",
      value: String(data.count_90d),
      sub: formatBitrixOrderSummaryMoney(data.total_90d),
      testId: "kpi-orders-90d",
    },
  ];

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid={`one-c-manager-orders-summary-${scope}`}
    >
      {tiles.map((tile) => (
        <Card key={tile.label} data-testid={tile.testId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">{tile.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
            {tile.sub ? (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{tile.sub}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
