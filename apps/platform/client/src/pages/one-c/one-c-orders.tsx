import { useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessOneCShowroomForUser } from "@/lib/auth-access";
import { fetchBitrixOrders, type BitrixOrderListItem } from "@/lib/one-c-bitrix-orders-api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ONE_C_PAGE_LIMIT,
  OneCLoadingBlock,
  OneCPagination,
  OneCPageShell,
  OneCRefreshStubButton,
  OneCSearchInput,
} from "./one-c-ui";
import { OneCListDensityToggle } from "./one-c-list-density-toggle";
import { useOneCListDensity } from "./use-one-c-list-density";
import { useOneCOrdersColumns } from "./use-one-c-orders-columns";
import { OneCOrdersColumnPicker } from "./one-c-orders-column-picker";
import { OneCOrdersTable } from "./one-c-orders-table";
import { BitrixOrderStatusBadge, formatBitrixOrderDateTime, formatBitrixOrderMoney } from "./one-c-orders-format";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

const STATUS_OPTIONS = ["", "Новый", "Закрыт", "Отменён"];

export default function OneCOrdersPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BitrixOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<BitrixOrderListItem[]>([]);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const { density, setDensity, effectiveDensity } = useOneCListDensity("orders", "table");
  const { columns, toggleColumn, reorderColumns, resetColumns } = useOneCOrdersColumns();

  const isAdmin = user?.role === "admin";
  const canAccess = user ? canAccessOneCShowroomForUser(user.role) : false;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, status, dateFrom, dateTo]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    void fetchBitrixOrders({
      search: debouncedSearch,
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: ONE_C_PAGE_LIMIT,
      offset,
      scope: "all",
    })
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
  }, [canAccess, debouncedSearch, status, dateFrom, dateTo, offset]);

  useEffect(() => {
    if (!canAccess || !isAdmin) return;
    let cancelled = false;
    void fetchBitrixOrders({ scope: "unassigned", limit: 50, offset: 0 })
      .then((res) => {
        if (cancelled || !res.success) return;
        setUnassigned(res.orders);
        setUnassignedTotal(res.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canAccess, isAdmin]);

  const statusOptions = useMemo(() => {
    const fromData = new Set(orders.map((o) => o.status).filter(Boolean));
    for (const s of STATUS_OPTIONS) if (s) fromData.add(s);
    return Array.from(fromData);
  }, [orders]);

  if (userLoading) return <OneCLoadingBlock />;
  if (!user || !canAccess) return <Redirect to="/dealer-base" />;

  return (
    <OneCPageShell
      path="/1c/orders"
      title="Заказы 1С"
      subtitle={`${total.toLocaleString("ru-RU")} заказов из выгрузки orders11.xml`}
      testId="page-one-c-orders"
      actions={<OneCRefreshStubButton />}
    >
      {isAdmin && unassignedTotal > 0 ? (
        <Accordion type="single" collapsible className="rounded-md border px-3">
          <AccordionItem value="unassigned" className="border-0">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              Непривязанные заказы ({unassignedTotal})
            </AccordionTrigger>
            <AccordionContent>
              <OneCOrdersTable orders={unassigned} compact testIdPrefix="one-c-orders-unassigned" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OneCListDensityToggle value={density} onChange={setDensity} testIdPrefix="one-c-orders" />
        {effectiveDensity === "table" ? (
          <OneCOrdersColumnPicker
            columns={columns}
            onToggleColumn={toggleColumn}
            onReorderColumns={reorderColumns}
            onResetColumns={resetColumns}
            testIdPrefix="one-c-orders"
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OneCSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Номер, MA, ТТ, юрлицо…"
          testId="input-one-c-orders-search"
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Статус</Label>
          <Select value={status || "__all__"} onValueChange={(v) => setStatus(v === "__all__" ? "" : v)}>
            <SelectTrigger data-testid="select-one-c-orders-status">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все статусы</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="one-c-orders-date-from" className="text-xs text-muted-foreground">
            Период с
          </Label>
          <Input
            id="one-c-orders-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="one-c-orders-date-to" className="text-xs text-muted-foreground">
            по
          </Label>
          <Input id="one-c-orders-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <OneCLoadingBlock />
      ) : effectiveDensity === "table" ? (
        <OneCOrdersTable orders={orders} columns={columns} testIdPrefix="one-c-orders" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.id} data-testid={`one-c-orders-card-${order.id}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">{formatBitrixOrderDateTime(order.created_at_bitrix)}</p>
                  </div>
                  <BitrixOrderStatusBadge status={order.status} />
                </div>
                {order.store ? (
                  <p className="text-sm">
                    <Link href={`/1c/store/${order.store.id_1c}`} className="text-primary hover:underline">
                      {order.store.name}
                    </Link>
                  </p>
                ) : order.legal ? (
                  <p className="text-sm text-muted-foreground">Юрлицо целиком ·{" "}
                    <Link href={`/1c/legal/${order.legal.id_1c}`} className="text-primary hover:underline">
                      {order.legal.name}
                    </Link>
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Не привязан к ТТ / юрлицу</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="tabular-nums font-medium">{formatBitrixOrderMoney(order.total_with_discount)}</span>
                  <span className="text-muted-foreground">{order.items_count} поз.</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OneCPagination
        offset={offset}
        limit={ONE_C_PAGE_LIMIT}
        total={total}
        onOffsetChange={setOffset}
        testIdPrefix="one-c-orders"
      />
    </OneCPageShell>
  );
}
