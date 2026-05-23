import { cn } from "@/lib/utils";

export type OperationalStripMetric = {
  label: string;
  value: string;
  hint?: string;
};

type OperationalHeaderKpiProps = {
  metrics: [OperationalStripMetric, OperationalStripMetric, OperationalStripMetric, OperationalStripMetric];
  className?: string;
  /** Подзаголовок под описанием блока (например источник данных). */
  sourceNote?: string;
};

export function OperationalHeaderKpi({ metrics, className, sourceNote }: OperationalHeaderKpiProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs ring-1 ring-black/[0.02] sm:flex-row sm:items-stretch sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Операционная аналитика</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Клиенты, витрины, фурнитура и оборудование в разрезе территории.
        </p>
        {sourceNote ? <p className="text-xs font-medium leading-relaxed text-primary">{sourceNote}</p> : null}
      </div>
      <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[min(100%,20rem)] sm:grid-cols-2 lg:min-w-[22rem]">
        {metrics.map((m, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums leading-tight text-foreground sm:text-lg">{m.value}</p>
            {m.hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{m.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
