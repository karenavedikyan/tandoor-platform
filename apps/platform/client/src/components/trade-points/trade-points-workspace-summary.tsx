import { buildTradePointsStructureSummary } from "@/lib/trade-points-management-view-model";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { TradePointsTpStateMiniBar } from "@/components/trade-points/trade-points-tp-state-mini-bar";
import { buildTpStateSegments } from "@/lib/trade-points-overview-view-model";

type Props = {
  workingRows: TradePointListRow[];
  dealerRows: DealerRow[];
};

export function TradePointsWorkspaceSummary({ workingRows, dealerRows }: Props) {
  const summary = buildTradePointsStructureSummary(workingRows, dealerRows);
  const segments = buildTpStateSegments(summary.withPhoto, summary.noPhoto, summary.unfilled);

  if (summary.totalTp === 0) return null;

  return (
    <section
      className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm"
      data-testid="section-trade-points-manager-summary"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["Всего точек", summary.totalTp],
            ["Без фото", summary.noPhoto],
            ["Не заполнены", summary.unfilled],
            ["Городов", summary.citiesCount],
            ["Клиентов с ТТ", summary.clientsWithTp],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
            <p className="text-base font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {segments.length > 0 ? (
        <div className="mt-2">
          <TradePointsTpStateMiniBar segments={segments} total={summary.totalTp} data-testid="manager-workspace-tp-bar" />
        </div>
      ) : null}
    </section>
  );
}
