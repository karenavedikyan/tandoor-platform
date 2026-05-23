import type { SalesPlanFactLine, SalesPlanFactLineStatus, SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";
import { upsertSalesPlanFactLine } from "@/lib/sales-plan-fact-types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `spf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function findLine(
  state: SalesPlanFactPersistedState,
  pred: (l: SalesPlanFactLine) => boolean,
): SalesPlanFactLine | undefined {
  return state.lines.find(pred);
}

export function upsertTeamPlanMetrics(
  prev: SalesPlanFactPersistedState,
  args: {
    periodId: string;
    teamId: string;
    metricPlans: Record<string, number>;
    actorId: string;
    status: SalesPlanFactLineStatus;
    comment?: string;
  },
): SalesPlanFactPersistedState {
  let next = prev;
  const now = new Date().toISOString();
  for (const [metricId, planValue] of Object.entries(args.metricPlans)) {
    const existing = findLine(
      next,
      (l) =>
        l.periodId === args.periodId &&
        l.teamId === args.teamId &&
        l.rollup === "team" &&
        l.metricId === metricId &&
        l.managerId === null,
    );
    const line: SalesPlanFactLine = {
      id: existing?.id ?? newId(),
      periodId: args.periodId,
      metricId,
      teamId: args.teamId,
      managerId: null,
      cityKey: null,
      cityName: null,
      productId: null,
      productName: null,
      rollup: "team",
      planValue: Number.isFinite(planValue) ? planValue : 0,
      actualValue: null,
      status: args.status,
      createdBy: existing?.createdBy ?? args.actorId,
      updatedBy: args.actorId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      comment: args.comment ?? existing?.comment ?? "",
    };
    next = upsertSalesPlanFactLine(next, line);
  }
  return next;
}

export function upsertManagerMetricLine(
  prev: SalesPlanFactPersistedState,
  args: {
    periodId: string;
    teamId: string;
    managerId: string;
    metricId: string;
    planValue: number;
    actualValue: number | null;
    status: SalesPlanFactLineStatus;
    actorId: string;
    comment?: string;
  },
): SalesPlanFactPersistedState {
  const now = new Date().toISOString();
  const existing = findLine(
    prev,
    (l) =>
      l.periodId === args.periodId &&
      l.teamId === args.teamId &&
      l.managerId === args.managerId &&
      l.metricId === args.metricId &&
      l.rollup === "manager",
  );
  const line: SalesPlanFactLine = {
    id: existing?.id ?? newId(),
    periodId: args.periodId,
    metricId: args.metricId,
    teamId: args.teamId,
    managerId: args.managerId,
    cityKey: null,
    cityName: null,
    productId: null,
    productName: null,
    rollup: "manager",
    planValue: Number.isFinite(args.planValue) ? args.planValue : 0,
    actualValue: args.actualValue === null || args.actualValue === undefined ? null : args.actualValue,
    status: args.status,
    createdBy: existing?.createdBy ?? args.actorId,
    updatedBy: args.actorId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    comment: args.comment ?? existing?.comment ?? "",
  };
  return upsertSalesPlanFactLine(prev, line);
}
