import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildHashPath } from "@/lib/hash-route-utils";
import { cn } from "@/lib/utils";
import { getAttentionLevel, getLoadLevel, type TeamSummary } from "@/lib/team-summary";

export type TeamSummaryCardVariant = "full" | "compact";

type TeamSummaryCardProps = {
  summary: TeamSummary;
  variant?: TeamSummaryCardVariant;
  ctaHref: string;
  ctaLabel: string;
  showCta?: boolean;
  /** Ссылки-переходы по KPI команды (только для полной карточки на главной). */
  showTeamMetricLinks?: boolean;
};

const drillLinkClass =
  "inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-2 transition hover:bg-muted/80 hover:text-foreground";

export function TeamSummaryCard({
  summary,
  variant = "full",
  ctaHref,
  ctaLabel,
  showCta = true,
  showTeamMetricLinks = false,
}: TeamSummaryCardProps) {
  const tid = summary.teamId;
  const att = getAttentionLevel(summary.pctAttention);
  const load = getLoadLevel(summary.avgClientsPerManager);

  const borderClass =
    att === "critical"
      ? "border-red-300 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/25"
      : att === "warning"
        ? "border-amber-300 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20"
        : "border-emerald-200/90 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/15";

  const loadClass =
    load === "overload"
      ? "font-semibold text-destructive"
      : load === "underload"
        ? "font-semibold text-sky-700 dark:text-sky-300"
        : "text-muted-foreground";

  const isCompact = variant === "compact";

  return (
    <Card
      className={cn("min-w-0 max-w-full overflow-hidden rounded-xl border-2 shadow-sm", borderClass)}
      data-testid={`card-team-summary-${tid}`}
    >
      <CardContent className={cn("space-y-3 p-4", isCompact && "space-y-2 p-3")}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground" data-testid={`text-team-summary-rop-${tid}`}>
              {summary.ropName}
            </p>
            <Badge variant="outline" className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
              Команда
            </Badge>
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground",
            isCompact && "text-[11px]",
          )}
        >
          <span data-testid={`text-team-summary-managers-${tid}`}>Менеджеров: {summary.managerCount}</span>
          <span data-testid={`text-team-summary-clients-${tid}`}>Клиентов: {summary.totalClients}</span>
          <span data-testid={`text-team-summary-active-${tid}`}>Активные: {summary.activeClients}</span>
          <span data-testid={`text-team-summary-top-${tid}`}>TOP: {summary.topClients}</span>
          <span data-testid={`text-team-summary-attention-${tid}`}>Внимание: {summary.attentionClients}</span>
          <span>Потенциальные: {summary.potentialClients}</span>
        </div>

        {showTeamMetricLinks && !isCompact ? (
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-xs">
            <Link
              href={buildHashPath("/dealer-base", { team: tid })}
              className={drillLinkClass}
              data-testid={`link-team-summary-clients-${tid}`}
            >
              Клиенты
            </Link>
            <Link
              href={buildHashPath("/dealer-base", { team: tid, quick: "active", view: "table_team" })}
              className={drillLinkClass}
              data-testid={`link-team-summary-active-${tid}`}
            >
              Активные
            </Link>
            <Link
              href={buildHashPath("/dealer-base", { team: tid, quick: "attention", view: "table_team" })}
              className={drillLinkClass}
              data-testid={`link-team-summary-attention-${tid}`}
            >
              Внимание
            </Link>
            <Link
              href={buildHashPath("/dealer-base", { team: tid, quick: "top", view: "table_team" })}
              className={drillLinkClass}
              data-testid={`link-team-summary-top-${tid}`}
            >
              TOP
            </Link>
            <Link
              href={buildHashPath("/dealer-base", { team: tid, quick: "potential", view: "table_team" })}
              className={drillLinkClass}
              data-testid={`link-team-summary-potential-${tid}`}
            >
              Потенциальные
            </Link>
            <Link
              href={buildHashPath("/dealer-base", { team: tid, view: "by_manager" })}
              className={drillLinkClass}
              data-testid={`link-team-summary-managers-${tid}`}
            >
              Менеджеры
            </Link>
          </div>
        ) : null}

        <div className={cn("flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs", isCompact && "text-[11px]")}>
          <span className={loadClass} data-testid={`text-team-summary-load-${tid}`}>
            Средняя нагрузка: {summary.avgClientsPerManager}
          </span>
          <span className="text-muted-foreground" data-testid={`text-team-summary-pct-active-${tid}`}>
            % активных: {summary.pctActive}%
          </span>
          <span className="text-muted-foreground" data-testid={`text-team-summary-pct-attention-${tid}`}>
            % внимания: {summary.pctAttention}%
          </span>
        </div>

        {!isCompact ? (
          <div className="space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            <p data-testid={`text-team-summary-leader-${tid}`}>
              <span className="font-medium text-foreground">Лидер:</span> {summary.leaderManagerName}
            </p>
            <p data-testid={`text-team-summary-risk-${tid}`}>
              <span className="font-medium text-foreground">В зоне риска:</span> {summary.riskManagerName}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <p className="truncate" data-testid={`text-team-summary-leader-${tid}`}>
              Лидер: {summary.leaderManagerName}
            </p>
            <p className="truncate" data-testid={`text-team-summary-risk-${tid}`}>
              Риск: {summary.riskManagerName}
            </p>
          </div>
        )}

        {showCta ? (
          <Button asChild size="sm" className="w-full min-w-0 font-semibold sm:w-auto" data-testid={`button-team-summary-open-${tid}`}>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
