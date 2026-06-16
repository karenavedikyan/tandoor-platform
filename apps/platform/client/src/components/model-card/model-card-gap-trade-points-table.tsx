import type { ReactElement } from "react";
import { Link } from "wouter";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

export type ModelGapRow = {
  row: TradePointListRow;
  freeSlots: number;
};

export function ModelCardGapTradePointsTable({ rows }: { rows: ModelGapRow[] }): ReactElement {
  return (
    <section className="space-y-2" data-testid="model-card-gap-trade-points-table">
      <h2 className="text-sm font-semibold">ТТ где модель должна быть, но не стоит</h2>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2">ТТ</th>
              <th className="px-2 py-2">Город</th>
              <th className="px-2 py-2">Категория</th>
              <th className="px-2 py-2">Менеджер</th>
              <th className="px-2 py-2">Свободных слотов</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, freeSlots }) => (
              <tr key={row.tradePointId} className="border-t border-border/50">
                <td className="px-2 py-2">{row.tradePointDisplayCode} · {row.tradePointName}</td>
                <td className="px-2 py-2">{row.city}</td>
                <td className="px-2 py-2">{row.clientCategoryLabel}</td>
                <td className="px-2 py-2">{row.manager}</td>
                <td className="px-2 py-2 font-semibold tabular-nums">{freeSlots}</td>
                <td className="px-2 py-2">
                  <Link
                    href={`/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}?tradePointShowcase=1`}
                    className="text-primary hover:underline"
                  >
                    Открыть карточку ТТ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
