import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  ALL_EQUIPMENT_TYPES,
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

type Props = {
  aggregate: DistributionGroupMetrics;
  tradePointsCount: number;
  activeEquipmentTypes?: EquipmentTypeKey[];
};

export function DistributionAnalyticsKpiTiles({
  aggregate,
  tradePointsCount,
  activeEquipmentTypes = [],
}: Props): ReactElement {
  const onlyTypes = ALL_EQUIPMENT_TYPES;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="distribution-analytics-kpi-tiles">
      <KpiTile
        title="ТТ в выборке"
        value={String(tradePointsCount)}
        hint="С учётом scope и фильтров"
      />
      {onlyTypes.map((type) => {
        const row = aggregate.byType[type];
        const disabled = activeEquipmentTypes.length > 0 && !activeEquipmentTypes.includes(type);
        const tone = distributionPercentTone(row.percent);
        return (
          <KpiTile
            key={type}
            title={`Средняя дистрибуция ${TYPE_LABEL[type]}`}
            value={disabled ? "—" : formatDistributionPercent(row.percent)}
            hint={
              disabled
                ? "Не входит в фильтр по типу"
                : `Σ ${row.tandoorOnShelf} / Σ ${row.capacity} слотов`
            }
            valueClassName={disabled ? undefined : DISTRIBUTION_PERCENT_TONE_CLASS[tone]}
          />
        );
      })}
    </div>
  );
}

function KpiTile({
  title,
  value,
  hint,
  valueClassName,
}: {
  title: string;
  value: string;
  hint: string;
  valueClassName?: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", valueClassName)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function DistributionPercentBadge({ value }: { value: number | null | undefined }): ReactElement {
  const tone = distributionPercentTone(value);
  return (
    <span
      className={cn(
        "inline-flex min-w-[3rem] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        DISTRIBUTION_PERCENT_TONE_CLASS[tone],
      )}
    >
      {formatDistributionPercent(value)}
    </span>
  );
}
