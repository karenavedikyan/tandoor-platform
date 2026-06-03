import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, ChevronRight, ExternalLink, PencilLine } from "lucide-react";
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
import type { DeficitPositionItem, DistributionAnalyticsRow } from "@/lib/distribution-analytics";
import { useDistributionAnalytics } from "@/lib/distribution-analytics-store";
import {
  buildDeficitGroupsByTradePoint,
  buildTradePointLevelRows,
  buildTradePointModelRows,
  getTradePointDrilldownLevel,
  parentTradePointDrilldownPath,
  tradePointDrilldownLevelLabel,
  tradePointDrilldownPathForCrumbIndex,
  type TradePointDeficitGroup,
  type TradePointDrilldownPath,
} from "@/lib/distribution-tradepoint-drilldown";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import { collectScopeTradePoints, type DistributionScope, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import {
  getShowcaseMatrixDeficitTasksForTradePoint,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
} from "@/lib/trade-point-task-data";
import { statusLabelRu, type ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";
import { cn } from "@/lib/utils";
import { useCurrentUser, displayUserName } from "@/hooks/use-current-user";

type DistributionTradePointTabProps = {
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

function deficitItemStatusLabel(status: ShowcaseMatrixStatus | null): string {
  if (!status) return statusLabelRu("need_install");
  return statusLabelRu(status as ShowcaseMatrixStatusId);
}

function deficitItemStatusClass(status: ShowcaseMatrixStatus | null): string {
  if (status === "installed") return statusBadgeClass("installed");
  if (status === "postponed") return statusBadgeClass("postponed");
  if (status === "not_relevant") return statusBadgeClass("not_relevant");
  return statusBadgeClass("need_install");
}

type TradePointDeficitPanelProps = {
  group: TradePointDeficitGroup;
  refForTp: ScopeTradePointRef;
  onEnterFact: (ref: ScopeTradePointRef) => void;
};

function TradePointDeficitPanel({ group, refForTp, onEnterFact }: TradePointDeficitPanelProps) {
  const autoTasks = useMemo(
    () => getShowcaseMatrixDeficitTasksForTradePoint(refForTp.dealer, refForTp.point.id),
    [refForTp.dealer, refForTp.point.id],
  );

  return (
    <Card
      className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-none"
      data-testid={`panel-tp-deficit-${group.tradePointId}`}
    >
      <CardHeader className="space-y-1 px-4 py-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-800 dark:text-amber-200" aria-hidden />
          Дефицит по точке
          <Badge variant="outline" className="tabular-nums">
            {group.deficitCount}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {group.dealerName} · закрытие — ввод факта по матрице
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <ul className="space-y-2" data-testid={`list-tp-deficit-positions-${group.tradePointId}`}>
          {group.items.map((item) => (
            <DeficitPositionRow key={`${item.tradePointId}-${item.targetId}`} item={item} onEnterFact={() => onEnterFact(refForTp)} />
          ))}
        </ul>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">Связанные авто-задачи</p>
          {autoTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Авто-задачи появятся при незакрытом дефиците</p>
          ) : (
            <ul className="space-y-2" data-testid={`list-tp-deficit-tasks-${group.tradePointId}`}>
              {autoTasks.map((task) => (
                <li
                  key={task.taskId}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <p className="font-medium text-foreground">{task.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {MATRIX_TASK_TYPE_LABEL[task.type]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {MATRIX_TASK_STATUS_LABEL[task.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="default" onClick={() => onEnterFact(refForTp)}>
            <PencilLine className="mr-2 h-4 w-4" aria-hidden />
            Ввести факт
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/tasks" data-testid={`link-tp-deficit-tasks-${group.tradePointId}`}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Открыть в задачах
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeficitPositionRow({
  item,
  onEnterFact,
}: {
  item: DeficitPositionItem;
  onEnterFact: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{item.productName}</p>
        <Badge variant="outline" className={cn("text-[10px] font-normal", deficitItemStatusClass(item.status))}>
          {deficitItemStatusLabel(item.status)}
        </Badge>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onEnterFact}>
          Ввести факт
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" asChild>
          <Link href="/tasks">Открыть в задачах</Link>
        </Button>
      </div>
    </li>
  );
}

export function DistributionTradePointTab({ scope, filter, profile }: DistributionTradePointTabProps) {
  const { user } = useCurrentUser();
  const { snapshot } = useDistributionAnalytics(scope);
  const [path, setPath] = useState<TradePointDrilldownPath>({});
  const [entryRef, setEntryRef] = useState<ScopeTradePointRef | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [deficitTpId, setDeficitTpId] = useState<string | null>(null);

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const ctxBuilder = useMemo(() => createFilteredMetricsContextBuilder(filter), [filter]);
  const level = getTradePointDrilldownLevel(path);

  const deficitGroups = useMemo(
    () => buildDeficitGroupsByTradePoint(refs, ctxBuilder),
    [refs, ctxBuilder, snapshot],
  );

  const deficitByTpId = useMemo(() => {
    const map = new Map<string, TradePointDeficitGroup>();
    for (const g of deficitGroups) map.set(g.tradePointId, g);
    return map;
  }, [deficitGroups]);

  const rows = useMemo(() => {
    switch (level) {
      case "tradePoints":
        return buildTradePointLevelRows(refs, ctxBuilder);
      case "models":
        return buildTradePointModelRows(refs, ctxBuilder, path.tradePointId!);
      default:
        return [];
    }
  }, [refs, ctxBuilder, level, path, snapshot]);

  const tradePointRef = useMemo(() => {
    if (!path.tradePointId) return null;
    return refs.find((r) => r.point.id === path.tradePointId) ?? null;
  }, [refs, path.tradePointId]);

  const deficitPanelRef = useMemo(() => {
    if (!deficitTpId) return null;
    return refs.find((r) => r.point.id === deficitTpId) ?? null;
  }, [refs, deficitTpId]);

  const actorUserId = user?.id ?? profile.personaUserId;
  const actorName = (user ? displayUserName(user) : null) ?? userLabelFromProfile(profile);

  const openEntryForRef = useCallback((ref: ScopeTradePointRef) => {
    setEntryRef(ref);
    setEntryOpen(true);
  }, []);

  const handleDrill = useCallback(
    (row: DistributionAnalyticsRow<unknown>) => {
      if (level === "tradePoints") {
        const ref = row.drilldownRef as ScopeTradePointRef;
        setPath({
          tradePointId: ref.point.id,
          tradePointName: row.label,
        });
        setDeficitTpId(null);
      }
    },
    [level],
  );

  const handleBack = () => {
    setPath((p) => parentTradePointDrilldownPath(p));
    setDeficitTpId(null);
  };

  const crumbs: { label: string; index: number }[] = useMemo(() => {
    const items: { label: string; index: number }[] = [{ label: "Торговые точки", index: 0 }];
    if (path.tradePointId) {
      items.push({ label: path.tradePointName ?? path.tradePointId, index: 1 });
    }
    return items;
  }, [path]);

  const renderLabelAddon = useCallback(
    (row: DistributionAnalyticsRow<unknown>): ReactNode => {
      if (level === "tradePoints") {
        const ref = row.drilldownRef as ScopeTradePointRef;
        const deficitCount = deficitByTpId.get(ref.point.id)?.deficitCount ?? 0;
        const deficitOpen = deficitTpId === ref.point.id;
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={deficitOpen ? "secondary" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={deficitCount === 0}
              data-testid={`btn-tp-deficit-${ref.point.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setDeficitTpId((prev) => (prev === ref.point.id ? null : ref.point.id));
              }}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden />
              Дефицит ({deficitCount})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              data-testid={`btn-tp-entry-${ref.point.id}`}
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
    [level, deficitByTpId, deficitTpId, openEntryForRef, tradePointRef, ctxBuilder],
  );

  const canGoBack = level !== "tradePoints";
  const onDrill = level === "models" ? undefined : handleDrill;
  const deficitGroup = deficitPanelRef ? deficitByTpId.get(deficitPanelRef.point.id) : null;

  return (
    <>
      <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-tradepoint-tab">
        <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Разрез по торговой точке</CardTitle>
            {canGoBack ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack} data-testid="tp-drilldown-back">
                Назад
              </Button>
            ) : null}
          </div>
          <nav
            className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            aria-label="Навигация по разрезу"
            data-testid="tp-drilldown-breadcrumbs"
          >
            {crumbs.map((crumb, i) => (
              <span key={crumb.index} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0" aria-hidden /> : null}
                {i < crumbs.length - 1 ? (
                  <button
                    type="button"
                    className="hover:text-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setPath(tradePointDrilldownPathForCrumbIndex(path, crumb.index));
                      setDeficitTpId(null);
                    }}
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
            levelLabel={tradePointDrilldownLevelLabel(level)}
            onDrill={onDrill}
            renderLabelAddon={level === "tradePoints" || level === "models" ? renderLabelAddon : undefined}
          />

          {level === "tradePoints" && deficitGroup && deficitPanelRef ? (
            <TradePointDeficitPanel
              group={deficitGroup}
              refForTp={deficitPanelRef}
              onEnterFact={openEntryForRef}
            />
          ) : null}

          {level === "models" && tradePointRef ? (
            <div className="mt-3 flex justify-center px-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="btn-tp-entry-models-level"
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
          data-testid="sheet-tp-tradepoint-entry"
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
