import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import type { Clients1cListItem } from "@/lib/clients-1c-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { dash } from "@/pages/one-c/one-c-ui";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function managersLabel(names: string[]): string {
  const filtered = names.filter((n) => n.trim().length > 0);
  if (filtered.length === 0) return "—";
  if (filtered.length <= 2) return filtered.join(", ");
  return `${filtered.slice(0, 2).join(", ")} +${filtered.length - 2}`;
}

type Clients1cListTableProps = {
  items: Clients1cListItem[];
  testId?: string;
};

export function Clients1cListTable({ items, testId = "table-clients-1c" }: Clients1cListTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border" data-testid={testId}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Клиент</TableHead>
            <TableHead className="text-right">ТТ</TableHead>
            <TableHead>Ответственные</TableHead>
            <TableHead>Дистрибуция</TableHead>
            <TableHead>Заказы 90д</TableHead>
            <TableHead>Последний заказ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.holding_id_1c} className="cursor-pointer hover:bg-muted/40">
              <TableCell>
                <Link
                  href={`/clients-1c/${row.holding_id_1c}`}
                  className="block font-medium text-primary hover:underline"
                >
                  <div>{dash(row.holding_name)}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.holding_inn ? `ИНН ${row.holding_inn}` : "—"}
                    {row.holding_city ? ` · ${row.holding_city}` : ""}
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.stores_count}</TableCell>
              <TableCell className="text-sm">
                <div>{managersLabel(row.responsible_managers)}</div>
                <div className="text-xs text-muted-foreground">{managersLabel(row.regional_managers)}</div>
              </TableCell>
              <TableCell className="min-w-[140px]">
                <div className="text-sm tabular-nums">
                  {row.distribution_filled_count}/{row.distribution_total_targets} · {row.distribution_percent}%
                </div>
                <Progress value={row.distribution_percent} className="mt-1 h-2" />
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                <div>{row.orders_last_90d_count}</div>
                <div className="text-xs text-muted-foreground">{formatMoney(row.orders_last_90d_amount)}</div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.last_order_at ? formatDisplayDateTime(row.last_order_at) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
