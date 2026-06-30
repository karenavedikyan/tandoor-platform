import { useState, type ReactElement } from "react";
import { DistributionAnalyticsKpiTiles } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { DistributionRotationTile } from "@/components/distribution-analytics/distribution-rotation-tile";
import type { DistributionGroupMetrics, EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import {
  useTradePointDistributionDynamics,
  type DistributionPeriodDays,
} from "@/hooks/use-trade-point-distribution-dynamics";
import { cn } from "@/lib/utils";

const TITLE_BY_ACCESS: Record<DealerBaseAccessRole, string> = {
  sales_manager: "Моя дистрибуция",
  team_lead: "Дистрибуция команды",
  sales_director: "Дистрибуция по региону",
};

const PERIOD_OPTIONS: DistributionPeriodDays[] = [7, 30, 90];

type Props = {
  access: DealerBaseAccessRole;
  aggregate: DistributionGroupMetrics;
  tradePointsCount: number;
  tradePointIds: string[];
  /** Префикс для data-testid плиток, чтобы не конфликтовать между разделами. */
  testIdPrefix: string;
  /** Показывать ли плитку «ТТ в выборке». По умолчанию false (как у менеджера сейчас). */
  showTradePointsCount?: boolean;
  /** Плейсхолдер загрузки вместо ложных Σ0/—. */
  loading?: boolean;
};

function DistributionSummaryLoadingTiles({ testIdPrefix }: { testIdPrefix: string }): ReactElement {
  const titles = ["Средняя дистрибуция ВХ", "Средняя дистрибуция МК", "Средняя дистрибуция Фурнитура", "Ротация"];
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid={`section-${testIdPrefix}-distribution-loading`}>
        {titles.slice(0, 3).map((title) => (
          <div key={title} className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">…</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Загрузка…</p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs" data-testid={`tile-${testIdPrefix}-rotation-loading`}>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{titles[3]}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">…</p>
        </div>
      </div>
    </>
  );
}

export function RoleDistributionSummaryBar({
  access,
  aggregate,
  tradePointsCount,
  tradePointIds,
  testIdPrefix,
  showTradePointsCount = false,
  loading = false,
}: Props): ReactElement {
  const [periodDays, setPeriodDays] = useState<DistributionPeriodDays>(30);
  const { deltaByType } = useTradePointDistributionDynamics(tradePointIds, periodDays);

  const tileTestIdByType: Partial<Record<EquipmentTypeKey, string>> = {
    entrance: `tile-${testIdPrefix}-distribution-entrance`,
    interior: `tile-${testIdPrefix}-distribution-interior`,
    hardware: `tile-${testIdPrefix}-distribution-hardware`,
  };
  const deltaTestIdByType: Partial<Record<EquipmentTypeKey, string>> = {
    entrance: `tile-${testIdPrefix}-distribution-entrance-delta`,
    interior: `tile-${testIdPrefix}-distribution-interior-delta`,
    hardware: `tile-${testIdPrefix}-distribution-hardware-delta`,
  };

  return (
    <section className="space-y-2" data-testid={`section-${testIdPrefix}-distribution`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{TITLE_BY_ACCESS[access]}</h2>
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Период динамики дистрибуции"
        >
          {PERIOD_OPTIONS.map((days) => {
            const active = periodDays === days;
            return (
              <button
                key={days}
                type="button"
                className={cn(
                  "min-w-[2.25rem] rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-pressed={active}
                data-testid={`button-${testIdPrefix}-distribution-period-${days}`}
                onClick={() => setPeriodDays(days)}
              >
                {days}
              </button>
            );
          })}
        </div>
      </div>
      {loading ? (
        <DistributionSummaryLoadingTiles testIdPrefix={testIdPrefix} />
      ) : (
        <>
          <DistributionAnalyticsKpiTiles
            aggregate={aggregate}
            tradePointsCount={tradePointsCount}
            showTradePointsCount={showTradePointsCount}
            tileTestIdByType={tileTestIdByType}
            deltaByType={deltaByType}
            deltaTestIdByType={deltaTestIdByType}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DistributionRotationTile
              aggregate={aggregate}
              testId={`tile-${testIdPrefix}-rotation`}
            />
          </div>
        </>
      )}
    </section>
  );
}

export type { DistributionPeriodDays };
