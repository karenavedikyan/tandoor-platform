import type { ReactElement } from "react";
import { Link } from "wouter";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { formatDisplayDateTime } from "@/lib/format-display-date";

export type ModelPresentTpRow = {
  row: TradePointListRow;
  selectedAt?: string;
};

export function ModelCardTradePointsTable({ rows }: { rows: ModelPresentTpRow[] }): ReactElement {
  return (
    <section className="space-y-2" data-testid="model-card-trade-points-table">
      <h2 className="text-sm font-semibold">ТТ где модель стоит</h2>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2">ТТ</th>
              <th className="px-2 py-2">Город</th>
              <th className="px-2 py-2">Дилер</th>
              <th className="px-2 py-2">Менеджер</th>
              <th className="px-2 py-2">Категория</th>
              <th className="px-2 py-2">Когда поставили</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, selectedAt }) => (
              <tr key={row.tradePointId} className="border-t border-border/50">
                <td className="px-2 py-2">
                  <Link
                    href={`/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.tradePointDisplayCode} · {row.tradePointName}
                  </Link>
                </td>
                <td className="px-2 py-2">{row.city}</td>
                <td className="px-2 py-2">{row.dealerName}</td>
                <td className="px-2 py-2">{row.manager}</td>
                <td className="px-2 py-2">{row.clientCategoryLabel}</td>
                <td className="px-2 py-2">{selectedAt ? formatDisplayDateTime(selectedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
