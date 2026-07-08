import { useEffect, useMemo, useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessClients1cForUser } from "@/lib/auth-access";
import {
  clients1cOrderToBitrixListItem,
  fetchClients1cHolding,
  type Clients1cHoldingResponse,
} from "@/lib/clients-1c-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import {
  OneCLoadingBlock,
  OneCPageShell,
  OneCDetailSection,
  dash,
} from "@/pages/one-c/one-c-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { OneCOrdersTable } from "@/pages/one-c/one-c-orders-table";
import { Clients1cRefreshButton } from "./clients-1c-refresh-button";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function Clients1cHoldingPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [, params] = useRoute("/clients-1c/:holdingId");
  const holdingId = params?.holdingId ?? "";
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Clients1cHoldingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user ? canAccessClients1cForUser(user.role) : false;

  useEffect(() => {
    if (!canAccess || !holdingId) return;
    let cancelled = false;
    setLoading(true);
    void fetchClients1cHolding(holdingId)
      .then((res) => {
        if (cancelled) return;
        if (!("ok" in res) || !res.ok) {
          setError("message" in res ? res.message ?? "Клиент не найден." : "Ошибка");
          setData(null);
          return;
        }
        setData(res);
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
  }, [canAccess, holdingId, reloadKey]);

  const ordersForTable = useMemo(
    () => (data?.orders ?? []).map(clients1cOrderToBitrixListItem),
    [data?.orders],
  );

  const distKinds = useMemo(
    () => Object.entries(data?.distributionSummary ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [data?.distributionSummary],
  );

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;
  if (!holdingId) return <Redirect to="/clients-1c" />;

  const holding = data?.holding;

  return (
    <OneCPageShell
      path={`/clients-1c/${holdingId}`}
      breadcrumbLabels={{ holding: holding?.holding_name ?? "Клиент" }}
      title={holding?.holding_name ?? "Клиент"}
      subtitle={
        holding
          ? [
              holding.holding_inn ? `ИНН ${holding.holding_inn}` : null,
              holding.holding_city,
              holding.holding_region,
              `${holding.stores_count} ТТ · ${holding.legals_count} ЮЛ`,
              holding.refreshed_at ? `обновлено ${formatDisplayDateTime(holding.refreshed_at)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      testId="page-clients-1c-holding"
      actions={<Clients1cRefreshButton onRefreshed={() => setReloadKey((k) => k + 1)} />}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : !holding ? (
        <p className="text-muted-foreground">Клиент не найден</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="ТТ" value={String(holding.stores_count)} />
            <KpiCard
              label="Дистрибуция"
              value={`${holding.distribution_percent}%`}
              hint={`${holding.distribution_filled_count}/${holding.distribution_total_targets}`}
            />
            <KpiCard
              label="Заказы 90д"
              value={formatMoney(holding.orders_last_90d_amount)}
              hint={`${holding.orders_last_90d_count} заказов`}
            />
            <KpiCard
              label="Последний заказ"
              value={holding.last_order_at ? formatDisplayDateTime(holding.last_order_at) : "—"}
            />
          </div>

          <OneCDetailSection title="Ответственные" testId="section-clients-1c-managers">
            <p className="text-sm">
              Менеджеры: {holding.responsible_managers.filter(Boolean).join(", ") || "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              Регионалы: {holding.regional_managers.filter(Boolean).join(", ") || "—"}
            </p>
          </OneCDetailSection>

          <Tabs defaultValue="stores">
            <TabsList>
              <TabsTrigger value="stores">ТТ</TabsTrigger>
              <TabsTrigger value="distribution">Дистрибуция</TabsTrigger>
              <TabsTrigger value="orders">Заказы</TabsTrigger>
            </TabsList>

            <TabsContent value="stores" className="mt-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ТТ</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead>ЮЛ</TableHead>
                      <TableHead>Менеджер ТТ</TableHead>
                      <TableHead>Дистрибуция</TableHead>
                      <TableHead>Заказы 90д</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.stores ?? []).map((store) => (
                      <TableRow key={store.store_id_1c}>
                        <TableCell>
                          <Link
                            href={`/clients-1c/${holdingId}/tp/${store.store_id_1c}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {dash(store.store_name)}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[240px] text-sm">{dash(store.store_address)}</TableCell>
                        <TableCell className="text-sm">
                          <div>{dash(store.legal_name)}</div>
                          <div className="text-xs text-muted-foreground">{store.legal_inn ? `ИНН ${store.legal_inn}` : "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{dash(store.store_manager_name)}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <div className="text-sm tabular-nums">{store.distribution_percent}%</div>
                          <Progress value={store.distribution_percent} className="mt-1 h-2" />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {store.orders_last_90d_count} · {formatMoney(store.orders_last_90d_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="distribution" className="mt-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип цели</TableHead>
                      <TableHead className="text-right">Всего</TableHead>
                      <TableHead className="text-right">Заполнено</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distKinds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          Нет данных по дистрибуции
                        </TableCell>
                      </TableRow>
                    ) : (
                      distKinds.map(([kind, summary]) => (
                        <TableRow key={kind}>
                          <TableCell>{kind}</TableCell>
                          <TableCell className="text-right tabular-nums">{summary.total}</TableCell>
                          <TableCell className="text-right tabular-nums">{summary.filled}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <OneCOrdersTable
                orders={ordersForTable}
                showStoreColumn
                showLegalColumn={false}
                emptyLabel="Заказов за 90 дней нет"
                testIdPrefix="clients-1c-holding"
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </OneCPageShell>
  );
}
