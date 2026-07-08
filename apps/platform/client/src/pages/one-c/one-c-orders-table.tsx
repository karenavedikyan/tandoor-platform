import { Fragment, useState, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  fetchBitrixOrder,
  type BitrixOrderDetail,
  type BitrixOrderListItem,
} from "@/lib/one-c-bitrix-orders-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dash } from "./one-c-ui";
import {
  BitrixOrderStatusBadge,
  formatBitrixOrderDateTime,
  formatBitrixOrderMoney,
} from "./one-c-orders-format";
import { ORDER_COLUMN_LABELS, DEFAULT_ORDER_COLUMNS, type OrderColumnKey, type OrderColumnsState } from "./one-c-orders-columns";

type OneCOrdersTableProps = {
  orders: BitrixOrderListItem[];
  columns?: OrderColumnsState;
  showStoreColumn?: boolean;
  showLegalColumn?: boolean;
  storeWholeLegalLabel?: boolean;
  compact?: boolean;
  emptyLabel?: string;
  testIdPrefix?: string;
};

function visibleColumns(
  columns: OrderColumnsState | undefined,
  opts: { showStoreColumn: boolean; showLegalColumn: boolean },
): OrderColumnsState {
  const base = columns ?? DEFAULT_ORDER_COLUMNS;
  return base.filter((c) => {
    if (!c.visible) return false;
    if (c.key === "store" && !opts.showStoreColumn) return false;
    if (c.key === "legal" && !opts.showLegalColumn) return false;
    return true;
  });
}

function OrderDetailPanel({ detail }: { detail: BitrixOrderDetail }): ReactElement {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Клиент MA:</span> {dash(detail.client_number_1c)}
        </p>
        <p>
          <span className="text-muted-foreground">Оплата:</span> {dash(detail.payment_method)}
          {detail.payment_percent != null ? ` (${detail.payment_percent}%)` : ""}
        </p>
        <p className="sm:col-span-2">
          <span className="text-muted-foreground">Адрес доставки:</span> {dash(detail.delivery_address)}
        </p>
      </div>
      {detail.items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Товар</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Скидка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.map((item) => (
              <TableRow key={item.line_no}>
                <TableCell>{item.line_no}</TableCell>
                <TableCell>
                  <div className="font-medium">{dash(item.product_name ?? item.product_name_1c)}</div>
                  {item.supply_variant ? (
                    <div className="text-xs text-muted-foreground">{item.supply_variant}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBitrixOrderMoney(item.price_no_discount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBitrixOrderMoney(item.discount_per_item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">Позиции не найдены.</p>
      )}
    </div>
  );
}

function renderCell(
  key: OrderColumnKey,
  order: BitrixOrderListItem,
  opts: { showStoreColumn: boolean; showLegalColumn: boolean; storeWholeLegalLabel: boolean },
): ReactNode {
  switch (key) {
    case "order_number":
      return <span className="font-medium">{order.order_number}</span>;
    case "created_at":
      return <span className="tabular-nums text-muted-foreground">{formatBitrixOrderDateTime(order.created_at_bitrix)}</span>;
    case "status":
      return <BitrixOrderStatusBadge status={order.status} />;
    case "store":
      if (!opts.showStoreColumn) return null;
      if (order.store) {
        return (
          <Link href={`/1c/store/${order.store.id_1c}`} className="text-primary hover:underline">
            {order.store.name}
            {order.store.city ? ` · ${order.store.city}` : ""}
          </Link>
        );
      }
      return opts.storeWholeLegalLabel ? (
        <span className="text-muted-foreground">Юрлицо целиком</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "legal":
      if (!opts.showLegalColumn) return null;
      return order.legal ? (
        <Link href={`/1c/legal/${order.legal.id_1c}`} className="text-primary hover:underline">
          {order.legal.name}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "manager":
      return dash(order.manager?.name);
    case "total":
      return <span className="tabular-nums font-medium">{formatBitrixOrderMoney(order.total_with_discount)}</span>;
    case "items_count":
      return <span className="tabular-nums">{order.items_count}</span>;
    case "delivery":
      return dash(order.delivery_type);
    default:
      return null;
  }
}

export function OneCOrdersTable({
  orders,
  columns,
  showStoreColumn = true,
  showLegalColumn = true,
  storeWholeLegalLabel = false,
  compact = false,
  emptyLabel = "Заказы не найдены",
  testIdPrefix = "one-c-orders",
}: OneCOrdersTableProps): ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, BitrixOrderDetail>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const cols = visibleColumns(columns, { showStoreColumn, showLegalColumn });
  const cellOpts = { showStoreColumn, showLegalColumn, storeWholeLegalLabel };

  async function toggleExpand(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (detailById[orderId]) return;
    setLoadingId(orderId);
    try {
      const res = await fetchBitrixOrder(orderId);
      if (res.success && res.order) {
        setDetailById((prev) => ({ ...prev, [orderId]: res.order }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border" data-testid={`table-${testIdPrefix}`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            {cols.map((col) => (
              <TableHead key={col.key} className={cn(col.key === "total" || col.key === "items_count" ? "text-right" : undefined)}>
                {ORDER_COLUMN_LABELS[col.key]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const open = expandedId === order.id;
            return (
              <Fragment key={order.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => void toggleExpand(order.id)}
                  data-testid={`${testIdPrefix}-row-${order.id}`}
                >
                  <TableCell className="px-2">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  {cols.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        compact && "py-2 text-sm",
                        col.key === "total" || col.key === "items_count" ? "text-right" : undefined,
                      )}
                    >
                      {renderCell(col.key, order, cellOpts)}
                    </TableCell>
                  ))}
                </TableRow>
                {open ? (
                  <TableRow>
                    <TableCell colSpan={cols.length + 1} className="bg-muted/10 p-3">
                      {loadingId === order.id ? (
                        <p className="text-sm text-muted-foreground">Загрузка позиций…</p>
                      ) : detailById[order.id] ? (
                        <OrderDetailPanel detail={detailById[order.id]!} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Не удалось загрузить детали.</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
