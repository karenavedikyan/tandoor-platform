import type { ReactElement } from "react";
import { Link } from "wouter";
import type { OneCLegalListItem } from "@/lib/one-c-showroom-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash, formatPlanSum } from "./one-c-ui";

type OneCLegalsTableProps = {
  items: OneCLegalListItem[];
  emptyLabel?: string;
  testIdPrefix?: string;
};

export function OneCLegalsTable({
  items,
  emptyLabel = "Ничего не найдено",
  testIdPrefix = "one-c-legals",
}: OneCLegalsTableProps): ReactElement {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table data-testid={`table-${testIdPrefix}`}>
        <TableHeader>
          <TableRow>
            <TableHead>Краткое имя</TableHead>
            <TableHead>Полное наименование</TableHead>
            <TableHead>ИНН</TableHead>
            <TableHead>КПП</TableHead>
            <TableHead>Город</TableHead>
            <TableHead>Холдинг</TableHead>
            <TableHead>Ответственный</TableHead>
            <TableHead>ТТ</TableHead>
            <TableHead>Дистрибуция</TableHead>
            <TableHead className="text-right">План</TableHead>
            <TableHead className="w-16 text-right">Заказы 1С</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id_1c} className="cursor-pointer" data-testid={`row-one-c-legal-${row.id_1c}`}>
              <TableCell>
                <Link href={`/1c/legal/${row.id_1c}`} className="font-medium text-primary hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="max-w-[14rem] truncate">{dash(row.legal_name)}</TableCell>
              <TableCell className="font-mono text-xs">{dash(row.inn)}</TableCell>
              <TableCell className="font-mono text-xs">{dash(row.kpp)}</TableCell>
              <TableCell>{dash(row.city)}</TableCell>
              <TableCell className="max-w-[10rem] truncate">{dash(row.parent_name)}</TableCell>
              <TableCell>{dash(row.responsible_manager_name)}</TableCell>
              <TableCell className="tabular-nums">{row.stores_count}</TableCell>
              <TableCell>{row.has_distribution ? "✓" : ""}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPlanSum(row.plan_sum)}</TableCell>
              <TableCell className="w-16 text-right tabular-nums">
                {(row.orders_count ?? 0) === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Link
                    href={`/1c/legal/${row.id_1c}#one-c-legal-orders`}
                    className="font-semibold text-primary hover:underline"
                    data-testid={`cell-${testIdPrefix}-${row.id_1c}-orders`}
                  >
                    {row.orders_count}
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
