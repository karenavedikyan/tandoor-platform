import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DistributionBreakdownTable } from "@/components/distribution/distribution-breakdown-table";
import { DistributionTradePointMatrixEntry } from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { DistributionAnalyticsRow } from "@/lib/distribution-analytics";
import { useDistributionAnalytics } from "@/lib/distribution-analytics-store";
import {
  buildClientLevelRows,
  buildClientModelRows,
  buildClientTradePointRows,
  clientDrilldownLevelLabel,
  clientDrilldownPathForCrumbIndex,
  getClientDrilldownLevel,
  parentClientDrilldownPath,
  type ClientDrilldownPath,
} from "@/lib/distribution-client-drilldown";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import { collectScopeTradePoints, type DistributionScope, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";
import { cn } from "@/lib/utils";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionClientTabProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
  profile: ReleaseDemoProfile;
};

function matrixStatusForTarget(
  ref: ScopeTradePointRef,
  targetId: string,
  ctxBuilder: (ref: ScopeTradePointRef) => {
    entries: readonly { targetKind: string; targetId: string; status: ShowcaseMatrixStatus }[];
  },
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

export function DistributionClientTab({ scope, filter, profile }: DistributionClientTabProps) {
  const { user } = useCurrentUser();
  const { snapshot } = useDistributionAnalytics(scope);
  const [path, setPath] = useState<ClientDrilldownPath>({});
  const [entryRef, setEntryRef] = useState<ScopeTradePointRef | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const ctxBuilder = useMemo(() => createFilteredMetricsContextBuilder(filter), [filter]);

  const level = getClientDrilldownLevel(path);

  const rows = useMemo(() => {
    switch (level) {
      case "clients":
        return buildClientLevelRows(refs, ctxBuilder);
      case "tradePoints":
        return buildClientTradePointRows(refs, ctxBuilder, path.dealerId!);
      case "models":
        return buildClientModelRows(refs, ctxBuilder, path.tradePointId!);
      default:
        return [];
    }
  }, [refs, ctxBuilder, level, path, snapshot]);

  const tradePointRef = useMemo(() => {
    if (!path.tradePointId) return null;
    return refs.find((r) => r.point.id === path.tradePointId) ?? null;
  }, [refs, path.tradePointId]);

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const openEntryForRef = useCallback((ref: ScopeTradePointRef) => {
    setEntryRef(ref);
    setEntryOpen(true);
  }, []);

  const handleDrill = useCallback(
    (row: DistributionAnalyticsRow<unknown>) => {
      if (level === "clients") {
        const group = row.drilldownRef as { dealer: { id: string } };
        setPath({ dealerId: group.dealer.id, dealerName: row.label });
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
    setPath((p) => parentClientDrilldownPath(p));
  };

  const crumbs: { label: string; index: number }[] = useMemo(() => {
    const items: { label: string; index: number }[] = [{ label: "Клиенты", index: 0 }];
    if (path.dealerId) items.push({ label: path.dealerName ?? path.dealerId, index: 1 });
    if (path.tradePointId) items.push({ label: path.tradePointName ?? path.tradePointId, index: 2 });
    return items;
  }, [path]);

  const renderLabelAddon = useCallback(
    (row: DistributionAnalyticsRow<unknown>): ReactNode => {
      if (level === "tradePoints") {
        const ref = row.drilldownRef as ScopeTradePointRef;
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            data-testid={`btn-client-entry-${ref.point.id}`}
            onClick={(e) => {
              e.stopPropagation();
              openEntryForRef(ref);
            }}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden />
            Ввод
          </Button>
        );
      }
      if (level === "models" && tradePointRef) {
        const targetId = (row.drilldownRef as { targetId: string }).targetId;
        const status = matrixStatusForTarget(tradePointRef, targetId, ctxBuilder);
        return (
          <Badge variant="outline" className={cn("text-xs font-normal", statusBadgeClass(status))}>
            {statusLabelRu(status)}
          </Badge>
        );
      }
      return null;
    },
    [level, tradePointRef, ctxBuilder, openEntryForRef],
  );

  const canGoBack = level !== "clients";
  const onDrill = level === "models" ? undefined : handleDrill;

  return (
    <>
      <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-client-tab">
        <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Разрез по клиенту</CardTitle>
            {canGoBack ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack} data-testid="client-drilldown-back">
                Назад
              </Button>
            ) : null}
          </div>
          <nav
            className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            aria-label="Навигация по разрезу"
            data-testid="client-drilldown-breadcrumbs"
          >
            {crumbs.map((crumb, i) => (
              <span key={crumb.index} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {i < crumbs.length - 1 ? (
                  <button
                    type="button"
                    className="hover:text-foreground underline-offset-2 hover:underline"
                    onClick={() => setPath(clientDrilldownPathForCrumbIndex(path, crumb.index))}
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
            levelLabel={clientDrilldownLevelLabel(level)}
            onDrill={onDrill}
            renderLabelAddon={level === "tradePoints" || level === "models" ? renderLabelAddon : undefined}
          />
          {level === "models" && tradePointRef ? (
            <div className="mt-3 flex justify-center px-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="btn-client-entry-models-level"
                onClick={() => openEntryForRef(tradePointRef)}
              >
                <PencilLine className="mr-2 h-4 w-4" aria-hidden />
                Ввести факт по этой ТТ
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Sheet
        open={entryOpen && entryRef != null}
        onOpenChange={(open) => {
          setEntryOpen(open);
          if (!open) setEntryRef(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl"
          data-testid="sheet-client-tradepoint-entry"
        >
          {entryRef ? (
            <>
              <SheetHeader className="border-b border-border px-4 py-4 text-left sm:px-6">
                <SheetTitle className="text-base">{entryRef.point.name?.trim() || entryRef.point.id}</SheetTitle>
                <SheetDescription>
                  {entryRef.dealer.name?.trim() || entryRef.dealer.id}
                  {entryRef.point.city ? ` · ${entryRef.point.city}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                <DistributionTradePointMatrixEntry
                  dealer={entryRef.dealer}
                  point={entryRef.point}
                  profile={profile}
                  actorUserId={actorUserId}
                  actorName={actorName}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
