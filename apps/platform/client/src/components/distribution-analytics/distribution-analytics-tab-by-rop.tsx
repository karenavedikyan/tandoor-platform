import { useMemo, useState, type ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildRopGroups,
} from "@/lib/distribution-analytics/distribution-analytics-rop-groups";
import { useOrgSnapshot } from "@/lib/use-org-snapshot";
import { DistributionBreakdownRow } from "@/components/distribution-analytics/distribution-breakdown-row";

type Props = {
  scopedDealers: DealerRow[];
  act: ActualizationState;
};

export function DistributionAnalyticsTabByRop({ scopedDealers, act }: Props): ReactElement {
  const orgSnapQ = useOrgSnapshot();
  const snap = orgSnapQ.data ?? null;
  const [expandedRops, setExpandedRops] = useState<Set<string>>(() => new Set());

  const ropGroups = useMemo(
    () => buildRopGroups(scopedDealers, snap, act),
    [scopedDealers, snap, act],
  );

  const toggleRop = (ropId: string) => {
    setExpandedRops((prev) => {
      const next = new Set(prev);
      if (next.has(ropId)) next.delete(ropId);
      else next.add(ropId);
      return next;
    });
  };

  return (
    <section className="space-y-3" data-testid="section-director-distribution-by-rop">
      <h2 className="text-sm font-semibold text-foreground">Дистрибуция по РОПам</h2>
      {ropGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет данных по РОПам в текущем scope.</p>
      ) : (
        <div className="space-y-2">
          {ropGroups.map((group) => {
            const expanded = expandedRops.has(group.ropId);
            const canExpand = !group.isUnassigned && group.managers.length > 0;
            return (
              <div key={group.ropId} className="space-y-2">
                <div className="flex items-stretch gap-2">
                  {canExpand ? (
                    <button
                      type="button"
                      className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-sm text-muted-foreground"
                      aria-expanded={expanded}
                      aria-label={expanded ? `Свернуть ${group.ropName}` : `Развернуть ${group.ropName}`}
                      onClick={() => toggleRop(group.ropId)}
                    >
                      {expanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <div className="w-8 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <DistributionBreakdownRow
                      label={group.ropName}
                      tradePointIds={group.tradePointIds}
                      act={act}
                      testId={`row-director-rop-distribution-${group.ropId}`}
                    />
                  </div>
                </div>
                {expanded && canExpand ? (
                  <div className="ml-10 grid gap-2 sm:grid-cols-2">
                    {group.managers.map((manager) => (
                      <DistributionBreakdownRow
                        key={`${group.ropId}:${manager.managerId}`}
                        label={manager.managerName}
                        tradePointIds={manager.tradePointIds}
                        act={act}
                        testId={`row-director-rop-${group.ropId}-manager-${manager.managerId}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
