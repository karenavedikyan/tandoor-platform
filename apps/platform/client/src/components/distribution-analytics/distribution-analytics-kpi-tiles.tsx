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

/** Компактные метки типов для мини-баров (ВХ / МК / Фурн). */
export const DISTRIBUTION_TYPE_MINI_LABEL: Record<EquipmentTypeKey, string> = {
  entrance: "ВХ",
  interior: "МК",
  hardware: "Фурн",
};

type Props = {
  aggregate: DistributionGroupMetrics;
  tradePointsCount: number;
  activeEquipmentTypes?: EquipmentTypeKey[];
  showTradePointsCount?: boolean;
  tileTestIdByType?: Partial<Record<EquipmentTypeKey, string>>;
  deltaByType?: Partial<Record<EquipmentTypeKey, number | null>>;
  deltaTestIdByType?: Partial<Record<EquipmentTypeKey, string>>;
};

export function DistributionAnalyticsKpiTiles({
  aggregate,
  tradePointsCount,
  activeEquipmentTypes = [],
  showTradePointsCount = true,
  tileTestIdByType,
  deltaByType,
  deltaTestIdByType,
}: Props): ReactElement {
  const onlyTypes = ALL_EQUIPMENT_TYPES;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="distribution-analytics-kpi-tiles">
      {showTradePointsCount ? (
        <KpiTile
          title="ТТ в выборке"
          value={String(tradePointsCount)}
          hint="С учётом scope и фильтров"
        />
      ) : null}
      {onlyTypes.map((type) => {
        const row = aggregate.byType[type];
        const disabled = activeEquipmentTypes.length > 0 && !activeEquipmentTypes.includes(type);
        const tone = distributionPercentTone(row.percent);
        const delta = deltaByType?.[type];
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
            testId={tileTestIdByType?.[type]}
            deltaLine={disabled ? null : formatDistributionDelta(delta)}
            deltaClassName={disabled ? undefined : distributionDeltaClassName(delta)}
            deltaTestId={deltaTestIdByType?.[type]}
          />
        );
      })}
    </div>
  );
}

function formatDistributionDelta(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(delta)) return "—";
  if (delta === 0) return "→ 0 пп";
  const abs = Math.abs(delta).toFixed(1);
  if (delta > 0) return `↑ +${abs} пп`;
  return `↓ −${abs} пп`;
}

function distributionDeltaClassName(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return "text-muted-foreground";
  if (delta > 0) return "text-emerald-600 dark:text-emerald-400";
  if (delta < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function KpiTile({
  title,
  value,
  hint,
  valueClassName,
  testId,
  deltaLine,
  deltaClassName,
  deltaTestId,
}: {
  title: string;
  value: string;
  hint: string;
  valueClassName?: string;
  testId?: string;
  deltaLine?: string | null;
  deltaClassName?: string;
  deltaTestId?: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs" data-testid={testId}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", valueClassName)}>{value}</p>
      {deltaLine != null ? (
        <p
          className={cn("mt-0.5 text-[11px] font-medium tabular-nums", deltaClassName)}
          data-testid={deltaTestId}
        >
          {deltaLine}
        </p>
      ) : null}
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
