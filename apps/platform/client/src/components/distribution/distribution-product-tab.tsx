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
  buildProductLevelRows,
  buildProductTradePointRows,
  getProductDrilldownLevel,
  parentProductDrilldownPath,
  productDrilldownLevelLabel,
  productDrilldownPathForCrumbIndex,
  type ProductDrilldownPath,
  type ProductTradePointDrilldownRef,
} from "@/lib/distribution-product-drilldown";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import { collectScopeTradePoints, type DistributionScope, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";
import { cn } from "@/lib/utils";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionProductTabProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
  profile: ReleaseDemoProfile;
};

function statusBadgeClass(status: ShowcaseMatrixStatus | null): string {
  if (status === "installed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "need_install") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "postponed") return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  return "border-border bg-muted/30 text-muted-foreground";
}

function modelStatusLabel(status: ShowcaseMatrixStatus | null): string {
  if (!status) return statusLabelRu("need_install");
  return statusLabelRu(status as ShowcaseMatrixStatusId);
}

export function DistributionProductTab({ scope, filter, profile }: DistributionProductTabProps) {
  const { user } = useCurrentUser();
  const { snapshot } = useDistributionAnalytics(scope);
  const [path, setPath] = useState<ProductDrilldownPath>({});
  const [entryRef, setEntryRef] = useState<ScopeTradePointRef | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const ctxBuilder = useMemo(() => createFilteredMetricsContextBuilder(filter), [filter]);
  const level = getProductDrilldownLevel(path);

  const rows = useMemo(() => {
    switch (level) {
      case "products":
        return buildProductLevelRows(refs, ctxBuilder);
      case "tradePoints":
        return buildProductTradePointRows(refs, ctxBuilder, path.targetId!);
      default:
        return [];
    }
  }, [refs, ctxBuilder, level, path, snapshot]);

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const openEntryForRef = useCallback((ref: ScopeTradePointRef) => {
    setEntryRef(ref);
    setEntryOpen(true);
  }, []);

  const handleDrill = useCallback((row: DistributionAnalyticsRow<unknown>) => {
    if (level !== "products") return;
    const group = row.drilldownRef as { targetId: string };
    setPath({
      targetId: group.targetId,
      productName: row.label,
    });
  }, [level]);

  const handleBack = () => {
    setPath((p) => parentProductDrilldownPath(p));
  };

  const crumbs: { label: string; index: number }[] = useMemo(() => {
    const items: { label: string; index: number }[] = [{ label: "Продукты", index: 0 }];
    if (path.targetId) {
      items.push({ label: path.productName ?? path.targetId, index: 1 });
    }
    return items;
  }, [path]);

  const renderLabelAddon = useCallback(
    (row: DistributionAnalyticsRow<unknown>): ReactNode => {
      if (level !== "tradePoints") return null;
      const { ref, modelStatus } = row.drilldownRef as ProductTradePointDrilldownRef;
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("text-xs font-normal", statusBadgeClass(modelStatus))}>
            {modelStatusLabel(modelStatus)}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            data-testid={`btn-product-entry-${ref.point.id}`}
            onClick={(e) => {
              e.stopPropagation();
              openEntryForRef(ref);
            }}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden />
            Ввод
          </Button>
        </span>
      );
    },
    [level, openEntryForRef],
  );

  const canGoBack = level !== "products";
  const onDrill = level === "products" ? handleDrill : undefined;

  return (
    <>
      <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-product-tab">
        <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Разрез по продукту</CardTitle>
            {canGoBack ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack} data-testid="product-drilldown-back">
                Назад
              </Button>
            ) : null}
          </div>
          <nav
            className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            aria-label="Навигация по разрезу"
            data-testid="product-drilldown-breadcrumbs"
          >
            {crumbs.map((crumb, i) => (
              <span key={crumb.index} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {i < crumbs.length - 1 ? (
                  <button
                    type="button"
                    className="hover:text-foreground underline-offset-2 hover:underline"
                    onClick={() => setPath(productDrilldownPathForCrumbIndex(path, crumb.index))}
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
            levelLabel={productDrilldownLevelLabel(level)}
            onDrill={onDrill}
            renderLabelAddon={level === "tradePoints" ? renderLabelAddon : undefined}
          />
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
          data-testid="sheet-product-tradepoint-entry"
        >
          {entryRef ? (
            <>
              <SheetHeader className="border-b border-border px-4 py-4 text-left sm:px-6">
                <SheetTitle className="text-base">{entryRef.point.name?.trim() || entryRef.point.id}</SheetTitle>
                <SheetDescription>
                  {entryRef.dealer.name?.trim() || entryRef.dealer.id}
                  {path.productName ? ` · ${path.productName}` : ""}
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
