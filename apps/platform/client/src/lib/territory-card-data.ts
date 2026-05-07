/**
 * Агрегаты для операционной «Карточки территории» поверх существующих обезличенных данных.
 * Без дублирования крупных массивов — только вычисления и склейка.
 */

import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { getAllOrders, orderNeedsManagerAttention, type OrderRow } from "@/lib/order-data";
import { getAllMatrixTasks, type MatrixTaskWithContext } from "@/lib/trade-point-task-data";
import {
  getCityAnalyticsRows,
  getSalesPlanMetrics,
  getTerritoryAnalytics,
  planCompletionPercent,
  remainingToPlan,
  type CityAnalytics,
} from "@/lib/sales-manager-kpi-data";

/** Территория по умолчанию для карточки (совпадает с аналитикой «Юг»). */
export const TERRITORY_CARD_SCOPE_ID = "south";

export type TerritoryCitySummary = {
  id: string;
  name: string;
  dealersCount: number;
  activeDealersCount: number;
  topDealersCount: number;
  attentionDealersCount: number;
  tradePointsCount: number;
  ordersCount: number;
  tasksCount: number;
  mkPlanUnits: number;
  mkFactUnits: number;
  vhPlanUnits: number;
  vhFactUnits: number;
  hardwarePlanMoney: number;
  hardwareFactMoney: number;
};

export type TerritoryRiskItem = {
  id: string;
  title: string;
  level: "critical" | "attention" | "normal";
  city: string;
  dealerId?: string;
  tradePointId?: string;
  reason: string;
  nextAction: string;
};

export type TerritoryFocusItem = {
  id: string;
  title: string;
  type: "dealer" | "trade_point" | "product" | "showcase" | "order" | "task";
  description: string;
  href: string;
};

export type TerritoryOperationalSummary = {
  territoryId: string;
  territoryLabel: string;
  dealersTotal: number;
  dealersActive: number;
  tradePointsTotal: number;
  ordersInProgress: number;
  tasksOpen: number;
  showcaseFollowUps: number;
  attentionSignals: number;
};

export type TerritoryPlanLine = {
  key: "mk" | "vh" | "hardware";
  label: string;
  unitLabel: string;
  plan: number;
  fact: number;
  completionPercent: number;
  remainder: number;
};

export type TerritoryTradePointCard = {
  pointId: string;
  dealerId: string;
  dealerLabel: string;
  city: string;
  pointLabel: string;
  status: string;
  matrixPercent: number;
  showcaseLine: string;
  lastActivity: string;
  issuesShort: string;
};

export type TerritoryShowcaseItem = {
  id: string;
  tradePointId: string;
  dealerId: string;
  city: string;
  headline: string;
  statusLine: string;
};

const IN_PROGRESS_ORDER: OrderRow["status"][] = [
  "новый",
  "на подтверждении",
  "подтверждён",
  "в комплектации",
  "частично укомплектован",
];

function slugCity(name: string): string {
  const known: Record<string, string> = {
    Ставрополь: "stavropol",
    Астрахань: "astrakhan",
  };
  if (known[name]) return known[name];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `city-${Math.abs(h)}`;
}

function ordersForDealers(ids: Set<string>): OrderRow[] {
  return getAllOrders().filter((o) => ids.has(o.dealerId));
}

function matrixTasksForDealers(ids: Set<string>): MatrixTaskWithContext[] {
  return getAllMatrixTasks().filter((t) => ids.has(t.dealerId));
}

function aggregateDealersForCity(cityName: string, dealers: DealerRow[]) {
  const ids = new Set(dealers.map((d) => d.id));
  const orders = ordersForDealers(ids);
  const tasks = matrixTasksForDealers(ids);
  return {
    dealersCount: dealers.length,
    activeDealersCount: dealers.filter((d) => d.status === "активный").length,
    topDealersCount: dealers.filter((d) => d.category === "TOP").length,
    attentionDealersCount: dealers.filter((d) => d.status === "требует внимания" || d.hasProblem).length,
    tradePointsCount: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersCount: orders.length,
    tasksCount: tasks.length,
  };
}

function buildCityFromKpi(row: CityAnalytics, dealers: DealerRow[]): TerritoryCitySummary {
  const agg = aggregateDealersForCity(row.name, dealers);
  const mkPlan = Math.max(row.mkUnits, Math.round(row.mkUnits * 1.08));
  const vhPlan = Math.max(row.vhUnits, Math.round(row.vhUnits * 1.1));
  const hwPlan = Math.max(row.hardwareTurnoverRub, Math.round(row.hardwareTurnoverRub * 1.1));
  return {
    id: row.cityId,
    name: row.name,
    ...agg,
    mkPlanUnits: mkPlan,
    mkFactUnits: row.mkUnits,
    vhPlanUnits: vhPlan,
    vhFactUnits: row.vhUnits,
    hardwarePlanMoney: hwPlan,
    hardwareFactMoney: row.hardwareTurnoverRub,
  };
}

function buildCityFromDealersOnly(cityName: string): TerritoryCitySummary {
  const dealers = DEALER_BASE_ROWS.filter((d) => d.city === cityName);
  const agg = aggregateDealersForCity(cityName, dealers);
  const avgMk = dealers.length ? Math.round(dealers.reduce((s, d) => s + d.distributionDetail.mk, 0) / dealers.length) : 0;
  const avgVh = dealers.length ? Math.round(dealers.reduce((s, d) => s + d.distributionDetail.vh, 0) / dealers.length) : 0;
  const mkFact = Math.max(40, Math.round(avgMk * 2.4));
  const vhFact = Math.max(35, Math.round(avgVh * 2.1));
  const hwFact = Math.max(800_000, dealers.length * 620_000 + (cityName.length % 7) * 120_000);
  return {
    id: slugCity(cityName),
    name: cityName,
    ...agg,
    mkPlanUnits: Math.round(mkFact * 1.1),
    mkFactUnits: mkFact,
    vhPlanUnits: Math.round(vhFact * 1.12),
    vhFactUnits: vhFact,
    hardwarePlanMoney: Math.round(hwFact * 1.09),
    hardwareFactMoney: hwFact,
  };
}

export function getTerritorySummary(): TerritoryOperationalSummary {
  const territory = getTerritoryAnalytics(TERRITORY_CARD_SCOPE_ID);
  const dealers = DEALER_BASE_ROWS;
  const orders = getAllOrders();
  const matrixTasks = getAllMatrixTasks();

  const ordersInProgress = orders.filter((o) => IN_PROGRESS_ORDER.includes(o.status)).length;
  const tasksOpen = matrixTasks.filter((t) => t.status !== "done").length;

  const showcaseFollowUps = dealers.reduce((sum, d) => {
    return (
      sum +
      d.tradePoints.filter((p) => p.distribution.total < 72 || p.issues.includes("витрин")).length
    );
  }, 0);

  const attentionSignals =
    dealers.filter((d) => d.hasProblem || d.status === "требует внимания").length +
    matrixTasks.filter((t) => t.status === "overdue").length +
    orders.filter((o) => orderNeedsManagerAttention(o)).length;

  return {
    territoryId: territory.territoryId,
    territoryLabel: territory.territoryLabel,
    dealersTotal: dealers.length,
    dealersActive: dealers.filter((d) => d.status === "активный").length,
    tradePointsTotal: dealers.reduce((s, d) => s + d.tradePoints.length, 0),
    ordersInProgress,
    tasksOpen,
    showcaseFollowUps,
    attentionSignals,
  };
}

export function getTerritoryCities(): TerritoryCitySummary[] {
  const kpiNames = new Set(getCityAnalyticsRows("all").map((c) => c.name));
  const list: TerritoryCitySummary[] = [];
  for (const row of getCityAnalyticsRows("all")) {
    const dealers = DEALER_BASE_ROWS.filter((d) => d.city === row.name);
    list.push(buildCityFromKpi(row, dealers));
  }
  const extraCityNames = Array.from(new Set(DEALER_BASE_ROWS.map((d) => d.city))).filter((n) => !kpiNames.has(n));
  for (const name of extraCityNames) {
    list.push(buildCityFromDealersOnly(name));
  }
  return list.sort((a, b) => b.dealersCount - a.dealersCount);
}

export function getTerritoryRisks(): TerritoryRiskItem[] {
  const risks: TerritoryRiskItem[] = [];
  let n = 0;
  const mkMetric = getSalesPlanMetrics().find((m) => m.category === "mk");
  if (mkMetric && mkMetric.monthFact < mkMetric.monthPlan * 0.92) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: "Отставание по МК от месячного плана",
      level: "attention",
      city: "Территория",
      reason: "Факт ниже плана более чем на 8% при активных заказах в работе.",
      nextAction: "Согласовать отгрузки с клиентами в фокусе и проверить незакрытые строки заказов.",
    });
  }
  for (const d of DEALER_BASE_ROWS.filter((x) => x.hasProblem).slice(0, 3)) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: `Клиент №${d.id}: витрина и поставки`,
      level: "attention",
      city: d.city,
      dealerId: d.id,
      reason: "Зафиксированы замечания по витрине или циклу поставок.",
      nextAction: d.nextAction,
    });
  }
  const overdue = getAllMatrixTasks().filter((t) => t.status === "overdue").slice(0, 2);
  for (const t of overdue) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: t.title,
      level: "critical",
      city: dCityFromPoint(t) || "—",
      dealerId: t.dealerId,
      tradePointId: t.tradePointId,
      reason: "Задача по матрице просрочена относительно срока визита.",
      nextAction: "Назначить визит или закрыть задачу после факта выкладки.",
    });
  }
  const stuck = getAllOrders().filter((o) => o.status === "на подтверждении").slice(0, 2);
  for (const o of stuck) {
    n += 1;
    risks.push({
      id: `risk-${n}`,
      title: `Заказ ${o.number} без движения`,
      level: "normal",
      city: o.warehouseCity,
      dealerId: o.dealerId,
      reason: "Долгое ожидание подтверждения со стороны клиента.",
      nextAction: o.nextAction,
    });
  }
  return risks.slice(0, 8);
}

function dCityFromPoint(t: MatrixTaskWithContext): string {
  const d = DEALER_BASE_ROWS.find((x) => x.id === t.dealerId);
  return d?.city ?? "";
}

export function getTerritoryFocusItems(): TerritoryFocusItem[] {
  const dealers = [...DEALER_BASE_ROWS].sort((a, b) => {
    const score = (x: DealerRow) => (x.hasProblem ? 4 : 0) + (x.status === "требует внимания" ? 3 : 0) + (x.category === "TOP" ? 2 : 0);
    return score(b) - score(a);
  });
  return dealers.slice(0, 8).map((d) => ({
    id: `focus-dealer-${d.id}`,
    title: d.name,
    type: "dealer" as const,
    description: `${d.city} · ${d.nextAction}`,
    href: `/dealers/${d.id}`,
  }));
}

export function getTerritoryRecentOrders(limit = 8): OrderRow[] {
  const pool = [...getAllOrders()].sort((a, b) => {
    const aw = orderNeedsManagerAttention(a) ? 1 : 0;
    const bw = orderNeedsManagerAttention(b) ? 1 : 0;
    if (bw !== aw) return bw - aw;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return pool.slice(0, limit);
}

export function getTerritoryTasks(limit = 10): MatrixTaskWithContext[] {
  const pool = [...getAllMatrixTasks()].sort((a, b) => {
    const rank = (t: MatrixTaskWithContext) =>
      (t.status === "overdue" ? 4 : 0) + (t.priority === "high" ? 2 : 0) + (t.status === "new" ? 1 : 0);
    return rank(b) - rank(a);
  });
  return pool.slice(0, limit);
}

export function getTerritoryTradePoints(limit = 12): TerritoryTradePointCard[] {
  const out: TerritoryTradePointCard[] = [];
  for (const d of DEALER_BASE_ROWS) {
    for (const p of d.tradePoints) {
      out.push({
        pointId: p.id,
        dealerId: d.id,
        dealerLabel: `Клиент №${d.id}`,
        city: p.city,
        pointLabel: p.name,
        status: p.status,
        matrixPercent: p.distribution.total,
        showcaseLine: p.showcaseStatus,
        lastActivity: p.activityHistory[0]?.date ?? p.lastVisitDate,
        issuesShort: p.issues.length > 72 ? `${p.issues.slice(0, 69)}…` : p.issues,
      });
    }
  }
  return out
    .sort((a, b) => a.matrixPercent - b.matrixPercent || (a.issuesShort.includes("Требуется") ? -1 : 0))
    .slice(0, limit);
}

export function getTerritoryShowcases(): TerritoryShowcaseItem[] {
  return getTerritoryTradePoints(16).map((tp, i) => ({
    id: `showcase-${tp.pointId}-${i}`,
    tradePointId: tp.pointId,
    dealerId: tp.dealerId,
    city: tp.city,
    headline: `${tp.pointLabel} · ${tp.dealerLabel}`,
    statusLine: tp.showcaseLine,
  }));
}

export function getTerritoryPlanLines(): TerritoryPlanLine[] {
  const metrics = getSalesPlanMetrics();
  return metrics.map((m) => ({
    key: m.category,
    label: m.label,
    unitLabel: m.unit === "units" ? "шт." : "₽",
    plan: m.monthPlan,
    fact: m.monthFact,
    completionPercent: planCompletionPercent(m.monthPlan, m.monthFact),
    remainder: remainingToPlan(m.monthPlan, m.monthFact),
  }));
}
