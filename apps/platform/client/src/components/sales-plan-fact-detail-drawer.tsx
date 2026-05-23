import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getSalesUserById, getTeamManagers, SALES_KPI_METRICS_SORTED, type SalesRole, type SalesUser } from "@/lib/sales-control-data";
import type { SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";
import {
  buildCityRows,
  buildProductRows,
  formatPlanFactValue,
  inScopeManager,
} from "@/lib/sales-plan-fact-management-view-model";

export type SalesPlanFactDetailTarget =
  | { kind: "rop"; teamId: string }
  | { kind: "manager"; teamId: string; managerId: string }
  | { kind: "city"; cityKey: string }
  | { kind: "product"; productId: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: SalesPlanFactDetailTarget | null;
  periodId: string;
  state: SalesPlanFactPersistedState;
  dealers: DealerRow[];
  role: SalesRole;
  persona: SalesUser;
  directorTeamFilter: string | null;
};

export function SalesPlanFactDetailDrawer({
  open,
  onOpenChange,
  target,
  periodId,
  state,
  dealers,
  role,
  persona,
  directorTeamFilter,
}: Props) {
  const mobile = useIsMobile();
  const opts = useMemo(() => ({ role, persona, directorTeamFilter }), [role, persona, directorTeamFilter]);

  const title = useMemo(() => {
    if (!target) return "Детали";
    if (target.kind === "rop") return `Команда · ${target.teamId}`;
    if (target.kind === "manager") return getSalesUserById(target.managerId)?.name ?? target.managerId;
    if (target.kind === "city") {
      const rows = buildCityRows(state, periodId, dealers, opts);
      return rows.find((r) => r.cityKey === target.cityKey)?.cityName ?? target.cityKey;
    }
    const pr = buildProductRows(state, periodId, opts).find((r) => r.productId === target.productId);
    return pr?.productName ?? target.productId;
  }, [target, state, periodId, dealers, opts]);

  const lines = useMemo(() => {
    if (!target) return [];
    const L = state.lines.filter((l) => l.periodId === periodId);
    if (target.kind === "rop") return L.filter((l) => l.teamId === target.teamId);
    if (target.kind === "manager")
      return L.filter((l) => l.teamId === target.teamId && l.managerId === target.managerId);
    if (target.kind === "product") return L.filter((l) => l.metricId === target.productId && l.rollup === "manager");
    if (target.kind === "city") {
      const rows = buildCityRows(state, periodId, dealers, opts);
      const row = rows.find((r) => r.cityKey === target.cityKey);
      if (!row) return [];
      const mids = new Set<string>();
      for (const d of dealers) {
        const name = (d.city ?? "").trim() || "Без города";
        const key = name.replace(/\s+/g, "-").replace(/[^\w.-А-Яа-яёЁ]/gi, "").slice(0, 64) || "no-city";
        if (key === target.cityKey && d.releaseManagerId && inScopeManager(d.releaseManagerId, opts)) {
          mids.add(d.releaseManagerId);
        }
      }
      return L.filter((l) => l.managerId && mids.has(l.managerId));
    }
    return [];
  }, [target, state, periodId, dealers, opts]);

  const managersInDetail = useMemo(() => {
    if (!target || target.kind !== "city") return [];
    const ids = new Set(lines.map((l) => l.managerId).filter(Boolean) as string[]);
    return Array.from(ids)
      .map((id) => getSalesUserById(id))
      .filter(Boolean) as SalesUser[];
  }, [target, lines]);

  const body = (
    <Tabs defaultValue="kpi" className="min-w-0">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-hidden bg-muted/40 p-1">
        <TabsTrigger value="kpi" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-kpi">
          KPI
        </TabsTrigger>
        <TabsTrigger value="managers" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-managers">
          Менеджеры
        </TabsTrigger>
        <TabsTrigger value="cities" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-cities">
          Города
        </TabsTrigger>
        <TabsTrigger value="products" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-products">
          Продукты
        </TabsTrigger>
        <TabsTrigger value="entry" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-entry">
          План/факт
        </TabsTrigger>
        <TabsTrigger value="comments" className="text-xs sm:text-sm" data-testid="tab-sales-plan-fact-detail-comments">
          Комментарии
        </TabsTrigger>
      </TabsList>
      <TabsContent value="kpi" className="mt-3 min-w-0 space-y-2">
        {SALES_KPI_METRICS_SORTED.map((met) => {
          const sub = lines.filter((l) => l.metricId === met.id && l.rollup === "manager");
          const plan = sub.reduce((s, l) => s + l.planValue, 0);
          const hasMiss = sub.some((l) => l.actualValue === null);
          const act = hasMiss ? null : sub.reduce((s, l) => s + (l.actualValue ?? 0), 0);
          return (
            <div key={met.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">{met.label}</p>
              <p className="text-xs text-muted-foreground">
                План: {formatPlanFactValue(met.id, plan)} · Факт:{" "}
                {act === null ? "не внесён" : formatPlanFactValue(met.id, act)}
              </p>
            </div>
          );
        })}
      </TabsContent>
      <TabsContent value="managers" className="mt-3 min-w-0 space-y-2 text-sm">
        {target?.kind === "rop" ? (
          getTeamManagers(target.teamId).map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-2">
              {m.name}
            </div>
          ))
        ) : target?.kind === "city" ? (
          managersInDetail.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-2">
              {m.name}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">Откройте детали команды или города.</p>
        )}
      </TabsContent>
      <TabsContent value="cities" className="mt-3 min-w-0">
        <ul className="space-y-1 text-sm">
          {buildCityRows(state, periodId, dealers, opts)
            .slice(0, 12)
            .map((c) => (
              <li key={c.cityKey} className="flex justify-between gap-2 rounded-md border border-border/80 px-2 py-1.5">
                <span className="min-w-0 truncate">{c.cityName}</span>
                <span className="shrink-0 text-muted-foreground">
                  {c.actual === null ? "факт —" : String(c.actual)}
                </span>
              </li>
            ))}
        </ul>
      </TabsContent>
      <TabsContent value="products" className="mt-3 min-w-0">
        <ul className="space-y-1 text-sm">
          {buildProductRows(state, periodId, opts).map((p) => (
            <li key={p.productId} className="flex justify-between gap-2 rounded-md border border-border/80 px-2 py-1.5">
              <span className="min-w-0 truncate">{p.productName}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{p.plan > 0 ? `${p.plan}` : "—"}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="entry" className="mt-3 min-w-0 space-y-3">
        <p className="text-xs text-muted-foreground">Строки persisted-слоя в текущем контексте.</p>
        <div data-testid="form-sales-plan-fact-plan-entry" className="space-y-1 rounded-lg border border-border p-2">
          {lines
            .filter((l) => l.rollup === "manager")
            .slice(0, 16)
            .map((l) => (
              <div key={l.id} className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{l.metricId}</span>
                <span>
                  план {l.planValue} · факт {l.actualValue === null ? "—" : l.actualValue}
                </span>
              </div>
            ))}
        </div>
      </TabsContent>
      <TabsContent value="comments" className="mt-3 min-w-0 space-y-2 text-sm text-muted-foreground">
        {lines.filter((l) => l.comment.trim()).length === 0 ? (
          <p>Нет комментариев.</p>
        ) : (
          lines
            .filter((l) => l.comment.trim())
            .map((l) => (
              <div key={l.id} className="rounded-md border border-border/80 p-2">
                <p className="text-foreground">{l.comment}</p>
                <p className="text-xs">{new Date(l.updatedAt).toLocaleString("ru-RU")}</p>
              </div>
            ))
        )}
      </TabsContent>
    </Tabs>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-xl border-border" data-testid="dialog-sales-plan-fact-detail">
          <SheetHeader>
            <SheetTitle className="text-left">{title}</SheetTitle>
          </SheetHeader>
          <div className="pb-6 pt-2">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-border bg-card shadow-lg transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      data-testid="dialog-sales-plan-fact-detail"
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Закрыть
        </Button>
      </div>
      <div className="h-[calc(100%-52px)] overflow-y-auto p-4">{body}</div>
    </div>
  );
}
