import type { ReactElement } from "react";

export type CompetitorHintRow = {
  city: string;
  tradePointName: string;
  competitorsListed: string;
  competitorPortals: number | null;
};

export function ModelCardCompetitorsSection({ rows }: { rows: CompetitorHintRow[] }): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2" data-testid="model-card-competitors-section">
      <h2 className="text-sm font-semibold">Потенциал замены конкурента</h2>
      <p className="text-xs text-muted-foreground">ТТ без модели, где зафиксированы конкурентные порталы того же типа.</p>
      <ul className="space-y-1 text-xs">
        {rows.map((row, i) => (
          <li key={`${row.city}-${i}`} className="rounded-md border border-border/60 bg-muted/10 px-2 py-1.5">
            <span className="font-medium">{row.city}</span> · {row.tradePointName}
            {row.competitorPortals != null ? ` · конкурент-порталов: ${row.competitorPortals}` : ""}
            {row.competitorsListed ? ` · ${row.competitorsListed}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
