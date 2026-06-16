import type { ReactElement } from "react";
import { DistributionPercentBadge } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";

export type ModelCityRow = {
  city: string;
  eligible: number;
  present: number;
  coveragePercent: number | null;
  tradePointNames: string[];
};

export function ModelCardCitiesTable({ rows }: { rows: ModelCityRow[] }): ReactElement {
  const sorted = [...rows].sort((a, b) => (b.coveragePercent ?? -1) - (a.coveragePercent ?? -1));
  return (
    <section className="space-y-2" data-testid="model-card-cities-table">
      <h2 className="text-sm font-semibold">Города</h2>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[640px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Город</th>
              <th className="px-2 py-2">ТТ eligible</th>
              <th className="px-2 py-2">С моделью</th>
              <th className="px-2 py-2">Покрытие</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.city} className="border-t border-border/50">
                <td className="px-2 py-2 font-medium">{row.city}</td>
                <td className="px-2 py-2">{row.eligible}</td>
                <td className="px-2 py-2">{row.present}</td>
                <td className="px-2 py-2">
                  <DistributionPercentBadge value={row.coveragePercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
