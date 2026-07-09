import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTION_PERCENT_TONE_CLASS,
  distributionPercentTone,
  formatDistributionPercent,
  type DistributionGroupMetrics,
  type EquipmentTypeKey,
} from "@/lib/distribution-analytics/distribution-analytics-math";

const TYPE_LABEL: Record<EquipmentTypeKey, string> = {
  entrance: "ВХ",
  interior: "МК",
  hardware: "Фурнитура",
};

const TYPE_TEST_ID: Record<EquipmentTypeKey, string> = {
  entrance: "kpi-one-c-stores-avg-entrance",
  interior: "kpi-one-c-stores-avg-interior",
  hardware: "kpi-one-c-stores-avg-hardware",
};

const EQUIPMENT_TYPES: EquipmentTypeKey[] = ["entrance", "interior", "hardware"];

type OneCStoresDistributionKpiCardsProps = {
  tradePointsCount: number;
  aggregate: DistributionGroupMetrics;
  loading?: boolean;
  testId?: string;
};

function formatPercentValue(
  percent: number | null | undefined,
  capacity: number,
  loading: boolean,
): string {
  if (loading) return "—";
  if (capacity === 0) return "—";
  if (percent == null || !Number.isFinite(percent)) return "—";
  return formatDistributionPercent(percent);
}

export function OneCStoresDistributionKpiCards({
  tradePointsCount,
  aggregate,
  loading = false,
  testId = "kpi-one-c-stores-distribution",
}: OneCStoresDistributionKpiCardsProps): ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid={testId}>
      <KpiCard
        title="ТТ в выборке"
        value={tradePointsCount.toLocaleString("ru-RU")}
        testId="kpi-one-c-stores-tp-count"
      />
      {EQUIPMENT_TYPES.map((type) => {
        const row = aggregate.byType[type];
        const percentValue = formatPercentValue(row.percent, row.capacity, loading);
        const tone = loading || row.capacity === 0 ? "empty" : distributionPercentTone(row.percent);
        return (
          <KpiCard
            key={type}
            title={`Средняя дистрибуция ${TYPE_LABEL[type]}`}
            value={percentValue}
            hint={`Σ ${row.tandoorOnShelf} / Σ ${row.capacity} слотов`}
            valueClassName={loading || row.capacity === 0 ? undefined : DISTRIBUTION_PERCENT_TONE_CLASS[tone]}
            testId={TYPE_TEST_ID[type]}
          />
        );
      })}
      <KpiCard
        title="Под ротацию"
        value={loading ? "—" : formatDistributionPercent(aggregate.rotationPotentialPercent)}
        hint={`Неактуальные: ${aggregate.totalLegacyOurs} шт`}
        valueClassName={
          loading
            ? undefined
            : aggregate.totalLegacyOurs > 0
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
        }
        testId="kpi-one-c-stores-rotation"
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  valueClassName,
  testId,
}: {
  title: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  testId: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", valueClassName)}>{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
