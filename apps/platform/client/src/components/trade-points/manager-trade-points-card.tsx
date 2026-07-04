import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  managerHeatAriaLabel,
  managerHeatBarClass,
  managerHeatTooltipLabel,
  type ManagerHeatLevel,
} from "@/lib/manager-load-heat";
import { TradePointsTpStateMiniBar } from "@/components/trade-points/trade-points-tp-state-mini-bar";
import type { TpStateSegmentRow } from "@/lib/trade-points-overview-view-model";

export type ManagerTradePointsCardModel = {
  userId: string;
  fullName: string;
  tradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  segments: TpStateSegmentRow[];
  shellHref: string;
  isRegional?: boolean;
};

type Props = {
  manager: ManagerTradePointsCardModel;
  heatLevel: ManagerHeatLevel;
};

export function ManagerTradePointsCard({ manager, heatLevel }: Props) {
  const totalForBar = manager.tradePoints;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-all hover:border-[#9ACA3C]/40 hover:shadow-[0_2px_10px_rgba(154,202,60,0.06)]"
      data-testid={`card-manager-trade-points-${manager.userId}`}
    >
      <div className="flex min-w-0 items-stretch gap-3">
        <div
          className={cn("w-1 shrink-0 self-stretch rounded-full", managerHeatBarClass(heatLevel))}
          title={managerHeatTooltipLabel(heatLevel)}
          aria-label={managerHeatAriaLabel(heatLevel)}
          data-testid={`manager-tp-heat-bar-${heatLevel}-${manager.userId}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-semibold text-foreground">{manager.fullName}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-base font-semibold tabular-nums text-foreground">{manager.tradePoints}</span> ТТ ·{" "}
            {manager.clientsWithTp} клиентов · {manager.cities} городов
          </p>
          <TradePointsTpStateMiniBar
            segments={manager.segments}
            total={totalForBar}
            data-testid={`mgr-tp-state-bar-${manager.userId}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {manager.withoutPhoto > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400"
            data-testid={`mgr-tp-tag-no-photo-${manager.userId}`}
          >
            без фото <span className="font-semibold tabular-nums">{manager.withoutPhoto}</span>
          </span>
        ) : null}
        {manager.notFilled > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400"
            data-testid={`mgr-tp-tag-unfilled-${manager.userId}`}
          >
            не заполнены <span className="font-semibold tabular-nums">{manager.notFilled}</span>
          </span>
        ) : null}
      </div>

      {manager.shellHref ? (
        <Button variant="outline" size="sm" className="h-8 w-full justify-between text-xs" asChild>
          <Link href={manager.shellHref} data-testid={`button-manager-tp-open-hq-${manager.userId}`}>
            Открыть штаб
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full cursor-not-allowed justify-between text-xs opacity-50"
          disabled
          aria-disabled
          data-testid={`button-manager-tp-open-hq-${manager.userId}`}
        >
          Открыть штаб
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Button>
      )}
    </div>
  );
}
