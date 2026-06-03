import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributionBreakdownTable } from "@/components/distribution/distribution-breakdown-table";
import type { DistributionAnalyticsRow } from "@/lib/distribution-analytics";
import { useDistributionAnalytics } from "@/lib/distribution-analytics-store";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import {
  buildManagerCityRows,
  buildManagerClientRows,
  buildManagerLevelRows,
  buildManagerModelRows,
  buildManagerTradePointRows,
  getManagerDrilldownLevel,
  managerDrilldownLevelLabel,
  managerDrilldownPathForCrumbIndex,
  parentManagerDrilldownPath,
  type ManagerDrilldownPath,
} from "@/lib/distribution-manager-drilldown";
import type { ManagerAggregationOptions } from "@/lib/distribution-analytics";
import { collectScopeTradePoints, type DistributionScope, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";
import { cn } from "@/lib/utils";

type DistributionManagerTabProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
  /** TODO: подключить responsibleByCode из client_assignments, когда менеджеры завершат актуализацию (~1 мес). */
  responsibleByCode?: ManagerAggregationOptions["responsibleByCode"];
  managerLabelByUserId?: ManagerAggregationOptions["managerLabelByUserId"];
};

function matrixStatusForTarget(
  ref: ScopeTradePointRef,
  targetId: string,
  ctxBuilder: (ref: ScopeTradePointRef) => { entries: readonly { targetKind: string; targetId: string; status: ShowcaseMatrixStatus }[] },
): ShowcaseMatrixStatusId {
  const ctx = ctxBuilder(ref);
  for (const e of ctx.entries) {
    if ((e.targetKind === "model" || e.targetKind === "variant") && e.targetId === targetId) {
      return e.status as ShowcaseMatrixStatusId;
    }
  }
  return "need_install";
}

function statusBadgeClass(status: ShowcaseMatrixStatusId): string {
  if (status === "installed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "need_install") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "postponed") return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  return "border-border bg-muted/30 text-muted-foreground";
}

export function DistributionManagerTab({
  scope,
  filter,
  responsibleByCode,
  managerLabelByUserId,
}: DistributionManagerTabProps) {
  const { snapshot } = useDistributionAnalytics(scope);
  const [path, setPath] = useState<ManagerDrilldownPath>({});

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const ctxBuilder = useMemo(() => createFilteredMetricsContextBuilder(filter), [filter]);
  const managerOptions = useMemo<ManagerAggregationOptions>(
    () => ({ responsibleByCode, managerLabelByUserId }),
    [responsibleByCode, managerLabelByUserId],
  );

  const level = getManagerDrilldownLevel(path);

  const rows = useMemo(() => {
    switch (level) {
      case "managers":
        return buildManagerLevelRows(refs, ctxBuilder, managerOptions);
      case "cities":
        return buildManagerCityRows(refs, ctxBuilder, path.managerKey!, managerOptions);
      case "clients":
        return buildManagerClientRows(refs, ctxBuilder, path.managerKey!, path.city!, managerOptions);
      case "tradePoints":
        return buildManagerTradePointRows(
          refs,
          ctxBuilder,
          path.managerKey!,
          path.city!,
          path.dealerId!,
          managerOptions,
        );
      case "models":
        return buildManagerModelRows(refs, ctxBuilder, path.tradePointId!);
      default:
        return [];
    }
  }, [refs, ctxBuilder, managerOptions, level, path, snapshot]);

  const modelRef = useMemo(() => {
    if (level !== "models" || !path.tradePointId) return null;
    return refs.find((r) => r.point.id === path.tradePointId) ?? null;
  }, [refs, level, path.tradePointId]);

  const handleDrill = useCallback(
    (row: DistributionAnalyticsRow<unknown>) => {
      if (level === "managers") {
        const ref = row.drilldownRef as { managerKey: string };
        setPath({ managerKey: ref.managerKey, managerLabel: row.label });
        return;
      }
      if (level === "cities") {
        const ref = row.drilldownRef as { city: string };
        setPath((p) => ({ ...p, city: ref.city }));
        return;
      }
      if (level === "clients") {
        const ref = row.drilldownRef as { dealer: { id: string; name?: string } };
        setPath((p) => ({
          ...p,
          dealerId: ref.dealer.id,
          dealerName: row.label,
        }));
        return;
      }
      if (level === "tradePoints") {
        const ref = row.drilldownRef as ScopeTradePointRef;
        setPath((p) => ({
          ...p,
          tradePointId: ref.point.id,
          tradePointName: row.label,
        }));
      }
    },
    [level],
  );

  const handleBack = () => {
    setPath((p) => parentManagerDrilldownPath(p));
  };

  const crumbs: { label: string; index: number }[] = useMemo(() => {
    const items: { label: string; index: number }[] = [{ label: "Менеджеры", index: 0 }];
    if (path.managerKey) {
      items.push({ label: path.managerLabel ?? path.managerKey, index: 1 });
    }
    if (path.city) items.push({ label: path.city, index: 2 });
    if (path.dealerId) items.push({ label: path.dealerName ?? path.dealerId, index: 3 });
    if (path.tradePointId) items.push({ label: path.tradePointName ?? path.tradePointId, index: 4 });
    return items;
  }, [path]);

  const renderLabelAddon = useCallback(
    (row: DistributionAnalyticsRow<unknown>): ReactNode => {
      if (level !== "models" || !modelRef) return null;
      const targetId = (row.drilldownRef as { targetId: string }).targetId;
      const status = matrixStatusForTarget(modelRef, targetId, ctxBuilder);
      return (
        <Badge variant="outline" className={cn("text-xs font-normal", statusBadgeClass(status))}>
          {statusLabelRu(status)}
        </Badge>
      );
    },
    [level, modelRef, ctxBuilder],
  );

  const canGoBack = level !== "managers";
  const onDrill = level === "models" ? undefined : handleDrill;

  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-manager-tab">
      <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Разрез по менеджеру</CardTitle>
          {canGoBack ? (
            <Button type="button" variant="outline" size="sm" onClick={handleBack} data-testid="manager-drilldown-back">
              Назад
            </Button>
          ) : null}
        </div>
        <nav
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
          aria-label="Навигация по разрезу"
          data-testid="manager-drilldown-breadcrumbs"
        >
          {crumbs.map((crumb, i) => (
            <span key={crumb.index} className="inline-flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
              {i < crumbs.length - 1 ? (
                <button
                  type="button"
                  className="hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setPath(managerDrilldownPathForCrumbIndex(path, crumb.index))}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="font-medium text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        <DistributionBreakdownTable
          rows={rows as DistributionAnalyticsRow<unknown>[]}
          loading={snapshot.loading}
          levelLabel={managerDrilldownLevelLabel(level)}
          onDrill={onDrill}
          renderLabelAddon={level === "models" ? renderLabelAddon : undefined}
        />
        {level === "models" && path.tradePointId ? (
          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              data-testid="link-manager-drilldown-open-entry"
              onClick={() => {
                /* TODO: переключить на вкладку «Ввод» с выбранной ТТ */
              }}
            >
              Открыть ввод по ТТ
            </button>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
