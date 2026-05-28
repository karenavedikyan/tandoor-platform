import type { ReactNode } from "react";
import { Link } from "wouter";
import type { MainDashboardScopeMetrics } from "@/lib/main-dashboard-scope-metrics";
import {
  managerHeatAriaLabel,
  managerHeatBarClass,
  managerHeatTooltipLabel,
  type ManagerHeatLevel,
} from "@/lib/manager-load-heat";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type ScopeMetricCardProps = {
  label: string;
  value: number;
  footnote: string;
  href?: string;
  testId: string;
};

function ScopeMetricCard({ label, value, footnote, href, testId }: ScopeMetricCardProps) {
  const card = (
    <Card className="min-w-0 rounded-xl border border-border bg-card" data-testid={testId}>
      <CardContent className="p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">{footnote}</p>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <a
      href={href}
      className="block min-w-0 rounded-xl no-underline outline-none ring-offset-background transition hover:opacity-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </a>
  );
}

export type MainScopeBreakdownKpiGridProps = {
  metrics: MainDashboardScopeMetrics;
  clientsHref: string;
  tradePointsHref: string;
};

/** KPI: активные клиенты и ТТ (директор, РОП). Промт 79: без карточек архива. */
export function MainScopeBreakdownKpiGrid({ metrics, clientsHref, tradePointsHref }: MainScopeBreakdownKpiGridProps) {
  return (
    <>
      <ScopeMetricCard
        label="Активные клиенты"
        value={metrics.activeClients}
        footnote="Рабочая база"
        href={clientsHref}
        testId="card-main-kpi-active-clients"
      />
      <ScopeMetricCard
        label="Активные ТТ"
        value={metrics.activeTradePoints}
        footnote="Рабочая база"
        href={tradePointsHref}
        testId="card-main-kpi-active-tp"
      />
    </>
  );
}

export function DrilldownScopeKpiPill({
  kind,
  active,
}: {
  kind: "clients" | "tradePoints";
  active: number;
  /** @deprecated Промт 79: архив не отображается */
  archived?: number;
}) {
  const label = kind === "clients" ? "клиенты" : "ТТ";
  return (
    <span className="inline-flex max-w-full shrink-0 items-center rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] tabular-nums sm:text-xs text-foreground">
      {label} {active}
    </span>
  );
}

export function DrilldownScopeKpiPills({ metrics }: { metrics: MainDashboardScopeMetrics }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
      <DrilldownScopeKpiPill kind="clients" active={metrics.activeClients} />
      <span className="text-muted-foreground text-xs" aria-hidden>
        ·
      </span>
      <DrilldownScopeKpiPill kind="tradePoints" active={metrics.activeTradePoints} />
    </div>
  );
}

function ManagerHeatStrip({ level }: { level: ManagerHeatLevel }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("w-1 shrink-0 self-stretch rounded-l-xl", managerHeatBarClass(level))}
          aria-label={managerHeatAriaLabel(level)}
          data-testid={`manager-heat-bar-${level}`}
        />
      </TooltipTrigger>
      <TooltipContent side="right">{managerHeatTooltipLabel(level)}</TooltipContent>
    </Tooltip>
  );
}

export function DrilldownListRow({
  href,
  testId,
  title,
  subtitle,
  metrics,
  children,
  heatLevel,
}: {
  href: string;
  testId: string;
  title: string;
  subtitle?: string | null;
  metrics?: MainDashboardScopeMetrics | null;
  children?: ReactNode;
  /** Цветная полоса нагрузки (только списки менеджеров). */
  heatLevel?: ManagerHeatLevel | null;
}) {
  return (
    <li className="flex min-w-0">
      {heatLevel ? <ManagerHeatStrip level={heatLevel} /> : null}
      <Link
        href={href}
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2 py-3 no-underline transition hover:bg-muted/60 cursor-pointer sm:flex-row sm:items-center sm:justify-between sm:gap-3",
          heatLevel ? "px-4 pr-4" : "px-4",
        )}
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {metrics ? <DrilldownScopeKpiPills metrics={metrics} /> : null}
          {children ?? (
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              →
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Обёртка списка drilldown с tooltip для heat-полос. */
export function DrilldownList({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <ul
        className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        data-testid={testId}
      >
        {children}
      </ul>
    </TooltipProvider>
  );
}
