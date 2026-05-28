import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  managerHeatAriaLabel,
  managerHeatBarClass,
  managerHeatTooltipLabel,
  type ManagerHeatLevel,
} from "@/lib/manager-load-heat";
import { buildManagerDashboardModel } from "@/lib/dealer-base-manager-dashboard-view-model";
import type { ManagerRowModel } from "@/lib/dealer-base-management-view-model";
import { ManagerSegmentMiniBar } from "@/components/dealer-base/manager-segment-mini-bar";

type Props = {
  manager: ManagerRowModel;
  ropName: string;
  heatLevel: ManagerHeatLevel;
};

export function ManagerTeamCard({ manager, ropName, heatLevel }: Props) {
  const dashboard = buildManagerDashboardModel(manager, ropName, heatLevel);
  const topCities = dashboard.cities.slice(0, 3);
  const totalForBar = dashboard.rows.length;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground transition-all hover:border-[#9ACA3C]/40 hover:shadow-[0_2px_10px_rgba(154,202,60,0.06)]"
      data-testid={`card-manager-team-${manager.managerId}`}
    >
      <div className="flex min-w-0 items-stretch gap-3">
        <div
          className={cn("w-1 shrink-0 self-stretch rounded-full", managerHeatBarClass(heatLevel))}
          title={managerHeatTooltipLabel(heatLevel)}
          aria-label={managerHeatAriaLabel(heatLevel)}
          data-testid={`manager-heat-bar-${heatLevel}-${manager.managerId}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{manager.name}</p>
            <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              <span className="text-base font-semibold text-foreground">{manager.active}</span> · {manager.outlets} ТТ
            </p>
          </div>
          <ManagerSegmentMiniBar
            segments={dashboard.segments}
            total={totalForBar}
            data-testid={`mgr-segment-bar-${manager.managerId}`}
          />
        </div>
      </div>

      {topCities.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
          data-testid={`mgr-top-cities-${manager.managerId}`}
        >
          {topCities.map((c, i) => (
            <span key={c.cityKey}>
              {i > 0 ? <span className="mx-1 text-muted-foreground/40">·</span> : null}
              <Link
                href={buildHashPath(`/dealer-base/city/${encodeURIComponent(c.cityKey)}`)}
                className="no-underline hover:text-[#9ACA3C]"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-foreground">{c.displayName}</span>{" "}
                <span className="tabular-nums">{c.activeClients}</span>
              </Link>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {manager.potential > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400"
            data-testid={`mgr-tag-potential-${manager.managerId}`}
          >
            потенц. <span className="font-semibold tabular-nums">{manager.potential}</span>
          </span>
        ) : null}
        {manager.attention > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400"
            data-testid={`mgr-tag-attention-${manager.managerId}`}
          >
            вним. <span className="font-semibold tabular-nums">{manager.attention}</span>
          </span>
        ) : null}
      </div>

      <Button variant="outline" size="sm" className="h-8 w-full justify-between text-xs" asChild>
        <Link
          href={buildHashPath(`/dealer-base/manager/${encodeURIComponent(manager.managerId)}`)}
          data-testid={`button-manager-team-open-${manager.managerId}`}
        >
          Штаб менеджера
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
