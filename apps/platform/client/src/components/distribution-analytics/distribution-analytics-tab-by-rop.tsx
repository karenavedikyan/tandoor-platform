import { useMemo, useState, type ReactElement } from "react";
import { mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerManagerDisplay, getDealerRopDisplay } from "@/lib/dealer-base-mock-data";
import { DistributionBreakdownRow } from "@/components/distribution-analytics/distribution-breakdown-row";

type RopGroup = {
  ropName: string;
  tradePointIds: string[];
  managers: { managerName: string; tradePointIds: string[] }[];
};

type Props = {
  scopedDealers: DealerRow[];
  act: ActualizationState;
};

function collectTradePointIds(rows: readonly DealerRow[], act: ActualizationState): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    for (const e of mergeTradePointsForActualization(row, act)) {
      if (!e.isArchived) ids.push(e.point.id);
    }
  }
  return ids;
}

function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-яё0-9-]/gi, "");
}

export function DistributionAnalyticsTabByRop({ scopedDealers, act }: Props): ReactElement {
  const [expandedRops, setExpandedRops] = useState<Set<string>>(() => new Set());

  const ropGroups = useMemo((): RopGroup[] => {
    const byRop = new Map<string, DealerRow[]>();
    for (const row of scopedDealers) {
      const key = getDealerRopDisplay(row).trim() || "Без РОПа";
      const arr = byRop.get(key);
      if (arr) arr.push(row);
      else byRop.set(key, [row]);
    }

    const groups: RopGroup[] = [];
    for (const [ropName, rows] of Array.from(byRop.entries())) {
      const tradePointIds = collectTradePointIds(rows, act);
      if (tradePointIds.length === 0) continue;

      const byManager = new Map<string, DealerRow[]>();
      for (const row of rows) {
        const managerKey = getDealerManagerDisplay(row).trim() || "Без менеджера";
        const managerRows = byManager.get(managerKey);
        if (managerRows) managerRows.push(row);
        else byManager.set(managerKey, [row]);
      }

      const managers = Array.from(byManager.entries())
        .map(([managerName, managerDealerRows]) => ({
          managerName,
          tradePointIds: collectTradePointIds(managerDealerRows, act),
        }))
        .filter((m) => m.tradePointIds.length > 0)
        .sort(
          (a, b) =>
            b.tradePointIds.length - a.tradePointIds.length ||
            a.managerName.localeCompare(b.managerName, "ru"),
        );

      groups.push({ ropName, tradePointIds, managers });
    }

    return groups.sort(
      (a, b) =>
        b.tradePointIds.length - a.tradePointIds.length || a.ropName.localeCompare(b.ropName, "ru"),
    );
  }, [scopedDealers, act]);

  const toggleRop = (ropName: string) => {
    setExpandedRops((prev) => {
      const next = new Set(prev);
      if (next.has(ropName)) next.delete(ropName);
      else next.add(ropName);
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
            const slug = slugifyLabel(group.ropName);
            const expanded = expandedRops.has(group.ropName);
            return (
              <div key={group.ropName} className="space-y-2">
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-sm text-muted-foreground"
                    aria-expanded={expanded}
                    aria-label={expanded ? `Свернуть ${group.ropName}` : `Развернуть ${group.ropName}`}
                    onClick={() => toggleRop(group.ropName)}
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                  <div className="min-w-0 flex-1">
                    <DistributionBreakdownRow
                      label={group.ropName}
                      tradePointIds={group.tradePointIds}
                      act={act}
                      testId={`row-director-rop-distribution-${slug}`}
                    />
                  </div>
                </div>
                {expanded ? (
                  <div className="ml-10 grid gap-2 sm:grid-cols-2">
                    {group.managers.map((manager) => (
                      <DistributionBreakdownRow
                        key={`${group.ropName}:${manager.managerName}`}
                        label={manager.managerName}
                        tradePointIds={manager.tradePointIds}
                        act={act}
                        testId={`row-director-rop-${slug}-manager-${slugifyLabel(manager.managerName)}`}
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
